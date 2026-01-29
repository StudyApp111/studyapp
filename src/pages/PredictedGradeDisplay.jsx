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
  switch (grade?.toUpperCase()) {
    case 'A+': return 'from-emerald-500 to-green-600';
    case 'A': return 'from-emerald-400 to-green-500';
    case 'A-': return 'from-lime-500 to-green-500';
    case 'B+': return 'from-yellow-400 to-lime-500';
    case 'B': return 'from-yellow-500 to-orange-400';
    case 'B-': return 'from-amber-500 to-orange-500';
    case 'C+': return 'from-orange-400 to-red-500';
    case 'C': return 'from-orange-500 to-red-600';
    case 'C-': return 'from-red-500 to-rose-600';
    default: return 'from-rose-500 to-red-700';
  }
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
        const user = await base44.auth.me();
        const profile = user.learning_profile_id 
          ? await base44.entities.LearningProfile.get(user.learning_profile_id)
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

  const handleUnlock = () => {
    if (!isPro) {
      triggerUpgradeModal("unlock_study_plan");
    } else {
      navigate(createPageUrl("DocumentViewer") + `?lessonId=${lessonId}`);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8 overflow-y-auto">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-6">
        {/* Logo */}
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* Main Grade Card */}
        <Card className="bg-slate-800/60 backdrop-blur-xl border-slate-700/50 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Grade Display */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className={`absolute inset-0 bg-gradient-to-r ${getGradeColor(insights.predicted_grade)} blur-2xl opacity-50 animate-pulse`} />
                  <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-slate-900/80 border-4 border-purple-500/50 flex flex-col items-center justify-center shadow-2xl">
                    <span className="text-5xl md:text-6xl font-extrabold bg-gradient-to-br from-white to-purple-200 bg-clip-text text-transparent">
                      {insights.predicted_grade}
                    </span>
                    <span className="text-sm text-purple-300 mt-1">
                      {insights.score_percentage}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Course Info */}
              <div className="flex-1 text-center md:text-left space-y-3">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                    {lesson?.course_name}
                  </h2>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <Badge className={`${getDifficultyColor(insights.course_difficulty)} border px-3 py-1`}>
                      <Target className="w-3 h-3 mr-1" />
                      {insights.course_difficulty}
                    </Badge>
                    <Badge variant="outline" className="border-purple-400/50 text-purple-200 bg-purple-500/10 px-3 py-1">
                      <Clock className="w-3 h-3 mr-1" />
                      {insights.time_commitment}
                    </Badge>
                    <Badge variant="outline" className="border-slate-400/50 text-slate-300 bg-slate-500/10 px-3 py-1">
                      Confidence: {insights.confidence_level}
                    </Badge>
                  </div>
                </div>
                <p className="text-purple-200/90 text-base md:text-lg">
                  Based on thousands of students in similar courses, here's your predicted starting grade.
                </p>
              </div>
            </div>
          </div>

          <CardContent className="p-6 md:p-8 space-y-6">
            {/* Key Insights */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                <h3 className="text-lg font-bold text-white">What Makes This Course Challenging</h3>
              </div>
              <div className="space-y-2">
                {insights.key_insights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-sm text-purple-100/90 bg-slate-900/40 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* High-Yield Topics */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold text-white">Focus On These Topics First</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {insights.high_yield_topics.map((topic, idx) => (
                  <Badge key={idx} variant="outline" className="border-blue-400/50 text-blue-200 bg-blue-500/10 px-3 py-1.5">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Success Strategies Preview */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-xl p-5 border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">How to Get to an A+</h3>
              </div>
              <div className="space-y-2">
                {insights.success_strategies.slice(0, 3).map((strategy, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-sm text-emerald-100/90">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{strategy}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* What You'll Get */}
            <div className="bg-slate-900/60 rounded-xl p-5 border border-purple-500/30">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Your Personalized Study Plan Includes:
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { icon: Target, text: "AI-powered diagnostic to pinpoint your weak spots" },
                  { icon: Zap, text: "Custom practice problems targeting your gaps" },
                  { icon: Trophy, text: "Real-time grade predictions as you improve" },
                  { icon: TrendingUp, text: "Personalized study tasks to boost your grade" }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-sm text-purple-100/90">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="mt-1">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="space-y-3 pt-4">
              <Button 
                onClick={handleUnlock}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-6 text-lg rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all hover:scale-[1.02] group"
              >
                <Sparkles className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" />
                {isPro ? "Start Your Study Plan" : "Unlock Your Study Plan"}
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => navigate(createPageUrl("Home"))}
                className="w-full text-purple-300/80 hover:text-white hover:bg-white/5"
              >
                Maybe later
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-slate-500 text-xs">Powered by StudyApp.AI</p>
        </div>
      </div>
    </div>
  );
}