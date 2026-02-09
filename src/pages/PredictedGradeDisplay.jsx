import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { 
  Trophy, Target, BookOpen, 
  TrendingUp, CheckCircle2, AlertCircle, ArrowRight,
  Lock, MessageSquare, FileText, Eye, Smartphone, MoreVertical, X
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { generateFingerprint } from "@/components/utils/browserFingerprint";
import { motion, AnimatePresence } from "framer-motion";
import { checkIsInAppBrowser } from "@/components/utils/BrowserCompatibility";

// Grade color based on percentage: 90+ green, 80+ blue, 70+ purple, 60+ orange, below 60 blue-gray (more appealing)
const getGradeColor = (percentage) => {
  if (percentage >= 90) return { bg: 'from-emerald-500 to-teal-600', text: 'text-emerald-400', border: 'border-emerald-500/40' };
  if (percentage >= 80) return { bg: 'from-blue-500 to-indigo-600', text: 'text-blue-400', border: 'border-blue-500/40' };
  if (percentage >= 70) return { bg: 'from-purple-500 to-violet-600', text: 'text-purple-400', border: 'border-purple-500/40' };
  if (percentage >= 60) return { bg: 'from-orange-500 to-amber-600', text: 'text-orange-400', border: 'border-orange-500/40' };
  return { bg: 'from-slate-600 to-blue-700', text: 'text-blue-300', border: 'border-blue-500/40' };
};

const getToolIcon = (tool) => {
  switch (tool) {
    case 'Teach It Cards': return BookOpen;
    case 'Practice Questions': return Target;
    case 'AI Tutor': return MessageSquare;
    case 'Note Generator': return FileText;
    default: return Target;
  }
};

const getToolColor = (tool) => {
  switch (tool) {
    case 'Teach It Cards': return { bg: 'from-purple-600 to-pink-600', border: 'border-purple-500' };
    case 'Practice Questions': return { bg: 'from-orange-500 to-amber-600', border: 'border-orange-500' };
    case 'AI Tutor': return { bg: 'from-blue-500 to-indigo-600', border: 'border-blue-500' };
    case 'Note Generator': return { bg: 'from-emerald-500 to-teal-600', border: 'border-emerald-500' };
    default: return { bg: 'from-purple-600 to-pink-600', border: 'border-purple-500' };
  }
};

// Answer Reveal Component
function AnswerRevealSection({ answer }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative bg-slate-800 rounded-xl p-5 sm:p-6 border border-slate-600 overflow-hidden min-h-[180px]">
      <p className="text-emerald-400 uppercase tracking-wider text-sm font-bold mb-3">Answer:</p>
      
      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="locked"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative min-h-[120px]"
          >
            {/* Fully hidden answer with overlay */}
            <div className="relative">
              <p className="text-transparent select-none leading-relaxed text-base blur-md">
                {answer}
              </p>
            </div>
            
            {/* Click to reveal button - covers entire area */}
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
      navigate(createPageUrl("Onboarding"), { replace: true });
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
    // Check if in-app browser and show modal
    if (checkIsInAppBrowser()) {
      const dismissed = sessionStorage.getItem('report_browser_warning_dismissed');
      if (!dismissed) {
        setShowBrowserModal(true);
        return;
      }
    }
    
    setCTALoading(true);
    
    try {
      // ABUSE PROTECTION - Track report view
      const fingerprint = await generateFingerprint();
      await base44.functions.invoke('checkAbuseProtection', {
        action_type: 'report_view',
        fingerprint,
        honeypot_value: ''
      }).catch(err => {
        console.warn('Abuse check failed (non-blocking):', err);
      });

      // Check if user is authenticated
      const isAuth = await base44.auth.isAuthenticated();
      
      if (isAuth) {
        // User is logged in - create lesson and navigate
        const user = await base44.auth.me();
        
        // Get document data from URL if available
        const documentDataStr = queryParams.get("documentData");
        let documentData = null;
        if (documentDataStr) {
          try {
            documentData = JSON.parse(decodeURIComponent(documentDataStr));
          } catch (e) {
            console.error("Failed to parse document data:", e);
          }
        }
        
        // Create lesson
        const lessonData = {
          course_name: courseCode,
          description: `Course at ${school}`,
          status: 'diagnostic_completed'
        };
        
        // Get file data from URL params (stored during onboarding)
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

        console.log('Creating lesson with data:', { 
          hasFile: !!lessonData.file_url, 
          hasExtracted: !!lessonData.extracted_content,
          hasCompressed: !!lessonData.compressed_content 
        });
        
        const newLesson = await base44.entities.Lesson.create(lessonData);
        
        // Mark onboarding as complete
        await base44.auth.updateMe({ onboarding_completed: true });
        
        // Navigate to study plan with report data
        const reportDataStr = encodeURIComponent(JSON.stringify(reportData || {}));
        navigate(`${createPageUrl("DocumentViewer")}?id=${newLesson.id}&tab=studyplan&fromOnboarding=true&reportData=${reportDataStr}`, { replace: true });
      } else {
        // User not logged in - store data and redirect to login
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

        console.log('📦 Storing onboarding data for post-login:', { 
          hasFile: !!onboardingData.fileUrl, 
          hasExtracted: !!onboardingData.extractedContent,
          hasCompressed: !!onboardingData.compressedContent,
          reportDataKeys: Object.keys(onboardingData.reportData || {})
        });

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
  const strongAreas = reportData?.strong_areas || [];
  const weakAreasDetailed = reportData?.weak_areas_detailed || [];
  const previewQuestion = reportData?.preview_question || {};
  const gradeTrajectory = reportData?.grade_trajectory || {};
  const studyIntensity = reportData?.study_intensity || '30-45 min/day';
  const urgencyTimeline = reportData?.urgency_timeline || {};
  const toolkitSocialProof = reportData?.toolkit_social_proof || {};
  
  // Handle both old and new personalized message formats
  const personalizedLine1 = reportData?.personalized_message_line1 || '';
  const personalizedLine2 = reportData?.personalized_message_line2 || '';
  const personalizedLine3 = reportData?.personalized_message_line3 || '';
  const hasNewFormat = personalizedLine1 || personalizedLine2 || personalizedLine3;
  const oldPersonalizedMessage = reportData?.personalized_message || '';

  const gradeColors = getGradeColor(percentage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 overflow-y-auto pb-20">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 md:px-8 pt-8 space-y-12">
        {/* Logo - HUGE */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/e6f13a569_LogoOnly.png"
            alt="StudyApp Logo"
            className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20"
          />
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-black text-white">
            {userName}'s Report Card
          </h2>
          <p className="text-purple-200/80 text-base sm:text-lg">
            {courseCode} • {school}
          </p>
        </div>

        {/* ========== 1. PREDICTED GRADE CARD ========== */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradeColors.bg} p-6 sm:p-8 md:p-10 shadow-2xl w-full`}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          
          <div className="relative text-center space-y-6">
            <p className="text-white/80 text-sm sm:text-base font-bold uppercase tracking-wider">
              Your Predicted Exam Grade
            </p>
            
            {/* HUGE Grade Display - 80-100px */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[80px] sm:text-[100px] md:text-[120px] font-black text-white drop-shadow-2xl leading-none">
                {grade}
              </span>
              <span className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white/80">
                ({percentage}%)
              </span>
            </div>
            
            {/* Visual Grade Meter */}
            <div className="w-full max-w-md mx-auto space-y-2">
              <div className="relative h-3 sm:h-4 bg-white/20 rounded-full overflow-hidden">
                {/* Background fill showing progress */}
                <div 
                  className="absolute left-0 top-0 h-full rounded-full bg-white/30 transition-all duration-1000"
                  style={{ width: `${percentage}%` }}
                />
                {/* Position indicator - accurately positioned based on grade scale */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full border-2 border-white shadow-lg transition-all duration-1000"
                  style={{ 
                    left: `${
                      percentage < 50 ? (percentage / 50) * 16.67 :
                      percentage < 60 ? 16.67 + ((percentage - 50) / 10) * 16.67 :
                      percentage < 70 ? 33.34 + ((percentage - 60) / 10) * 16.67 :
                      percentage < 80 ? 50.01 + ((percentage - 70) / 10) * 16.67 :
                      percentage < 90 ? 66.68 + ((percentage - 80) / 10) * 16.67 :
                      83.35 + ((percentage - 90) / 10) * 16.65
                    }%`
                  }}
                />
              </div>
              <div className="flex justify-between text-xs sm:text-sm text-white/70 font-medium px-1">
                <span>F</span>
                <span>D</span>
                <span>C</span>
                <span>B</span>
                <span>A</span>
                <span>A+</span>
              </div>
              
              {/* Prediction Confidence Box */}
              <div className="flex items-center justify-center pt-3">
                <div className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl border-2 shadow-lg ${
                  confidenceLevel === 'High' 
                    ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400/40' 
                    : confidenceLevel === 'Medium'
                    ? 'bg-amber-500/20 text-amber-100 border-amber-400/40'
                    : 'bg-slate-500/20 text-slate-100 border-slate-400/40'
                }`}>
                  <span className="text-xl">{confidenceLevel === 'High' ? '🎯' : confidenceLevel === 'Medium' ? '📊' : '📈'}</span>
                  <div className="text-left">
                    <div className="text-white/60 text-xs font-medium uppercase tracking-wider">Prediction Confidence</div>
                    <div className="text-white font-bold text-base">{confidenceLevel}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Personalized Message - Only first and third line, with visual separator */}
            <div className="max-w-lg mx-auto space-y-3">
              {hasNewFormat ? (
                <>
                  <p className="text-white text-base sm:text-lg leading-relaxed">{personalizedLine1}</p>
                  <div className="border-t-2 border-white/20 my-3" />
                  <p className="text-white text-lg sm:text-xl leading-relaxed font-bold">{personalizedLine3}</p>
                </>
              ) : oldPersonalizedMessage ? (
                <p className="text-white text-base sm:text-lg leading-relaxed">{oldPersonalizedMessage}</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* ========== 2. YOUR #1 PRIORITY SECTION ========== */}
        {weakAreasDetailed.length > 0 && previewQuestion.topic && (
          <div className="relative overflow-hidden rounded-2xl bg-slate-900 border-l-4 border-orange-500 p-5 sm:p-6 md:p-8 shadow-2xl w-full">
            {/* Header with orange badge */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <Target className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Your #1 Priority
              </h3>
            </div>

            {/* Topic title - 18-20px */}
            <p className="text-lg sm:text-xl font-semibold text-white mb-4">{previewQuestion.topic}</p>
            
            {/* LARGE Grade Impact - 40-48px red */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl sm:text-4xl">📉</span>
              <span className="text-slate-300 text-lg font-medium">COSTING YOU:</span>
              <span className="font-black text-red-500 text-4xl sm:text-5xl">{weakAreasDetailed[0]?.grade_impact}</span>
            </div>
            
            {/* Impact statement */}
            {previewQuestion.impact_statement && (
              <p className="text-slate-400 text-base mb-6">{previewQuestion.impact_statement}</p>
            )}

            {/* Why this matters - Light purple box */}
            {previewQuestion.why_this_matters && (
              <div className="bg-purple-500/15 rounded-xl p-4 border border-purple-500/30 mb-6">
                <p className="text-purple-200 text-base leading-relaxed">
                  <span className="text-lg mr-2">💡</span>
                  <span className="font-bold">Why this matters:</span> {previewQuestion.why_this_matters}
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-slate-700 my-6" />

            {/* Sample Question */}
            <p className="text-slate-400 font-semibold text-base mb-3">Sample Exam Question:</p>
            
            {/* Question card - lighter bg with dark text for contrast */}
            <div className="bg-slate-800 rounded-xl p-5 sm:p-6 border border-slate-600 mb-4">
              <p className="text-white font-medium leading-relaxed text-base sm:text-lg">{previewQuestion.question_text}</p>
            </div>

            {/* Answer Section - Interactive */}
            <AnswerRevealSection 
              answer={previewQuestion.correct_answer}
            />
          </div>
        )}

        {/* ========== 3. CTA SECTION ========== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-6 sm:p-8 shadow-2xl w-full">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          
          <div className="relative text-center space-y-5">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">
              Ready to Fix Your Weak Spots?
            </h3>
            
            {/* 3 items max, 12px spacing */}
            <div className="text-left max-w-md mx-auto space-y-3">
              <p className="text-white/90 font-medium">We'll also show you:</p>
              <div className="space-y-3">
                {[
                  "Your complete personalized study plan",
                  "Which topics to study first (by priority)",
                  "Your week-by-week grade trajectory"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
                    <span className="text-white/90 text-base">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Primary CTA - WHITE with PURPLE text, 56px min height */}
            <div className="space-y-2 pt-3">
              <Button 
                onClick={handleCTA}
                disabled={ctaLoading}
                className="w-full bg-white hover:bg-slate-100 text-purple-700 font-black py-4 sm:py-5 text-lg sm:text-xl rounded-xl shadow-xl shadow-black/20 transition-all hover:scale-[1.02] min-h-[56px]"
              >
                {ctaLoading ? (
                  <>Loading...</>
                ) : (
                  <>
                    See My Free Study Plan
                  </>
                )}
              </Button>
              <p className="text-white/80 text-sm sm:text-base">+ Get access to all study tools</p>
            </div>

            <button 
              onClick={handleCTA}
              className="text-white/70 hover:text-white text-base underline transition-colors pt-2"
            >
              Already have an account? Log in
            </button>
          </div>
        </div>

        {/* ========== 4. PERFORMANCE BREAKDOWN ========== */}
        <div className="space-y-6">
          <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            📊 Your Performance Breakdown
          </h3>

          {/* Strong Areas */}
          {strongAreas.length > 0 && (
            <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-emerald-500/40 w-full">
              <h4 className="text-base sm:text-lg font-bold text-emerald-400 mb-4 uppercase tracking-wide">
                ✅ STRONG AREAS
              </h4>
              <div className="space-y-3">
                {strongAreas.map((area, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="text-emerald-400 flex-shrink-0 text-lg">✓</span>
                    <span className="text-white/90 text-base sm:text-lg">{area}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak Areas - Redesigned cards */}
          {weakAreasDetailed.length > 0 && (
            <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-red-500/40 w-full">
              <h4 className="text-base sm:text-lg font-bold text-red-400 mb-5 flex items-center gap-2 uppercase tracking-wide">
                <AlertCircle className="w-5 h-5" />
                WHERE YOU'RE LOSING POINTS
              </h4>
              <div className="space-y-4">
                {weakAreasDetailed.slice(0, 3).map((weak, idx) => {
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
                      
                      {/* Grade impact - MASSIVE 40-48px */}
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl sm:text-3xl">📉</span>
                        <span className="font-black text-red-500 text-3xl sm:text-4xl">{weak.grade_impact}</span>
                      </div>
                      <p className="text-slate-400 text-sm mb-4">Costing you this much on your exam</p>
                      
                      {/* Divider */}
                      <div className="border-t border-slate-700 my-4" />
                      
                      {/* Tool badge */}
                      <div className="flex items-center gap-3 bg-purple-500/15 rounded-xl px-4 py-3 border border-purple-500/30">
                        <ToolIcon className="w-6 h-6 text-purple-400 flex-shrink-0" />
                        <div>
                          <span className="text-purple-300 font-bold text-base">🎯 Fix with: {weak.recommended_tool}</span>
                          {weak.tool_reason && (
                            <p className="text-slate-400 text-sm mt-1">Why: {weak.tool_reason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {weakAreasDetailed.length > 3 && (
                  <p className="text-purple-400 text-base font-medium text-center pt-2">
                    + {weakAreasDetailed.length - 3} more topics (unlock to see)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========== 5. SECOND CTA - Purple gradient, eye-catching ========== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-6 sm:p-8 shadow-2xl w-full text-center">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          
          <div className="relative">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-5">
              Ready to Fix These Weaknesses?
            </h3>
            <Button 
              onClick={handleCTA}
              className="w-full max-w-md mx-auto bg-white hover:bg-slate-100 text-purple-700 font-black py-4 sm:py-5 text-lg rounded-xl shadow-xl shadow-black/20 transition-all hover:scale-[1.02] min-h-[56px]"
            >
              See My Free Study Plan
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <p className="text-white/80 text-sm mt-3">No credit card • Start in 30 seconds</p>
          </div>
        </div>

        {/* ========== 6. YOUR PATH TO A+ - Visual Timeline ========== */}
        <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 md:p-8 border border-purple-500/40 w-full">
          <h3 className="text-xl sm:text-2xl font-black text-white mb-6 flex items-center gap-2">
            📅 Your Path to A+
          </h3>
          
          {/* Study time note - above urgency */}
          <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30 mb-6">
            <p className="text-emerald-300 text-base sm:text-lg text-center">
              <span className="font-bold">Study time:</span> Just {studyIntensity}
            </p>
          </div>
          
          {gradeTrajectory.current && (
            <div className="space-y-6">
              {/* Visual Timeline */}
              <div className="space-y-0">
                {[
                  { 
                    label: 'Week 1', 
                    from: gradeTrajectory.current, 
                    to: gradeTrajectory.week_1_target, 
                    desc: gradeTrajectory.week_1_description || 'Fix theoretical gaps',
                    pct: gradeTrajectory.week_1_percentage || 75,
                    color: 'orange'
                  },
                  { 
                    label: 'Week 2', 
                    from: gradeTrajectory.week_1_target, 
                    to: gradeTrajectory.week_2_target, 
                    desc: gradeTrajectory.week_2_description || 'Master calculations',
                    pct: gradeTrajectory.week_2_percentage || 85,
                    color: 'yellow'
                  },
                  { 
                    label: 'Week 3', 
                    from: gradeTrajectory.week_2_target, 
                    to: gradeTrajectory.final_target, 
                    desc: gradeTrajectory.week_3_description || 'Practice & polish',
                    pct: gradeTrajectory.week_3_percentage || 95,
                    color: 'green'
                  }
                ].map((week, idx) => (
                  <div key={idx} className="flex gap-4">
                    {/* Timeline line and colored dot */}
                    <div className="flex flex-col items-center">
                      <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0 ring-4 ${
                        week.color === 'orange' ? 'bg-orange-500 ring-orange-500/20' :
                        week.color === 'yellow' ? 'bg-yellow-500 ring-yellow-500/20' :
                        'bg-emerald-500 ring-emerald-500/20'
                      }`} />
                      {idx < 2 && (
                        <div className={`w-1 h-20 sm:h-16 ${
                          week.color === 'orange' ? 'bg-gradient-to-b from-orange-500 to-yellow-500' :
                          'bg-gradient-to-b from-yellow-500 to-emerald-500'
                        }`} />
                      )}
                    </div>
                    
                    {/* Content card */}
                    <div className={`flex-1 bg-slate-800 rounded-xl p-4 sm:p-5 border mb-3 ${
                      week.color === 'orange' ? 'border-orange-500/30' :
                      week.color === 'yellow' ? 'border-yellow-500/30' :
                      'border-emerald-500/30'
                    }`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                        <span className={`text-sm sm:text-base font-bold ${
                          week.color === 'orange' ? 'text-orange-400' :
                          week.color === 'yellow' ? 'text-yellow-400' :
                          'text-emerald-400'
                        }`}>{week.label}</span>
                      </div>
                      <p className="text-white font-bold text-lg sm:text-xl">
                        {week.from} → <span className={`${
                          week.color === 'orange' ? 'text-orange-400' :
                          week.color === 'yellow' ? 'text-yellow-400' :
                          'text-emerald-400'
                        }`}>{week.to}</span>
                        <span className="text-slate-400 text-sm ml-2">({week.pct}%)</span>
                      </p>
                      <p className="text-slate-400 text-sm sm:text-base mt-1">{week.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Urgency indicators - color coded */}
              <div className="space-y-3 pt-4 border-t border-slate-700">
                <div className="flex items-center gap-3 text-base sm:text-lg">
                  <span className="text-emerald-400 text-xl">✅</span>
                  <span className="text-slate-300">Start today → <span className="font-bold text-emerald-400">{urgencyTimeline.start_today || 'A+ is realistic'}</span></span>
                </div>
                <div className="flex items-center gap-3 text-base sm:text-lg">
                  <span className="text-yellow-400 text-xl">⚠️</span>
                  <span className="text-slate-300">Wait 5 days → <span className="font-bold text-yellow-400">{urgencyTimeline.wait_5_days || `${gradeTrajectory.week_2_target} is your ceiling`}</span></span>
                </div>
                <div className="flex items-center gap-3 text-base sm:text-lg">
                  <span className="text-red-400 text-xl">❌</span>
                  <span className="text-slate-300">Wait 10 days → <span className="font-bold text-red-400">{urgencyTimeline.wait_10_days || `You'll stay at ${grade}`}</span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========== 7. YOUR PERSONALIZED TOOLKIT ========== */}
        <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 md:p-8 border border-purple-500/40 w-full">
          <h3 className="text-xl sm:text-2xl font-black text-white mb-6 flex items-center gap-2">
            🧠 Your Personalized Toolkit
          </h3>
          
          <div className="space-y-4">
            {/* Teach It Cards - Purple accent */}
            <div className="bg-slate-800 rounded-xl p-5 border-t-4 border-purple-500">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-lg sm:text-xl">Teach It Cards</p>
                  <p className="text-slate-300 text-sm sm:text-base mt-1">
                    Explain concepts back to AI. This fixes {weakAreasDetailed.filter(w => w.recommended_tool === 'Teach It Cards').length || weakAreasDetailed.length} of your weak spots.
                  </p>
                  {toolkitSocialProof?.teach_it_cards?.testimonial && (
                    <p className="text-slate-500 text-sm italic mt-2">
                      "{toolkitSocialProof.teach_it_cards.testimonial}" - {toolkitSocialProof.teach_it_cards.testimonial_author}
                    </p>
                  )}
                  {weakAreasDetailed.filter(w => w.recommended_tool === 'Teach It Cards').length > 0 && (
                    <p className="text-purple-400 text-sm mt-2">
                      ✓ Fixes: {weakAreasDetailed.filter(w => w.recommended_tool === 'Teach It Cards').map(w => w.topic).slice(0, 2).join(', ')}
                    </p>
                  )}
                  <p className="text-slate-400 text-xs sm:text-sm mt-2">
                    {toolkitSocialProof?.teach_it_cards?.stats || '✓ Used by 1,200+ students • ✓ Avg improvement: +12%'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Practice Questions - Orange accent */}
            <div className="bg-slate-800 rounded-xl p-5 border-t-4 border-orange-500">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-lg sm:text-xl">Practice Questions</p>
                  <p className="text-slate-300 text-sm sm:text-base mt-1">
                    Adaptive questions on YOUR weak spots. {studyIntensity.split('-')[0]} min/day.
                  </p>
                  {toolkitSocialProof?.practice_questions?.testimonial && (
                    <p className="text-slate-500 text-sm italic mt-2">
                      "{toolkitSocialProof.practice_questions.testimonial}" - {toolkitSocialProof.practice_questions.testimonial_author}
                    </p>
                  )}
                  {weakAreasDetailed.filter(w => w.recommended_tool === 'Practice Questions').length > 0 && (
                    <p className="text-orange-400 text-sm mt-2">
                      ✓ Fixes: {weakAreasDetailed.filter(w => w.recommended_tool === 'Practice Questions').map(w => w.topic).slice(0, 2).join(', ')}
                    </p>
                  )}
                  <p className="text-slate-400 text-xs sm:text-sm mt-2">
                    {toolkitSocialProof?.practice_questions?.stats || '✓ Avg improvement: +18% in 2 weeks'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* AI Tutor - Blue accent */}
            <div className="bg-slate-800 rounded-xl p-5 border-t-4 border-blue-500">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-lg sm:text-xl">AI Tutor</p>
                  <p className="text-slate-300 text-sm sm:text-base mt-1">24/7 help when you're stuck. Ask anything.</p>
                  {toolkitSocialProof?.ai_tutor?.testimonial && (
                    <p className="text-slate-500 text-sm italic mt-2">
                      "{toolkitSocialProof.ai_tutor.testimonial}" - {toolkitSocialProof.ai_tutor.testimonial_author}
                    </p>
                  )}
                  <p className="text-slate-400 text-xs sm:text-sm mt-2">
                    {toolkitSocialProof?.ai_tutor?.stats || '✓ Course-specific • ✓ Instant answers'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Progress Tracking - Green accent */}
            <div className="bg-slate-800 rounded-xl p-5 border-t-4 border-emerald-500">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-lg sm:text-xl">Progress Tracking</p>
                  <p className="text-slate-300 text-sm sm:text-base mt-1">Watch your predicted grade climb daily.</p>
                  <p className="text-slate-400 text-xs sm:text-sm mt-2">
                    ✓ Real-time updates • ✓ Motivation boost
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleCTA}
            disabled={ctaLoading}
            className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black py-5 sm:py-6 text-lg sm:text-xl rounded-xl shadow-lg shadow-purple-500/30 transition-all hover:scale-[1.02] min-h-[56px]"
          >
            {ctaLoading ? 'Loading...' : (
              <>
                See My Free Study Plan
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center space-y-3 pb-8">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-slate-400 text-sm sm:text-base">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Start in 30 seconds</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Trusted by 10,000+ students</span>
          </div>
          <p className="text-slate-600 text-sm">Powered by StudyApp.AI</p>
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