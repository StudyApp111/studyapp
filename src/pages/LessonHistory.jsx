import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, Clock, FileCheck, Trophy, Copy, ChevronRight, Sparkles,
  Target, TrendingUp, Upload, Flame, Zap
} from "lucide-react";
import { motion } from "framer-motion";
import CreateLessonModal from "@/components/modals/CreateLessonModal";

const formatTime = (seconds) => {
  if (!seconds || seconds === 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export default function LessonHistory() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [createLessonModalOpen, setCreateLessonModalOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(console.error);
  }, []);

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['lessons-history'],
    queryFn: () => base44.entities.Lesson.list('-created_date', 50),
    staleTime: 30 * 1000,
  });

  const { data: gradedAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['graded-assignments-history'],
    queryFn: () => base44.entities.GradedAssignment.list('-created_date', 50),
    staleTime: 30 * 1000,
  });

  const visibleLessonIds = React.useMemo(() => lessons.slice(0, 20).map(l => l.id), [lessons]);

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
    if (!g) return 'bg-white border-slate-200';
    if (g.startsWith('A')) return 'bg-emerald-50 border-emerald-200';
    if (g.startsWith('B')) return 'bg-blue-50 border-blue-200';
    if (g.startsWith('C')) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  const LessonCard = ({ lesson, index }) => {
    const exams = lessonExams[lesson.id] || [];
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
        <div className={`rounded-2xl border-2 hover:shadow-lg transition-all p-4 ${getGradeBgColor(grade)}`}>
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getGradientByGrade(grade)} flex flex-col items-center justify-center shadow-lg flex-shrink-0`}>
              {grade ? (
                <>
                  <span className="text-white font-black text-xl leading-none">{grade}</span>
                  {confidence && <span className="text-white/70 text-[8px] mt-0.5">{Math.round(confidence)}%</span>}
                </>
              ) : (
                <>
                  <Target className="w-6 h-6 text-white" />
                  <span className="text-white/70 text-[8px] mt-0.5">start</span>
                </>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-purple-700 transition-colors mb-2">
                {lesson.course_name}
              </h3>
              
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {completedExamsCount > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-white/80 rounded-lg border border-slate-100">
                    <Trophy className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] font-medium text-slate-600">{completedExamsCount} exam{completedExamsCount > 1 ? 's' : ''}</span>
                  </div>
                )}
                {flashcards.length > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-white/80 rounded-lg border border-slate-100">
                    <Copy className="w-3 h-3 text-purple-500" />
                    <span className="text-[10px] font-medium text-slate-600">{masteredFlashcards}/{flashcards.length}</span>
                  </div>
                )}
                {studyTime > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-white/80 rounded-lg border border-slate-100">
                    <Clock className="w-3 h-3 text-blue-500" />
                    <span className="text-[10px] font-medium text-slate-600">{formatTime(studyTime)}</span>
                  </div>
                )}
              </div>
              
              {totalTasks > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-white/80 rounded-full overflow-hidden max-w-[150px]">
                    <div 
                      className={`h-full rounded-full ${completedTasks === totalTasks ? 'bg-emerald-500' : 'bg-purple-500'}`}
                      style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${completedTasks === totalTasks ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {completedTasks === totalTasks ? '✓ Complete' : `${totalTasks - completedTasks} tasks left`}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-purple-600">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Take diagnostic →</span>
                </div>
              )}
            </div>

            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 flex-shrink-0 mt-5" />
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
        <div className={`rounded-2xl border-2 hover:shadow-lg transition-all p-4 ${getGradeBgColor(grade)}`}>
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getGradientByGrade(grade)} flex flex-col items-center justify-center shadow-lg flex-shrink-0`}>
              {grade ? (
                <>
                  <span className="text-white font-black text-xl leading-none">{grade}</span>
                  {score && <span className="text-white/70 text-[8px] mt-0.5">{Math.round(score)}%</span>}
                </>
              ) : (
                <>
                  <FileCheck className="w-6 h-6 text-white" />
                  <span className="text-white/70 text-[8px] mt-0.5">grading</span>
                </>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <Badge variant="outline" className="bg-white/80 text-emerald-700 border-emerald-200 text-[10px] mb-1">
                <FileCheck className="w-2.5 h-2.5 mr-1" /> Assignment
              </Badge>
              <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-emerald-700 transition-colors mb-1">
                {assignment.assignment_title}
              </h3>
              <p className="text-xs text-slate-500 truncate mb-2">{assignment.course_name}</p>
              
              {grade && (
                <div className="flex flex-wrap items-center gap-2">
                  {strengths > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-white/80 rounded-lg border border-slate-100">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      <span className="text-[10px] font-medium text-slate-600">{strengths} strengths</span>
                    </div>
                  )}
                  {improvements > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-white/80 rounded-lg border border-slate-100">
                      <Target className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] font-medium text-slate-600">{improvements} to improve</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 flex-shrink-0 mt-5" />
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
    <div className="min-h-screen bg-slate-50">
      {/* Compact Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mb-4">Your Learning Journey</h1>
          
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-3 text-white">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-white/80" />
                <div>
                  <p className="text-xl font-bold">{lessons.length}</p>
                  <p className="text-[10px] text-white/70">Courses</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-3 text-white">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-white/80" />
                <div>
                  <p className="text-xl font-bold">{gradedAssignments.length}</p>
                  <p className="text-[10px] text-white/70">Graded</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-3 text-white">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-white/80" />
                <div>
                  <p className="text-xl font-bold">{totalCompletedExams}</p>
                  <p className="text-[10px] text-white/70">Exams</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-3 text-white">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-white/80" />
                <div>
                  <p className="text-xl font-bold">{formatTime(totalStudyTime)}</p>
                  <p className="text-[10px] text-white/70">Studied</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-6xl mx-auto pb-28 md:pb-10">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1.5 mb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-100 p-1 rounded-lg w-full grid grid-cols-3">
              <TabsTrigger value="all" className="rounded-md text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">All</TabsTrigger>
              <TabsTrigger value="lessons" className="rounded-md text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">Courses</TabsTrigger>
              <TabsTrigger value="assignments" className="rounded-md text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">Graded</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-purple-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {activeTab === 'all' ? 'Start Your Journey' : activeTab === 'lessons' ? 'No courses yet' : 'No assignments yet'}
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
              {activeTab === 'assignments' 
                ? 'Grade your first assignment to see it here'
                : 'Upload your lecture notes to get AI-powered study plans'}
            </p>
            <Button
              onClick={() => setCreateLessonModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Upload className="w-4 h-4 mr-2" /> Upload Notes
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

      <CreateLessonModal 
        open={createLessonModalOpen} 
        onOpenChange={setCreateLessonModalOpen} 
      />
    </div>
  );
}