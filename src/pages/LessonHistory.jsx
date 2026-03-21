import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, Clock, FileCheck, Trophy, Copy, ChevronRight, Sparkles,
  Target, TrendingUp, Upload, Flame, Zap, Trash2
} from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import PullToRefresh from "@/components/ui/PullToRefresh";

const formatTime = (seconds) => {
  if (!seconds || seconds === 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export default function LessonHistory() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("all");


  useEffect(() => {
    base44.auth.me().then(setUser).catch(console.error);
  }, []);

  const { data: lessons = [], isLoading: lessonsLoading, refetch: refetchLessons } = useQuery({
    queryKey: ['lessons-history'],
    queryFn: () => base44.entities.Lesson.list('-created_date', 20),
    staleTime: 30 * 1000,
  });

  const { data: gradedAssignments = [], isLoading: assignmentsLoading, refetch: refetchAssignments } = useQuery({
    queryKey: ['graded-assignments-history'],
    queryFn: () => base44.entities.GradedAssignment.list('-created_date', 20),
    staleTime: 30 * 1000,
  });

  // Batch fetch all related data in single queries to avoid rate limiting
  const { data: allExams = [], refetch: refetchExams } = useQuery({
    queryKey: ['exams-history-all'],
    queryFn: () => base44.entities.Exam.list('-created_date', 50),
    staleTime: 60 * 1000,
  });

  const { data: allFlashcards = [], refetch: refetchFlashcards } = useQuery({
    queryKey: ['flashcards-history-all'],
    queryFn: () => base44.entities.Flashcard.list('-created_date', 50),
    staleTime: 60 * 1000,
  });

  const { data: allStudyPlans = [], refetch: refetchPlans } = useQuery({
    queryKey: ['study-plans-history-all'],
    queryFn: () => base44.entities.StudyPlan.list('-created_date', 50),
    staleTime: 60 * 1000,
  });

  const handleRefresh = async () => {
    await Promise.all([
      refetchLessons(),
      refetchAssignments(),
      refetchExams(),
      refetchFlashcards(),
      refetchPlans()
    ]);
  };

  const isLoading = lessonsLoading || assignmentsLoading;

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

  const getGradientByGrade = (g) => {
    if (!g) return 'from-slate-400 to-slate-500';
    if (g.startsWith('A')) return 'from-emerald-500 to-teal-600';
    if (g.startsWith('B')) return 'from-blue-500 to-indigo-600';
    if (g.startsWith('C')) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  const getGradeBgColor = (g) => {
    if (!g) return isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200';
    if (g.startsWith('A')) return isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200';
    if (g.startsWith('B')) return isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200';
    if (g.startsWith('C')) return isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200';
    return isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200';
  };

  const queryClient = useQueryClient();

  const deleteLessonMutation = useMutation({
    mutationFn: (lessonId) => base44.entities.Lesson.delete(lessonId),
    onMutate: async (lessonId) => {
      await queryClient.cancelQueries({ queryKey: ['lessons-history'] });
      const previous = queryClient.getQueryData(['lessons-history']);
      queryClient.setQueryData(['lessons-history'], (old) =>
        old ? old.filter(l => l.id !== lessonId) : []
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['lessons-history'], context.previous);
      alert("Failed to delete course.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons-history'] });
    },
  });

  const LessonCard = ({ lesson, index }) => {
    const exams = lessonExams[lesson.id] || [];

    const handleDelete = (e) => {
      e.stopPropagation();
      if (window.confirm("Are you sure you want to delete this course? This action cannot be undone.")) {
        deleteLessonMutation.mutate(lesson.id);
      }
    };
    const flashcards = lessonFlashcards[lesson.id] || [];
    const studyPlans = lessonStudyPlans[lesson.id] || [];
    
    const activeStudyPlan = studyPlans.find(p => p.status === 'active') || studyPlans[0];
    const totalTasks = activeStudyPlan?.tasks?.length || 0;
    const completedTasks = activeStudyPlan?.tasks?.filter(t => t.completed)?.length || 0;
    const currentGrade = activeStudyPlan?.current_predicted_grade || activeStudyPlan?.initial_predicted_grade;
    const confidence = activeStudyPlan?.current_confidence || activeStudyPlan?.initial_confidence;
    
    const grade = currentGrade;
    const studyTime = lesson.total_study_time_seconds || 0;
    const completedExamsCount = exams.filter(e => e.completed).length;
    const masteredFlashcards = flashcards.filter(f => f.mastered).length;

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.03, 0.15) }}
        onClick={() => navigate(`${createPageUrl("DocumentViewer")}?id=${lesson.id}`)}
        className="cursor-pointer group"
      >
        <div className={`rounded-2xl border-2 hover:shadow-lg transition-all p-3 ${getGradeBgColor(grade)}`}>
          <div className="flex items-start gap-2">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getGradientByGrade(grade)} flex flex-col items-center justify-center shadow-lg flex-shrink-0`}>
              {grade ? (
                <>
                  <span className="text-white font-black text-base leading-none">{grade}</span>
                  {confidence && <span className="text-white/70 text-[6px] mt-0.5">{Math.round(confidence)}%</span>}
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 text-white" />
                  <span className="text-white/70 text-[6px] mt-0.5">start</span>
                </>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className={`font-bold text-sm truncate group-hover:text-purple-400 transition-colors mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {lesson.course_name}
              </h3>
              
              <div className="flex flex-wrap items-center gap-1 mb-1">
                {completedExamsCount > 0 && (
                  <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                    <Trophy className="w-2.5 h-2.5 text-amber-400" />
                    <span className={`text-[8px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{completedExamsCount}</span>
                  </div>
                )}
                {flashcards.length > 0 && (
                  <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                    <Copy className="w-2.5 h-2.5 text-purple-400" />
                    <span className={`text-[8px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{masteredFlashcards}/{flashcards.length}</span>
                  </div>
                )}
                {studyTime > 0 && (
                  <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                    <Clock className="w-2.5 h-2.5 text-blue-400" />
                    <span className={`text-[8px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatTime(studyTime)}</span>
                  </div>
                )}
              </div>
              
              {totalTasks > 0 ? (
                <div className="flex items-center gap-1.5">
                  <div className={`flex-1 h-1 rounded-full overflow-hidden max-w-[80px] ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                    <div 
                      className={`h-full rounded-full ${completedTasks === totalTasks ? 'bg-emerald-500' : 'bg-purple-500'}`}
                      style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                    />
                  </div>
                  <span className={`text-[9px] font-medium ${completedTasks === totalTasks ? 'text-emerald-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                    {completedTasks === totalTasks ? '✓' : `${totalTasks - completedTasks} left`}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-purple-500">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span className="text-[9px] font-medium">Diagnostic →</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center justify-center gap-2 self-center flex-shrink-0">
              <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500 group-hover:text-purple-400' : 'text-slate-400 group-hover:text-purple-600'}`} />
              <button 
                onClick={handleDelete}
                disabled={deleteLessonMutation.isPending}
                className={`w-11 h-11 flex items-center justify-center rounded-md transition-colors ${isDark ? 'hover:bg-red-500/20 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
                title="Delete Course"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const AssignmentCard = ({ assignment, index }) => {
    const grade = assignment.grading_result?.predicted_grade;
    const score = assignment.grading_result?.total_score;
    const strengths = assignment.grading_result?.identified_strengths?.length || 0;
    const improvements = assignment.grading_result?.areas_for_improvement?.length || 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.03, 0.15) }}
        onClick={() => navigate(createPageUrl("GradeResults") + `?assignmentId=${assignment.id}`)}
        className="cursor-pointer group"
      >
        <div className={`rounded-2xl border-2 hover:shadow-lg transition-all p-3 ${getGradeBgColor(grade)}`}>
          <div className="flex items-start gap-2">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getGradientByGrade(grade)} flex flex-col items-center justify-center shadow-lg flex-shrink-0`}>
              {grade ? (
                <>
                  <span className="text-white font-black text-base leading-none">{grade}</span>
                  {score && <span className="text-white/70 text-[6px] mt-0.5">{Math.round(score)}%</span>}
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 text-white" />
                  <span className="text-white/70 text-[6px] mt-0.5">grading</span>
                </>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <Badge variant="outline" className={`text-[8px] mb-0.5 px-1 py-0 ${isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                <FileCheck className="w-2 h-2 mr-0.5" /> Assignment
              </Badge>
              <h3 className={`font-bold text-sm truncate group-hover:text-emerald-500 transition-colors mb-0.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {assignment.assignment_title}
              </h3>
              <p className={`text-[9px] truncate mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{assignment.course_name}</p>
              
              {grade && (
                <div className="flex flex-wrap items-center gap-1">
                  {strengths > 0 && (
                    <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                      <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                      <span className={`text-[8px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{strengths}</span>
                    </div>
                  )}
                  {improvements > 0 && (
                    <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                      <Target className="w-2.5 h-2.5 text-amber-400" />
                      <span className={`text-[8px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{improvements}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <ChevronRight className={`w-4 h-4 flex-shrink-0 self-center ${isDark ? 'text-slate-500 group-hover:text-emerald-400' : 'text-slate-400 group-hover:text-emerald-600'}`} />
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

  const totalCompletedExams = allExams.filter(e => e.completed).length;
  const totalStudyTime = lessons.reduce((acc, l) => acc + (l.total_study_time_seconds || 0), 0);

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
    <PullToRefresh onRefresh={handleRefresh} isDark={isDark}>
    <div className={`min-h-screen w-full max-w-full pb-20 md:pb-8 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ overflowX: 'hidden', boxSizing: 'border-box', maxWidth: '100vw' }}>
      {/* Compact Header */}
      <div className={`border-b ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="w-full max-w-full px-3 py-4 md:px-4 mx-auto" style={{ boxSizing: 'border-box', maxWidth: '100vw' }}>
          <h1 className={`text-lg md:text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Your Learning Journey</h1>
          
          {/* Stats Row - 2x2 on mobile, 4 cols on desktop */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl p-2.5 text-white">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-white/80 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-base font-bold leading-none">{lessons.length}</p>
                  <p className="text-[9px] text-white/70">Courses</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl p-2.5 text-white">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-white/80 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-base font-bold leading-none">{gradedAssignments.length}</p>
                  <p className="text-[9px] text-white/70">Graded</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-xl p-2.5 text-white">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-white/80 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-base font-bold leading-none">{totalCompletedExams}</p>
                  <p className="text-[9px] text-white/70">Exams</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-600 to-cyan-700 rounded-xl p-2.5 text-white">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/80 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-base font-bold leading-none truncate">{formatTime(totalStudyTime)}</p>
                  <p className="text-[9px] text-white/70">Studied</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-full px-3 py-4 md:px-4 mx-auto" style={{ boxSizing: 'border-box', maxWidth: '100vw' }}>
        {/* Tabs */}
        <div className={`rounded-xl border p-1 mb-4 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'}`}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={`p-0.5 rounded-lg w-full grid grid-cols-3 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
              <TabsTrigger value="all" className={`rounded-md text-xs py-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}>All</TabsTrigger>
              <TabsTrigger value="lessons" className={`rounded-md text-xs py-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}>Courses</TabsTrigger>
              <TabsTrigger value="assignments" className={`rounded-md text-xs py-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}>Graded</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 bg-white/5 rounded-2xl border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl border-2 border-dashed ${isDark ? 'bg-[#12121a] border-white/20' : 'bg-white border-slate-300'}`}>
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
              <BookOpen className={`w-10 h-10 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {activeTab === 'all' ? 'Start Your Journey' : activeTab === 'lessons' ? 'No courses yet' : 'No assignments yet'}
            </h3>
            <p className={`text-sm mb-6 max-w-sm mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {activeTab === 'assignments' 
                ? 'Grade your first assignment to see it here'
                : 'Upload your lecture notes to get AI-powered study plans'}
            </p>
            <Button
              onClick={() => navigate(createPageUrl("CreateLesson"))}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Upload className="w-4 h-4 mr-2" /> Add Course
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item, idx) => (
              item.itemType === 'lesson' 
                ? <LessonCard key={`lesson-${item.id}`} lesson={item} index={idx} />
                : <AssignmentCard key={`assignment-${item.id}`} assignment={item} index={idx} />
            ))}
          </div>
        )}
      </div>

    </div>
    </PullToRefresh>
  );
}