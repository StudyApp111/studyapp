import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { 
  Trophy, Target, BookOpen, 
  TrendingUp, CheckCircle2, ArrowRight,
  MessageSquare, Smartphone, MoreVertical, X,
  Lightbulb, Zap, Brain, BarChart3, Sparkles, Clock, Shield
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { generateFingerprint } from "@/components/utils/browserFingerprint";
import { motion } from "framer-motion";
import { checkIsInAppBrowser } from "@/components/utils/BrowserCompatibility";

const getGradeColor = (percentage) => {
  if (percentage >= 90) return { bg: 'from-emerald-500 to-teal-600', text: 'text-emerald-400', card: 'bg-emerald-500' };
  if (percentage >= 80) return { bg: 'from-blue-500 to-indigo-600', text: 'text-blue-400', card: 'bg-blue-500' };
  if (percentage >= 70) return { bg: 'from-purple-500 to-violet-600', text: 'text-purple-400', card: 'bg-purple-500' };
  if (percentage >= 60) return { bg: 'from-orange-500 to-amber-600', text: 'text-orange-400', card: 'bg-orange-500' };
  return { bg: 'from-slate-500 to-slate-600', text: 'text-slate-300', card: 'bg-slate-500' };
};

const getIntensityLabel = (intensity) => {
  if (!intensity) return '30-45 min/day';
  return intensity;
};

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
      }).catch(() => {});

      const isAuth = await base44.auth.isAuthenticated();
      
      if (isAuth) {
        const user = await base44.auth.me();
        
        const documentDataStr = queryParams.get("documentData");
        let documentData = null;
        if (documentDataStr) {
          try { documentData = JSON.parse(decodeURIComponent(documentDataStr)); } catch (e) {}
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
        if (documentData?.extractedContent) lessonData.extracted_content = documentData.extractedContent;
        if (documentData?.compressedContent) lessonData.compressed_content = documentData.compressedContent;
        
        const newLesson = await base44.entities.Lesson.create(lessonData);
        await base44.auth.updateMe({ onboarding_completed: true });
        
        const reportDataStr = encodeURIComponent(JSON.stringify(reportData || {}));
        navigate(`${createPageUrl("DocumentViewer")}?id=${newLesson.id}&tab=studyplan&fromOnboarding=true&reportData=${reportDataStr}`, { replace: true });
      } else {
        const documentDataStr = queryParams.get("documentData");
        let documentData = null;
        if (documentDataStr) {
          try { documentData = JSON.parse(decodeURIComponent(documentDataStr)); } catch (e) {}
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
  const strongAreas = reportData?.strong_areas || [];
  const weakAreasDetailed = reportData?.weak_areas_detailed || [];
  const gradeTrajectory = reportData?.grade_trajectory || {};
  const studyIntensity = reportData?.study_intensity || '30-45 min/day';
  const urgencyTimeline = reportData?.urgency_timeline || {};
  const personalizedLine1 = reportData?.personalized_message_line1 || '';
  const personalizedLine2 = reportData?.personalized_message_line2 || '';
  const personalizedLine3 = reportData?.personalized_message_line3 || '';
  const topPriority = reportData?.top_priority_action || '';

  const gradeColors = getGradeColor(percentage);

  // Extract weak topic names for "Focus On These Topics First"
  const focusTopics = weakAreasDetailed.map(w => w.topic).slice(0, 5);
  
  // Build "How to Get to an A+" tips from weak areas specific_fix
  const improvementTips = weakAreasDetailed
    .filter(w => w.specific_fix)
    .map(w => w.specific_fix)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 overflow-y-auto pb-20">
      {/* Background blurs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/e6f13a569_LogoOnly.png"
            alt="StudyApp Logo"
            className="w-8 h-8 sm:w-10 sm:h-10"
          />
          <h1 className="text-2xl sm:text-3xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* ===== SECTION 1: Grade Header Card ===== */}
        <div className="bg-slate-900/80 rounded-2xl p-5 sm:p-6 border border-purple-500/30">
          <div className="flex items-start gap-4 sm:gap-5">
            {/* Grade Box */}
            <div className="flex-shrink-0">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ${gradeColors.card} flex flex-col items-center justify-center shadow-lg`}>
                <span className="text-3xl sm:text-4xl font-black text-white leading-none">{grade}</span>
                <span className="text-white/70 text-xs sm:text-sm font-medium">{percentage}%</span>
              </div>
            </div>
            {/* Course Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-black text-white truncate">{courseCode}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30">
                  <Zap className="w-3 h-3" /> {studyIntensity.includes('Moderate') || studyIntensity.includes('moderate') ? 'Moderate' : studyIntensity.includes('High') || studyIntensity.includes('high') || studyIntensity.includes('Intense') ? 'Intensive' : 'Moderate'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium border border-purple-500/30">
                  <Clock className="w-3 h-3" /> {getIntensityLabel(studyIntensity)}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-500/20 text-slate-300 text-xs font-medium border border-slate-500/30">
                  <Shield className="w-3 h-3" /> Confidence: {confidenceLevel}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                Based on thousands of students in similar courses, here's your predicted starting grade.
              </p>
            </div>
          </div>
        </div>

        {/* ===== SECTION 2: What Makes This Course Challenging ===== */}
        {(personalizedLine1 || personalizedLine2 || personalizedLine3) && (
          <div className="space-y-3">
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              What Makes This Course Challenging
            </h3>
            <div className="space-y-2.5">
              {[personalizedLine1, personalizedLine2, personalizedLine3].filter(Boolean).map((line, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
                  <div className="w-2 h-2 rounded-full bg-orange-400 mt-2 flex-shrink-0" />
                  <p className="text-slate-300 text-sm sm:text-base leading-relaxed">{line}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== SECTION 3: Focus On These Topics First ===== */}
        {focusTopics.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
              Focus On These Topics First
            </h3>
            <div className="flex flex-wrap gap-2">
              {focusTopics.map((topic, idx) => (
                <span
                  key={idx}
                  className="inline-block px-3.5 py-2 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 text-sm font-medium"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ===== SECTION 4: How to Get to an A+ ===== */}
        {improvementTips.length > 0 && (
          <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/30 rounded-2xl p-5 sm:p-6 border border-emerald-500/30">
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              How to Get to an A+
            </h3>
            <div className="space-y-3">
              {improvementTips.map((tip, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-200 text-sm sm:text-base leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== SECTION 5: Your Personalized Study Plan Includes ===== */}
        <div className="bg-slate-900/80 rounded-2xl p-5 sm:p-6 border border-purple-500/30">
          <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 mb-5">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Your Personalized Study Plan Includes:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: Brain, text: "AI-powered diagnostic to pinpoint your weak spots", color: "text-purple-400" },
              { icon: Target, text: "Custom practice problems targeting your gaps", color: "text-orange-400" },
              { icon: BarChart3, text: "Real-time grade predictions as you improve", color: "text-blue-400" },
              { icon: BookOpen, text: "Personalized study tasks to boost your grade", color: "text-emerald-400" },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50">
                <item.icon className={`w-5 h-5 ${item.color} flex-shrink-0 mt-0.5`} />
                <span className="text-slate-300 text-sm leading-relaxed">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ===== SECTION 6: Primary CTA ===== */}
        <div className="space-y-3 pt-2">
          <Button 
            onClick={handleCTA}
            disabled={ctaLoading}
            className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-500 hover:via-pink-500 hover:to-purple-500 text-white font-black py-5 sm:py-6 text-lg sm:text-xl rounded-xl shadow-2xl shadow-purple-500/30 transition-all hover:scale-[1.02] min-h-[56px]"
          >
            {ctaLoading ? 'Loading...' : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Start Your Study Plan
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
          <button 
            onClick={handleCTA}
            className="w-full text-slate-400 hover:text-slate-200 text-sm transition-colors py-2"
          >
            Maybe later
          </button>
        </div>

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-slate-600 text-xs">Powered by StudyApp.AI</p>
        </div>
      </div>

      {/* Browser Compatibility Modal */}
      {showBrowserModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-end mb-2">
              <button onClick={handleDismissBrowserModal} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto">
                <Smartphone className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Open in Your Browser</h3>
              <p className="text-sm text-slate-600 mb-4">For the best experience, open this in your regular browser</p>
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 mb-4 border border-purple-200">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="bg-white rounded-lg p-2 shadow-sm">
                    <MoreVertical className="w-6 h-6 text-purple-600" />
                  </div>
                  <p className="text-sm text-slate-700 font-medium">
                    Tap the <MoreVertical className="w-3 h-3 inline" /> menu at the top
                  </p>
                  <p className="text-xs text-slate-600">Then select <strong>"Open in Browser"</strong></p>
                </div>
              </div>
              <button
                onClick={handleContinueFromModal}
                disabled={ctaLoading}
                className="w-full py-3 px-4 rounded-xl font-semibold transition-colors bg-purple-600 hover:bg-purple-700 text-white"
              >
                {ctaLoading ? 'Loading...' : 'Continue Anyway'}
              </button>
              <p className="text-xs text-slate-400 mt-4 text-center">Your progress will be saved</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}