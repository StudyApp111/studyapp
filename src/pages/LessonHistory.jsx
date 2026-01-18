import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, Calendar, Clock, FileCheck, 
  ArrowRight, Trophy, Layers, ChevronRight, Sparkles,
  GraduationCap, Target, FileText, PenLine
} from "lucide-react";
import { motion } from "framer-motion";

const formatTime = (seconds) => {
  if (!seconds || seconds === 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function LessonHistory() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(console.error);
  }, []);

  const { data: lessons = [], isLoading: lessonsLoading, error: lessonsError } = useQuery({
    queryKey: ['lessons-history'],
    queryFn: async () => {
      const result = await base44.entities.Lesson.list('-created_date', 50);
      return result || [];
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const { data: gradedAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['graded-assignments-history'],
    queryFn: async () => {
      const result = await base44.entities.GradedAssignment.list('-created_date', 50);
      return result || [];
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch exams and flashcards for visible lessons
  const visibleLessonIds = React.useMemo(() => 
    lessons.slice(0, 20).map(l => l.id), 
    [lessons]
  );

  const { data: allExams = [] } = useQuery({
    queryKey: ['exams-history', visibleLessonIds],
    queryFn: async () => {
      if (visibleLessonIds.length === 0) return [];
      const examPromises = visibleLessonIds.map(id =>
        base44.entities.Exam.filter({ lesson_id: id }).catch(() => [])
      );
      return (await Promise.all(examPromises)).flat();
    },
    enabled: visibleLessonIds.length > 0,
    staleTime: 30 * 1000,
  });

  const { data: allFlashcards = [] } = useQuery({
    queryKey: ['flashcards-history', visibleLessonIds],
    queryFn: async () => {
      if (visibleLessonIds.length === 0) return [];
      const flashcardPromises = visibleLessonIds.map(id =>
        base44.entities.Flashcard.filter({ lesson_id: id }).catch(() => [])
      );
      return (await Promise.all(flashcardPromises)).flat();
    },
    enabled: visibleLessonIds.length > 0,
    staleTime: 30 * 1000,
  });

  // Fetch study plans for progress tracking
  const { data: allStudyPlans = [] } = useQuery({
    queryKey: ['study-plans-history', visibleLessonIds],
    queryFn: async () => {
      if (visibleLessonIds.length === 0) return [];
      const planPromises = visibleLessonIds.map(id =>
        base44.entities.StudyPlan.filter({ lesson_id: id }).catch(() => [])
      );
      return (await Promise.all(planPromises)).flat();
    },
    enabled: visibleLessonIds.length > 0,
    staleTime: 30 * 1000,
  });

  const isLoading = lessonsLoading || assignmentsLoading;

  // Group data by lesson
  const lessonExams = {};
  allExams.forEach(e => {
    if (!lessonExams[e.lesson_id]) lessonExams[e.lesson_id] = [];
    lessonExams[e.lesson_id].push(e);
  });

  const lessonFlashcards = {};
  allFlashcards.forEach(f => {
    if (!lessonFlashcards[f.lesson_id]) lessonFlashcards[f.lesson_id] = [];
    lessonFlashcards[f.lesson_id].push(f);
  });

  const lessonStudyPlans = {};
  allStudyPlans.forEach(p => {
    if (!lessonStudyPlans[p.lesson_id]) lessonStudyPlans[p.lesson_id] = [];
    lessonStudyPlans[p.lesson_id].push(p);
  });

  const LessonCard = ({ lesson, index }) => {
    const exams = (lessonExams[lesson.id] || []);
    const flashcards = (lessonFlashcards[lesson.id] || []);
    const studyPlans = (lessonStudyPlans[lesson.id] || []);
    
    // Get active study plan for this lesson
    const activeStudyPlan = studyPlans.find(p => p.status === 'active') || studyPlans[0];
    
    // Calculate study plan task progress
    const totalTasks = activeStudyPlan?.tasks?.length || 0;
    const completedTasks = activeStudyPlan?.tasks?.filter(t => t.completed)?.length || 0;
    
    // Count completed exams (official only)
    const officialExams = exams.filter(e => e.exam_type !== 'practice');
    const completedOfficialExams = officialExams.filter(e => e.completed).length;
    
    // Get latest predicted grade from most recent completed exam
    const latestCompletedExam = exams
      .filter(e => e.completed && e.predicted_grade)
      .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];
    
    // Flashcard progress - mastered cards
    const masteredFlashcards = flashcards.filter(f => f.mastered || f.review_count >= 3).length;
    const totalFlashcards = flashcards.length;
    
    const studyTime = lesson.total_study_time_seconds || 0;
    const hasDocument = lesson.file_url || (lesson.file_urls && lesson.file_urls.length > 0);

    const getGradeColor = (grade) => {
      if (!grade) return 'text-slate-400';
      if (grade.startsWith('A')) return 'text-emerald-600';
      if (grade.startsWith('B')) return 'text-blue-600';
      if (grade.startsWith('C')) return 'text-amber-600';
      return 'text-red-500';
    };

    const getGradientByGrade = (grade) => {
      if (!grade) return 'from-slate-500 to-slate-600';
      if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
      if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
      if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
      return 'from-slate-500 to-slate-600';
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.04, 0.2) }}
        onClick={() => navigate(`${createPageUrl("DocumentViewer")}?id=${lesson.id}`)}
        className="cursor-pointer group"
      >
        <div className="relative bg-white rounded-2xl shadow-sm hover:shadow-lg border border-slate-100 overflow-hidden transition-all duration-300 hover:-translate-y-1">
          {/* Accent bar at top based on grade */}
          <div className={`h-1 w-full bg-gradient-to-r ${getGradientByGrade(latestCompletedExam?.predicted_grade)}`} />
          
          <div className="p-4">
            {/* Header Row */}
            <div className="flex items-start gap-3 mb-4">
              {/* Icon */}
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${
                latestCompletedExam?.predicted_grade 
                  ? getGradientByGrade(latestCompletedExam.predicted_grade)
                  : 'from-purple-500 to-indigo-600'
              } flex items-center justify-center shadow-sm flex-shrink-0`}>
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              
              {/* Title & Meta */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-sm leading-tight mb-1 line-clamp-2">
                  {lesson.course_name}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>{formatDate(lesson.created_date)}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  {hasDocument ? (
                    <span className="flex items-center gap-0.5 text-blue-600 font-medium">
                      <FileText className="w-3 h-3" />
                      Document
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-purple-600 font-medium">
                      <PenLine className="w-3 h-3" />
                      Description
                    </span>
                  )}
                </div>
              </div>
              
              {/* Grade Badge - prominent */}
              {latestCompletedExam?.predicted_grade && (
                <div className={`px-3 py-1.5 rounded-lg bg-gradient-to-r ${getGradientByGrade(latestCompletedExam.predicted_grade)} shadow-sm`}>
                  <span className="text-white font-black text-lg">{latestCompletedExam.predicted_grade}</span>
                </div>
              )}
            </div>
            
            {/* Stats Grid - Compact pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full">
                <Trophy className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">{completedOfficialExams} exams</span>
              </div>
              
              <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{formatTime(studyTime)}</span>
              </div>
              
              {totalFlashcards > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                  <Layers className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{masteredFlashcards}/{totalFlashcards} cards</span>
                </div>
              )}
            </div>
            
            {/* Study Plan Progress - only if exists */}
            {totalTasks > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    Study Plan
                  </span>
                  <span className="text-[11px] font-semibold text-purple-600">{completedTasks}/{totalTasks}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((completedTasks / totalTasks) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            
            {/* CTA hint on hover */}
            <div className="mt-3 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[11px] text-purple-600 font-medium flex items-center gap-1">
                Continue studying
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const AssignmentCard = ({ assignment, index }) => {
    const getGradientByGrade = (grade) => {
      if (!grade) return 'from-slate-500 to-slate-600';
      if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
      if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
      if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
      return 'from-slate-500 to-slate-600';
    };

    const grade = assignment.grading_result?.predicted_grade;
    const score = assignment.grading_result?.total_score;

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.04, 0.2) }}
        onClick={() => navigate(createPageUrl("GradeResults") + `?assignmentId=${assignment.id}`)}
        className="cursor-pointer group"
      >
        <div className="relative bg-white rounded-2xl shadow-sm hover:shadow-lg border border-slate-100 overflow-hidden transition-all duration-300 hover:-translate-y-1">
          {/* Accent bar */}
          <div className={`h-1 w-full bg-gradient-to-r ${getGradientByGrade(grade)}`} />
          
          <div className="p-4">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getGradientByGrade(grade)} flex items-center justify-center shadow-sm flex-shrink-0`}>
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-sm leading-tight mb-1 line-clamp-2">
                  {assignment.assignment_title}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>{assignment.course_name}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span>{formatDate(assignment.created_date)}</span>
                </div>
              </div>
              
              {/* Grade Badge */}
              {grade && (
                <div className={`px-3 py-1.5 rounded-lg bg-gradient-to-r ${getGradientByGrade(grade)} shadow-sm`}>
                  <span className="text-white font-black text-lg">{grade}</span>
                </div>
              )}
            </div>
            
            {/* Score or Status */}
            {assignment.grading_result ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {score && (
                    <span className="text-sm font-semibold text-slate-700">{Math.round(score)}%</span>
                  )}
                  <span className="text-[11px] text-slate-500">score</span>
                </div>
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  View feedback
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-amber-600">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                <span>Grading in progress...</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  // Count total completed exams
  const totalCompletedExams = allExams.filter(e => e.completed).length;

  const allItems = [
    ...lessons.map(l => ({ ...l, itemType: 'lesson', date: new Date(l.created_date) })),
    ...gradedAssignments.map(a => ({ ...a, itemType: 'assignment', date: new Date(a.created_date) }))
  ].sort((a, b) => b.date - a.date);

  const filteredItems = activeTab === 'all' 
    ? allItems 
    : activeTab === 'lessons' 
    ? allItems.filter(i => i.itemType === 'lesson')
    : allItems.filter(i => i.itemType === 'assignment');

  return (
    <div className="p-3 md:p-10 max-w-7xl mx-auto">
      <div className="mb-4 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-bold text-slate-900 mb-1">History</h1>
        {lessonsError && (
          <p className="text-xs text-red-600">Error loading lessons. Please refresh.</p>
        )}
        {!isLoading && lessons.length === 0 && !lessonsError && (
          <p className="text-xs text-slate-500">No lessons found. Upload your first lesson to get started!</p>
        )}
      </div>

      {/* Summary Stats - Clean minimal design */}
      <div className="flex items-center gap-3 md:gap-6 mb-6 overflow-x-auto pb-2">
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-slate-100 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{lessons.length}</p>
            <p className="text-[10px] text-slate-500 -mt-0.5">Lessons</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-slate-100 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{totalCompletedExams}</p>
            <p className="text-[10px] text-slate-500 -mt-0.5">Exams</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-slate-100 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <FileCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{gradedAssignments.length}</p>
            <p className="text-[10px] text-slate-500 -mt-0.5">Graded</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="bg-white shadow-sm border w-full justify-start">
          <TabsTrigger value="all" className="flex-1 md:flex-none">All</TabsTrigger>
          <TabsTrigger value="lessons" className="flex-1 md:flex-none">Lessons</TabsTrigger>
          <TabsTrigger value="assignments" className="flex-1 md:flex-none">Assignments</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-52 animate-pulse bg-slate-100 border-0" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="text-center py-12 md:py-16 bg-gradient-to-br from-purple-50 to-yellow-50 border-0 shadow-lg">
          <CardContent>
            <BookOpen className="w-12 h-12 md:w-16 md:h-16 mx-auto text-purple-400 mb-4" />
            <h3 className="text-lg md:text-xl font-semibold text-slate-700 mb-2">
              {activeTab === 'all' ? 'Nothing here yet' : activeTab === 'lessons' ? 'No lessons yet' : 'No assignments yet'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {activeTab === 'assignments' 
                ? 'Grade your first assignment to see it here'
                : 'Upload your first lesson to get started'}
            </p>
            <Button
              onClick={() => navigate(createPageUrl("Home"))}
              className="bg-gradient-to-r from-purple-600 to-purple-800"
            >
              Get Started
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filteredItems.map((item, idx) => (
            item.itemType === 'lesson' 
              ? <LessonCard key={`lesson-${item.id}`} lesson={item} index={idx} />
              : <AssignmentCard key={`assignment-${item.id}`} assignment={item} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}