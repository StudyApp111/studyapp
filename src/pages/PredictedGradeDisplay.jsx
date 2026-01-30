import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { 
  Trophy, Loader2, Target, Clock, BookOpen, 
  TrendingUp, CheckCircle2, AlertCircle, Zap, ArrowRight,
  Lock, Sparkles, MessageSquare, FileText
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const getGradeColor = (grade) => {
  if (!grade || grade === '—') return 'from-slate-500 to-slate-600';
  if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
  if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
  if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
  return 'from-red-500 to-rose-600';
};

const getToolIcon = (tool) => {
  switch (tool) {
    case 'Teach It Cards': return BookOpen;
    case 'Practice Questions': return Target;
    case 'AI Tutor': return MessageSquare;
    case 'Note Generator': return FileText;
    default: return Zap;
  }
};

export default function PredictedGradeDisplay() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  // Get data from URL params (passed from DiagnosticQuiz)
  const name = queryParams.get("name");
  const school = queryParams.get("school");
  const courseCode = queryParams.get("courseCode");
  const reportDataParam = queryParams.get("reportData");
  
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    if (!school || !courseCode) {
      navigate(createPageUrl("Onboarding"), { replace: true });
      return;
    }

    // Parse report data from URL
    if (reportDataParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(reportDataParam));
        setReportData(parsed);
      } catch (e) {
        console.error("Failed to parse report data:", e);
      }
    }

    setUserName(name || 'Student');
    setTimeout(() => setLoading(false), 2000);
  }, [name, school, courseCode, reportDataParam, navigate]);

  const handleCTA = () => {
    // Always redirect to sign in page with context
    const signInUrl = `?from=report&course=${encodeURIComponent(courseCode || '')}&grade=${encodeURIComponent(reportData?.predicted_grade || '')}`;
    base44.auth.redirectToLogin(createPageUrl("Home") + signInUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-4">
        <div className="text-center space-y-6">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-black">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
              <span className="text-white">App</span>
            </h1>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
            <Trophy className="relative h-20 w-20 text-purple-400 mx-auto animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Generating Your Report Card...</h2>
            <p className="text-purple-300">Analyzing your performance</p>
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

  const grade = reportData?.predicted_grade || 'B';
  const percentage = reportData?.predicted_percentage || 80;
  const strongAreas = reportData?.strong_areas || [];
  const weakAreasDetailed = reportData?.weak_areas_detailed || [];
  const previewQuestion = reportData?.preview_question || {};
  const gradeTrajectory = reportData?.grade_trajectory || {};
  const personalizedMessage = reportData?.personalized_message || '';
  const urgencyMessage = reportData?.urgency_message || '';
  const studyIntensity = reportData?.study_intensity || '15-20 min/day';

  // Get first 2 lines of correct answer for blur preview
  const answerPreview = previewQuestion.correct_answer 
    ? previewQuestion.correct_answer.split('.').slice(0, 2).join('.') + '...'
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 overflow-y-auto pb-20">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 md:px-8 pt-8 space-y-8">
        {/* Logo */}
        <div className="text-center mb-4">
          <h1 className="text-3xl md:text-4xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-black text-white">
            {userName}'s Report Card
          </h2>
          <p className="text-purple-200/80 text-base">
            {courseCode} • {school}
          </p>
        </div>

        {/* Main Grade Card */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getGradeColor(grade)} p-6 md:p-8 shadow-2xl`}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          
          <div className="relative text-center space-y-4">
            <p className="text-white/80 text-sm font-bold uppercase tracking-wider">
              Your Predicted Exam Grade
            </p>
            <div className="flex items-center justify-center gap-4">
              <span className="text-7xl md:text-8xl font-black text-white drop-shadow-2xl">
                {grade}
              </span>
              <span className="text-4xl md:text-5xl font-black text-white/80">
                ({percentage}%)
              </span>
            </div>
            {personalizedMessage && (
              <p className="text-white/90 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                {personalizedMessage}
              </p>
            )}
          </div>
        </div>

        {/* Biggest Opportunity Section */}
        {weakAreasDetailed.length > 0 && previewQuestion.topic && (
          <div className="relative overflow-hidden rounded-2xl bg-black border-2 border-amber-500/60 p-4 sm:p-6 md:p-8 shadow-2xl w-full">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
            
            <div className="relative space-y-6">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Target className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white break-words">
                  Your Biggest Opportunity
                </h3>
              </div>

              <div className="space-y-2">
                <p className="text-lg sm:text-xl font-bold text-amber-400 break-words">{previewQuestion.topic}</p>
                <p className="text-white/80 text-sm sm:text-base break-words">
                  This topic alone is costing you <span className="font-bold text-red-400">{weakAreasDetailed[0]?.grade_impact}</span> on your exam.
                </p>
              </div>

              <p className="text-purple-300 text-sm">Here's a sample question you need to master:</p>

              {/* Preview Question */}
              <div className="bg-slate-900/80 rounded-xl p-4 sm:p-5 border border-purple-500/30 w-full">
                <p className="text-xs text-purple-400 uppercase tracking-wider mb-2">Question:</p>
                <p className="text-white font-medium leading-relaxed text-sm sm:text-base break-words">{previewQuestion.question_text}</p>
              </div>

              {/* Blurred Answer Section */}
              <div className="relative bg-slate-900/80 rounded-xl p-4 sm:p-5 border border-slate-700 overflow-hidden w-full min-h-[120px]">
                <p className="text-xs text-emerald-400 uppercase tracking-wider mb-2">Answer:</p>
                <p className="text-white/90 leading-relaxed text-sm sm:text-base break-words blur-[3px]">{previewQuestion.correct_answer || ''}</p>
                
                {/* Blur overlay with lock icon only */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-slate-900/30 flex items-center justify-center">
                  <div className="w-12 h-12 bg-purple-600/80 rounded-full flex items-center justify-center shadow-lg">
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

              {previewQuestion.why_this_matters && (
                <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/30">
                  <p className="text-purple-200 text-sm">
                    <span className="font-bold text-purple-400">Why this matters:</span> {previewQuestion.why_this_matters}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Unlock CTA Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-4 sm:p-6 md:p-8 shadow-2xl w-full">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          
          <div className="relative text-center space-y-5">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-white flex-shrink-0" />
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white text-center break-words">
                Want to See the Full Answer?
              </h3>
            </div>
            
            <div className="text-left max-w-md mx-auto space-y-2">
              <p className="text-white/90">We'll also show you:</p>
              <div className="space-y-1.5">
                {[
                  "Your complete personalized study plan",
                  "Which topics to study first (by priority)",
                  "Exactly which learning tool fixes each weakness",
                  "Your week-by-week grade trajectory"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
                    <span className="text-white/90 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleCTA}
              className="w-full max-w-md bg-white hover:bg-slate-100 text-purple-700 font-bold py-7 text-lg rounded-xl shadow-lg transition-all hover:scale-[1.02] group"
            >
              <Sparkles className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" />
              Unlock My Study Plan + Answer
              <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>

            <button 
              onClick={handleCTA}
              className="text-white/70 hover:text-white text-sm underline transition-colors"
            >
              Already have an account? Log in
            </button>
          </div>
        </div>

        {/* Performance Breakdown */}
        <div className="space-y-6">
          <h3 className="text-2xl font-black text-white flex items-center gap-2">
            📊 Your Performance Breakdown
          </h3>

          {/* Strong Areas */}
          {strongAreas.length > 0 && (
            <div className="bg-black rounded-2xl p-4 sm:p-6 border border-emerald-500/40 w-full">
              <h4 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                What You're Already Good At
              </h4>
              <div className="space-y-2">
                {strongAreas.map((area, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 flex-shrink-0">✓</span>
                    <span className="text-white/90 text-sm sm:text-base break-words">{area}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak Areas */}
          {weakAreasDetailed.length > 0 && (
            <div className="bg-black rounded-2xl p-4 sm:p-6 border border-red-500/40 w-full">
              <h4 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Where You're Losing Points
              </h4>
              <div className="space-y-4">
                {weakAreasDetailed.slice(0, 3).map((weak, idx) => {
                  const ToolIcon = getToolIcon(weak.recommended_tool);
                  return (
                    <div key={idx} className="bg-slate-900/50 rounded-xl p-3 sm:p-4 border border-slate-700 w-full">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm sm:text-base break-words">{idx + 1}. {weak.topic}</p>
                          <p className="text-red-400 text-xs sm:text-sm mt-1 break-words">
                            <span className="font-semibold">Impact:</span> Losing {weak.grade_impact} on your exam
                          </p>
                          <div className="flex items-start gap-2 mt-2 text-purple-300 text-xs sm:text-sm">
                            <ToolIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span className="break-words"><span className="font-semibold">Fix it with:</span> {weak.recommended_tool}</span>
                          </div>
                          <p className="text-slate-400 text-xs mt-1 break-words">{weak.tool_reason}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {weakAreasDetailed.length > 3 && (
                  <p className="text-purple-400 text-sm font-medium">
                    + {weakAreasDetailed.length - 3} more topics (see your full plan)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Timing Section */}
        <div className="bg-black rounded-2xl p-4 sm:p-6 border border-purple-500/40 w-full">
          <h3 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
            ⏰ Timing Matters
          </h3>
          
          {urgencyMessage && (
            <p className="text-white/80 mb-4">{urgencyMessage}</p>
          )}

          {gradeTrajectory.current && (
            <div className="space-y-3">
              <p className="text-purple-300 font-semibold">Your 21-day path:</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Week 1', from: gradeTrajectory.current, to: gradeTrajectory.week_1_target },
                  { label: 'Week 2', from: gradeTrajectory.week_1_target, to: gradeTrajectory.week_2_target },
                  { label: 'Week 3', from: gradeTrajectory.week_2_target, to: gradeTrajectory.final_target }
                ].map((week, idx) => (
                  <div key={idx} className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">{week.label}</p>
                    <p className="text-white font-bold">
                      {week.from} → <span className="text-emerald-400">{week.to}</span>
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-slate-400 text-sm">
                <span className="font-semibold text-white">Study time:</span> Just {studyIntensity}
              </p>
            </div>
          )}
        </div>

        {/* How StudyApp Works */}
        <div className="bg-black rounded-2xl p-4 sm:p-6 border border-purple-500/40 w-full">
          <h3 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
            🧠 How StudyApp Gets You There
          </h3>
          
          <div className="space-y-3">
            {[
              { icon: BookOpen, title: weakAreasDetailed[0]?.recommended_tool || 'Teach It Cards', desc: weakAreasDetailed[0]?.tool_reason || 'Master concepts through active recall' },
              { icon: Target, title: 'Practice Questions', desc: 'Adaptive questions on your weak spots' },
              { icon: MessageSquare, title: 'AI Tutor', desc: '24/7 help when you\'re stuck' },
              { icon: TrendingUp, title: 'Progress Tracking', desc: 'Watch your predicted grade climb daily' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-white">{item.title}</p>
                  <p className="text-slate-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Button 
            onClick={handleCTA}
            className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-6 text-lg rounded-xl shadow-lg transition-all hover:scale-[1.02] group"
          >
            See My Free Study Plan
            <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2 pb-8">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-slate-400 text-xs">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 flex-shrink-0" /> No credit card</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 flex-shrink-0" /> Start in 30 seconds</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 flex-shrink-0" /> 1,500+ students</span>
          </div>
          <p className="text-slate-600 text-xs">Powered by StudyApp.AI</p>
        </div>
      </div>
    </div>
  );
}