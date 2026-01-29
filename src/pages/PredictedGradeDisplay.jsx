import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge, Sparkles, Trophy, Loader2 } from "lucide-react";
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
    case 'D+':
    case 'D':
    case 'D-':
    case 'F': return 'from-rose-500 to-red-700';
    default: return 'from-slate-400 to-gray-500';
  }
};

export default function PredictedGradeDisplay() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const lessonId = queryParams.get("lessonId");
  const predictedGrade = queryParams.get("grade") || "B-";
  const score = queryParams.get("score") || "75";
  const { isPro, triggerUpgradeModal } = useSubscription();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLesson = async () => {
      if (!lessonId) {
        navigate(createPageUrl("Home"), { replace: true });
        return;
      }
      
      try {
        const fetchedLesson = await base44.entities.Lesson.get(lessonId);
        setLesson(fetchedLesson);
      } catch (error) {
        console.error("Error fetching lesson:", error);
        navigate(createPageUrl("Home"), { replace: true });
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        <Card className="bg-slate-800/60 backdrop-blur-xl border-slate-700/50 text-white shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50">
              <Trophy className="h-10 w-10 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl md:text-3xl font-bold">Your Predicted Grade</CardTitle>
              <CardDescription className="text-purple-200/80 mt-2">
                Based on similar students in {lesson?.course_name}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Grade Display */}
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative">
                {/* Glow effect */}
                <div className={`absolute inset-0 bg-gradient-to-r ${getGradeColor(predictedGrade)} blur-2xl opacity-40 animate-pulse`} />
                
                {/* Grade circle */}
                <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-slate-900/80 border-4 border-purple-500 flex flex-col items-center justify-center shadow-xl">
                  <span className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                    {predictedGrade}
                  </span>
                  <span className="text-sm text-purple-300 mt-1">
                    {Math.round(parseFloat(score))}%
                  </span>
                </div>
              </div>
            </div>

            {/* Course badge */}
            <div className="flex justify-center">
              <Badge variant="outline" className="text-sm px-4 py-2 border-purple-400/50 text-purple-200 bg-purple-500/10">
                <Gauge className="h-4 w-4 mr-2" />
                {lesson?.course_name}
              </Badge>
            </div>

            {/* Motivational message */}
            <div className="text-center space-y-3 px-4">
              <p className="text-lg font-medium text-white">
                Good start! 🎯
              </p>
              <p className="text-purple-200/80 leading-relaxed">
                Get a personalized AI study plan to boost your grade to an <span className="font-bold text-emerald-400">A+</span>
              </p>
            </div>

            {/* Features preview */}
            <div className="bg-slate-900/40 rounded-xl p-4 space-y-2 border border-purple-500/20">
              <p className="text-xs text-purple-300 font-semibold uppercase tracking-wider mb-3">What You'll Get:</p>
              <div className="space-y-2 text-sm text-purple-100/90">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
                  <span>AI-powered study tasks tailored to your weaknesses</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
                  <span>Practice exams that predict your real grade</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
                  <span>Track improvement in real-time</span>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button 
              onClick={handleUnlock}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-6 text-lg rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all hover:scale-[1.02]"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Unlock Your Study Plan
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate(createPageUrl("Home"))}
              className="w-full text-purple-300/80 hover:text-white hover:bg-white/5"
            >
              Maybe later
            </Button>
          </CardFooter>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-slate-500 text-xs">Powered by StudyApp.AI</p>
        </div>
      </div>
    </div>
  );
}