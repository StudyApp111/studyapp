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
  BookOpen, Award, Calendar, Clock, FileCheck, 
  ArrowRight, Trophy, Layers, ChevronRight, Sparkles,
  GraduationCap, Target, Zap, FileText, PenLine
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

  // OPTIMIZED: Paginate and limit data fetching
  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['lessons-history'],
    queryFn: () => base44.entities.Lesson.list('-created_date', 50),
    initialData: [],
    staleTime: 5 * 60 * 1000,
  });

  const { data: gradedAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['graded-assignments-history'],
    queryFn: () => base44.entities.GradedAssignment.list('-created_date', 50),
    initialData: [],
    staleTime: 5 * 60 * 1000,
  });

  // OPTIMIZED: Only fetch exams/flashcards for visible lessons
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
      const results = await Promise.all(examPromises);
      return results.flat();
    },
    enabled: visibleLessonIds.length > 0,
    initialData: [],
    staleTime: 5 * 60 * 1000,
  });

  const { data: allFlashcards = [] } = useQuery({
    queryKey: ['flashcards-history', visibleLessonIds],
    queryFn: async () => {
      if (visibleLessonIds.length === 0) return [];
      const flashcardPromises = visibleLessonIds.map(id =>
        base44.entities.Flashcard.filter({ lesson_id: id }).catch(() => [])
      );
      const results = await Promise.all(flashcardPromises);
      return results.flat();
    },
    enabled: visibleLessonIds.length > 0,
    initialData: [],
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = lessonsLoading || assignmentsLoading;

  // Group exams by lesson
  const lessonExams = {};
  allExams.forEach(e => {
    if (!lessonExams[e.lesson_id]) lessonExams[e.lesson_id] = [];
    lessonExams[e.lesson_id].push(e);
  });

  // Group flashcards by lesson
  const lessonFlashcards = {};
  allFlashcards.forEach(f => {
    if (!lessonFlashcards[f.lesson_id]) lessonFlashcards[f.lesson_id] = [];
    lessonFlashcards[f.lesson_id].push(f);
  });

  const LessonCard = ({ lesson, index }) => {
    const exams = (lessonExams[lesson.id] || []);
    const flashcards = (lessonFlashcards[lesson.id] || []);
    
    // Deduplicate exams by number
    const examsByNumber = {};
    exams.forEach(e => {
      const existing = examsByNumber[e.exam_number];
      if (!existing || e.completed || (!existing.completed && e.updated_date > existing.updated_date)) {
        examsByNumber[e.exam_number] = e;
      }
    });
    const uniqueExams = Object.values(examsByNumber);
    
    const completedExams = uniqueExams.filter(e => e.completed).length;
    const totalExams = 6;
    const latestCompletedExam = uniqueExams.filter(e => e.completed).sort((a, b) => b.exam_number - a.exam_number)[0];
    
    const masteredFlashcards = flashcards.filter(f => f.mastery_level >= 4).length;
    const totalFlashcards = flashcards.length;
    
    const progress = (completedExams / totalExams) * 100;
    const studyTime = lesson.total_study_time_seconds || 0;
    
    // Determine content type
    const hasDocument = lesson.file_url || (lesson.file_urls && lesson.file_urls.length > 0);

    const getGradeColor = (grade) => {
      if (!grade) return 'text-slate-400';
      if (grade.startsWith('A')) return 'text-emerald-600';
      if (grade.startsWith('B')) return 'text-blue-600';
      if (grade.startsWith('C')) return 'text-amber-600';
      return 'text-red-500';
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        onClick={() => navigate(`${createPageUrl("DocumentViewer")}?id=${lesson.id}`)}
        className="cursor-pointer group"
      >
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden bg-white hover:scale-[1.01]">
          <CardContent className="p-4 md:p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  completedExams === totalExams 
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' 
                    : completedExams > 0 
                    ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                    : 'bg-gradient-to-br from-slate-400 to-slate-500'
                }`}>
                  <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 text-sm md:text-base truncate">{lesson.course_name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(lesson.created_date)}
                    </span>
                    <span className="text-slate-300">•</span>
                    {hasDocument ? (
                      <span className="inline-flex items-center gap-0.5 text-blue-600">
                        <FileText className="w-3 h-3" />
                        Doc
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-purple-600">
                        <PenLine className="w-3 h-3" />
                        Written
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-purple-50 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Target className="w-3 h-3 text-purple-600" />
                  <span className="text-xs text-purple-600 font-medium">Exams</span>
                </div>
                <p className="text-sm font-bold text-purple-700">{completedExams}/{totalExams}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span className="text-xs text-amber-600 font-medium">Time</span>
                </div>
                <p className="text-sm font-bold text-amber-700">{formatTime(studyTime)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Layers className="w-3 h-3 text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">Cards</span>
                </div>
                <p className="text-sm font-bold text-blue-700">{masteredFlashcards}/{totalFlashcards || '0'}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500">Progress</span>
                <span className="font-medium text-slate-700">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Grade Badge */}
            {latestCompletedExam ? (
              <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-purple-50 to-yellow-50 rounded-lg border border-purple-100">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs text-slate-600">Predicted Grade</span>
                </div>
                <span className={`text-lg font-bold ${getGradeColor(latestCompletedExam.predicted_grade)}`}>
                  {latestCompletedExam.predicted_grade || '-'}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-slate-500">Complete your first exam to see predicted grade</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const AssignmentCard = ({ assignment, index }) => {
    const getGradeColor = (grade) => {
      if (!grade) return 'bg-slate-100 text-slate-600';
      if (grade.startsWith('A')) return 'bg-emerald-100 text-emerald-700';
      if (grade.startsWith('B')) return 'bg-blue-100 text-blue-700';
      if (grade.startsWith('C')) return 'bg-amber-100 text-amber-700';
      return 'bg-red-100 text-red-700';
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        onClick={() => navigate(createPageUrl("GradeResults") + `?assignmentId=${assignment.id}`)}
        className="cursor-pointer group"
      >
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden bg-white hover:scale-[1.01]">
          <CardContent className="p-4 md:p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                  <FileCheck className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 text-sm md:text-base truncate">{assignment.assignment_title}</h3>
                  <p className="text-xs text-slate-500 truncate">{assignment.course_name}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
            </div>

            {/* Date */}
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
              <Calendar className="w-3 h-3" />
              {formatDate(assignment.created_date)}
            </div>

            {/* Grade Result */}
            {assignment.grading_result ? (
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Your Grade</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${assignment.grading_result.predicted_grade?.startsWith('A') ? 'text-emerald-600' : assignment.grading_result.predicted_grade?.startsWith('B') ? 'text-blue-600' : 'text-amber-600'}`}>
                      {assignment.grading_result.predicted_grade || '-'}
                    </span>
                    <Badge className={getGradeColor(assignment.grading_result.predicted_grade)}>
                      {assignment.grading_result.total_score ? `${Math.round(assignment.grading_result.total_score)}%` : '-'}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-emerald-600 font-medium">View Feedback</p>
                  <ArrowRight className="w-4 h-4 text-emerald-500 ml-auto" />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-500">Grading in progress...</span>
              </div>
            )}
          </CardContent>
        </Card>
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
    <div className="p-4 md:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-bold text-slate-900">History</h1>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-500 to-purple-600">
          <CardContent className="p-3 md:p-4 text-center">
            <GraduationCap className="w-5 h-5 md:w-6 md:h-6 text-white/80 mx-auto mb-1" />
            <p className="text-lg md:text-2xl font-bold text-white">{lessons.length}</p>
            <p className="text-xs text-white/80">Lessons</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-teal-600">
          <CardContent className="p-3 md:p-4 text-center">
            <FileCheck className="w-5 h-5 md:w-6 md:h-6 text-white/80 mx-auto mb-1" />
            <p className="text-lg md:text-2xl font-bold text-white">{gradedAssignments.length}</p>
            <p className="text-xs text-white/80">Assignments</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-orange-500">
          <CardContent className="p-3 md:p-4 text-center">
            <Zap className="w-5 h-5 md:w-6 md:h-6 text-white/80 mx-auto mb-1" />
            <p className="text-lg md:text-2xl font-bold text-white">{allExams.filter(e => e.completed).length}</p>
            <p className="text-xs text-white/80">Exams Done</p>
          </CardContent>
        </Card>
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