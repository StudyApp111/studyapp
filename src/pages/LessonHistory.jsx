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
    
    const activeStudyPlan = studyPlans.find(p => p.status === 'active') || studyPlans[0];
    const totalTasks = activeStudyPlan?.tasks?.length || 0;
    const completedTasks = activeStudyPlan?.tasks?.filter(t => t.completed)?.length || 0;
    const currentGrade = activeStudyPlan?.current_predicted_grade || activeStudyPlan?.initial_predicted_grade;
    
    const latestCompletedExam = exams
      .filter(e => e.completed && e.predicted_grade)
      .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];
    
    const grade = currentGrade || latestCompletedExam?.predicted_grade;
    const studyTime = lesson.total_study_time_seconds || 0;

    const getGradientByGrade = (g) => {
      if (!g) return 'from-slate-400 to-slate-500';
      if (g.startsWith('A')) return 'from-emerald-500 to-teal-600';
      if (g.startsWith('B')) return 'from-blue-500 to-indigo-600';
      if (g.startsWith('C')) return 'from-amber-500 to-orange-600';
      return 'from-red-500 to-rose-600';
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.03, 0.15) }}
        onClick={() => navigate(`${createPageUrl("DocumentViewer")}?id=${lesson.id}`)}
        className="cursor-pointer group"
      >
        <div className="bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all p-3">
          <div className="flex items-center gap-3">
            {/* Grade indicator */}
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getGradientByGrade(grade)} flex items-center justify-center shadow-sm flex-shrink-0`}>
              {grade ? (
                <span className="text-white font-black text-sm">{grade}</span>
              ) : (
                <BookOpen className="w-5 h-5 text-white" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 text-sm truncate group-hover:text-purple-700 transition-colors">
                {lesson.course_name}
              </h3>
              
              <div className="flex items-center gap-3 mt-1">
                {totalTasks > 0 ? (
                  <>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                      <div 
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {totalTasks - completedTasks > 0 ? `${totalTasks - completedTasks} left` : '✓'}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-purple-600">Start diagnostic →</span>
                )}
                
                {studyTime > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {formatTime(studyTime)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition-colors flex-shrink-0" />
          </div>
        </div>
      </motion.div>
    );
  };

  const AssignmentCard = ({ assignment, index }) => {
    const getGradientByGrade = (g) => {
      if (!g) return 'from-slate-400 to-slate-500';
      if (g.startsWith('A')) return 'from-emerald-500 to-teal-600';
      if (g.startsWith('B')) return 'from-blue-500 to-indigo-600';
      if (g.startsWith('C')) return 'from-amber-500 to-orange-600';
      return 'from-red-500 to-rose-600';
    };

    const grade = assignment.grading_result?.predicted_grade;
    const score = assignment.grading_result?.total_score;

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.03, 0.15) }}
        onClick={() => navigate(createPageUrl("GradeResults") + `?assignmentId=${assignment.id}`)}
        className="cursor-pointer group"
      >
        <div className="bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all p-3">
          <div className="flex items-center gap-3">
            {/* Grade indicator */}
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getGradientByGrade(grade)} flex items-center justify-center shadow-sm flex-shrink-0`}>
              {grade ? (
                <span className="text-white font-black text-sm">{grade}</span>
              ) : (
                <FileCheck className="w-5 h-5 text-white" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 text-sm truncate group-hover:text-emerald-700 transition-colors">
                {assignment.assignment_title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-500 truncate">{assignment.course_name}</span>
                {score && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-[10px] text-slate-500">{Math.round(score)}%</span>
                  </>
                )}
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-28 md:pb-10">
      {/* Header with Stats */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">History</h1>
          <p className="text-sm text-slate-500">{lessons.length} courses • {gradedAssignments.length} assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 rounded-xl">
            <Trophy className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-bold text-purple-700">{totalCompletedExams}</span>
            <span className="text-xs text-purple-500">exams</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="all" className="rounded-md text-xs">All</TabsTrigger>
          <TabsTrigger value="lessons" className="rounded-md text-xs">Courses</TabsTrigger>
          <TabsTrigger value="assignments" className="rounded-md text-xs">Graded</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-700 mb-1">
            {activeTab === 'all' ? 'Nothing here yet' : activeTab === 'lessons' ? 'No courses yet' : 'No assignments yet'}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {activeTab === 'assignments' 
              ? 'Grade your first assignment to see it here'
              : 'Upload your first lesson to get started'}
          </p>
          <Button
            onClick={() => navigate(createPageUrl("Home"))}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Get Started
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
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