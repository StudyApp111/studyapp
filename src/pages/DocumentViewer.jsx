import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Clock, Zap } from "lucide-react";
import DocumentViewerTabs from "@/components/document-viewer/DocumentViewerTabs";
import ExamTab from "@/components/document-viewer/ExamTab";
import PracticeHubTab from "@/components/document-viewer/PracticeHubTab";
import PracticeSidebar from "@/components/document-viewer/PracticeSidebar";
import MobileTabsView from "@/components/document-viewer/MobileTabsView";


import FlashcardsTab from "@/components/document-viewer/FlashcardsTab";
import TeachItTab from "@/components/document-viewer/TeachItTab";
import LearnTab from "@/components/document-viewer/LearnTab";
import StudyPlanTab from "@/components/study-plan/StudyPlanTab";
import NextStepBanner from "@/components/study-plan/NextStepBanner";
import StudyPlanBannerInline from "@/components/study-plan/StudyPlanBannerInline";
import PomodoroTimer from "@/components/document-viewer/PomodoroTimer";
import ParsingLoader from "@/components/document-viewer/ParsingLoader";
import NotesTab from "@/components/document-viewer/NotesTab";
import StudySessionTracker from "@/components/gamification/StudySessionTracker";
import XPGainToast from "@/components/gamification/XPGainToast";
import MaterialUploadPrompt from "@/components/document-viewer/MaterialUploadPrompt";
import DiagnosticLockOverlay from "@/components/document-viewer/DiagnosticLockOverlay";
import TopicConfirmationBanner from "@/components/document-viewer/TopicConfirmationBanner";
import PostDiagnosticPaywall from "@/components/document-viewer/PostDiagnosticPaywall";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";
import PostSessionSummary from "@/components/document-viewer/PostSessionSummary";
import AnimatedGradeBadge from "@/components/document-viewer/AnimatedGradeBadge";
import CramModeTab from "@/components/document-viewer/CramModeTab";
import { useSubscription } from "@/components/subscription/SubscriptionContext";
import { useGuestSession } from "@/components/guest/GuestSessionContext";

import { handleDailyReset, awardDailyXP, recordDailyActivity } from "@/components/utils/dailyReset";
import { useTheme } from "@/components/theme/ThemeProvider";
import { differenceInCalendarDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import posthog from 'posthog-js';
import { detectDeviceInfo } from "@/components/utils/userTracking";

// Track study minutes every minute
      
export default function DocumentViewer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState("practice");
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lessonIdRef = useRef(null);
  const [exams, setExams] = useState(undefined); // undefined = loading, [] = loaded empty, [data] = loaded with data
  const [extractedContent, setExtractedContent] = useState("");
  const [studyTime, setStudyTime] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [timerInterval, setTimerInterval] = useState(null);
  const saveProgressRef = useRef(null);
  const lastSaveTimeRef = useRef(Date.now());
  const lastMinuteTrackRef = useRef(Date.now());
  const [messages, setMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [predictedGrade, setPredictedGrade] = useState(null);
  const [xpToast, setXpToast] = useState({ show: false, xp: 0, reason: '' });
  const [userStreak, setUserStreak] = useState(0);
  const [userDailyXP, setUserDailyXP] = useState(0);
  const [isGeneratingStudyPlan, setIsGeneratingStudyPlan] = useState(false);
  const [pomodoroEnabled, setPomodoroEnabled] = useState(false);
  const [showUploadPrompt, setShowUploadPrompt] = useState(false);
  const { isPro } = useSubscription();
  const { isGuest, guestData } = useGuestSession();
  const [showTaskConfetti, setShowTaskConfetti] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const sessionStartTimeRef = useRef(null);
  
  // Record session start time once + save timer on page unload
  useEffect(() => {
    if (!sessionStartTimeRef.current) {
      sessionStartTimeRef.current = Date.now();
    }
    
    const handleBeforeUnload = () => {
      if (lesson?.id && studyTime > 0 && !isGuest) {
        // Use sendBeacon for reliable save on unload
        const payload = JSON.stringify({ total_study_time_seconds: studyTime });
        // Fall back to sync update attempt
        base44.entities.Lesson.update(lesson.id, { total_study_time_seconds: studyTime }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [lesson?.id, studyTime, isGuest]);

  const MIN_SESSION_SECONDS = 300; // 5 minutes
  const getSessionElapsed = () => Math.floor((Date.now() - (sessionStartTimeRef.current || Date.now())) / 1000);

  const handleBackNavigation = () => {
    // Go back to previous page; fall back to Home if no history
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(createPageUrl("Home"));
    }
  };

  // Check if lesson has a document
  const hasDocument = lesson?.file_url || lesson?.file_urls?.length > 0;
  
  // Show Notes tab for lessons WITHOUT uploaded documents
  const showNotesTab = !hasDocument;

  // Handle navigation from study plan
  const handleStudyPlanNavigate = (tab, options = {}) => {
    setActiveTab(tab);
    // Could pass practice mode options to ExamTab via state if needed
  };
  
  // Dynamic notification dot logic based on actual task completion
  const [flashcards, setFlashcards] = useState([]);
  const [teachItCards, setTeachItCards] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  
  // Load micro-interaction data for notification dots (delayed to avoid burst with loadLesson)
  useEffect(() => {
    if (!lesson?.id) return;
    const timer = setTimeout(async () => {
      try {
        const [fc, tic, plans] = await Promise.all([
          base44.entities.Flashcard.filter({ lesson_id: lesson.id }),
          base44.entities.TeachItCard.filter({ lesson_id: lesson.id }),
          base44.entities.StudyPlan.filter({ lesson_id: lesson.id, status: 'active' })
        ]);
        setFlashcards(fc || []);
        setTeachItCards(tic || []);
        setActivePlan(plans?.[0] || null);
      } catch (err) {
        console.error('Error loading notification data:', err);
      }
    }, 2000); // Delay 2s after lesson loads to avoid rate limit burst
    return () => clearTimeout(timer);
  }, [lesson?.id]);
  
  // Check exam completion status
  const completedExamCount = (exams || []).filter(e => e.completed).length;
  const diagnosticCompleted = (exams || []).some(e => e.exam_number === 1 && e.completed);
  
  // Track if user explicitly skipped diagnostic (locks content generation)
  const [diagnosticSkipped, setDiagnosticSkipped] = useState(false);
  
  useEffect(() => {
    if (lesson?.id) {
      setDiagnosticSkipped(!!localStorage.getItem(`diagnostic_skipped_${lesson.id}`));
    }
  }, [lesson?.id]);
  
  useEffect(() => {
    const handleSkip = (e) => {
      if (e.detail?.lessonId === lesson?.id) {
        setDiagnosticSkipped(true);
      }
    };
    window.addEventListener('diagnosticSkipped', handleSkip);
    return () => window.removeEventListener('diagnosticSkipped', handleSkip);
  }, [lesson?.id]);
  
  // Clear skip flag if diagnostic gets completed
  useEffect(() => {
    if (diagnosticCompleted && lesson?.id) {
      localStorage.removeItem(`diagnostic_skipped_${lesson.id}`);
      setDiagnosticSkipped(false);
    }
  }, [diagnosticCompleted, lesson?.id]);
  
  // Content locked = diagnostic not completed (and either not skipped, or skipped)
  // If skipped: ALL generation tabs locked. If not skipped and not completed: also locked.
  const contentLocked = !diagnosticCompleted;
  
  // Red dot logic based on Study Plan tasks
  const getTaskStatus = (taskType) => {
    if (!activePlan?.tasks) return { needsAction: false };
    const task = activePlan.tasks.find(t => t.task_type === taskType && !t.completed);
    if (!task) return { needsAction: false };
    // Task exists and is not completed = needs action
    return { 
      needsAction: true,
      progress: `${task.completed_count || 0}/${task.target_count}`
    };
  };
  
  // Exam tab: show dot if diagnostic not completed OR if practice_exam task pending OR if diagnostic exam is ready but not started
  const practiceExamTask = getTaskStatus('practice_exam');
  const diagnosticExamReady = (exams || []).some(e => e.exam_number === 1 && e.exam_type !== 'practice' && e.questions?.length > 0 && !e.completed);
  const showExamDot = !diagnosticCompleted || practiceExamTask.needsAction || diagnosticExamReady;
  
  // Flashcards tab: show dot if flashcard task not completed in study plan
  const flashcardTask = getTaskStatus('flashcards');
  const showFlashcardsDot = flashcardTask.needsAction;
  
  // TeachIt tab: show dot if teach_it task not completed in study plan  
  const teachItTask = getTaskStatus('teach_it');
  const showTeachItDot = teachItTask.needsAction;
  
  // Study Plan tab: show dot if plan exists but has incomplete tasks, OR if diagnostic is ready (guiding user to take it)
  const hasIncompleteTasks = activePlan?.tasks?.some(t => !t.completed);
  const showStudyPlanDot = (activePlan && hasIncompleteTasks) || diagnosticExamReady;

  // Cram Mode activation: exam date is set and within 7 days
  const isCramActive = (() => {
    if (!lesson?.exam_date) return false;
    const days = differenceInCalendarDays(new Date(lesson.exam_date), new Date());
    return days >= 0 && days <= 7;
  })();
  const daysUntilExam = lesson?.exam_date ? differenceInCalendarDays(new Date(lesson.exam_date), new Date()) : null;

  // Cram mode feature flag
  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
    staleTime: 60000,
  });
  const cramFeatureEnabled = appSettings.find(s => s.key === 'cram_mode_enabled')?.value ?? false;
  const showCramTab = cramFeatureEnabled;

  // Track first lesson view (SubmitApplication)
  const hasTrackedFirstLesson = useRef(false);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  // When lesson loads, default tab: cram if exam within 7 days, else PracticeHub (new Pillar 1 default)
  useEffect(() => {
    if (!lesson) return;
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (!tabParam) {
      if (showCramTab && lesson.exam_date) {
        const days = differenceInCalendarDays(new Date(lesson.exam_date), new Date());
        if (days >= 0 && days <= 7 && diagnosticCompleted) {
          setActiveTab("cram");
          return;
        }
      }
      // Pillar 1: Practice Hub is the new default first experience for ALL lessons
      setActiveTab("practice");
    }
  }, [lesson?.id]);

  // Track SubmitApplication when user views their FIRST lesson
  useEffect(() => {
    const trackFirstLesson = async () => {
      if (hasTrackedFirstLesson.current || !lesson?.id) return;
      
      try {
        const user = await base44.auth.me();
        if (!user) return;
        
        // Check if this is their first lesson (just completed onboarding)
        const allLessons = await base44.entities.Lesson.filter({ created_by: user.email });
        const isFirstLesson = allLessons.length === 1;
        
        if (isFirstLesson && window.ttq) {
          hasTrackedFirstLesson.current = true;
          
          // Hash user ID for privacy
          const encoder = new TextEncoder();
          const data = encoder.encode(user.id);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashedId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          
          // Identify user
          window.ttq.identify({
            external_id: hashedId
          });
          
          // Track first lesson start
          window.ttq.track('SubmitApplication', {
            contents: [{
              content_id: 'first_lesson',
              content_type: 'product',
              content_name: lesson.course_name || 'First Lesson',
              price: 0
            }],
            value: 0,
            currency: 'USD'
          });
        }
      } catch (err) {
        console.error('TikTok tracking error:', err);
      }
    };
    
    trackFirstLesson();
  }, [lesson?.id]);

  // Listen for study task completion events → trigger full-screen confetti + grade bounce
  useEffect(() => {
    const handleTaskCompleted = () => {
      setShowTaskConfetti(true);
      window.dispatchEvent(new CustomEvent('studyActivityCompleted'));
    };
    window.addEventListener('studyTaskCompleted', handleTaskCompleted);
    return () => window.removeEventListener('studyTaskCompleted', handleTaskCompleted);
  }, []);

  useEffect(() => {
    const handleSwitchToStudyPlan = () => setActiveTab('studyplan');
    const handleSwitchToExam = () => setActiveTab('exam');
    
    const handleStudyPlanGenerating = (e) => {
      const isGenerating = e.detail?.generating ?? true;
      setIsGeneratingStudyPlan(isGenerating);
      if (!isGenerating) {
        // When generation completes, reload lesson to get study plan
        loadLesson();
      }
    };
    
    window.addEventListener('switchToStudyPlanTab', handleSwitchToStudyPlan);
    window.addEventListener('switchToExamTab', handleSwitchToExam);
    window.addEventListener('studyPlanGenerating', handleStudyPlanGenerating);
    
    return () => {
      window.removeEventListener('switchToStudyPlanTab', handleSwitchToStudyPlan);
      window.removeEventListener('switchToExamTab', handleSwitchToExam);
      window.removeEventListener('studyPlanGenerating', handleStudyPlanGenerating);
    };
  }, []);



  // Capture lesson ID and load lesson whenever URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const capturedId = urlParams.get('id') || urlParams.get('lessonId');
    
    if (capturedId && capturedId !== 'null' && capturedId !== 'undefined') {
      const isNewId = capturedId !== lessonIdRef.current;
      lessonIdRef.current = capturedId;
      sessionStorage.setItem('currentLessonId', capturedId);
      
      if (isNewId) {
        console.log("✅ Detected new lesson ID:", capturedId);
        setLesson(null);
        setLoading(true);
        loadLesson();
        loadUserStats();
      } else if (!lesson) {
        // Same ID but no lesson data yet (first mount)
        loadLesson();
        loadUserStats();
      }
    } else {
      // No ID in URL — try session fallback on first mount
      if (!lesson) {
        loadLesson();
        loadUserStats();
      }
    }
  }, [location.search]);

  const loadUserStats = async () => {
    if (isGuest) return; // Skip for guest users
    try {
      // Use centralized daily reset
      const resetResult = await handleDailyReset();
      const user = resetResult.user || await base44.auth.me();
      
      setUserStreak(resetResult.streak ?? user.current_streak ?? 0);
      setUserDailyXP(resetResult.dailyXP ?? user.daily_xp ?? 0);
    } catch (error) {
      console.error("Error loading user stats:", error);
    }
  };

  const awardXP = async (amount, reason) => {
    try {
      const result = await awardDailyXP(amount, reason);
      if (result.success) {
        setUserDailyXP(result.dailyXP);
        setXpToast({ show: true, xp: amount, reason });
      }
    } catch (error) {
      console.error("Error awarding XP:", error);
    }
  };

  const handleMilestoneReached = (milestone) => {
    awardXP(milestone.xp, `${milestone.minutes} min milestone!`);
  };

  useEffect(() => {
    if (isTimerRunning && studyTime !== null) {
      const interval = setInterval(() => {
        setStudyTime(prev => prev + 1);
      }, 1000);
      setTimerInterval(interval);
      return () => clearInterval(interval);
    } else if (timerInterval) {
      clearInterval(timerInterval);
    }
  }, [isTimerRunning, studyTime !== null]);

  // Save progress periodically — lesson time every 30s, user time every 60s, daily activity every 60s
  useEffect(() => {
    if (saveProgressRef.current) {
      clearInterval(saveProgressRef.current);
    }

    // Check every 30 seconds (not every 1 second!) to avoid rate limits
    saveProgressRef.current = setInterval(async () => {
      if (!isTimerRunning || isGuest || !lesson?.id) return;
      
      const now = Date.now();
      
      try {
        // Update lesson-specific study time every 30 seconds
        await base44.entities.Lesson.update(lesson.id, {
          total_study_time_seconds: studyTime
        });
        
        // Update user total time every 60 seconds
        const secondsSinceLastSave = Math.floor((now - lastSaveTimeRef.current) / 1000);
        if (secondsSinceLastSave >= 60) {
          const user = await base44.auth.me();
          await base44.auth.updateMe({
            time_spent_seconds: (user.time_spent_seconds || 0) + secondsSinceLastSave
          });
          lastSaveTimeRef.current = now;
        }
        
        // Track study minutes for daily challenges every 60 seconds
        const secondsSinceMinuteTrack = Math.floor((now - lastMinuteTrackRef.current) / 1000);
        if (secondsSinceMinuteTrack >= 60) {
          await recordDailyActivity('study_minutes', 1);
          lastMinuteTrackRef.current = now;
        }
      } catch (error) {
        console.error("Error saving progress:", error);
      }
    }, 30000);

    return () => {
      if (saveProgressRef.current) {
        clearInterval(saveProgressRef.current);
      }
    };
  }, [lesson?.id, isTimerRunning]);

  const formatStudyTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadLesson = async () => {
    try {
      // Always check URL first for the most up-to-date ID
      const urlParams = new URLSearchParams(window.location.search);
      let lessonId = urlParams.get('id') || urlParams.get('lessonId');

      // If not in URL, fall back to ref or session
      if (!lessonId || lessonId === 'null' || lessonId === 'undefined') {
        lessonId = lessonIdRef.current || sessionStorage.getItem('currentLessonId');
      } else {
        // URL has valid ID, sync ref
        lessonIdRef.current = lessonId;
      }

      console.log("Loading lesson with ID:", lessonId);

      if (!lessonId || lessonId === 'null' || lessonId === 'undefined') {
        setError("No lesson ID found");
        setLoading(false);
        return;
      }

      let lessonData = null;
      let examsData = [];

      // Guest users: load via backend function (service role) since RLS blocks direct access
      if (isGuest && guestData?.fingerprint) {
        console.log("👤 Guest mode: loading lesson via getGuestLesson...");
        const { data } = await base44.functions.invoke('getGuestLesson', {
          fingerprint: guestData.fingerprint,
          lesson_id: lessonId,
          include_exams: true
        });
        
        if (!data?.lesson) {
          setError("Lesson not found");
          setLoading(false);
          return;
        }
        
        lessonData = data.lesson;
        examsData = data.exams || [];
      } else {
        // Authenticated user: load directly
        const lessons = await base44.entities.Lesson.filter({ id: lessonId });
        
        if (!lessons || lessons.length === 0) {
          setError("Lesson not found");
          setLoading(false);
          return;
        }

        lessonData = lessons[0];
        examsData = await base44.entities.Exam.filter({ lesson_id: lessonId }).catch(() => []);
      }

      setLesson(lessonData);

      // PostHog: track lesson/document view (fires once per unique lesson load)
      if (!lessonIdRef._tracked || lessonIdRef._tracked !== lessonData.id) {
        lessonIdRef._tracked = lessonData.id;
        try {
          const deviceInfo = detectDeviceInfo();
          posthog?.capture('document_analysis_viewed', {
            lesson_id: lessonData.id,
            course_name: lessonData.course_name,
            input_type: lessonData.input_type,
            has_file: !!(lessonData.file_url || lessonData.file_urls?.length),
            device_type: deviceInfo.device_type,
            app_type: deviceInfo.app_type,
            is_guest: isGuest
          });
        } catch {}
      }
      
      // Initialize study time from saved lesson data
      setStudyTime(lessonData.total_study_time_seconds || 0);
      
      // Use uncompressed content for document viewer - compressed is for prompts only
      if (lessonData.extracted_content) {
        setExtractedContent(lessonData.extracted_content);
      }

      // Sort exams
      const sortedExams = examsData.filter(e => e?.id).sort((a, b) => {
        if (a.exam_type === 'practice' && b.exam_type !== 'practice') return 1;
        if (a.exam_type !== 'practice' && b.exam_type === 'practice') return -1;
        if (a.exam_type === 'practice' && b.exam_type === 'practice') {
          return new Date(b.created_date) - new Date(a.created_date);
        }
        return (a.exam_number || 0) - (b.exam_number || 0);
      });
      setExams(sortedExams);
      
      // Get the latest predicted grade from completed exams
      const examWithGrade = examsData
        .filter(e => e.completed && e.predicted_grade)
        .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];
      
      if (examWithGrade) {
        setPredictedGrade(examWithGrade.predicted_grade);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading lesson:", error);
      setError(error.message);
      setLoading(false);
    }
  };



  useEffect(() => {
    const handleReloadLesson = () => {
      loadLesson();
    };
    
    window.addEventListener('reloadLesson', handleReloadLesson);
    
    return () => {
      window.removeEventListener('reloadLesson', handleReloadLesson);
    };
  }, []);

  const handleExamComplete = async () => {
    // Reload lesson data to refresh exams list
    await loadLesson();
    window.dispatchEvent(new CustomEvent('studyActivityCompleted'));

    // PostHog: document_analysis_completed fires when user finishes the diagnostic (their first exam)
    try {
      const freshExams = await base44.entities.Exam.filter({ lesson_id: lessonIdRef.current }).catch(() => []);
      const completedDiag = freshExams.find(e => e.exam_number === 1 && e.completed && e.exam_type !== 'practice');
      if (completedDiag) {
        const deviceInfo = detectDeviceInfo();
        posthog?.capture('document_analysis_completed', {
          lesson_id: lessonIdRef.current,
          predicted_grade: completedDiag.predicted_grade,
          predicted_score: completedDiag.total_score,
          device_type: deviceInfo.device_type,
          app_type: deviceInfo.app_type,
          is_guest: isGuest
        });
      }
    } catch {}
  };



  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-purple-900/20' : 'bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40'}`}>
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Unable to Load Lesson</h2>
          <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{error}</p>
          <Button onClick={() => navigate(createPageUrl("Home"))}>
            Go Back Home
          </Button>
        </div>
      </div>
    );
  }

  // Show upload prompt if needed
  if (showUploadPrompt && lesson) {
    return (
      <MaterialUploadPrompt 
        lesson={lesson} 
        onComplete={() => {
          setShowUploadPrompt(false);
          loadLesson(); // Reload to get updated lesson
        }} 
      />
    );
  }

  return (
    <div className={`min-h-screen overflow-x-hidden w-full ${isDark ? 'bg-[#0a0a12]' : 'bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40'}`}>

      
      {/* Desktop Header - Unified Purple Banner */}
      <div className="hidden md:block sticky top-0 z-10 w-full">
        <div className="bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-700 px-4 py-2.5 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back + Course Name */}
            <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
              <button
                onClick={handleBackNavigation}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className={`backdrop-blur-sm px-4 py-1 rounded-full border ${isDark ? 'bg-white/10 border-white/20' : 'bg-white/90 border-purple-200'}`}>
                <span className={`font-semibold text-sm truncate block max-w-[280px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {lesson?.course_name}
                </span>
              </div>
            </div>
            
            {/* Right: Grade + XP + Timer */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Predicted Grade */}
              <AnimatedGradeBadge grade={predictedGrade} />
              
              {/* Subtle Divider */}
              <div className="h-6 w-px bg-white/20" />
              
              {/* Daily XP */}
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-400/20 to-amber-400/20 border border-yellow-400/30 rounded-full px-3 py-1.5">
                <Zap className="w-4 h-4 text-yellow-300" />
                <span className="text-white text-xs font-bold">{userDailyXP}/50 XP</span>
              </div>
              
              {/* Timer */}
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5">
                <button 
                  onClick={() => setPomodoroEnabled(!pomodoroEnabled)}
                  className={`w-4 h-4 flex items-center justify-center transition-colors ${pomodoroEnabled ? 'text-yellow-300' : 'text-white/80'}`}
                  title={pomodoroEnabled ? 'Pomodoro enabled' : 'Enable Pomodoro breaks'}
                >
                  <Clock className="w-4 h-4" />
                </button>
                <span className="text-white text-xs font-mono font-semibold min-w-[45px]">
                  {formatStudyTime(studyTime)}
                </span>
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                >
                  {isTimerRunning ? (
                    <div className="flex gap-0.5">
                      <div className="w-[3px] h-3 bg-white rounded-full" />
                      <div className="w-[3px] h-3 bg-white rounded-full" />
                    </div>
                  ) : (
                    <div className="w-0 h-0 border-l-[6px] border-l-white border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-0.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-full px-2 py-2 relative md:h-[calc(100vh-56px)] overflow-x-hidden">
        {/* Desktop: Turbo-style split-pane — Document (left 2/3) + AI/Practice sidebar (right 1/3) */}
        <div className="hidden md:flex gap-3 h-full w-full max-w-full" style={{ isolation: 'isolate' }}>
          {/* LEFT PANE: Document content */}
          <div className="w-2/3 min-w-0 flex-shrink-0">
            {!lesson ? (
              <ParsingLoader />
            ) : hasDocument ? (
              <div className="h-full flex flex-col">
                <div className="px-2 pt-1">
                  <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} onNavigateToTab={(tab) => setActiveTab(tab)} currentTab={activeTab} />
                </div>
                <div className="flex-1 overflow-auto scrollbar-hide">
                  <DocumentViewerTabs lesson={lesson} />
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="px-2 pt-1">
                  <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} onNavigateToTab={(tab) => setActiveTab(tab)} currentTab={activeTab} />
                </div>
                <div className="flex-1 overflow-auto scrollbar-hide">
                  <NotesTab lesson={lesson} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANE: AI Chat + Practice Sidebar */}
          <div className="w-1/3 flex-shrink-0 flex flex-col" style={{ height: '100%' }}>
            <PracticeSidebar
              lesson={lesson}
              exams={exams}
              messages={messages}
              setMessages={setMessages}
              aiInput={aiInput}
              setAiInput={setAiInput}
              aiLoading={aiLoading}
              setAiLoading={setAiLoading}
              activeActivity={activeTab !== 'doc' && activeTab !== 'notes' ? activeTab : null}
              onSelectActivity={(id) => setActiveTab(id)}
              onBackToHub={() => setActiveTab(hasDocument ? 'doc' : 'notes')}
              showStudyPlanDot={showStudyPlanDot}
              showFlashcardsDot={showFlashcardsDot}
              showTeachItDot={showTeachItDot}
              showExamDot={showExamDot}
              isCramActive={isCramActive}
              showCramTab={showCramTab}
              isDark={isDark}
            >
              {/* Activity content rendered as children when an activity is active */}
              {activeTab === 'practice' && (
                <PracticeHubTab lesson={lesson} exams={exams} onNavigateToTab={(tab) => setActiveTab(tab)} />
              )}
              {activeTab === 'studyplan' && (
                <StudyPlanTab lesson={lesson} exams={exams} onNavigate={handleStudyPlanNavigate} isGeneratingPlan={isGeneratingStudyPlan} />
              )}
              {activeTab === 'exam' && (
                <ExamTab lesson={lesson} exams={exams} onExamComplete={handleExamComplete} extractedContent={extractedContent} />
              )}
              {activeTab === 'flashcards' && (
                <FlashcardsTab lesson={lesson} extractedContent={extractedContent} />
              )}
              {activeTab === 'teachit' && (
                <TeachItTab lesson={lesson} />
              )}
              {activeTab === 'learn' && (
                contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <LearnTab lesson={lesson} extractedContent={extractedContent} onNavigateToExam={() => setActiveTab('exam')} />
              )}
              {activeTab === 'cram' && showCramTab && (
                contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <CramModeTab lesson={lesson} isCramActive={isCramActive} daysUntilExam={daysUntilExam} />
              )}
            </PracticeSidebar>
          </div>
        </div>

        {/* Mobile view — extracted to component for maintainability */}
        <MobileTabsView
          lesson={lesson}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          studyTime={studyTime}
          formatStudyTime={formatStudyTime}
          hasDocument={hasDocument}
          contentLocked={contentLocked}
          isCramActive={isCramActive}
          daysUntilExam={daysUntilExam}
          showCramTab={showCramTab}
          showStudyPlanDot={showStudyPlanDot}
          showFlashcardsDot={showFlashcardsDot}
          showTeachItDot={showTeachItDot}
          showExamDot={showExamDot}
          exams={exams}
          extractedContent={extractedContent}
          isGeneratingStudyPlan={isGeneratingStudyPlan}
          handleStudyPlanNavigate={handleStudyPlanNavigate}
          handleExamComplete={handleExamComplete}
          isDark={isDark}
        />

      </div>

      {/* Pomodoro Timer - Mobile only */}
      <div className="md:hidden">
        {isTimerRunning && (
          <PomodoroTimer 
            elapsedSeconds={studyTime} 
            onBreakComplete={() => {
              if (getSessionElapsed() >= MIN_SESSION_SECONDS) {
                setShowSessionSummary(true);
              }
            }}
            enabled={pomodoroEnabled}
          />
        )}
      </div>

      {/* Topic Confirmation Modal removed — diagnostic is no longer the forced first step (Pillar 1) */}

      {/* Full-screen confetti on task completion */}
      <ConfettiEffect show={showTaskConfetti} onComplete={() => setShowTaskConfetti(false)} />

      {/* Post-Diagnostic Paywall for free authenticated users only (guests get GuestSignUpModal instead) */}
      {lesson?.id && !isGuest && <PostDiagnosticPaywall lessonId={lesson.id} />}

      {/* Post-Session Summary */}
      <PostSessionSummary
        open={showSessionSummary}
        onClose={() => {
          setShowSessionSummary(false);
          navigate(createPageUrl("Home"));
        }}
        onContinue={() => setShowSessionSummary(false)}
        lesson={lesson}
        studyTimeSeconds={studyTime}
      />

      {/* XP Gain Toast */}
      <XPGainToast 
        xpGained={xpToast.xp}
        reason={xpToast.reason}
        show={xpToast.show}
        onComplete={() => setXpToast({ show: false, xp: 0, reason: '' })}
      />
    </div>
  );
}