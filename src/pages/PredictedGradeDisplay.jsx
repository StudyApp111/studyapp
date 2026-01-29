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
  
  // New diagnostic quiz flow params
  const grade = queryParams.get("grade");
  const strongAreas = queryParams.get("strongAreas");
  const weakAreas = queryParams.get("weakAreas");
  const studyDays = queryParams.get("studyDays");
  const subject = queryParams.get("subject");
  const school = queryParams.get("school");
  const courseCode = queryParams.get("courseCode");
  
  const { triggerUpgradeModal } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Try to get current user (may not be authenticated yet)
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        const firstName = currentUser.full_name?.split(' ')[0] || 'Student';
        setUserName(firstName);
      } catch (err) {
        // User not authenticated - that's OK for this page
        setUserName('Student');
      } finally {
        // Minimum 2s loading for dramatic reveal
        setTimeout(() => setLoading(false), 2000);
      }
    };
    
    loadUser();
  }, []);

  const handleGetStudyPlan = async () => {
    // First check if user is authenticated
    if (!user) {
      // Redirect to login, then back here after auth
      base44.auth.redirectToLogin(location.pathname + location.search);
      return;
    }
    
    // User is authenticated - show upgrade modal (hard paywall)
    triggerUpgradeModal("unlock_study_plan", {
      onSuccess: () => {
        // After successful payment/promo, navigate to CreateLesson with course name pre-filled
        navigate(createPageUrl("CreateLesson") + `?courseName=${encodeURIComponent(courseCode || '')}`);
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

  // Parse diagnostic results
  const parsedStrongAreas = strongAreas ? JSON.parse(strongAreas) : [];
  const parsedWeakAreas = weakAreas ? JSON.parse(weakAreas) : [];
  
  // Calculate score percentage from grade
  const getScoreFromGrade = (grade) => {
    const gradeMap = {
      'A+': 97, 'A': 93, 'A-': 90,
      'B+': 87, 'B': 83, 'B-': 80,
      'C+': 77, 'C': 73, 'C-': 70,
      'D+': 67, 'D': 63, 'D-': 60,
      'F': 50
    };
    return gradeMap[grade] || 70;
  };
  
  const scorePercentage = getScoreFromGrade(grade);

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
            {courseCode} • {subject}
          </p>
        </div>

        {/* Main Grade Card - Colorful like Study Plan */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getGradeColor(grade)} p-6 md:p-8 shadow-2xl`}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          
          <div className="relative text-center space-y-6">
            {/* Grade Display */}
            <div>
              <p className="text-white/80 text-xs md:text-sm font-bold uppercase tracking-wider mb-2">
                Your Predicted Exam Grade
              </p>
              <div className="flex items-center justify-center gap-4">
                <span className="text-7xl md:text-8xl font-black text-white drop-shadow-2xl">
                  {grade}
                </span>
                <span className="text-4xl md:text-5xl font-black text-white/80">
                  {scorePercentage}%
                </span>
              </div>
            </div>

            {/* Motivational tagline */}
            <p className="text-white text-lg md:text-xl font-semibold max-w-lg mx-auto">
              But you're not settling for a <span className="line-through opacity-60">{grade}</span>. 
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
            <p className="text-purple-200/80 text-sm">Based on your answers:</p>
            <div className="space-y-3 pt-2">
              {parsedWeakAreas.length > 0 ? (
                parsedWeakAreas.map((area, idx) => (
                  <div key={idx} className="bg-slate-900/40 backdrop-blur-sm rounded-xl p-4 border border-orange-500/30">
                    <p className="text-sm md:text-base text-white/95 font-medium flex items-start gap-2">
                      <span className="text-orange-400 mt-0.5">✗</span>
                      {area}
                    </p>
                  </div>
                ))
              ) : (
                <div className="bg-slate-900/40 backdrop-blur-sm rounded-xl p-4 border border-orange-500/30">
                  <p className="text-sm md:text-base text-white/95 font-medium">Limited diagnostic data</p>
                </div>
              )}
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
            <p className="text-purple-200/80 text-sm">To reach an A+:</p>
            <div className="space-y-3 pt-2">
              {parsedWeakAreas.length > 0 && (
                <div className="flex items-center gap-3 bg-slate-900/40 backdrop-blur-sm rounded-xl p-4 border border-emerald-500/30">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-base md:text-lg font-semibold text-white">
                    Focus on these {parsedWeakAreas.length} topic{parsedWeakAreas.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 bg-slate-900/40 backdrop-blur-sm rounded-xl p-4 border border-emerald-500/30">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <span className="text-base md:text-lg font-semibold text-white">
                  Estimated study time: {studyDays} days
                </span>
              </div>
              {parsedStrongAreas.length > 0 && (
                <div className="flex items-center gap-3 bg-slate-900/40 backdrop-blur-sm rounded-xl p-4 border border-emerald-500/30">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-base md:text-lg font-semibold text-white">
                    Build on your strengths in {parsedStrongAreas.length} area{parsedStrongAreas.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
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

        {/* CTA - Single Button Only */}
        <div className="pt-4">
          <Button 
            onClick={handleGetStudyPlan}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-7 text-lg md:text-xl rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all hover:scale-[1.02] group"
          >
            <Sparkles className="h-6 w-6 mr-2 group-hover:rotate-12 transition-transform" />
            Get My Free Study Plan
            <ArrowRight className="h-6 w-6 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-slate-500 text-xs">Powered by StudyApp.AI</p>
        </div>
      </div>
    </div>
  );
}