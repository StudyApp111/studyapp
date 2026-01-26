import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, FileCheck, ArrowRight, Sparkles, Upload, Flame, Zap, Target, Trophy, ChevronRight, Brain, Copy, GraduationCap, Crown } from "lucide-react";
import { UpgradeButton } from "@/components/subscription/UpgradeBadge";
import { motion } from "framer-motion";
// CreateLessonModal replaced with CreateLesson page
import DailyChallenge from "@/components/gamification/DailyChallenge";
import FirstSessionWelcome from "@/components/gamification/FirstSessionWelcome";
import { handleDailyReset } from "@/components/utils/dailyReset";
import LearningTrajectory from "@/components/home/LearningTrajectory";

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  // CreateLessonModal removed - using CreateLesson page instead
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
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
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
    flashcards: Copy,
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
  const schoolName = learningProfile?.school || '';
  const yearInfo = learningProfile?.grade || '';
  
  // Build subtitle: "University of X • Year 2" or just school or just year
  const subtitleParts = [];
  if (schoolName) subtitleParts.push(schoolName);
  if (yearInfo && !['professional_cert', 'standardized_tests', 'other'].includes(yearInfo)) {
    subtitleParts.push(yearInfo);
  }
  const subtitle = subtitleParts.join(' • ');

  return (
    <div className="min-h-screen bg-[#0a0a12]">
      {/* Hero Section */}
      <div className="relative overflow-hidden px-4 pt-10 pb-8 md:px-8 md:pt-14 md:pb-12 bg-gradient-to-b from-purple-900/50 to-[#0a0a12]">
        {/* Subtle gradient blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto relative">
        {/* Logo + App Name + Upgrade - Above Pill */}
        <div className="flex items-center justify-center gap-3 mb-8 md:mb-10">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/6afa508f0_LogoOnly.png"
            alt="StudyApp Logo"
            className="w-14 h-14 md:w-16 md:h-16"
          />
          <span className="text-4xl md:text-5xl font-black text-white">StudyApp</span>
          <UpgradeButton compact />
        </div>

          {/* Hero Pill - Full Width */}
          <div className="bg-white/5 backdrop-blur-md rounded-3xl px-6 py-6 md:px-10 md:py-8 border border-white/10 shadow-2xl">
            <div className="flex flex-col items-center text-center gap-4">
              {/* Title - Centered and Large */}
              <div>
                <h1 className="text-2xl md:text-4xl font-black text-white leading-tight">
                  Hey {firstName}, are you ready to lock in?
                </h1>
                {subtitle && (
                  <p className="text-slate-400 text-sm md:text-base mt-2">
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Stats Row - School, Year, Streak, XP */}
              <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
                {learningProfile?.school && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                    <BookOpen className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-bold text-slate-200">{learningProfile.school}</span>
                  </div>
                )}
                {learningProfile?.grade && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                    <GraduationCap className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-bold text-slate-200">{learningProfile.grade.replace(/_/g, ' ')}</span>
                  </div>
                )}
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-sm border ${(user?.current_streak || 0) > 0 ? 'bg-orange-500/20 border-orange-500/30' : 'bg-white/10 border-white/10'}`}>
                  <Flame className={`w-4 h-4 ${(user?.current_streak || 0) > 0 ? 'text-orange-400' : 'text-orange-400'}`} />
                  <span className={`text-sm font-bold ${(user?.current_streak || 0) > 0 ? 'text-orange-300' : 'text-slate-200'}`}>{user?.current_streak || 0} day streak</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-bold text-yellow-300">{dailyXP}/50 XP</span>
                </div>
              </div>

              {/* CTA Buttons - Right in the hero */}
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-2">
                <button
                  onClick={() => navigate(createPageUrl("CreateLesson"))}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:from-purple-500 hover:to-indigo-500 transition-all hover:scale-[1.02] border border-purple-500/50"
                >
                  <Upload className="w-5 h-5" />
                  Upload Notes
                </button>
                <button
                  onClick={() => navigate(createPageUrl("SmartGrader"))}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-2xl shadow-xl hover:from-emerald-500 hover:to-teal-500 transition-all hover:scale-[1.02] border border-emerald-500/50"
                >
                  <FileCheck className="w-5 h-5" />
                  Grade Essay
                </button>
              </div>
            </div>
          </div>
          </div>
          </div>

      <div className="p-4 md:p-8 max-w-6xl mx-auto pb-32 md:pb-10">


        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Courses */}
          <div className="lg:col-span-2 space-y-4">
            {/* Your Courses */}
            <div className="bg-[#12121a] rounded-2xl border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-700">
                <h2 className="font-bold text-white">Your Courses</h2>
                <button 
                  onClick={() => navigate(createPageUrl("LessonHistory"))}
                  className="text-xs text-white/90 font-medium hover:text-white flex items-center gap-0.5 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {lessonsLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
                </div>
              ) : lessons.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-purple-400" />
                  </div>
                  <p className="font-medium text-slate-200 mb-1">No courses yet</p>
                  <p className="text-sm text-slate-400 mb-4">Upload your first lesson to get started</p>
                  <Button onClick={() => navigate(createPageUrl("CreateLesson"))} className="bg-purple-600 hover:bg-purple-700">
                    <Upload className="w-4 h-4 mr-2" /> Upload Notes
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {lessons.slice(0, 3).map((lesson, idx) => {
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
                        className="p-4 hover:bg-white/5 transition-colors cursor-pointer group"
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
                            <h3 className="font-semibold text-slate-100 truncate group-hover:text-purple-400 transition-colors">
                              {lesson.course_name}
                            </h3>
                            
                            {plan ? (
                              <div className="mt-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden max-w-[140px]">
                                    <div 
                                      className={`h-full rounded-full ${tasksRemaining === 0 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                                      style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-medium ${tasksRemaining === 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    {tasksRemaining > 0 ? `${tasksRemaining} tasks left` : '✓ Complete'}
                                  </span>
                                </div>
                                {completedExams > 0 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Trophy className="w-3 h-3 text-amber-400" />
                                    <span className="text-[10px] text-slate-500">{completedExams} exam{completedExams > 1 ? 's' : ''}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-purple-400 mt-1 flex items-center gap-1 font-medium">
                                <Sparkles className="w-3 h-3" /> Take diagnostic →
                              </p>
                            )}
                          </div>

                          {plan && tasksRemaining > 0 && (
                            <div className="hidden sm:flex flex-col items-center gap-1 px-3 py-2 bg-purple-600/20 rounded-xl border border-purple-500/30">
                              {(() => {
                                const nextTask = plan.tasks?.find(t => !t.completed);
                                const Icon = TASK_ICONS[nextTask?.task_type] || Target;
                                return (
                                  <>
                                    <Icon className="w-4 h-4 text-purple-400" />
                                    <span className="text-[10px] text-purple-300 font-medium">
                                      {nextTask?.task_type === 'flashcards' ? 'Cards' :
                                       nextTask?.task_type === 'teach_it' ? 'Teach' :
                                       nextTask?.task_type === 'practice_exam' ? 'Quiz' : 'Notes'}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                          )}

                          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-purple-400 flex-shrink-0" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Goals */}
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
      </div>

      {/* CreateLessonModal removed - using CreateLesson page instead */}

      <FirstSessionWelcome 
        open={showWelcome}
        onOpenChange={setShowWelcome}
        userName={user?.full_name?.split(' ')[0]}
      />
    </div>
  );
}