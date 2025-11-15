import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, TrendingUp, Award, Clock, Zap, Trophy, Flame, Calculator, Microscope, Globe, Palette, Code2, DollarSign, Languages, Briefcase, Music, Dumbbell, FlaskConical, Brain, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import BadgeDisplay from "@/components/gamification/BadgeDisplay";

const getSubjectIcon = (courseName) => {
  const name = courseName.toLowerCase();
  
  if (name.includes('math') || name.includes('calculus') || name.includes('algebra') || name.includes('geometry') || name.includes('trigonometry')) {
    return Calculator;
  }
  if (name.includes('biology') || name.includes('chemistry') || name.includes('physics') || name.includes('science')) {
    return Microscope;
  }
  if (name.includes('chem')) {
    return FlaskConical;
  }
  if (name.includes('geography') || name.includes('geo')) {
    return Globe;
  }
  if (name.includes('computer') || name.includes('coding') || name.includes('programming') || name.includes('technology') || name.includes('cs')) {
    return Code2;
  }
  if (name.includes('business') || name.includes('economics') || name.includes('finance') || name.includes('accounting')) {
    return DollarSign;
  }
  if (name.includes('english') || name.includes('french') || name.includes('spanish') || name.includes('language')) {
    return Languages;
  }
  if (name.includes('history') || name.includes('social')) {
    return MapPin;
  }
  if (name.includes('art') || name.includes('design') || name.includes('visual')) {
    return Palette;
  }
  if (name.includes('music')) {
    return Music;
  }
  if (name.includes('physical') || name.includes('pe') || name.includes('sport')) {
    return Dumbbell;
  }
  if (name.includes('psychology') || name.includes('philosophy') || name.includes('psych')) {
    return Brain;
  }
  if (name.includes('management') || name.includes('marketing')) {
    return Briefcase;
  }
  
  return BookOpen;
};

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        if (!currentUser.onboarding_completed) {
          navigate(createPageUrl("Onboarding"));
        }
      } catch (error) {
        console.error("Error checking user:", error);
      }
    };
    
    checkOnboarding();
  }, [navigate]);

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: () => base44.entities.Lesson.list('-created_date', 6),
    initialData: [],
  });

  const { data: allWorksheets = [] } = useQuery({
    queryKey: ['worksheets'],
    queryFn: () => base44.entities.Worksheet.list('-created_date'),
    initialData: [],
  });

  const lessonWorksheets = {};
  allWorksheets.forEach(w => {
    if (!lessonWorksheets[w.lesson_id]) {
      lessonWorksheets[w.lesson_id] = [];
    }
    lessonWorksheets[w.lesson_id].push(w);
  });

  const completedWorksheets = allWorksheets.filter(w => w.completed).length;
  const inProgressWorksheets = allWorksheets.filter(w => w.status === "in_progress").length;
  const totalQuizzes = allWorksheets.filter(w => w.completed).length;
  const avgScore = totalQuizzes > 0
    ? Math.round(allWorksheets.filter(w => w.completed).reduce((sum, w) => sum + (w.total_score || 0), 0) / totalQuizzes)
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
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  const SimpleLessonCard = ({ lesson }) => {
    const worksheets = (lessonWorksheets[lesson.id] || []).sort((a, b) => a.worksheet_number - b.worksheet_number);
    const completedCount = worksheets.filter(w => w.completed).length;
    const totalWorksheets = 6;
    const latestCompletedWorksheet = worksheets.filter(w => w.completed).pop();
    const progress = (completedCount / totalWorksheets) * 100;
    const SubjectIcon = getSubjectIcon(lesson.course_name);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        onClick={() => navigate(createPageUrl("LessonDetail") + `?lessonId=${lesson.id}`)}
        className="cursor-pointer"
      >
        <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-lg relative overflow-hidden hover:scale-105">
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200">
            <div 
              className={`h-full transition-all duration-500 ${
                completedCount === totalWorksheets ? 'bg-emerald-500' : 
                completedCount > 0 ? 'bg-yellow-500' : 'bg-purple-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <CardHeader className="pb-4 pt-6">
            <div className="flex items-center justify-between mb-3">
              <SubjectIcon className={`w-8 h-8 ${
                completedCount === totalWorksheets ? 'text-emerald-600' :
                completedCount > 0 ? 'text-yellow-600' : 'text-purple-600'
              }`} />
              <Badge className={`${
                completedCount === totalWorksheets ? 'bg-emerald-100 text-emerald-700' :
                completedCount > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'
              } border`}>
                {completedCount}/{totalWorksheets}
              </Badge>
            </div>
            <CardTitle className="text-xl text-slate-900 leading-tight">{lesson.course_name}</CardTitle>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Progress</span>
                  <span className="font-semibold text-slate-900">{completedCount} / {totalWorksheets}</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {latestCompletedWorksheet ? (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-yellow-50 rounded-lg border border-yellow-300 shadow-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1">Predicted Grade</p>
                      <p className="text-3xl font-bold text-slate-900">{latestCompletedWorksheet.predicted_grade}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-600 mb-1">Score</p>
                      <p className="text-3xl font-bold text-purple-600">{Math.round(latestCompletedWorksheet.total_score)}%</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <p className="text-sm text-slate-500">No grade yet - start your first worksheet</p>
                </div>
              )}

              <div className="pt-2 text-center">
                <p className="text-xs text-slate-500">Click to view details →</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40">
      {/* Rolling Banner */}
      <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-yellow-500 overflow-hidden">
        <div className="py-2.5">
          <div className="flex animate-scroll whitespace-nowrap">
            <div className="flex items-center gap-8 px-8">
              <span className="text-white font-semibold">🎓 New Feature: Smart Grader now supports custom rubrics</span>
              <span className="text-white/70">•</span>
              <span className="text-white font-semibold">🔥 Track your learning streak</span>
              <span className="text-white/70">•</span>
              <span className="text-white font-semibold">✨ Earn badges as you learn</span>
              <span className="text-white/70">•</span>
            </div>
            <div className="flex items-center gap-8 px-8">
              <span className="text-white font-semibold">🎓 New Feature: Smart Grader now supports custom rubrics</span>
              <span className="text-white/70">•</span>
              <span className="text-white font-semibold">🔥 Track your learning streak</span>
              <span className="text-white/70">•</span>
              <span className="text-white font-semibold">✨ Earn badges as you learn</span>
              <span className="text-white/70">•</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 20s linear infinite;
        }
      `}</style>

      <div className="p-4 md:p-10 max-w-6xl mx-auto">
        <div className="mb-8 md:mb-12">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-purple-700 to-yellow-500 p-8 md:p-12 shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-400/20 rounded-full blur-2xl -ml-24 -mb-24" />
            
            <div className="relative text-center">
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
                Welcome back, {user.full_name?.split(' ')[0] || 'Learner'}! 👋
              </h1>
              <p className="text-white/90 text-base md:text-xl mb-6 max-w-2xl mx-auto">
                Ready to continue your learning journey?
              </p>
              
              <div className="flex items-center justify-center gap-3 md:gap-4 flex-wrap">
                {user.total_points > 0 && (
                  <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-full shadow-lg">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm font-semibold text-slate-700">Level {user.level || 1}</span>
                    <span className="text-xs text-slate-500">• {user.total_points || 0} pts</span>
                  </div>
                )}
                
                {(user.current_streak || 0) > 0 && (
                  <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-full shadow-lg">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <span className="text-sm font-semibold text-slate-700">{user.current_streak} day streak</span>
                  </div>
                )}
                
                {user.badges && user.badges.length > 0 && (
                  <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-full shadow-lg">
                    <Award className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-semibold text-slate-700">{user.badges.length} {user.badges.length === 1 ? 'badge' : 'badges'}</span>
                  </div>
                )}
                
                {(user.time_spent_seconds || 0) > 0 && (
                  <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-full shadow-lg">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-semibold text-slate-700">{formatTime(user.time_spent_seconds)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-10 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-700 opacity-10" />
              <CardContent className="p-4 md:p-6 relative">
                <div className="flex flex-col gap-3">
                  <div className="p-2 md:p-3 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 shadow-lg w-fit">
                    <Award className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-medium text-slate-600 mb-1">Completed</p>
                    <p className="text-2xl md:text-3xl font-bold text-slate-900">{completedWorksheets}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-yellow-600 opacity-10" />
              <CardContent className="p-4 md:p-6 relative">
                <div className="flex flex-col gap-3">
                  <div className="p-2 md:p-3 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg w-fit">
                    <Clock className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-medium text-slate-600 mb-1">In Progress</p>
                    <p className="text-2xl md:text-3xl font-bold text-slate-900">{inProgressWorksheets}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-purple-800 opacity-10" />
              <CardContent className="p-4 md:p-6 relative">
                <div className="flex flex-col gap-3">
                  <div className="p-2 md:p-3 rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 shadow-lg w-fit">
                    <Zap className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-medium text-slate-600 mb-1">Total Tests</p>
                    <p className="text-2xl md:text-3xl font-bold text-slate-900">{totalQuizzes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-amber-600 opacity-10" />
              <CardContent className="p-4 md:p-6 relative">
                <div className="flex flex-col gap-3">
                  <div className="p-2 md:p-3 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 shadow-lg w-fit">
                    <TrendingUp className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-medium text-slate-600 mb-1">Avg Score</p>
                    <p className="text-2xl md:text-3xl font-bold text-slate-900">{avgScore}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">Recent Lessons</h2>
            <Button
              onClick={() => navigate(createPageUrl("CreateLesson"))}
              className="hidden md:flex bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-slate-900 font-semibold shadow-lg shadow-yellow-500/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Lesson
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                  <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                </Card>
              ))}
            </div>
          ) : lessons.length === 0 ? (
            <Card className="text-center py-12 md:py-16 bg-gradient-to-br from-purple-50 to-yellow-50 border-dashed border-2 border-yellow-300 max-w-2xl mx-auto">
              <CardContent>
                <BookOpen className="w-12 h-12 md:w-16 md:h-16 mx-auto text-yellow-600 mb-4" />
                <h3 className="text-lg md:text-xl font-semibold text-slate-700 mb-2">No lessons yet</h3>
                <p className="text-sm md:text-base text-slate-500 mb-6">Create your first lesson to begin your learning journey</p>
                <Button
                  onClick={() => navigate(createPageUrl("CreateLesson"))}
                  className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-slate-900 font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Lesson
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {lessons.map(lesson => (
                <SimpleLessonCard key={lesson.id} lesson={lesson} />
              ))}
            </div>
          )}
        </div>

        {user.badges && user.badges.length > 0 && (
          <div className="mb-8 max-w-4xl mx-auto">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 text-center">Your Badges</h2>
            <BadgeDisplay badges={user.badges} size="compact" />
          </div>
        )}
      </div>
    </div>
  );
}