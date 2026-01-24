import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Clock, FileCheck, ArrowRight, Sparkles, Upload, Flame, Zap, Target, Trophy, ChevronRight, Layers, Brain } from "lucide-react";
import { motion } from "framer-motion";
import CreateLessonModal from "@/components/modals/CreateLessonModal";
import DailyChallenge from "@/components/gamification/DailyChallenge";
import FirstSessionWelcome from "@/components/gamification/FirstSessionWelcome";
import { handleDailyReset } from "@/components/utils/dailyReset";
import PollyChatBox from "@/components/home/PollyChatBox";
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
  const [learningProfile, setLearningProfile] = useState(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          base44.auth.redirectToLogin(window.location.pathname + window.location.search);
          return;
        }

        const resetResult = await handleDailyReset();
        const currentUser = resetResult.user || await base44.auth.me();
        setUser(currentUser);

        setDailyXP(resetResult.dailyXP ?? currentUser.daily_xp ?? 0);
        setStudyMinutesToday(resetResult.studyMinutesToday ?? currentUser.study_minutes_today ?? 0);
        setQuestionsToday(resetResult.questionsToday ?? currentUser.questions_today ?? 0);
        setFlashcardsToday(resetResult.flashcardsToday ?? currentUser.flashcards_today ?? 0);

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
  }, []);

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: () => base44.entities.Lesson.list('-created_date', 100),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allExams = [] } = useQuery({
    queryKey: ['exams'],
    queryFn: () => base44.entities.Exam.list('-created_date'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: studyPlans = [] } = useQuery({
    queryKey: ['studyPlans'],
    queryFn: () => base44.entities.StudyPlan.filter({ status: 'active' }),
    staleTime: 5 * 60 * 1000,
  });

  const studyPlansByLesson = React.useMemo(() => {
    const map = {};
    studyPlans.forEach(sp => {
      if (sp.lesson_id) map[sp.lesson_id] = sp;
    });
    return map;
  }, [studyPlans]);

  const lessonExams = React.useMemo(() => {
    const map = {};
    allExams.forEach(e => {
      if (!map[e.lesson_id]) map[e.lesson_id] = [];
      map[e.lesson_id].push(e);
    });
    return map;
  }, [allExams]);

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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  const firstName = user?.full_name?.split(' ')[0] || 'there';
  const schoolInfo = learningProfile?.school || learningProfile?.grade || '';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 px-4 py-6 md:px-8 md:py-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-400/20 rounded-full blur-3xl -ml-24 -mb-24" />
        
        <div className="max-w-6xl mx-auto relative">
          {/* Hero Pill */}
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-5 md:p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
                  Hey {firstName}! 👋
                </h1>
                <p className="text-white/80 text-sm md:text-base">
                  {schoolInfo ? `${schoolInfo} • ` : ''}Are you ready to lock in?
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${(user?.current_streak || 0) > 0 ? 'bg-orange-500/40' : 'bg-white/10'}`}>
                  <Flame className={`w-5 h-5 ${(user?.current_streak || 0) > 0 ? 'text-orange-300' : 'text-white/50'}`} />
                  <span className="text-sm font-bold text-white">{user?.current_streak || 0}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-yellow-400/40">
                  <Zap className="w-5 h-5 text-yellow-300" />
                  <span className="text-sm font-bold text-white">{dailyXP}/50</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-6xl mx-auto pb-28 md:pb-10">
        {/* CTA Cards - Right after hero */}
        <div className="grid grid-cols-2 gap-3 mb-6 -mt-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setCreateLessonModalOpen(true)}
            className="cursor-pointer group"
          >
            <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-purple-600 to-indigo-700 hover:scale-[1.02]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="text-base font-bold text-white">Upload Notes</h3>
                <p className="text-white/70 text-xs mt-0.5">Get AI study materials</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onClick={() => navigate(createPageUrl("SmartGrader"))}
            className="cursor-pointer group"
          >
            <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-emerald-500 to-teal-600 hover:scale-[1.02]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-white" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="text-base font-bold text-white">Grade My Work</h3>
                <p className="text-white/70 text-xs mt-0.5">Get instant AI feedback</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Courses */}
          <div className="lg:col-span-2 space-y-4">
            {/* Your Courses */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-900">Your Courses</h2>
                <button 
                  onClick={() => navigate(createPageUrl("LessonHistory"))}
                  className="text-xs text-purple-600 font-medium hover:text-purple-700 flex items-center gap-0.5"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {lessonsLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
              ) : lessons.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-purple-500" />
                  </div>
                  <p className="font-medium text-slate-700 mb-1">No courses yet</p>
                  <p className="text-sm text-slate-500 mb-4">Upload your first lesson to get started</p>
                  <Button onClick={() => setCreateLessonModalOpen(true)} className="bg-purple-600 hover:bg-purple-700">
                    <Upload className="w-4 h-4 mr-2" /> Upload Notes
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {lessons.slice(0, 5).map((lesson, idx) => {
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
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => navigate(`${createPageUrl("DocumentViewer")}?id=${lesson.id}`)}
                        className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getGradeColor(currentGrade)} flex flex-col items-center justify-center shadow-lg flex-shrink-0`}>
                            {currentGrade ? (
                              <>
                                <span className="text-white font-black text-lg leading-none">{currentGrade}</span>
                                <span className="text-white/70 text-[8px]">predicted</span>
                              </>
                            ) : (
                              <Target className="w-6 h-6 text-white" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 truncate group-hover:text-purple-700 transition-colors">
                              {lesson.course_name}
                            </h3>
                            
                            {plan ? (
                              <div className="mt-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[140px]">
                                    <div 
                                      className={`h-full rounded-full ${tasksRemaining === 0 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                                      style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-medium ${tasksRemaining === 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
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
                                <Sparkles className="w-3 h-3" /> Take diagnostic →
                              </p>
                            )}
                          </div>

                          {plan && tasksRemaining > 0 && (
                            <div className="hidden sm:flex flex-col items-center gap-1 px-3 py-2 bg-purple-50 rounded-xl border border-purple-100">
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

                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 flex-shrink-0" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Polly & Goals */}
          <div className="space-y-4">
            <PollyChatBox 
              lessons={lessons}
              studyPlans={studyPlans}
              user={user}
            />

            <LearningTrajectory studyPlans={studyPlans} lessons={lessons} />
            
            <DailyChallenge 
              studyMinutes={studyMinutesToday}
              questionsAnswered={questionsToday}
              flashcardsReviewed={flashcardsToday}
              compact={false}
            />
          </div>
        </div>
      </div>

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
  );
}