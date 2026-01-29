import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Gauge, Sparkles, Trophy, Loader2, Target, Clock, BookOpen, 
  TrendingUp, Lightbulb, CheckCircle2, AlertCircle, Zap, ArrowRight 
} from "lucide-react";
import { useSubscription } from "@/components/subscription/SubscriptionContext";
import { base44 } from "@/api/base44Client";

const getGradeColor = (grade) => {
  if (!grade || grade === '—') return 'from-slate-500 to-slate-600';
  if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
  if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
  if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
  return 'from-red-500 to-rose-600';
};

const getDifficultyColor = (difficulty) => {
  switch (difficulty) {
    case 'Easy': return 'text-green-400 bg-green-500/10 border-green-500/30';
    case 'Moderate': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'Challenging': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'Very Challenging': return 'text-red-400 bg-red-500/10 border-red-500/30';
    default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  }
};

export default function PredictedGradeDisplay() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const lessonId = queryParams.get("lessonId");
  const { isPro, triggerUpgradeModal } = useSubscription();

  const [lesson, setLesson] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!lessonId) {
        navigate(createPageUrl("Home"), { replace: true });
        return;
      }
      
      try {
        // Fetch lesson
        const fetchedLesson = await base44.entities.Lesson.get(lessonId);
        setLesson(fetchedLesson);

        // Get user profile for context
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Extract first name
        const firstName = currentUser.full_name?.split(' ')[0] || 'Student';
        setUserName(firstName);
        
        const profile = currentUser.learning_profile_id 
          ? await base44.entities.LearningProfile.get(currentUser.learning_profile_id)
          : null;

        // Generate AI insights
        const result = await base44.functions.invoke('generateCourseInsights', {
          course_name: fetchedLesson.course_name,
          school: profile?.school,
          grade: profile?.grade
        });

        if (result?.data?.success && result.data.insights) {
          setInsights(result.data.insights);
        } else {
          throw new Error('Failed to generate insights');
        }
      } catch (err) {
        console.error("Error loading data:", err);
        setError(err.message);
      } finally {
        // Minimum 2s loading for authenticity
        setTimeout(() => setLoading(false), 2000);
      }
    };
    
    fetchData();
  }, [lessonId, navigate]);

  const handleUnlock = async () => {
    // Check if already pro
    if (isPro) {
      // Already pro, go straight to upload materials
      navigate(createPageUrl("CreateLesson") + `?lessonId=${lessonId}&courseName=${encodeURIComponent(lesson?.course_name || '')}`);
      return;
    }
    
    // Show upgrade modal as hard paywall
    triggerUpgradeModal("unlock_study_plan", {
      onSuccess: () => {
        // After successful payment/promo, navigate to CreateLesson with course name
        navigate(createPageUrl("CreateLesson") + `?lessonId=${lessonId}&courseName=${encodeURIComponent(lesson?.course_name || '')}`);
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
            <Trophy className="relative h-20 w-20 text-purple-400 mx-auto animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Analyzing Your Course...</h2>
            <p className="text-purple-300">Predicting your grade and generating personalized insights</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <Card className="bg-slate-800/60 backdrop-blur-xl border-red-500/30 text-white max-w-md">
          <CardHeader>
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <CardTitle>Unable to Generate Insights</CardTitle>
            <CardDescription className="text-slate-300">
              {error || 'Something went wrong'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(createPageUrl("Home"))} className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-y-auto pb-20">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 pt-8 space-y-6">
        {/* Logo */}
        <div className="text-center mb-4">
          <h1 className="text-2xl md:text-3xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* Scroll Indicator */}
        <div className="text-center mb-2">
          <p className="text-purple-300/60 text-xs animate-pulse">↓ Scroll to see your full report ↓</p>
        </div>

        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-3xl md:text-4xl font-black text-white">
            {userName}'s Report Card
          </h2>
          <p className="text-purple-200/80 text-sm md:text-base">
            {lesson?.course_name}
          </p>
        </div>

        {/* Main Grade Card - Colorful like Study Plan */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getGradeColor(insights.predicted_grade)} p-6 md:p-8 shadow-2xl`}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          
          <div className="relative text-center space-y-6">
            {/* Grade Display */}
            <div>
              <p className="text-white/80 text-xs md:text-sm font-bold uppercase tracking-wider mb-2">
                Based on thousands of students like you, we think you'll get:
              </p>
              <div className="flex items-center justify-center gap-4">
                <span className="text-7xl md:text-8xl font-black text-white drop-shadow-2xl">
                  {insights.predicted_grade}
                </span>
                <span className="text-4xl md:text-5xl font-black text-white/80">
                  {insights.score_percentage}%
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Badge className={`${getDifficultyColor(insights.course_difficulty)} border-2 px-4 py-2 text-sm`}>
                <Target className="w-4 h-4 mr-2" />
                {insights.course_difficulty} Course
              </Badge>
              <Badge className="bg-white/20 text-white border-2 border-white/30 px-4 py-2 text-sm">
                <Clock className="w-4 h-4 mr-2" />
                {insights.time_commitment} weekly
              </Badge>
            </div>

            {/* Motivational tagline */}
            <p className="text-white text-lg md:text-xl font-semibold max-w-lg mx-auto">
              But you're not settling for a <span className="line-through opacity-60">{insights.predicted_grade}</span>. 
              You want an <span className="text-emerald-300 font-black">A+</span>.
            </p>
          </div>
        </div>

        {/* Why You Might Struggle - Visually Striking */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/30 to-red-500/30 backdrop-blur-xl border-2 border-orange-500/60 p-6 md:p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl" />
          <div className="relative text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mb-3 shadow-xl">
              <AlertCircle className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-3xl md:text-4xl font-black text-white">
              Why {userName} Might Struggle
            </h3>
            <div className="space-y-3 pt-2">
              {insights.key_insights.map((insight, idx) => (
                <div key={idx} className="bg-slate-900/40 backdrop-blur-sm rounded-xl p-4 border border-orange-500/30">
                  <p className="text-sm md:text-base text-white/95 font-medium">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Success Path - Visually Striking */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/30 to-green-500/30 backdrop-blur-xl border-2 border-emerald-500/60 p-6 md:p-8 shadow-2xl">
          <div className="absolute top-0 left-0 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="relative text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mb-3 shadow-xl">
              <Trophy className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-3xl md:text-4xl font-black text-white">
              Do You Want an A+, {userName}?
            </h3>
            <div className="space-y-3 pt-2">
              {insights.success_strategies.map((strategy, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-slate-900/40 backdrop-blur-sm rounded-xl p-4 border border-emerald-500/30">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-base md:text-lg font-semibold text-white">{strategy}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How You Do It - Colored Borders */}
        <Card className="bg-slate-800/60 backdrop-blur-xl border-purple-500/40 overflow-hidden">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl md:text-3xl font-bold text-white mb-1">
              Here's How You Do It:
            </CardTitle>
            <CardDescription className="text-purple-200/80 text-sm">
              StudyApp learns from your mistakes and guides your studying
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { 
                icon: Target, 
                title: "Find Your Weak Spots", 
                desc: "AI diagnostic pinpoints what you don't know",
                color: "from-pink-500 to-rose-600",
                borderColor: "border-pink-500/60"
              },
              { 
                icon: Zap, 
                title: "Custom Practice", 
                desc: "Questions targeting YOUR gaps",
                color: "from-blue-500 to-indigo-600",
                borderColor: "border-blue-500/60"
              },
              { 
                icon: Trophy, 
                title: "Know Your Grade Early", 
                desc: "Real-time predictions as you study",
                color: "from-emerald-500 to-teal-600",
                borderColor: "border-emerald-500/60"
              },
              { 
                icon: TrendingUp, 
                title: "Clear Action Plan", 
                desc: "Follow tasks, watch grade climb",
                color: "from-amber-500 to-orange-600",
                borderColor: "border-amber-500/60"
              }
            ].map((item, idx) => (
              <div key={idx} className={`flex items-start gap-4 bg-slate-900/40 rounded-xl p-4 border-2 ${item.borderColor}`}>
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-bold text-base mb-1">{item.title}</h4>
                  <p className="text-purple-200/70 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* CTA - No escape route */}
        <div className="pt-4">
          <Button 
            onClick={handleUnlock}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-7 text-lg md:text-xl rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all hover:scale-[1.02] group"
          >
            <Sparkles className="h-6 w-6 mr-2 group-hover:rotate-12 transition-transform" />
            Let's Do This, {userName}
            <ArrowRight className="h-6 w-6 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <p className="text-center text-xs text-purple-300/60 mt-3">
            7-day free trial • No credit card • Cancel anytime
          </p>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-slate-500 text-xs">Powered by StudyApp.AI</p>
        </div>
      </div>
    </div>
  );
}