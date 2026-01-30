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

        {/* Main Grade Card - Neutral background with huge grade */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 p-6 md:p-8 shadow-2xl w-full">
          <div className="relative text-center space-y-6">
            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">
              Your Predicted Exam Grade
            </p>
            
            {/* HUGE Grade Display */}
            <div className="flex flex-col items-center gap-2">
              <span className={`text-7xl sm:text-8xl md:text-9xl font-black bg-gradient-to-br ${getGradeColor(grade)} bg-clip-text text-transparent drop-shadow-2xl`}>
                {grade}
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-slate-300">
                ({percentage}%)
              </span>
            </div>
            
            {/* Visual Grade Meter */}
            <div className="w-full max-w-md mx-auto space-y-2">
              <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${getGradeColor(grade)}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>F</span>
                <span>D</span>
                <span>C</span>
                <span>B</span>
                <span>A</span>
                <span>A+</span>
              </div>
            </div>
            
            {/* Personalized Message - Better contrast */}
            {personalizedMessage && (
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-slate-200 text-sm sm:text-base leading-relaxed break-words">
                  {personalizedMessage}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Your #1 Priority Section - Cleaner design */}
        {weakAreasDetailed.length > 0 && previewQuestion.topic && (
          <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 p-4 sm:p-6 md:p-8 shadow-2xl w-full">
            <div className="relative space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Your #1 Priority
                </h3>
              </div>

              {/* Topic + Impact */}
              <div className="space-y-1">
                <p className="text-lg sm:text-xl font-bold text-white break-words">{previewQuestion.topic}</p>
                <p className="text-base sm:text-lg">
                  This topic is worth <span className="font-bold text-red-400 text-lg sm:text-xl">{weakAreasDetailed[0]?.grade_impact}</span> of your grade
                </p>
              </div>

              {/* Why this matters - Moved up for importance */}
              {previewQuestion.why_this_matters && (
                <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/30">
                  <p className="text-amber-200 text-sm break-words">
                    <span className="font-bold">💡 Why it matters:</span> {previewQuestion.why_this_matters}
                  </p>
                </div>
              )}

              <div className="border-t border-slate-700 pt-5 space-y-4">
                <p className="text-slate-300 font-semibold text-base">Sample Question:</p>

                {/* Preview Question - Better readability */}
                <div className="bg-slate-800 rounded-xl p-4 sm:p-5 border border-slate-600 w-full">
                  <p className="text-white font-medium leading-relaxed text-base sm:text-lg break-words">{previewQuestion.question_text}</p>
                </div>

                {/* Blurred Answer Section - Enhanced blur effect */}
                <div className="relative bg-slate-800 rounded-xl p-4 sm:p-5 border border-slate-600 overflow-hidden w-full min-h-[140px]">
                  <p className="text-xs text-emerald-400 uppercase tracking-wider mb-3 font-semibold">Answer:</p>
                  <div className="relative">
                    <p className="text-white/90 leading-relaxed text-base break-words blur-[5px] select-none">{previewQuestion.correct_answer || ''}</p>
                    
                    {/* Gradient overlay */}
                    <div 
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'linear-gradient(to bottom, transparent 0%, rgba(15,23,42,0.3) 40%, rgba(15,23,42,0.8) 100%)'
                      }}
                    />
                  </div>
                  
                  {/* Lock overlay button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-purple-600/95 px-5 py-3 rounded-xl flex items-center gap-2 shadow-xl shadow-purple-500/30">
                      <Lock className="w-5 h-5 text-white" />
                      <span className="text-white font-bold text-sm sm:text-base">Unlock Answer</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unlock CTA Section - Stronger hierarchy */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-5 sm:p-6 md:p-8 shadow-2xl w-full">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          
          <div className="relative text-center space-y-5">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white">
              Want to See the Full Answer?
            </h3>
            
            <div className="text-left max-w-md mx-auto space-y-2">
              <p className="text-white/90 font-medium">We'll also show you:</p>
              <div className="space-y-1.5">
                {[
                  "Your complete personalized study plan",
                  "Which topics to study first",
                  "Which tool fixes each weakness",
                  "Your week-by-week grade trajectory"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
                    <span className="text-white/90 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Primary CTA - Larger, stronger */}
            <div className="space-y-2 pt-2">
              <Button 
                onClick={handleCTA}
                className="w-full bg-white hover:bg-slate-100 text-purple-700 font-black py-7 sm:py-8 text-lg sm:text-xl rounded-xl shadow-xl transition-all hover:scale-[1.02] group min-h-[56px]"
              >
                <Lock className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                Unlock Full Answer
              </Button>
              <p className="text-white/80 text-sm">+ See Your Complete Study Plan</p>
            </div>

            <button 
              onClick={handleCTA}
              className="text-white/70 hover:text-white text-sm underline transition-colors pt-2"
            >
              Already have an account? Log in
            </button>
          </div>
        </div>

        {/* Performance Breakdown - Better visual hierarchy */}
        <div className="space-y-5">
          <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            📊 Your Performance Breakdown
          </h3>

          {/* Strong Areas - Scannable */}
          {strongAreas.length > 0 && (
            <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 border border-emerald-500/40 w-full">
              <h4 className="text-base font-bold text-emerald-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <CheckCircle2 className="w-5 h-5" />
                Strong Areas
              </h4>
              <div className="space-y-2">
                {strongAreas.map((area, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 flex-shrink-0 font-bold">✓</span>
                    <span className="text-white/90 text-sm sm:text-base break-words">{area}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak Areas - Card-based with visual hierarchy */}
          {weakAreasDetailed.length > 0 && (
            <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 border border-red-500/40 w-full">
              <h4 className="text-base font-bold text-red-400 mb-4 flex items-center gap-2 uppercase tracking-wide">
                <AlertCircle className="w-5 h-5" />
                Where You're Losing Points
              </h4>
              <div className="space-y-3">
                {weakAreasDetailed.slice(0, 3).map((weak, idx) => {
                  const ToolIcon = getToolIcon(weak.recommended_tool);
                  return (
                    <div key={idx} className="bg-slate-800 rounded-xl p-4 border border-slate-700 w-full">
                      <p className="font-bold text-white text-base break-words mb-2">{idx + 1}. {weak.topic}</p>
                      
                      {/* Grade impact - Large and prominent */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-slate-400 text-sm">📉 Costing you:</span>
                        <span className="font-black text-red-400 text-lg">{weak.grade_impact}</span>
                      </div>
                      
                      {/* Tool recommendation */}
                      <div className="flex items-center gap-2 bg-purple-500/10 rounded-lg px-3 py-2 border border-purple-500/30">
                        <ToolIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span className="text-purple-300 text-sm">
                          <span className="font-semibold">Fix with:</span> {weak.recommended_tool}
                        </span>
                      </div>
                      
                      {weak.tool_reason && (
                        <p className="text-slate-400 text-xs mt-2 break-words">{weak.tool_reason}</p>
                      )}
                    </div>
                  );
                })}
                {weakAreasDetailed.length > 3 && (
                  <p className="text-purple-400 text-sm font-medium text-center pt-2">
                    + {weakAreasDetailed.length - 3} more topics (unlock to see)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Timing Section - Visual timeline */}
        <div className="bg-slate-900 rounded-2xl p-4 sm:p-6 border border-purple-500/40 w-full">
          <h3 className="text-xl sm:text-2xl font-black text-white mb-4 flex items-center gap-2">
            ⏰ Your Path to A+
          </h3>
          
          {gradeTrajectory.current && (
            <div className="space-y-4">
              {/* Visual Timeline */}
              <div className="space-y-4">
                {[
                  { label: 'Week 1', from: gradeTrajectory.current, to: gradeTrajectory.week_1_target, desc: 'Fix theoretical gaps' },
                  { label: 'Week 2', from: gradeTrajectory.week_1_target, to: gradeTrajectory.week_2_target, desc: 'Master calculations' },
                  { label: 'Week 3', from: gradeTrajectory.week_2_target, to: gradeTrajectory.final_target, desc: 'Practice & polish' }
                ].map((week, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    {/* Timeline dot and line */}
                    <div className="flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full ${idx === 2 ? 'bg-emerald-500' : 'bg-purple-500'} ring-4 ring-purple-500/20`} />
                      {idx < 2 && <div className="w-0.5 h-8 bg-purple-500/30" />}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-slate-400 text-sm font-medium">{week.label}</span>
                        <span className="text-white font-bold">
                          {week.from} → <span className="text-emerald-400">{week.to}</span>
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-1">{week.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Study time reassurance */}
              <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/30 text-center">
                <p className="text-emerald-300 text-sm">
                  <span className="font-bold">Study time:</span> Just {studyIntensity}
                </p>
              </div>
              
              {/* Urgency indicators */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-400">✓</span>
                  <span className="text-slate-300">Start today → <span className="font-bold text-emerald-400">A+ possible</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-amber-400">⚠️</span>
                  <span className="text-slate-300">Wait 5 days → <span className="font-bold text-amber-400">B+ max</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-400">✗</span>
                  <span className="text-slate-300">Wait 10 days → <span className="font-bold text-red-400">Stay at {grade}</span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Your Personalized Toolkit - Card-based with social proof */}
        <div className="bg-slate-900 rounded-2xl p-4 sm:p-6 border border-purple-500/40 w-full">
          <h3 className="text-xl sm:text-2xl font-black text-white mb-5 flex items-center gap-2">
            🧠 Your Personalized Toolkit
          </h3>
          
          <div className="space-y-4">
            {/* Teach It Cards */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-base uppercase tracking-wide">Teach It Cards</p>
                  <p className="text-slate-300 text-sm mt-1">Explain concepts back to AI. This fixes {weakAreasDetailed.length > 0 ? weakAreasDetailed.length : 3} of your weak spots.</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>👥 1,200+ students</span>
                    <span>📈 Avg +12%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Practice Questions */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-base uppercase tracking-wide">Practice Questions</p>
                  <p className="text-slate-300 text-sm mt-1">Adaptive questions on YOUR weak spots. 15 min/day.</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>✓ Targets your gaps</span>
                    <span>📈 Builds confidence</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* AI Tutor */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-base uppercase tracking-wide">AI Tutor</p>
                  <p className="text-slate-300 text-sm mt-1">24/7 help when you're stuck. Ask anything.</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>💬 Instant answers</span>
                    <span>🎯 Course-specific</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleCTA}
            className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black py-6 sm:py-7 text-lg rounded-xl shadow-lg shadow-purple-500/30 transition-all hover:scale-[1.02] group"
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