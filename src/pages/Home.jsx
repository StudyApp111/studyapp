import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, Clock, Calculator, Beaker, Globe, BookText, Languages, Code, Palette, Music, Briefcase, FileCheck, ArrowRight, Sparkles, Upload, Flame, Zap, Target, Trophy, ChevronRight, TrendingUp, Layers, Brain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import CreateLessonModal from "@/components/modals/CreateLessonModal";
import { AssignmentActivityCard } from "@/components/home/ActivityCard";
import DailyChallenge from "@/components/gamification/DailyChallenge";
import FirstSessionWelcome from "@/components/gamification/FirstSessionWelcome";
import { handleDailyReset } from "@/components/utils/dailyReset";
import PollyCard from "@/components/home/PollyCard";
import LearningTrajectory from "@/components/home/LearningTrajectory";

export default function Home() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [createLessonModalOpen, setCreateLessonModalOpen] = useState(false);
    const [dailyXP, setDailyXP] = useState(0);
    const [studyMinutesToday, setStudyMinutesToday] = useState(0);
    const [questionsToday, setQuestionsToday] = useState(0);
    const [flashcardsToday, setFlashcardsToday] = useState(0);
    const [showWelcome, setShowWelcome] = useState(false);

    useEffect(() => {
      const checkOnboarding = async () => {
        try {
          // Check if authenticated first
          const isAuth = await base44.auth.isAuthenticated();
          if (!isAuth) {
            base44.auth.redirectToLogin(window.location.pathname + window.location.search);
            return;
          }

          // Handle daily reset using centralized utility
          const resetResult = await handleDailyReset();
          const currentUser = resetResult.user || await base44.auth.me();
          setUser(currentUser);

          // Set daily stats from reset result or user data
          setDailyXP(resetResult.dailyXP ?? currentUser.daily_xp ?? 0);
          setStudyMinutesToday(resetResult.studyMinutesToday ?? currentUser.study_minutes_today ?? 0);
          setQuestionsToday(resetResult.questionsToday ?? currentUser.questions_today ?? 0);
          setFlashcardsToday(resetResult.flashcardsToday ?? currentUser.flashcards_today ?? 0);

          // Show welcome guide for new users
          const hasSeenWelcome = localStorage.getItem('hasSeenWelcomeGuide');
          if (!hasSeenWelcome && currentUser.session_count <= 2) {
            setShowWelcome(true);
          }

          if (!currentUser.onboarding_completed) {
            navigate(createPageUrl("Onboarding"));
          } else if (currentUser.learning_profile_id) {
            const profile = await base44.entities.LearningProfile.filter({
              id: currentUser.learning_profile_id
            });
            if (profile.length > 0) {
              setLearningProfile(profile[0]);
            }
          }
        } catch (error) {
          console.error("Error checking user:", error);
        }
      };

      checkOnboarding();
    }, []); // Only run once on mount

    const [learningProfile, setLearningProfile] = useState(null);

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: () => base44.entities.Lesson.list('-created_date', 100),
    initialData: [],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: gradedAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['gradedAssignments'],
    queryFn: () => base44.entities.GradedAssignment.list('-created_date', 100),
    initialData: [],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isLoading = lessonsLoading || assignmentsLoading;

  // Combine and sort lessons and graded assignments by date
  const recentItems = React.useMemo(() => {
    const combined = [
      ...lessons.map(l => ({ ...l, type: 'lesson', date: new Date(l.created_date) })),
      ...gradedAssignments.map(a => ({ ...a, type: 'assignment', date: new Date(a.created_date) }))
    ];
    return combined.sort((a, b) => b.date - a.date).slice(0, 6);
  }, [lessons, gradedAssignments]);

  const { data: allExams = [] } = useQuery({
    queryKey: ['exams'],
    queryFn: () => base44.entities.Exam.list('-created_date'),
    initialData: [],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Fetch study plans for all lessons
  const { data: studyPlans = [] } = useQuery({
    queryKey: ['studyPlans'],
    queryFn: () => base44.entities.StudyPlan.filter({ status: 'active' }),
    initialData: [],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Map study plans by lesson_id
  const studyPlansByLesson = React.useMemo(() => {
    const map = {};
    studyPlans.forEach(sp => {
      if (sp.lesson_id) map[sp.lesson_id] = sp;
    });
    return map;
  }, [studyPlans]);

  // Group exams by lesson
  const lessonExams = React.useMemo(() => {
    const map = {};
    allExams.forEach(e => {
      if (!map[e.lesson_id]) map[e.lesson_id] = [];
      map[e.lesson_id].push(e);
    });
    return map;
  }, [allExams]);

  // Calculate tasks remaining per lesson for display
  const lessonsWithTasks = React.useMemo(() => {
    return lessons.slice(0, 6).map(lesson => {
      const plan = studyPlansByLesson[lesson.id];
      const totalTasks = plan?.tasks?.length || 0;
      const completedTasks = plan?.tasks?.filter(t => t.completed)?.length || 0;
      const tasksRemaining = totalTasks - completedTasks;
      const currentGrade = plan?.current_predicted_grade || plan?.initial_predicted_grade;
      return { lesson, plan, tasksRemaining, totalTasks, completedTasks, currentGrade };
    });
  }, [lessons, studyPlansByLesson]);

  const getGradeColor = (grade) => {
    if (!grade) return 'from-slate-400 to-slate-500';
    if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
    if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
    if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  const TASK_ICONS = {
    flashcards: Layers,
    teach_it: Brain,
    practice_exam: Zap,
    review_notes: BookOpen
  };

  // Early return AFTER all hooks
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section with Purple Gradient */}
      <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 px-4 pt-6 pb-8 md:px-8 md:pt-8 md:pb-12 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-400/20 rounded-full blur-3xl -ml-24 -mb-24" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-pink-400/10 rounded-full blur-2xl" />
        
        <div className="max-w-6xl mx-auto relative">
          {/* Header with stats */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Hey {user?.full_name?.split(' ')[0] || 'there'}! 👋
              </h1>
              <p className="text-white/70 text-sm mt-1">
                {learningProfile?.school || "Ready to ace your next exam?"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Streak */}
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-sm ${(user?.current_streak || 0) > 0 ? 'bg-orange-500/30' : 'bg-white/10'}`}>
                <Flame className={`w-5 h-5 ${(user?.current_streak || 0) > 0 ? 'text-orange-300' : 'text-white/50'}`} />
                <span className="text-sm font-bold text-white">{user?.current_streak || 0}</span>
              </div>
              {/* XP */}
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-yellow-400/30 backdrop-blur-sm">
                <Zap className="w-5 h-5 text-yellow-300" />
                <span className="text-sm font-bold text-white">{dailyXP}/50</span>
              </div>
            </div>
          </div>

          {/* Polly AI Card */}
          <PollyCard 
            lessons={lessons}
            studyPlans={studyPlans}
            user={user}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 md:p-8 max-w-6xl mx-auto pb-28 md:pb-10 -mt-4">
        {/* Quick Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{lessons.length}</p>
                <p className="text-[10px] text-slate-500">Courses</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Trophy className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{allExams.filter(e => e.completed).length}</p>
                <p className="text-[10px] text-slate-500">Exams</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{Math.round(studyMinutesToday)}</p>
                <p className="text-[10px] text-slate-500">Min today</p>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Left: Courses with Tasks */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Your Courses</h2>
              <button 
                onClick={() => navigate(createPageUrl("LessonHistory"))}
                className="text-xs text-purple-600 font-medium hover:text-purple-700 flex items-center gap-0.5"
              >
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : lessons.length === 0 ? (
              <div className="text-center py-8 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border-2 border-dashed border-purple-200">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-8 h-8 text-purple-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">No courses yet</p>
                <p className="text-xs text-slate-500 mb-4">Upload your first lesson to get started</p>
                <Button 
                  onClick={() => setCreateLessonModalOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Upload className="w-4 h-4 mr-2" /> Upload Notes
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {lessons.slice(0, 6).map((lesson, idx) => {
                  const plan = studyPlansByLesson[lesson.id];
                  const totalTasks = plan?.tasks?.length || 0;
                  const completedTasks = plan?.tasks?.filter(t => t.completed)?.length || 0;
                  const tasksRemaining = totalTasks - completedTasks;
                  const currentGrade = plan?.current_predicted_grade || plan?.initial_predicted_grade;
                  const exams = lessonExams[lesson.id] || [];
                  const completedExams = exams.filter(e => e.completed).length;
                  
                  return (
                    <motion.div
                      key={lesson.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => navigate(`${createPageUrl("DocumentViewer")}?id=${lesson.id}`)}
                      className="bg-white rounded-xl border border-slate-200 p-3 hover:shadow-lg hover:border-purple-300 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        {/* Grade indicator */}
                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getGradeColor(currentGrade)} flex flex-col items-center justify-center shadow-lg flex-shrink-0`}>
                          {currentGrade ? (
                            <>
                              <span className="text-white font-black text-lg leading-none">{currentGrade}</span>
                              <span className="text-white/70 text-[8px] mt-0.5">predicted</span>
                            </>
                          ) : (
                            <>
                              <Target className="w-5 h-5 text-white" />
                              <span className="text-white/70 text-[8px] mt-0.5">start</span>
                            </>
                          )}
                        </div>

                        {/* Course info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 text-sm truncate group-hover:text-purple-700 transition-colors">
                            {lesson.course_name}
                          </h3>
                          
                          {plan ? (
                            <div className="mt-1.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      tasksRemaining === 0 ? 'bg-emerald-500' : 'bg-purple-500'
                                    }`}
                                    style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-medium ${tasksRemaining === 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                  {tasksRemaining > 0 ? `${tasksRemaining} tasks left` : '✓ Complete'}
                                </span>
                              </div>
                              {completedExams > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Trophy className="w-3 h-3 text-amber-500" />
                                  <span className="text-[10px] text-slate-400">{completedExams} exam{completedExams > 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-purple-600 mt-1 flex items-center gap-1 font-medium">
                              <Sparkles className="w-3 h-3" /> Take diagnostic to get your grade →
                            </p>
                          )}
                        </div>

                        {/* Next task preview */}
                        {plan && tasksRemaining > 0 && (
                          <div className="hidden sm:flex flex-col items-center gap-1 px-3 py-2 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl flex-shrink-0 border border-purple-100">
                            {(() => {
                              const nextTask = plan.tasks?.find(t => !t.completed);
                              const Icon = TASK_ICONS[nextTask?.task_type] || Target;
                              return (
                                <>
                                  <Icon className="w-4 h-4 text-purple-600" />
                                  <span className="text-[10px] text-purple-700 font-medium">
                                    {nextTask?.task_type === 'flashcards' ? 'Cards' :
                                     nextTask?.task_type === 'teach_it' ? 'Teach' :
                                     nextTask?.task_type === 'practice_exam' ? 'Quiz' : 'Notes'}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        )}

                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 transition-colors flex-shrink-0" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Trajectory + Daily Goals */}
          <div className="space-y-4">
            <LearningTrajectory studyPlans={studyPlans} lessons={lessons} />
            
            <DailyChallenge 
              studyMinutes={studyMinutesToday}
              questionsAnswered={questionsToday}
              flashcardsReviewed={flashcardsToday}
              compact={false}
            />
          </div>
        </div>

        {/* CTA Cards - Full and descriptive */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {/* Upload Notes Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setCreateLessonModalOpen(true)}
              className="cursor-pointer group"
            >
              <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 hover:scale-[1.02]">
                <CardContent className="p-5 md:p-8">
                  <div className="flex items-start justify-between mb-3 md:mb-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 backdrop-blur-sm rounded-xl md:rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 md:w-7 md:h-7 text-white" />
                    </div>
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-yellow-400 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                      <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-slate-900" />
                    </div>
                  </div>
                  <h3 className="text-lg md:text-2xl font-bold text-white mb-1 md:mb-2">Upload Notes</h3>
                  <p className="text-white/80 text-sm md:text-base mb-3 md:mb-4">
                    Drop your lecture notes or textbook chapters and get AI-powered quizzes, flashcards & grade predictions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs text-white/90">AI Quiz</span>
                    <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs text-white/90">Grade Prediction</span>
                    <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs text-white/90">Flashcards</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Grade Assignment Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              onClick={() => navigate(createPageUrl("SmartGrader"))}
              className="cursor-pointer group"
            >
              <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 hover:scale-[1.02]">
                <CardContent className="p-5 md:p-8">
                  <div className="flex items-start justify-between mb-3 md:mb-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 backdrop-blur-sm rounded-xl md:rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileCheck className="w-6 h-6 md:w-7 md:h-7 text-white" />
                    </div>
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-yellow-400 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                      <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-slate-900" />
                    </div>
                  </div>
                  <h3 className="text-lg md:text-2xl font-bold text-white mb-1 md:mb-2">Grade My Work</h3>
                  <p className="text-white/80 text-sm md:text-base mb-3 md:mb-4">
                    Upload your assignment or essay and get instant AI feedback with a predicted grade & improvements
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs text-white/90">Instant Grade</span>
                    <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs text-white/90">Rubric Analysis</span>
                    <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs text-white/90">Improvements</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>


      {/* Create Lesson Modal */}
      <CreateLessonModal 
        open={createLessonModalOpen} 
        onOpenChange={setCreateLessonModalOpen} 
      />

      <FirstSessionWelcome 
        open={showWelcome}
        onOpenChange={setShowWelcome}
        userName={user?.full_name?.split(' ')[0]}
      />
      </div>
    </div>
  );
}