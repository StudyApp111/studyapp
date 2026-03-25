import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, ChevronLeft, Loader2, Clock, BookMarked, Flame, Zap, Users, NotebookPen, Lightbulb, ChevronRight, Target, StickyNote, Brain, Headphones, FlameKindling } from "lucide-react";
import DocumentViewerTabs from "@/components/document-viewer/DocumentViewerTabs";
import ExamTab from "@/components/document-viewer/ExamTab";


import FlashcardsTab from "@/components/document-viewer/FlashcardsTab";
import TeachItTab from "@/components/document-viewer/TeachItTab";
import LearnTab from "@/components/document-viewer/LearnTab";
import StudyPlanTab from "@/components/study-plan/StudyPlanTab";
import NextStepBanner from "@/components/study-plan/NextStepBanner";
import StudyPlanBannerInline from "@/components/study-plan/StudyPlanBannerInline";
import PomodoroTimer from "@/components/document-viewer/PomodoroTimer";
import AITutorPanel from "@/components/document-viewer/AITutorPanel";
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

// Track study minutes every minute
      
export default function DocumentViewer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState("doc");
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
  
  // Record session start time once
  useEffect(() => {
    if (!sessionStartTimeRef.current) {
      sessionStartTimeRef.current = Date.now();
    }
  }, []);

  const MIN_SESSION_SECONDS = 300; // 5 minutes
  const getSessionElapsed = () => Math.floor((Date.now() - (sessionStartTimeRef.current || Date.now())) / 1000);

  const handleBackNavigation = () => {
    if (getSessionElapsed() >= MIN_SESSION_SECONDS) {
      setShowSessionSummary(true);
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
  
  // Load micro-interaction data for notification dots
  useEffect(() => {
    const loadNotificationData = async () => {
      if (!lesson?.id) return;
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
    };
    loadNotificationData();
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

  // Track first lesson view (SubmitApplication)
  const hasTrackedFirstLesson = useRef(false);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  // When lesson loads, default tab: cram if exam within 7 days, else doc/studyplan
  useEffect(() => {
    if (!lesson) return;
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (!tabParam) {
      if (lesson.exam_date) {
        const days = differenceInCalendarDays(new Date(lesson.exam_date), new Date());
        if (days >= 0 && days <= 7 && diagnosticCompleted) {
          setActiveTab("cram");
          return;
        }
      }
      const lessonHasDoc = lesson.file_url || lesson.file_urls?.length > 0;
      setActiveTab(lessonHasDoc ? "doc" : "studyplan");
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
      // If we have a new ID in the URL, update our ref and storage
      if (capturedId !== lessonIdRef.current) {
        console.log("✅ Detected new lesson ID:", capturedId);
        lessonIdRef.current = capturedId;
        sessionStorage.setItem('currentLessonId', capturedId);
        setLesson(null); // Clear previous lesson
        setLoading(true);
      }
    }
    
    loadLesson();
    loadUserStats();
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

  // Save progress every 1 second for accurate timer persistence
  // Track study_minutes_today every minute for daily challenges
  useEffect(() => {
    if (saveProgressRef.current) {
      clearInterval(saveProgressRef.current);
    }

    // Save every 1 second for accurate timer (skip for guests)
    saveProgressRef.current = setInterval(async () => {
      if (!isTimerRunning || isGuest) return;
      
      const now = Date.now();
      const secondsSinceLastSave = Math.floor((now - lastSaveTimeRef.current) / 1000);
      
      if (secondsSinceLastSave >= 1) {
        try {
          // Update lesson-specific study time
          if (lesson?.id) {
            await base44.entities.Lesson.update(lesson.id, {
              total_study_time_seconds: studyTime
            });
          }
          
          // Update user total time less frequently (every 10 seconds)
          if (secondsSinceLastSave >= 10) {
            const user = await base44.auth.me();
            await base44.auth.updateMe({
              time_spent_seconds: (user.time_spent_seconds || 0) + secondsSinceLastSave
            });
            lastSaveTimeRef.current = now;
          }
          
          // Track study minutes for daily challenges (every 60 seconds)
          const secondsSinceMinuteTrack = Math.floor((now - lastMinuteTrackRef.current) / 1000);
          if (secondsSinceMinuteTrack >= 60) {
            await recordDailyActivity('study_minutes', 1);
            lastMinuteTrackRef.current = now;
          }
        } catch (error) {
          console.error("Error saving progress:", error);
        }
      }
    }, 1000);

    return () => {
      if (saveProgressRef.current) {
        clearInterval(saveProgressRef.current);
      }
    };
  }, [lesson?.id, isTimerRunning, studyTime]);

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
            
            {/* Right: Next Step + Grade + XP + Timer */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Next Step Banner */}
              {lesson?.id && (
                <NextStepBanner 
                  lessonId={lesson.id} 
                  onNavigateToStudyPlan={() => setActiveTab('studyplan')} 
                />
              )}
              
              {/* Subtle Divider */}
              <div className="h-6 w-px bg-white/20" />
              
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
        {/* Desktop: Flex container for AI tutor + tabs */}
        <div className="hidden md:flex gap-3 h-full w-full max-w-full" style={{ isolation: 'isolate' }}>
          {/* AI Tutor Panel - Left side, 1/3 width */}
          <div className="w-1/3 flex-shrink-0">
            <AITutorPanel 
              messages={messages}
              setMessages={setMessages}
              input={aiInput}
              setInput={setAiInput}
              isLoading={aiLoading}
              setIsLoading={setAiLoading}
              lesson={lesson}
            />
          </div>
          
          {/* Tabs - Right side, 2/3 width */}
          <div className="w-2/3 min-w-0 relative z-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2 h-full flex flex-col">
              <div className="flex-shrink-0 relative z-0 overflow-x-auto scrollbar-hide">
                <TabsList className={`flex w-max min-w-full border p-1 gap-1 h-auto rounded-lg ${isDark ? 'bg-[#1a1a2e] border-white/10' : 'bg-white border-purple-200'}`}>
                {hasDocument && (
                  <TabsTrigger 
                    value="doc"
                    className={`flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap rounded-md ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}
                  >
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Doc</span>
                  </TabsTrigger>
                )}
                <TabsTrigger 
                  value="studyplan"
                  className={`flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative rounded-md ${isDark ? 'data-[state=inactive]:text-amber-400/80 data-[state=inactive]:bg-amber-500/10' : 'data-[state=inactive]:text-amber-700 data-[state=inactive]:bg-amber-50'}`}
                >
                  {showStudyPlanDot && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                  <Target className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-medium">Study Plan</span>
                </TabsTrigger>
                  <TabsTrigger 
                    value="notes"
                    className={`flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap rounded-md ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}
                  >
                    <StickyNote className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Notes</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="teachit"
                    className={`flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative rounded-md ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}
                  >
                    {showTeachItDot && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                    <Brain className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Feynman</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="flashcards"
                    className={`flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative rounded-md ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}
                  >
                    {showFlashcardsDot && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                    <BookMarked className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Flashcards</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="exam"
                    className={`flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative rounded-md ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}
                  >
                    {showExamDot && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                    <Zap className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Practice</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="learn"
                    className={`flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap rounded-md ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}
                  >
                    <Headphones className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Learn</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="cram"
                    className={`flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative rounded-md ${isCramActive ? 'data-[state=inactive]:bg-orange-500/20 data-[state=inactive]:text-orange-400 ring-1 ring-orange-500/40' : isDark ? 'data-[state=inactive]:text-orange-400/80 data-[state=inactive]:bg-orange-500/10' : 'data-[state=inactive]:text-orange-700 data-[state=inactive]:bg-orange-50'}`}
                  >
                    {isCramActive && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse" />}
                    <FlameKindling className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Cram</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="w-full flex-1 overflow-auto scrollbar-hide">
                {hasDocument && (
                  <TabsContent value="doc" className="mt-0 p-0 h-full">
                    {!lesson ? (
                      <ParsingLoader />
                    ) : (
                      <div className="h-full flex flex-col">
                        <div className="px-2 pt-2">
                          <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} currentTab={activeTab} />
                        </div>
                        <div className="flex-1">
                          <DocumentViewerTabs lesson={lesson} />
                        </div>
                      </div>
                    )}
                  </TabsContent>
                )}

                <TabsContent value="studyplan" className="mt-0 p-0 h-full">
                  <StudyPlanTab 
                    lesson={lesson} 
                    exams={exams} 
                    onNavigate={handleStudyPlanNavigate}
                    isGeneratingPlan={isGeneratingStudyPlan}
                  />
                </TabsContent>

                <TabsContent value="notes" className="mt-0 p-0 h-full">
                  <div className="px-2 pt-2">
                    <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} currentTab={activeTab} />
                  </div>
                  {contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <NotesTab lesson={lesson} />}
                </TabsContent>

                <TabsContent value="exam" forceMount className="mt-0 p-0 h-full data-[state=inactive]:hidden">
                  <div className="px-2 pt-2">
                    <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} currentTab={activeTab} />
                  </div>
                  <ExamTab lesson={lesson} exams={exams} onExamComplete={handleExamComplete} extractedContent={extractedContent} />
                </TabsContent>



                <TabsContent value="flashcards" forceMount className="mt-0 p-0 h-full data-[state=inactive]:hidden">
                  <div className="px-2 pt-2">
                    <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} currentTab={activeTab} />
                  </div>
                  {contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <FlashcardsTab lesson={lesson} extractedContent={extractedContent} />}
                </TabsContent>

                <TabsContent value="teachit" forceMount className="mt-0 p-0 h-full data-[state=inactive]:hidden">
                  <div className="px-2 pt-2">
                    <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} currentTab={activeTab} />
                  </div>
                  {contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <TeachItTab lesson={lesson} />}
                </TabsContent>

                <TabsContent value="learn" forceMount className="mt-0 p-0 h-full data-[state=inactive]:hidden">
                  <div className="px-2 pt-2">
                    <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} currentTab={activeTab} />
                  </div>
                  {contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <LearnTab lesson={lesson} extractedContent={extractedContent} onNavigateToExam={() => setActiveTab('exam')} />}
                </TabsContent>

                <TabsContent value="cram" forceMount className="mt-0 p-0 h-full data-[state=inactive]:hidden">
                  {contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <CramModeTab lesson={lesson} />}
                </TabsContent>

              </div>
            </Tabs>
          </div>
          </div>
        
        {/* Mobile: Tabs + info bar at top */}
        <div className="md:hidden flex flex-col w-full overflow-x-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col w-full overflow-x-hidden flex-1">
            {/* Fixed tabs + info bar */}
            <div 
              className="fixed left-0 right-0 z-40 bg-gradient-to-r from-purple-800 to-purple-700"
              style={{ 
                top: '0px',
                paddingTop: 'env(safe-area-inset-top, 0px)'
              }}
            >
              {/* Info strip - course and timer */}
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-white font-bold text-base truncate">{lesson?.course_name || 'Loading...'}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Next Step Banner - Mobile */}
                  {lesson?.id && (
                    <NextStepBanner 
                      lessonId={lesson.id} 
                      onNavigateToStudyPlan={() => setActiveTab('studyplan')} 
                    />
                  )}
                  <div className="bg-white/15 rounded-full px-3 py-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-white/80" />
                    <span className="text-white text-sm font-mono font-semibold">{formatStudyTime(studyTime)}</span>
                  </div>
                </div>
              </div>
              
              {/* Tabs bar */}
              <div className={`backdrop-blur-sm px-2 py-1.5 border-b ${isDark ? 'bg-[#12121a]/95 border-white/10' : 'bg-white/95 border-purple-200'}`}>
                <div className="overflow-x-auto scrollbar-hide">
                  <TabsList className={`flex w-max min-w-full border p-0.5 h-auto rounded-lg shadow-sm gap-0.5 ${isDark ? 'bg-[#1a1a2e] border-white/10' : 'bg-white border-purple-200'}`}>
                    {hasDocument && (
                      <TabsTrigger 
                        value="doc"
                        className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold">Doc</span>
                      </TabsTrigger>
                    )}
                    <TabsTrigger 
                      value="studyplan"
                      className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all relative ${isDark ? 'data-[state=inactive]:text-amber-400/80 data-[state=inactive]:bg-amber-500/10' : 'data-[state=inactive]:text-amber-700 data-[state=inactive]:bg-amber-50'}`}
                    >
                      {showStudyPlanDot && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                      <Target className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">Plan</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="notes"
                      className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">Notes</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="teachit"
                      className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all relative ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}
                    >
                      {showTeachItDot && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                      <Brain className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">Feynman</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="flashcards"
                      className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all relative ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}
                    >
                      {showFlashcardsDot && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                      <BookMarked className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">Flash</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="exam"
                      className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all relative ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}
                    >
                      {showExamDot && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                      <Zap className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">Practice</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="learn"
                      className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}
                    >
                      <Headphones className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">Learn</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="cram"
                      className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all relative ${isCramActive ? 'data-[state=inactive]:bg-orange-500/20 data-[state=inactive]:text-orange-400 ring-1 ring-orange-500/40' : isDark ? 'data-[state=inactive]:text-orange-400/80 data-[state=inactive]:bg-orange-500/10' : 'data-[state=inactive]:text-orange-700 data-[state=inactive]:bg-orange-50'}`}
                    >
                      {isCramActive && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
                      <FlameKindling className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">Cram</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
            </div>
            
            {/* Spacer for fixed tabs + info */}
            <div style={{ height: 'calc(env(safe-area-inset-top, 0px) + 100px)' }} />

            {/* Scrollable content area */}
            <div className="overflow-x-hidden w-full pb-28 scrollbar-hide" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 112px)' }}>
              {hasDocument && (
                <TabsContent value="doc" className="mt-0 p-0 w-full overflow-x-hidden">
                  {!lesson ? (
                    <ParsingLoader />
                  ) : (
                    <>
                      <div className="px-2 pt-2">
                        <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} currentTab={activeTab} />
                      </div>
                      <DocumentViewerTabs lesson={lesson} />
                    </>
                  )}
                </TabsContent>
              )}

              <TabsContent value="studyplan" className="mt-0 p-0 w-full overflow-x-hidden">
                <StudyPlanTab 
                  lesson={lesson} 
                  exams={exams} 
                  onNavigate={handleStudyPlanNavigate}
                  isGeneratingPlan={isGeneratingStudyPlan}
                />
              </TabsContent>

              <TabsContent value="notes" className="mt-0 p-0 w-full overflow-x-hidden">
                <div className="px-2 pt-2">
                  <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} currentTab={activeTab} />
                </div>
                {contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <NotesTab lesson={lesson} />}
              </TabsContent>

              <TabsContent value="exam" forceMount className="mt-0 p-0 w-full overflow-x-hidden data-[state=inactive]:hidden">
                <div className="px-2 pt-2">
                  <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} currentTab={activeTab} />
                </div>
                <ExamTab lesson={lesson} exams={exams} onExamComplete={handleExamComplete} extractedContent={extractedContent} />
              </TabsContent>



              <TabsContent value="flashcards" forceMount className="mt-0 p-0 w-full overflow-x-hidden data-[state=inactive]:hidden">
                <div className="px-2 pt-2">
                  <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} currentTab={activeTab} />
                </div>
                {contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <FlashcardsTab lesson={lesson} extractedContent={extractedContent} />}
              </TabsContent>

              <TabsContent value="teachit" forceMount className="mt-0 p-0 w-full overflow-x-hidden data-[state=inactive]:hidden">
                <div className="px-2 pt-2">
                  <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} currentTab={activeTab} />
                </div>
                {contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <TeachItTab lesson={lesson} />}
              </TabsContent>

              <TabsContent value="learn" forceMount className="mt-0 p-0 w-full overflow-x-hidden data-[state=inactive]:hidden">
                <div className="px-2 pt-2">
                  <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} currentTab={activeTab} />
                </div>
                {contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <LearnTab lesson={lesson} extractedContent={extractedContent} onNavigateToExam={() => setActiveTab('exam')} />}
              </TabsContent>

              <TabsContent value="cram" forceMount className="mt-0 p-0 w-full overflow-x-hidden data-[state=inactive]:hidden">
                {contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <CramModeTab lesson={lesson} />}
              </TabsContent>

            </div>
          </Tabs>
        </div>
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

      {/* Topic Confirmation Modal - rendered once globally */}
      {lesson && hasDocument && !diagnosticCompleted && (
        <TopicConfirmationBanner
          lesson={lesson}
          diagnosticReady={!!((exams || []).find(e => e.exam_number === 1 && e.exam_type !== 'practice' && e.questions?.length > 0))}
          diagnosticCompleted={diagnosticCompleted}
          onGoToDiagnostic={() => {
            window.dispatchEvent(new CustomEvent('startDiagnosticExam', { detail: { examNumber: 1 } }));
            setActiveTab('exam');
          }}
        />
      )}

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