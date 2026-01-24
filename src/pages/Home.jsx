import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, Clock, Calculator, Beaker, Globe, BookText, Languages, Code, Palette, Music, Briefcase, FileCheck, ArrowRight, Sparkles, Upload, Flame, Zap, Target, Trophy, ChevronRight, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import BadgeDisplay from "@/components/gamification/BadgeDisplay";
import CreateLessonModal from "@/components/modals/CreateLessonModal";
import { LessonActivityCard, AssignmentActivityCard } from "@/components/home/ActivityCard";
import XPProgressBar from "@/components/gamification/XPProgressBar";
import DailyChallenge from "@/components/gamification/DailyChallenge";
import FirstSessionWelcome from "@/components/gamification/FirstSessionWelcome";
import { handleDailyReset } from "@/components/utils/dailyReset";
import NextActionCard from "@/components/home/NextActionCard";
import LessonProgressCard from "@/components/home/LessonProgressCard";

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
  const lessonExams = {};
  allExams.forEach(e => {
    if (!lessonExams[e.lesson_id]) {
      lessonExams[e.lesson_id] = [];
    }
    lessonExams[e.lesson_id].push(e);
  });

  // Find the lesson with most urgent action needed
  const nextActionLesson = React.useMemo(() => {
    if (lessons.length === 0) return null;
    
    // Priority: 1) Lessons with incomplete tasks, 2) Lessons without study plan
    for (const lesson of lessons) {
      const plan = studyPlansByLesson[lesson.id];
      if (plan) {
        const incompleteTasks = plan.tasks?.filter(t => !t.completed) || [];
        if (incompleteTasks.length > 0) {
          return { lesson, plan, tasksRemaining: incompleteTasks.length };
        }
      }
    }
    
    // Find lesson without study plan (needs diagnostic)
    for (const lesson of lessons) {
      if (!studyPlansByLesson[lesson.id]) {
        return { lesson, plan: null, tasksRemaining: 0 };
      }
    }
    
    return lessons[0] ? { lesson: lessons[0], plan: studyPlansByLesson[lessons[0].id], tasksRemaining: 0 } : null;
  }, [lessons, studyPlansByLesson]);

  // Calculate stats
  const completedExams = allExams.filter(e => e.completed).length;
  const inProgressExams = allExams.filter(e => e.status === "in_progress").length;
  const totalExams = allExams.filter(e => e.completed).length;
  const avgScore = totalExams > 0
    ? Math.round(allExams.filter(e => e.completed).reduce((sum, e) => sum + (e.total_score || 0), 0) / totalExams)
    : 0;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h`;
    }
    return `${minutes}m`;
  };

  const getSubjectIcon = (courseName) => {
    const name = courseName.toLowerCase();
    
    // Math & Calculus
    if (name.includes('math') || name.includes('calculus') || name.includes('algebra') || name.includes('geometry') || name.includes('trigonometry') || name.includes('statistics')) {
      return Calculator;
    }
    // Science subjects
    if (name.includes('physics') || name.includes('chemistry') || name.includes('biology') || name.includes('science')) {
      return Beaker;
    }
    // Geography
    if (name.includes('geography') || name.includes('geo')) {
      return Globe;
    }
    // Humanities (History, Philosophy, etc)
    if (name.includes('history') || name.includes('humanities') || name.includes('philosophy') || name.includes('literature') || name.includes('english')) {
      return BookText;
    }
    // Languages
    if (name.includes('language') || name.includes('french') || name.includes('spanish') || name.includes('german') || name.includes('chinese')) {
      return Languages;
    }
    // Computer Science
    if (name.includes('computer') || name.includes('coding') || name.includes('programming') || name.includes('cs')) {
      return Code;
    }
    // Art
    if (name.includes('art') || name.includes('design')) {
      return Palette;
    }
    // Music
    if (name.includes('music')) {
      return Music;
    }
    // Business/Economics
    if (name.includes('business') || name.includes('economics') || name.includes('econ') || name.includes('finance') || name.includes('accounting')) {
      return Briefcase;
    }
    
    // Default
    return BookOpen;
  };



  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto pb-28 md:pb-10">
      {/* Hero Section with Gamification */}
      <div className="mb-5 md:mb-8">
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-purple-600 via-purple-700 to-yellow-500 p-4 md:p-8 shadow-xl md:shadow-2xl">
          <div className="absolute top-0 right-0 w-40 md:w-64 h-40 md:h-64 bg-white/10 rounded-full blur-3xl -mr-20 md:-mr-32 -mt-20 md:-mt-32" />
          <div className="absolute bottom-0 left-0 w-32 md:w-48 h-32 md:h-48 bg-yellow-400/20 rounded-full blur-2xl -ml-16 md:-ml-24 -mb-16 md:-mb-24" />

          <div className="relative">
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2 mb-1 md:mb-2">
                <h1 className="text-xl md:text-4xl font-bold text-white">
                  Hi {user.full_name?.split(' ')[0] || 'there'}! 👋
                </h1>
                <span className="bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-white text-xs md:text-sm font-semibold">
                  Level {user?.level || 1}
                </span>
              </div>
              <p className="text-white/90 text-sm md:text-lg max-w-2xl mx-auto">
                {learningProfile?.grade && learningProfile?.school ? (
                  <>
                    {learningProfile.grade} at {learningProfile.school}
                  </>
                ) : (
                  "Ready to ace your next exam?"
                )}
              </p>
            </div>

            {/* Gamification Stats Row */}
            <div className="flex items-center justify-center gap-3 md:gap-4 flex-wrap">
              {/* Streak */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${user.current_streak > 0 ? 'bg-white/20' : 'bg-white/10'}`}>
                <Flame className={`w-4 h-4 md:w-5 md:h-5 ${user.current_streak > 0 ? 'text-orange-400' : 'text-white/50'}`} />
                <span className="text-white font-bold text-sm md:text-base">{user.current_streak || 0}</span>
                <span className="text-white/70 text-xs md:text-sm">day streak</span>
              </div>

              {/* Daily XP */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20">
                <Zap className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />
                <span className="text-white font-bold text-sm md:text-base">{dailyXP}</span>
                <span className="text-white/70 text-xs md:text-sm">/ 50 XP today</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Action - What to do NOW */}
      {nextActionLesson && (
        <div className="mb-5 md:mb-8 max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm md:text-base font-bold text-slate-900">Continue where you left off</h2>
          </div>
          <NextActionCard 
            lesson={nextActionLesson.lesson}
            studyPlan={nextActionLesson.plan}
            tasksRemaining={nextActionLesson.tasksRemaining}
          />
        </div>
      )}

      {/* Daily Challenges - Both Mobile and Desktop */}
      <div className="mb-5 md:mb-8 max-w-6xl mx-auto">
        <DailyChallenge 
          studyMinutes={studyMinutesToday}
          questionsAnswered={questionsToday}
          flashcardsReviewed={flashcardsToday}
        />
      </div>

      {/* All Lessons Progress */}
      {!isLoading && lessons.length > 0 && (
        <div className="mb-5 md:mb-8 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm md:text-base font-bold text-slate-900">Your Courses</h2>
            <button 
              onClick={() => navigate(createPageUrl("LessonHistory"))}
              className="text-xs text-purple-600 font-medium hover:text-purple-700 flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
            {lessons.slice(0, 6).map((lesson, idx) => (
              <LessonProgressCard 
                key={lesson.id}
                lesson={lesson}
                studyPlan={studyPlansByLesson[lesson.id]}
                index={idx}
              />
            ))}
          </div>
        </div>
      )}

      {/* CTA Cards - Full and descriptive */}
      <div className="mb-5 md:mb-8 max-w-6xl mx-auto">
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

      {/* Recent Graded Assignments */}
      {!isLoading && gradedAssignments.length > 0 && (
        <div className="mb-8 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm md:text-base font-bold text-slate-900">Recent Graded Work</h2>
            <button 
              onClick={() => navigate(createPageUrl("AssignmentHistory"))}
              className="text-xs text-purple-600 font-medium hover:text-purple-700 flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
            {gradedAssignments.slice(0, 3).map((assignment, idx) => (
              <AssignmentActivityCard 
                key={`assignment-${assignment.id}`} 
                assignment={assignment}
                index={idx}
              />
            ))}
          </div>
        </div>
      )}

{/* Create Lesson Modal */}
<CreateLessonModal 
  open={createLessonModalOpen} 
  onOpenChange={setCreateLessonModalOpen} 
/>

{/* First Session Welcome */}
<FirstSessionWelcome 
  open={showWelcome}
  onOpenChange={setShowWelcome}
  userName={user?.full_name?.split(' ')[0]}
/>
</div>
);
}