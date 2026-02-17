import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { 
  Trophy, Target, BookOpen, 
  TrendingUp, CheckCircle2, AlertCircle, ArrowRight,
  MessageSquare, FileText, Eye, Smartphone, MoreVertical, X
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { generateFingerprint } from "@/components/utils/browserFingerprint";
import { motion, AnimatePresence } from "framer-motion";
import { checkIsInAppBrowser } from "@/components/utils/BrowserCompatibility";

const getGradeColor = (percentage) => {
  if (percentage >= 90) return { bg: 'bg-emerald-500', ring: 'ring-emerald-500/30', text: 'text-emerald-400', border: 'border-emerald-500/40', gradient: 'from-emerald-500 to-teal-600' };
  if (percentage >= 80) return { bg: 'bg-blue-500', ring: 'ring-blue-500/30', text: 'text-blue-400', border: 'border-blue-500/40', gradient: 'from-blue-500 to-indigo-600' };
  if (percentage >= 70) return { bg: 'bg-purple-500', ring: 'ring-purple-500/30', text: 'text-purple-400', border: 'border-purple-500/40', gradient: 'from-purple-500 to-violet-600' };
  if (percentage >= 60) return { bg: 'bg-orange-500', ring: 'ring-orange-500/30', text: 'text-orange-400', border: 'border-orange-500/40', gradient: 'from-orange-500 to-amber-600' };
  return { bg: 'bg-yellow-500', ring: 'ring-yellow-500/30', text: 'text-yellow-400', border: 'border-yellow-500/40', gradient: 'from-yellow-500 to-amber-600' };
};

const getToolIcon = (tool) => {
  switch (tool) {
    case 'Teach It Cards': return BookOpen;
    case 'Practice Questions': return Target;
    case 'AI Tutor': case 'AI Professor': return MessageSquare;
    case 'Note Generator': return FileText;
    default: return Target;
  }
};

const getConfidenceLabel = (level) => {
  if (typeof level === 'number') return `${level}%`;
  // If it's a string like "Low", "Medium", "High" – also check for percentage in prediction_confidence
  return level;
};

// Answer Reveal Component
function AnswerRevealSection({ answer }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative bg-slate-800 rounded-xl p-5 sm:p-6 border border-slate-600 overflow-hidden min-h-[140px]">
      <p className="text-emerald-400 uppercase tracking-wider text-sm font-bold mb-3">Answer:</p>
      
      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="locked"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative min-h-[80px]"
          >
            <div className="relative">
              <p className="text-transparent select-none leading-relaxed text-base blur-md">
                {answer}
              </p>
            </div>
            <button
              onClick={() => setRevealed(true)}
              className="absolute inset-0 flex items-center justify-center bg-slate-900/90 hover:bg-slate-900/95 transition-colors group"
            >
              <div className="bg-purple-600 hover:bg-purple-500 px-6 py-4 rounded-xl flex items-center gap-3 shadow-2xl shadow-purple-500/40 transition-all group-hover:scale-105">
                <Eye className="w-6 h-6 text-white" />
                <span className="text-white font-bold text-base sm:text-lg">Click to Reveal Answer</span>
              </div>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-white/90 leading-relaxed text-base">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PredictedGradeDisplay() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  const name = queryParams.get("name");
  const school = queryParams.get("school");
  const courseCode = queryParams.get("courseCode");
  const reportDataParam = queryParams.get("reportData");
  
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [reportData, setReportData] = useState(null);
  const [ctaLoading, setCTALoading] = useState(false);
  const [showBrowserModal, setShowBrowserModal] = useState(false);

  useEffect(() => {
    if (!school || !courseCode) {
      navigate(createPageUrl("Home"), { replace: true });
      return;
    }

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

  const handleDismissBrowserModal = () => {
    sessionStorage.setItem('report_browser_warning_dismissed', 'true');
    setShowBrowserModal(false);
  };

  const handleContinueFromModal = async () => {
    sessionStorage.setItem('report_browser_warning_dismissed', 'true');
    setShowBrowserModal(false);
    await handleCTA();
  };

  const handleCTA = async () => {
    if (checkIsInAppBrowser()) {
      const dismissed = sessionStorage.getItem('report_browser_warning_dismissed');
      if (!dismissed) {
        setShowBrowserModal(true);
        return;
      }
    }
    
    setCTALoading(true);
    
    try {
      const fingerprint = await generateFingerprint();
      await base44.functions.invoke('checkAbuseProtection', {
        action_type: 'report_view',
        fingerprint,
        honeypot_value: ''
      }).catch(err => {
        console.warn('Abuse check failed (non-blocking):', err);
      });

      const isAuth = await base44.auth.isAuthenticated();
      
      if (isAuth) {
        const user = await base44.auth.me();
        
        const documentDataStr = queryParams.get("documentData");
        let documentData = null;
        if (documentDataStr) {
          try {
            documentData = JSON.parse(decodeURIComponent(documentDataStr));
          } catch (e) {
            console.error("Failed to parse document data:", e);
          }
        }
        
        const lessonData = {
          course_name: courseCode,
          description: `Course at ${school}`,
          status: 'diagnostic_completed'
        };
        
        if (documentData?.fileUrl) {
          lessonData.file_url = documentData.fileUrl;
          lessonData.file_urls = [documentData.fileUrl];
          lessonData.input_type = 'file';
        }
        if (documentData?.extractedContent) {
          lessonData.extracted_content = documentData.extractedContent;
        }
        if (documentData?.compressedContent) {
          lessonData.compressed_content = documentData.compressedContent;
        }
        
        const newLesson = await base44.entities.Lesson.create(lessonData);
        
        await base44.auth.updateMe({ onboarding_completed: true });
        
        const reportDataStr = encodeURIComponent(JSON.stringify(reportData || {}));
        navigate(`${createPageUrl("DocumentViewer")}?id=${newLesson.id}&tab=studyplan&fromOnboarding=true&reportData=${reportDataStr}`, { replace: true });
      } else {
        const documentDataStr = queryParams.get("documentData");
        let documentData = null;
        if (documentDataStr) {
          try {
            documentData = JSON.parse(decodeURIComponent(documentDataStr));
          } catch (e) {
            console.error("Failed to parse document data:", e);
          }
        }
        
        const onboardingData = {
          courseCode: courseCode || '',
          school: school || '',
          studentName: name || '',
          reportData: reportData || {},
          fileUrl: documentData?.fileUrl || null,
          extractedContent: documentData?.extractedContent || null,
          compressedContent: documentData?.compressedContent || null,
          fromReportCard: true
        };

        sessionStorage.setItem('pendingOnboardingData', JSON.stringify(onboardingData));
        const redirectUrl = `${createPageUrl("Home")}?fromOnboarding=true`;
        base44.auth.redirectToLogin(redirectUrl);
      }
    } catch (error) {
      console.error("Error in handleCTA:", error);
      setCTALoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-4">
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-3 mb-8">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/e6f13a569_LogoOnly.png"
              alt="StudyApp Logo"
              className="w-10 h-10 md:w-12 md:h-12"
            />
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
        </div>
      </div>
    );
  }

  const grade = reportData?.predicted_grade || 'B';
  const percentage = reportData?.predicted_percentage || 80;
  const confidenceLevel = reportData?.confidence_level || 'Medium';
  const confidencePct = reportData?.prediction_confidence || null;
  const strongAreas = reportData?.strong_areas || [];
  const weakAreasDetailed = reportData?.weak_areas_detailed || [];
  const previewQuestion = reportData?.preview_question || {};
  const gradeTrajectory = reportData?.grade_trajectory || {};
  const studyIntensity = reportData?.study_intensity || '30-45 min/day';
  const urgencyTimeline = reportData?.urgency_timeline || {};
  const toolkitSocialProof = reportData?.toolkit_social_proof || {};
  const estimatedStudyDays = reportData?.estimated_study_time_days || null;
  
  const personalizedLine1 = reportData?.personalized_message_line1 || '';
  const personalizedLine2 = reportData?.personalized_message_line2 || '';
  const personalizedLine3 = reportData?.personalized_message_line3 || '';
  const topPriorityAction = reportData?.top_priority_action || '';

  const gradeColors = getGradeColor(percentage);
  
  // Confidence display value
  const confidenceDisplay = confidencePct ? `${confidencePct}%` : confidenceLevel;

  return (
    <div className="min-h-screen bg-slate-950 overflow-y-auto pb-20">
      {/* Rich gradient hero top */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-purple-900/60 via-indigo-950/40 to-transparent" />
        <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-br from-purple-600/20 via-pink-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-[20%] right-[10%] w-72 h-72 bg-indigo-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg sm:max-w-xl md:max-w-2xl mx-auto px-4 sm:px-5 pt-8 space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/e6f13a569_LogoOnly.png"
            alt="StudyApp Logo"
            className="w-10 h-10 sm:w-12 sm:h-12"
          />
          <h1 className="text-3xl sm:text-4xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* ========== 1. PREDICTED GRADE BANNER ========== */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradeColors.gradient} p-[2px] w-full shadow-lg`}>
          <div className="bg-slate-900 rounded-[14px] p-5 sm:p-6">
            <div className="flex items-start gap-4 sm:gap-5">
              {/* Grade square */}
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br ${gradeColors.gradient} flex flex-col items-center justify-center flex-shrink-0 shadow-lg`}>
                <span className="text-3xl sm:text-4xl font-black text-white leading-none">{grade}</span>
                <span className="text-white/70 text-xs sm:text-sm font-semibold">{percentage}%</span>
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0 space-y-2.5">
                <h2 className="text-xl sm:text-2xl font-bold text-white truncate">{courseCode}</h2>
                
                {/* Tags row */}
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    percentage >= 70 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    percentage >= 50 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                    'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {studyIntensity}
                  </span>
                  {estimatedStudyDays && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      ~{estimatedStudyDays}d to A+
                    </span>
                  )}
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/20 text-slate-300 border border-slate-500/30">
                    Confidence: {confidenceDisplay}
                  </span>
                </div>
                
                {/* One-liner */}
                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                  {personalizedLine1 || `Based on thousands of students in similar courses, here's your predicted starting grade.`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========== 2. HERO BLOCK — Emotional Context ========== */}
        <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-700/50 w-full space-y-4">
          {/* Main message card with left accent */}
          <div className="border-l-4 border-purple-500 pl-4 py-1">
            <p className="text-white text-base sm:text-lg font-bold leading-snug">
              {personalizedLine2 || `You're currently tracking at ${percentage}% (${grade}) — and this is recoverable.`}
            </p>
          </div>
          
          {/* Context sub-cards */}
          <div className="space-y-3">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">📊</span>
                <div>
                  <p className="text-white text-sm font-semibold mb-1">Rapid Diagnostic Complete</p>
                  <p className="text-slate-400 text-xs leading-relaxed">This score is your starting point, not your ceiling. Uploading class notes increases precision.</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">🔍</span>
                <div>
                  <p className="text-white text-sm font-semibold mb-1">What this means right now</p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {personalizedLine3 || 'You understand parts of the course, but a few high-impact gaps are pulling your grade down.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">🎯</span>
                <div>
                  <p className="text-white text-sm font-semibold mb-1">Confidence: {confidenceDisplay}</p>
                  <p className="text-slate-400 text-xs leading-relaxed">We only used 5 questions. Your real exam coverage will refine this further.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========== 3. PRIMARY CTA ========== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 p-5 sm:p-7 shadow-2xl w-full">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          
          <div className="relative text-center space-y-4">
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Button 
                onClick={handleCTA}
                disabled={ctaLoading}
                className="w-full bg-white hover:bg-slate-100 text-purple-700 font-black py-4 sm:py-5 text-base sm:text-lg rounded-xl shadow-xl shadow-black/20 transition-all hover:scale-[1.02] min-h-[52px]"
              >
                {ctaLoading ? 'Loading...' : 'Build My Free Recovery Plan →'}
              </Button>
            </motion.div>
            <p className="text-white/80 text-xs sm:text-sm">Personalized steps, topic order, and weekly trajectory in under 30 seconds.</p>
            <button 
              onClick={handleCTA}
              className="text-white/60 hover:text-white text-xs underline transition-colors"
            >
              Already have an account? Log in
            </button>
          </div>
        </div>

        {/* ========== 4. REFRAME / EMOTIONAL SAFETY ========== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-[1px] w-full">
          <div className="bg-slate-900 rounded-[15px] p-5 sm:p-7 text-center space-y-3">
            <div className="w-12 h-12 bg-purple-500/15 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl">🧘</span>
            </div>
            <p className="text-purple-300 text-lg sm:text-xl font-bold">
              Breathe — you're not behind, you're now calibrated.
            </p>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
              Most students feel anxious when they don't know where they stand. Now you do. From here, we focus on the fastest point-gain topics first.
            </p>
          </div>
        </div>

        {/* ========== 5. PERFORMANCE BREAKDOWN ========== */}
        <div className="space-y-4">
          <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            📊 Performance Breakdown
          </h3>

          {/* Strong Areas */}
          {strongAreas.length > 0 && (
            <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-emerald-500/30 w-full">
              <h4 className="text-base font-bold text-emerald-400 mb-4">
                Where you're already strong
              </h4>
              <div className="space-y-3">
                {strongAreas.map((area, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-white/90 text-sm sm:text-base">{area}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak Areas — highest impact first */}
          {weakAreasDetailed.length > 0 && (
            <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-red-500/40 w-full">
              <h4 className="text-base sm:text-lg font-bold text-red-400 mb-5 flex items-center gap-2 uppercase tracking-wide">
                <AlertCircle className="w-5 h-5" />
                WHERE YOU'RE LOSING POINTS
              </h4>
              <div className="space-y-4">
                {weakAreasDetailed.slice(0, 4).map((weak, idx) => {
                  const ToolIcon = getToolIcon(weak.recommended_tool);
                  const borderColor = idx === 0 ? 'border-l-red-500' : idx === 1 ? 'border-l-orange-500' : 'border-l-yellow-500';
                  
                  return (
                    <div key={idx} className={`bg-slate-800 rounded-xl p-5 sm:p-6 border-l-4 ${borderColor} border border-slate-700 w-full`}>
                      {/* Rank badge + Topic */}
                      <div className="flex items-start gap-3 mb-4">
                        <span className={`text-2xl sm:text-3xl font-black ${idx === 0 ? 'text-red-400' : idx === 1 ? 'text-orange-400' : 'text-yellow-400'}`}>
                          #{idx + 1}
                        </span>
                        <p className="font-semibold text-white text-base sm:text-lg flex-1">{weak.topic}</p>
                      </div>
                      
                      {/* Grade impact */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xl">📉</span>
                        <span className="font-black text-red-500 text-2xl sm:text-3xl">{weak.grade_impact}</span>
                      </div>
                      <p className="text-slate-400 text-sm mb-4">Costing you this much on your exam</p>
                      
                      {/* Why this matters */}
                      {weak.specific_fix && (
                        <p className="text-slate-500 text-sm leading-relaxed mb-4">
                          <span className="text-slate-400 font-medium">Why this matters:</span> {weak.specific_fix}
                        </p>
                      )}
                      
                      {/* Divider */}
                      <div className="border-t border-slate-700 my-4" />
                      
                      {/* Tool badge */}
                      <div className="flex items-center gap-3 bg-purple-500/15 rounded-xl px-4 py-3 border border-purple-500/30">
                        <ToolIcon className="w-5 h-5 text-purple-400 flex-shrink-0" />
                        <span className="text-purple-300 font-bold text-sm sm:text-base">🎯 Fix with: {weak.recommended_tool}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ========== 6. MID CTA ========== */}
        <div className="text-center">
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <Button 
              onClick={handleCTA}
              disabled={ctaLoading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black py-4 px-6 text-base sm:text-lg rounded-xl shadow-lg shadow-purple-500/30 transition-all hover:scale-[1.02] min-h-[52px]"
            >
              {ctaLoading ? 'Loading...' : (
                <>Show Me What to Study First <ArrowRight className="h-5 w-5 ml-2" /></>
              )}
            </Button>
          </motion.div>
        </div>

        {/* ========== 7. TRAJECTORY ========== */}
        {gradeTrajectory.current && (
          <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-purple-500/30 w-full">
            <h3 className="text-lg sm:text-xl font-black text-white mb-5">
              📅 Your 3-week trajectory if you start now
            </h3>
            
            <div className="space-y-0">
              {/* Current */}
              <div className="flex gap-4 mb-1">
                <div className="flex flex-col items-center">
                  <div className="w-5 h-5 rounded-full bg-slate-500 ring-4 ring-slate-500/20 flex-shrink-0" />
                  <div className="w-1 h-14 bg-gradient-to-b from-slate-500 to-orange-500" />
                </div>
                <div className="pb-3">
                  <span className="text-slate-400 text-sm font-medium">Current</span>
                  <p className="text-white font-bold text-lg">{gradeTrajectory.current} ({percentage}%)</p>
                </div>
              </div>

              {[
                { 
                  label: 'Week 1', 
                  target: gradeTrajectory.week_1_target, 
                  pct: gradeTrajectory.week_1_percentage,
                  desc: `Goal: lock fundamentals and remove major conceptual confusion`,
                  color: 'orange'
                },
                { 
                  label: 'Week 2', 
                  target: gradeTrajectory.week_2_target, 
                  pct: gradeTrajectory.week_2_percentage,
                  desc: `Goal: improve application and comparison accuracy`,
                  color: 'yellow'
                },
                { 
                  label: 'Week 3', 
                  target: gradeTrajectory.final_target || gradeTrajectory.week_3_target, 
                  pct: gradeTrajectory.week_3_percentage,
                  desc: `Goal: convert understanding into exam-style performance`,
                  color: 'green'
                }
              ].map((week, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 ring-4 ${
                      week.color === 'orange' ? 'bg-orange-500 ring-orange-500/20' :
                      week.color === 'yellow' ? 'bg-yellow-500 ring-yellow-500/20' :
                      'bg-emerald-500 ring-emerald-500/20'
                    }`} />
                    {idx < 2 && (
                      <div className={`w-1 h-14 ${
                        week.color === 'orange' ? 'bg-gradient-to-b from-orange-500 to-yellow-500' :
                        'bg-gradient-to-b from-yellow-500 to-emerald-500'
                      }`} />
                    )}
                  </div>
                  <div className="pb-3 flex-1">
                    <span className={`text-sm font-bold ${
                      week.color === 'orange' ? 'text-orange-400' :
                      week.color === 'yellow' ? 'text-yellow-400' :
                      'text-emerald-400'
                    }`}>{week.label} → {week.target}{week.pct ? ` (${week.pct}%)` : ''}</span>
                    <p className="text-slate-400 text-sm mt-0.5">{week.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Urgency indicators */}
            <div className="space-y-2.5 pt-5 mt-5 border-t border-slate-700">
              <div className="flex items-start gap-3">
                <span className="text-emerald-400 text-lg flex-shrink-0">✅</span>
                <span className="text-slate-300 text-sm sm:text-base">
                  <span className="font-medium">Start today:</span> {urgencyTimeline.start_today || 'clear path to a passing grade and likely C-range momentum'}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow-400 text-lg flex-shrink-0">⚠️</span>
                <span className="text-slate-300 text-sm sm:text-base">
                  <span className="font-medium">Delay 5 days:</span> {urgencyTimeline.wait_5_days || 'requires significantly more daily study intensity'}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-400 text-lg flex-shrink-0">❌</span>
                <span className="text-slate-300 text-sm sm:text-base">
                  <span className="font-medium">Delay 10 days:</span> {urgencyTimeline.wait_10_days || 'recovery remains possible, but effort and stress increase sharply'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========== 8. YOUR PERSONALIZED STUDY STACK ========== */}
        <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-purple-500/30 w-full">
          <h3 className="text-lg sm:text-xl font-black text-white mb-5">
            🧠 Your personalized study stack
          </h3>
          
          <div className="space-y-4">
            {/* Teach It Cards */}
            <div className="bg-slate-800 rounded-xl p-5 border-l-4 border-purple-500">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-base sm:text-lg">Teach It Cards</p>
                  <p className="text-slate-400 text-sm mt-1">Explain concepts in your own words and get instant corrections.</p>
                  {weakAreasDetailed.filter(w => w.recommended_tool === 'Teach It Cards').length > 0 && (
                    <p className="text-purple-400 text-sm mt-2 font-medium">
                      Best for: {weakAreasDetailed.filter(w => w.recommended_tool === 'Teach It Cards').map(w => w.topic).slice(0, 2).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Practice Questions */}
            <div className="bg-slate-800 rounded-xl p-5 border-l-4 border-orange-500">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-base sm:text-lg">Practice Questions</p>
                  <p className="text-slate-400 text-sm mt-1">Adaptive exam-style sets on your exact weak areas.</p>
                  {weakAreasDetailed.filter(w => w.recommended_tool === 'Practice Questions').length > 0 && (
                    <p className="text-orange-400 text-sm mt-2 font-medium">
                      Best for: {weakAreasDetailed.filter(w => w.recommended_tool === 'Practice Questions').map(w => w.topic).slice(0, 2).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* AI Professor */}
            <div className="bg-slate-800 rounded-xl p-5 border-l-4 border-blue-500">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-base sm:text-lg">AI Professor</p>
                  <p className="text-slate-400 text-sm mt-1">Ask for step-by-step clarification when you get stuck.</p>
                  {weakAreasDetailed.filter(w => ['AI Tutor', 'AI Professor'].includes(w.recommended_tool)).length > 0 && (
                    <p className="text-blue-400 text-sm mt-2 font-medium">
                      Best for: {weakAreasDetailed.filter(w => ['AI Tutor', 'AI Professor'].includes(w.recommended_tool)).map(w => w.topic).slice(0, 2).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Progress Tracking */}
            <div className="bg-slate-800 rounded-xl p-5 border-l-4 border-emerald-500">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-base sm:text-lg">Progress Tracking</p>
                  <p className="text-slate-400 text-sm mt-1">Watch your predicted range improve as you complete sessions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========== 9. PREVIEW QUESTION (if available) ========== */}
        {previewQuestion?.question_text && (
          <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-orange-500/30 w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Target className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white">Sample Exam Question</h3>
            </div>
            
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-600 mb-4">
              <p className="text-white font-medium leading-relaxed text-base">{previewQuestion.question_text}</p>
            </div>
            
            <AnswerRevealSection answer={previewQuestion.correct_answer} />
            
            {previewQuestion.why_this_matters && (
              <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20 mt-4">
                <p className="text-purple-300 text-sm leading-relaxed">
                  <span className="font-bold">Why this matters:</span> {previewQuestion.why_this_matters}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========== 10. FINAL CONVERSION BLOCK ========== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 p-5 sm:p-7 shadow-2xl w-full">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          
          <div className="relative text-center space-y-4">
            <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
              You now have clarity. Let's turn it into points.
            </h3>
            <p className="text-white/80 text-sm sm:text-base">
              You don't need to study everything. Study the right things in the right order.
            </p>
            
            <motion.div
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Button 
                onClick={handleCTA}
                disabled={ctaLoading}
                className="w-full bg-white hover:bg-slate-100 text-purple-700 font-black py-4 sm:py-5 text-base sm:text-lg rounded-xl shadow-xl shadow-black/20 transition-all hover:scale-[1.02] min-h-[52px]"
              >
                {ctaLoading ? 'Loading...' : (
                  <>Get My Free Study Plan <ArrowRight className="h-5 w-5 ml-2" /></>
                )}
              </Button>
            </motion.div>
            <p className="text-white/70 text-xs">No credit card • Starts in 30 seconds</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-3 pb-8">
          <div className="flex flex-wrap items-center justify-center gap-3 text-slate-400 text-xs sm:text-sm">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> Start in 30 seconds</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> Trusted by 10,000+ students</span>
          </div>
          <p className="text-slate-600 text-xs">Powered by StudyApp.AI</p>
        </div>
      </div>

      {/* Browser Compatibility Modal */}
      {showBrowserModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-end mb-2">
              <button
                onClick={handleDismissBrowserModal}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto">
                <Smartphone className="w-8 h-8 text-purple-600" />
              </div>

            <h3 className="text-xl font-bold text-slate-900">
              Open in Your Browser
            </h3>

            <p className="text-sm text-slate-600 mb-4">
              For the best experience, open this in your regular browser
            </p>

            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 mb-4 border border-purple-200">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="bg-white rounded-lg p-2 shadow-sm">
                  <MoreVertical className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  Tap the <MoreVertical className="w-3 h-3 inline" /> menu at the top
                </p>
                <p className="text-xs text-slate-600">
                  Then select <strong>"Open in Browser"</strong>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleContinueFromModal}
                disabled={ctaLoading}
                className="w-full py-3 px-4 rounded-xl font-semibold transition-colors bg-purple-600 hover:bg-purple-700 text-white"
              >
                {ctaLoading ? 'Loading...' : 'Continue Anyway'}
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-4 text-center">
              Your progress will be saved
            </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}