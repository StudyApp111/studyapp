import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, Clock, Sparkles, Play, Pause, CheckCircle2, Trophy, Zap, ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import ExamQuestion from "@/components/exam/ExamQuestion.jsx";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";
import EducationalLoader from "@/components/ui/EducationalLoader";
import { logError } from "@/components/utils/errorLogger";
import XPGainToast from "@/components/gamification/XPGainToast";
import { recordDailyActivity, awardDailyXP } from "@/components/utils/dailyReset";
import posthog from 'posthog-js';
import FeedbackDisplay from "@/components/feedback/FeedbackDisplay";
import { useTheme } from "@/components/theme/ThemeProvider";
import CreatePracticeQuizButton from "./CreatePracticeQuizButton";
import { useGuestSession } from "@/components/guest/GuestSessionContext";

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Unified progress loader for exam generation - with fun facts
function ExamGeneratingLoader({ isPractice }) {
  const { isDark } = useTheme();
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  
  const funFacts = [
    { text: "Your brain can process images in as little as 13 milliseconds", icon: "🧠" },
    { text: "Learning is more effective when you take breaks every 25-50 minutes", icon: "⏰" },
    { text: "Teaching others is one of the best ways to learn something", icon: "👥" },
    { text: "Your brain uses 20% of your body's energy while only being 2% of its weight", icon: "⚡" },
    { text: "Sleep helps consolidate memories and improve learning", icon: "💤" },
    { text: "Walking can boost creative thinking by up to 60%", icon: "🚶" },
    { text: "The average attention span is about 8 seconds - but deep focus can last hours", icon: "🎯" }
  ];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFactIndex(prev => (prev + 1) % funFacts.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 min-h-[400px]">
      {/* Animated icon with glow */}
      <motion.div
        className="relative mb-6"
        animate={{ 
          scale: [1, 1.05, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ 
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <div className="absolute inset-0 bg-purple-500/30 blur-3xl rounded-full" />
        <div className="relative w-24 h-24 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl">
          <span className="text-5xl">✨</span>
        </div>
      </motion.div>
      
      {/* Title */}
      <h3 className={`font-bold text-xl mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {isPractice ? 'Creating Practice Quiz' : 'Generating Your Exam'}
      </h3>
      
      {/* Fun fact rotator */}
      <div className="h-16 flex items-center justify-center mb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentFactIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl max-w-md ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}
          >
            <span className="text-2xl flex-shrink-0">{funFacts[currentFactIndex].icon}</span>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {funFacts[currentFactIndex].text}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Loading dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-purple-500"
            animate={{ 
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1, 0.8]
            }}
            transition={{ 
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </div>
    </div>
  );
}

const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

export default function ExamTab({ lesson, exams, onExamComplete, extractedContent }) {
  const { isDark } = useTheme();
  const { isGuest, markGuestDiagnosticCompleted } = useGuestSession();
  const [exam, setExam] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [newBadges, setNewBadges] = useState([]);
  const gradingTimeoutRef = useRef(null);
  const [gradingInProgress, setGradingInProgress] = useState({});
  const [selectedExamNumber, setSelectedExamNumber] = useState(null);
  const [xpToast, setXpToast] = useState({ show: false, xp: 0, reason: '' });
  const [waitingForCompression, setWaitingForCompression] = useState(false);
  const [correctStreak, setCorrectStreak] = useState(0);
  const hasAutoSelectedRef = useRef(false);
  const [viewingCompletedExam, setViewingCompletedExam] = useState(null);
  const [error, setError] = useState(null);
  
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const questionTimesRef = useRef({});
  const currentQuestionStartTimeRef = useRef(null);
  const examIdRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const lastSavedQuestionsRef = useRef(null);

  const practiceExamGeneratingRef = useRef(false);
  const generatedTaskIdsRef = useRef(new Set());

  // Listen for direct exam results viewing from StudyPlanTab
  useEffect(() => {
    const handleViewExamResults = (e) => {
      const { examId } = e.detail;
      const targetExam = (exams || []).find(ex => ex.id === examId);
      if (targetExam) {
        setViewingCompletedExam(targetExam);
      }
    };
    
    const handleStartDiagnostic = (e) => {
      const { examNumber } = e.detail;
      // Check if we already have a completed diagnostic in exams prop — show results instead of regenerating
      const existing = (exams || []).find(ex => ex.exam_number === examNumber && ex.exam_type !== 'practice');
      if (existing?.completed) {
        setViewingCompletedExam(existing);
        return;
      }
      // If exam exists with questions but not completed, load it directly
      if (existing?.questions?.length > 0) {
        setExam(existing);
        const firstUnanswered = existing.questions.findIndex(q => !q.user_answer?.trim());
        setCurrentQuestion(firstUnanswered >= 0 ? firstUnanswered : 0);
        hasAutoSelectedRef.current = true;
        return;
      }
      setViewingCompletedExam(null);
      setExam(null);
      setSelectedExamNumber(examNumber);
      hasAutoSelectedRef.current = true;
    };
    
    window.addEventListener('viewExamResults', handleViewExamResults);
    window.addEventListener('startDiagnosticExam', handleStartDiagnostic);
    return () => {
      window.removeEventListener('viewExamResults', handleViewExamResults);
      window.removeEventListener('startDiagnosticExam', handleStartDiagnostic);
    };
  }, [exams]);

  useEffect(() => {
    const handleGeneratePracticeExam = async (e) => {
      if (practiceExamGeneratingRef.current) {
        console.log('⚠️ Practice exam generation already in progress, skipping');
        return;
      }

      // Debounce: ignore events within 2 seconds of each other
      const now = Date.now();
      if (handleGeneratePracticeExam._lastCall && now - handleGeneratePracticeExam._lastCall < 2000) {
        console.log('⚠️ Debouncing duplicate practice exam event');
        return;
      }
      handleGeneratePracticeExam._lastCall = now;

      const { task, focus_topics, target_competency, misconception_addressed } = e.detail;
      
      console.log('🎯 Practice exam task details:', { title: task?.title, section: task?.section_title, topics: focus_topics });
      
      // Check if we've already generated an exam for this specific task
      const taskId = task?.task_id;
      if (taskId && generatedTaskIdsRef.current.has(taskId)) {
        console.log('⚠️ Already generated exam for this task, skipping duplicate');
        return;
      }
      
      // Check if there's already an incomplete practice exam for this lesson we can resume
      const existingPracticeExams = (exams || []).filter(e => 
        e.exam_type === 'practice' && !e.completed
      );
      
      if (existingPracticeExams.length > 0) {
        console.log('📋 Found existing incomplete practice exam, loading instead of generating');
        const examToResume = existingPracticeExams[0];
        setExam(examToResume);
        setCurrentQuestion(0);
        hasAutoSelectedRef.current = true;
        return;
      }
      
      console.log('🎯 Received practice exam generation request from study plan');

      // Clear any existing exam view state FIRST before generating
      setViewingCompletedExam(null);
      setExam(null);
      setCurrentQuestion(0);

      practiceExamGeneratingRef.current = true;
      if (taskId) generatedTaskIdsRef.current.add(taskId);
      setIsGenerating(true);

      try {
        // Subscription check removed - handled in generatePracticeExam function
        
        const { data } = await base44.functions.invoke('generatePracticeExam', {
          lesson_id: lesson.id,
          focus_topics: focus_topics || [],
          target_competency: target_competency || '',
          misconception_addressed: misconception_addressed || ''
        });

        if (data?.success && data.exam) {
              console.log('✅ Practice exam generated:', data.exam.id);
              setExam(data.exam);
              setCurrentQuestion(0);
              hasAutoSelectedRef.current = true;
              // Refresh exams list so practice exam shows in list
              if (onExamComplete) onExamComplete();
            }
      } catch (error) {
        console.error("Error generating practice exam:", error);
        // Remove from generated set on error so user can retry
        if (taskId) generatedTaskIdsRef.current.delete(taskId);
      } finally {
        setIsGenerating(false);
        practiceExamGeneratingRef.current = false;
      }
    };

    window.addEventListener('generatePracticeExamFromTask', handleGeneratePracticeExam);
    return () => window.removeEventListener('generatePracticeExamFromTask', handleGeneratePracticeExam);
  }, [lesson?.id, exams]);

  useEffect(() => {
    if (!lesson?.id || exams === undefined || selectedExamNumber || hasAutoSelectedRef.current) return;

    const allExamsForLesson = exams || [];
    const inProgressExam = allExamsForLesson.find(e => e.status === 'in_progress' && !e.completed);
    if (inProgressExam) {
      hasAutoSelectedRef.current = true;
      setSelectedExamNumber(inProgressExam.exam_number);
    }
  }, [lesson?.id, exams, selectedExamNumber]);

  useEffect(() => {
    if (!lesson?.id || !selectedExamNumber || exams === undefined) return;
    // Don't reload if we already have this exam loaded (prevents regeneration on re-entry)
    if (exam && exam.exam_number === selectedExamNumber && exam.questions?.length > 0) return;
    // Don't reload if we're currently viewing a completed exam
    if (viewingCompletedExam) return;
    if (waitingForCompression) return;

    loadOrGenerateExam(selectedExamNumber);
  }, [lesson?.id, selectedExamNumber, waitingForCompression, exams]);

  // Wait for lesson content to be ready - but only briefly, then proceed anyway
  useEffect(() => {
    if (!lesson?.id) return;
    
    const isFileUpload = lesson.input_type === 'file';
    const hasExtractedContent = lesson.extracted_content?.length > 0;
    const hasCompressedContent = lesson.compressed_content?.length > 0;
    const needsToWait = isFileUpload && (!hasExtractedContent || !hasCompressedContent);
    
    if (needsToWait) {
      setWaitingForCompression(true);
      console.log('⏳ Waiting for content extraction and compression to complete...');
      
      // Set a max wait time of 10 seconds, then proceed anyway
      const maxWaitTimeout = setTimeout(() => {
        console.log('⚠️ Max wait time reached, proceeding without full content');
        setWaitingForCompression(false);
      }, 10000);
      
      // Subscribe to lesson updates
      const unsubscribe = base44.entities.Lesson.subscribe((event) => {
        if (event.id === lesson.id && event.type === 'update') {
          const updated = event.data;
          if (updated?.extracted_content?.length > 0 && updated?.compressed_content?.length > 0) {
            console.log('✅ Content ready via realtime update!');
            clearTimeout(maxWaitTimeout);
            setWaitingForCompression(false);
            window.dispatchEvent(new Event('reloadLesson'));
          }
        }
      });
      
      return () => {
        clearTimeout(maxWaitTimeout);
        unsubscribe();
      };
    } else {
      setWaitingForCompression(false);
    }
  }, [lesson?.id, lesson?.extracted_content, lesson?.compressed_content]);

  useEffect(() => {
    if (exam && !exam.completed && exam.id !== examIdRef.current) {
      examIdRef.current = exam.id;
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      const savedElapsed = exam.time_taken_seconds || 0;
      setElapsedSeconds(savedElapsed);
      startTimeRef.current = Date.now() - (savedElapsed * 1000);
      currentQuestionStartTimeRef.current = Date.now();
      
      if (exam.question_time_laps && exam.question_time_laps.length > 0) {
        const timesObj = {};
        exam.question_time_laps.forEach(lap => {
          timesObj[lap.question_index] = lap.total_seconds;
        });
        questionTimesRef.current = timesObj;
      } else {
        questionTimesRef.current = {};
        for (let i = 0; i < (exam.questions?.length || 10); i++) {
          questionTimesRef.current[i] = 0;
        }
      }
      
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const now = Date.now();
          const totalElapsed = Math.floor((now - startTimeRef.current) / 1000);
          setElapsedSeconds(totalElapsed);
        }
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [exam?.id, exam?.completed]);

  const saveExamProgress = async () => {
    if (!exam || exam.completed) return;
    
    const questionsJson = JSON.stringify(exam.questions);
    if (lastSavedQuestionsRef.current === questionsJson) return;
    
    try {
      const questionTimeLaps = Object.keys(questionTimesRef.current).map(key => ({
        question_index: parseInt(key),
        total_seconds: questionTimesRef.current[key]
      }));
      
      await base44.entities.Exam.update(exam.id, {
        questions: exam.questions,
        time_taken_seconds: elapsedSeconds,
        question_time_laps: questionTimeLaps
      });
      lastSavedQuestionsRef.current = questionsJson;
    } catch (error) {
      console.error("Auto-save error:", error);
    }
  };

  useEffect(() => {
    if (!exam || exam.completed) return;
    
    const intervalId = setInterval(saveExamProgress, 1000);
    return () => clearInterval(intervalId);
  }, [exam?.id, exam?.completed, elapsedSeconds]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (exam && !exam.completed) {
        saveExamProgress();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && exam && !exam.completed) {
        saveExamProgress();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [exam?.id, exam?.completed, elapsedSeconds]);

  const recordQuestionTime = (questionIndex) => {
    if (currentQuestionStartTimeRef.current) {
      const now = Date.now();
      const timeSpentOnQuestion = Math.floor((now - currentQuestionStartTimeRef.current) / 1000);
      questionTimesRef.current[questionIndex] = (questionTimesRef.current[questionIndex] || 0) + timeSpentOnQuestion;
    }
  };

  const loadOrGenerateExam = async (examNumber) => {
    if (!lesson?.id) {
      console.error("ExamTab: Cannot load exam - lesson not ready");
      return;
    }
    if (waitingForCompression) {
      console.log('⏳ Waiting for compression to complete...');
      return;
    }

    // Only exam 1 (diagnostic) should be generated here, and ONLY via autoGenerateExam1
    // Practice exams come from study plan via generatePracticeExam
    if (examNumber !== 1) {
      console.log(`⚠️ ExamTab only handles exam 1 (diagnostic). Exam ${examNumber} should be practice exam from study plan.`);
      return;
    }

    try {
      // FIRST: Check if we already have the exam loaded in state
      if (exam && exam.exam_number === 1 && exam.questions?.length > 0) {
        console.log('✅ Exam 1 already loaded in state with questions, skipping reload');
        return;
      }

      // Look for existing exam 1 in the loaded exams prop
      const existingExams = (exams || []).filter(e => e.exam_number === 1 && e.exam_type !== 'practice');
      console.log(`📋 Looking for Exam 1 in loaded exams:`, existingExams.length > 0 ? 'FOUND' : 'NOT FOUND');

      if (existingExams?.length > 0) {
        const loadedExam = existingExams[0];

        if (loadedExam.completed) {
          console.log('✅ Exam 1 already completed, loading from cache');
          setExam(loadedExam);
          return;
        }

        if (loadedExam.questions?.length > 0) {
          // Exam exists with questions - load it directly, NO regeneration needed
          console.log('✅ Exam 1 found with', loadedExam.questions.length, 'questions - loading directly');
          setExam(loadedExam);
          const firstUnanswered = loadedExam.questions.findIndex(q => !q.user_answer?.trim());
          setCurrentQuestion(firstUnanswered >= 0 ? firstUnanswered : loadedExam.questions.length - 1);
          return;
        } else {
          // Exam exists but no questions yet - autoGenerateExam1 is still processing
          // Use 2-phase approach: poll 25s, then retry + poll
          console.log('⏳ Exam 1 exists but questions not ready - starting poll + retry logic...');
          setIsGenerating(true);

          const pollAndRetry = async () => {
            // Phase 1: Poll for ~25s
            for (let i = 0; i < 8; i++) {
              await new Promise(r => setTimeout(r, 3000));
              try {
                const refreshed = await base44.entities.Exam.filter({ id: loadedExam.id });
                if (refreshed[0]?.questions?.length > 0) {
                  console.log('✅ Questions appeared during phase-1 polling');
                  setExam(refreshed[0]);
                  setIsGenerating(false);
                  return;
                }
              } catch (pollErr) {
                console.warn('Phase-1 poll error:', pollErr.message);
              }
            }

            // Phase 2: Retry autoGenerateExam1 + continue polling
            console.log('🔄 Phase-1 timed out, retrying autoGenerateExam1...');
            const retryPromise = base44.functions.invoke('autoGenerateExam1', { lesson_id: lesson.id })
              .catch(err => console.warn('Retry error:', err.message));

            for (let i = 0; i < 12; i++) {
              await new Promise(r => setTimeout(r, 4000));
              try {
                const refreshed = await base44.entities.Exam.filter({ id: loadedExam.id });
                if (refreshed[0]?.questions?.length > 0) {
                  console.log('✅ Questions appeared during phase-2 polling');
                  setExam(refreshed[0]);
                  setIsGenerating(false);
                  return;
                }
              } catch (pollErr) {
                console.warn('Phase-2 poll error:', pollErr.message);
              }
            }

            await retryPromise;
            const finalCheck = await base44.entities.Exam.filter({ id: loadedExam.id });
            if (finalCheck[0]?.questions?.length > 0) {
              setExam(finalCheck[0]);
              setIsGenerating(false);
              return;
            }

            console.error('❌ Exam generation failed after poll + retry');
            setIsGenerating(false);
            setError('Exam generation is taking longer than expected. Please refresh the page to try again.');
          };
          pollAndRetry();
          return;
        }
      }
      
      // SECOND: Double-check database directly before triggering generation
      // This catches race conditions where exams prop hasn't updated yet
      const dbExams = await base44.entities.Exam.filter({ lesson_id: lesson.id, exam_number: 1 });
      const dbExam = dbExams.find(e => e.exam_type !== 'practice');
      
      if (dbExam?.questions?.length > 0) {
        console.log('✅ Exam 1 found in DB with questions (race condition caught)');
        setExam(dbExam);
        const firstUnanswered = dbExam.questions.findIndex(q => !q.user_answer?.trim());
        setCurrentQuestion(firstUnanswered >= 0 ? firstUnanswered : dbExam.questions.length - 1);
        return;
      }
      
      if (dbExam && !dbExam.questions?.length) {
        // Exam record exists but no questions — poll, then retry autoGenerateExam1 if needed
        console.log('⏳ Exam 1 record exists in DB but no questions — starting poll + retry logic...');
        setIsGenerating(true);

        // Phase 1: Poll for 25s (the initial autoGenerateExam1 call from CreateLesson may still be running)
        const PHASE1_POLLS = 8;
        for (let i = 0; i < PHASE1_POLLS; i++) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const refreshed = await base44.entities.Exam.filter({ id: dbExam.id });
            if (refreshed[0]?.questions?.length > 0) {
              console.log('✅ Questions appeared during phase-1 polling');
              setExam(refreshed[0]);
              setIsGenerating(false);
              return;
            }
          } catch (pollErr) {
            console.warn('Phase-1 poll error:', pollErr.message);
          }
        }

        // Phase 2: No questions after ~25s — retrigger autoGenerateExam1
        console.log('🔄 Phase-1 timed out, retrying autoGenerateExam1...');
        try {
          // Fire retry — but also keep polling in case the ORIGINAL call eventually succeeds
          const retryPromise = base44.functions.invoke('autoGenerateExam1', { lesson_id: lesson.id })
            .catch(err => console.warn('Retry autoGenerateExam1 error:', err.message));

          // Poll while retry is running (up to 50s more)
          const PHASE2_POLLS = 12;
          for (let i = 0; i < PHASE2_POLLS; i++) {
            await new Promise(r => setTimeout(r, 4000));
            try {
              const refreshed = await base44.entities.Exam.filter({ id: dbExam.id });
              if (refreshed[0]?.questions?.length > 0) {
                console.log('✅ Questions appeared during phase-2 polling');
                setExam(refreshed[0]);
                setIsGenerating(false);
                return;
              }
            } catch (pollErr) {
              console.warn('Phase-2 poll error:', pollErr.message);
            }
          }

          // Wait for retry to finish
          await retryPromise;
          // One final check
          const finalCheck = await base44.entities.Exam.filter({ id: dbExam.id });
          if (finalCheck[0]?.questions?.length > 0) {
            console.log('✅ Questions appeared after retry completed');
            setExam(finalCheck[0]);
            setIsGenerating(false);
            return;
          }
        } catch (retryErr) {
          console.error('Retry phase error:', retryErr);
        }

        // All phases exhausted
        console.error('❌ Exam generation failed after poll + retry');
        setIsGenerating(false);
        setError('Exam generation is taking longer than expected. Please refresh the page to try again.');
        return;
      }

      // No exam 1 exists at all - trigger autoGenerateExam1 with retry on 502
      console.log('🎯 No Exam 1 found anywhere, triggering autoGenerateExam1...');
      setIsGenerating(true);

      const MAX_ATTEMPTS = 2;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const result = await Promise.race([
            base44.functions.invoke('autoGenerateExam1', { lesson_id: lesson.id }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Exam generation timeout')), 55000)
            )
          ]);
          
          if (result?.data?.success && result?.data?.exam_id) {
            const createdExams = await base44.entities.Exam.filter({ id: result.data.exam_id });
            if (createdExams[0]) {
              setExam(createdExams[0]);
            }
          } else if (result?.data?.skipped) {
            console.log('✅ autoGenerateExam1 returned skipped - exam already exists');
            const existingExamId = result?.data?.exam_id;
            if (existingExamId) {
              const existingExam = await base44.entities.Exam.filter({ id: existingExamId });
              if (existingExam[0]?.questions?.length > 0) {
                setExam(existingExam[0]);
              }
            }
          }
          break; // Success - exit retry loop
        } catch (err) {
          const is502 = err.response?.status === 502;
          const isTimeout = err.message?.includes('timeout') || is502;
          
          if (isTimeout && attempt < MAX_ATTEMPTS) {
            console.log(`⚠️ Attempt ${attempt} failed (502/timeout), retrying...`);
            // Check if questions appeared despite the 502 (function may have succeeded server-side)
            const checkExams = await base44.entities.Exam.filter({ lesson_id: lesson.id, exam_number: 1 });
            const readyExam = checkExams.find(e => e.exam_type !== 'practice' && e.questions?.length > 0);
            if (readyExam) {
              console.log('✅ Questions appeared despite 502 - loading');
              setExam(readyExam);
              break;
            }
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          
          if (isTimeout) {
            // Final attempt failed - check DB one more time before showing error
            const finalCheck = await base44.entities.Exam.filter({ lesson_id: lesson.id, exam_number: 1 });
            const finalExam = finalCheck.find(e => e.exam_type !== 'practice' && e.questions?.length > 0);
            if (finalExam) {
              console.log('✅ Questions found on final DB check');
              setExam(finalExam);
              break;
            }
            console.error('❌ Exam generation failed after all retries');
            setError('Exam generation is taking longer than expected. Please refresh the page to try again.');
          } else {
            console.error('Error generating exam 1:', err);
            setError('Failed to generate exam. Please try again.');
          }
          
          await logError('exam_generation_timeout', err, { lesson_id: lesson?.id, is502, isTimeout, attempt });
        }
      }
      setIsGenerating(false);
    } catch (error) {
      console.error("Error loading exam:", error);
      await logError('exam_loading', error, { lesson_id: lesson?.id, examNumber });
      setIsGenerating(false);
    }
  };

  // NOTE: Exam 1 generation is now handled EXCLUSIVELY by autoGenerateExam1 backend function
  // This component only LOADS existing exams, never generates them directly
  // Practice exams are generated via generatePracticeExam from the study plan

  const isSubjectiveQuestion = (questionType) => {
    const type = (questionType || '').toLowerCase();
    return type.includes("short answer") || 
           type.includes("long answer") || 
           type.includes("fill-in-the-blank") ||
           type.includes("fill in the blank") ||
           type.includes("fill_in_the_blank") ||
           type.includes("structured response");
  };

  // Cache learning profile to avoid rate limits
  const learningProfileRef = useRef(null);
  
  const getLearningProfile = async () => {
    if (learningProfileRef.current) return learningProfileRef.current;
    try {
      const user = await base44.auth.me();
      if (user.learning_profile_id) {
        const profile = await base44.entities.LearningProfile.filter({ id: user.learning_profile_id });
        learningProfileRef.current = profile[0] || {};
      } else {
        learningProfileRef.current = {};
      }
    } catch {
      learningProfileRef.current = {};
    }
    return learningProfileRef.current;
  };

  const gradeSubjectiveQuestion = async (question, questionIndex) => {
    if (!question.user_answer || question.user_answer.trim() === "") return;

    try {
      setGradingInProgress(prev => ({ ...prev, [questionIndex]: true }));

      const learningProfile = await getLearningProfile();

      const { data: gradingResult } = await base44.functions.invoke('gradeShortAnswer', {
        question_text: question.question_text,
        question_type: question.question_type,
        difficulty_index: question.difficulty_index,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
        assessed_competencies: question.assessed_competencies,
        targeted_misconception: question.targeted_misconception,
        student_answer: question.user_answer,
        student_grade_level: learningProfile.grade || "N/A",
        course_name: lesson.course_name
      });

      const updatedQuestions = [...exam.questions];
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        ai_score_out_of_10: gradingResult.score_out_of_10,
        ai_verdict: gradingResult.verdict,
        ai_rationale_short: gradingResult.rationale_short,
        ai_keypoints_hit: gradingResult.keypoints_hit,
        ai_keypoints_missed: gradingResult.keypoints_missed,
        ai_misconception_detected: gradingResult.misconception_detected,
        ai_grading_pending: false
      };
      
      await base44.entities.Exam.update(exam.id, {
        questions: updatedQuestions
      });

      setExam(prev => ({
        ...prev,
        questions: updatedQuestions
      }));

      setGradingInProgress(prev => ({ ...prev, [questionIndex]: false }));
    } catch (error) {
      console.error("Error grading question:", error);
      setGradingInProgress(prev => ({ ...prev, [questionIndex]: false }));
    }
  };

  const awardXP = async (amount, reason) => {
    try {
      const result = await awardDailyXP(amount, reason);
      if (result.success) {
        await recordDailyActivity('questions', 1);
        
        const user = await base44.auth.me();
        await base44.auth.updateMe({
          questions_completed: (user.questions_completed || 0) + 1
        });
        
        setXpToast({ show: true, xp: amount, reason });
      }
    } catch (error) {
      console.error("Error awarding XP:", error);
    }
  };

  const fallbackTopicsTriggeredRef = useRef(false);

  const handleAnswer = (answer) => {
    const updatedQuestions = [...exam.questions];
    updatedQuestions[currentQuestion].user_answer = answer;

    setExam(prev => ({
      ...prev,
      questions: updatedQuestions
    }));

    // On first answer submitted, trigger fallback topic generation if lesson lacks topics
    if (!fallbackTopicsTriggeredRef.current && lesson?.id) {
      fallbackTopicsTriggeredRef.current = true;
      // Fire-and-forget: generate fallback topics if needed (function checks internally and skips if topics exist)
      base44.functions.invoke('generateFallbackTopics', { lesson_id: lesson.id })
        .then(res => {
          if (res?.data?.success && !res?.data?.skipped) {
            console.log('✅ Fallback topics generated, refreshing lesson');
            window.dispatchEvent(new Event('reloadLesson'));
          }
        })
        .catch(err => console.warn('Fallback topic generation error:', err.message));
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveExamProgress();
    }, 2000);

    if (gradingTimeoutRef.current) {
      clearTimeout(gradingTimeoutRef.current);
    }

    if (isSubjectiveQuestion(updatedQuestions[currentQuestion].question_type)) {
      updatedQuestions[currentQuestion].ai_grading_pending = true;
      setExam(prev => ({
        ...prev,
        questions: updatedQuestions
      }));

      gradingTimeoutRef.current = setTimeout(() => {
        gradeSubjectiveQuestion(updatedQuestions[currentQuestion], currentQuestion);
      }, 2000);
    }
  };

  const handleNext = () => {
    recordQuestionTime(currentQuestion);

    const currentQ = exam.questions[currentQuestion];
    if (currentQ.user_answer) {
      awardXP(3, 'Question answered!');
    }

    saveExamProgress();

    if (currentQuestion < exam.questions.length - 1) {
      if (gradingTimeoutRef.current) {
        clearTimeout(gradingTimeoutRef.current);
        if (isSubjectiveQuestion(currentQ.question_type) && currentQ.user_answer) {
          gradeSubjectiveQuestion(currentQ, currentQuestion);
        }
      }

      currentQuestionStartTimeRef.current = Date.now();
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      recordQuestionTime(currentQuestion);
      saveExamProgress();
      currentQuestionStartTimeRef.current = Date.now();
      setCurrentQuestion(prev => prev - 1);
    }
  };

  // Helper to check if answer is correct using letter-based comparison for MCQ
  const checkAnswerCorrect = (userAnswer, correctAnswer, options, questionType) => {
    if (!userAnswer || !correctAnswer) return false;
    
    const type = (questionType || '').toLowerCase();
    const userTrimmed = userAnswer.trim();
    const correctTrimmed = correctAnswer.trim();
    
    // For MCQ where correct_answer should be just a letter (A, B, C, D)
    if (type.includes('multiple') || type.includes('choice') || type.includes('mcq')) {
      if (/^[A-Da-d]$/i.test(correctTrimmed)) {
        // Extract letter from user's selection
        const letterMatch = userTrimmed.match(/^([A-Da-d])[\.\)\:\s]/i);
        if (letterMatch) {
          return letterMatch[1].toUpperCase() === correctTrimmed.toUpperCase();
        }
        // Find option index and compare
        const optionIndex = options?.findIndex(opt => opt === userTrimmed);
        if (optionIndex >= 0) {
          const userLetter = String.fromCharCode(65 + optionIndex);
          return userLetter === correctTrimmed.toUpperCase();
        }
      }
      // Fallback to exact match
      return userTrimmed.toLowerCase() === correctTrimmed.toLowerCase();
    }
    
    // For True/False
    if (type.includes('true') && type.includes('false')) {
      return userTrimmed.toLowerCase() === correctTrimmed.toLowerCase();
    }
    
    // For fill-in-blank and short answer
    return userTrimmed.toLowerCase() === correctTrimmed.toLowerCase();
  };

  const submitPracticeExam = async () => {
    setIsSubmitting(true);
    recordQuestionTime(currentQuestion);

    const finalElapsedSeconds = elapsedSeconds;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      // Grade any subjective questions that haven't been graded yet
      // Wait for all pending AI grading to complete first
      const learningProfile = await getLearningProfile();

      const questionsWithGrading = await Promise.all(exam.questions.map(async (q, idx) => {
        // For subjective questions, use AI grading if not already graded
        if (isSubjectiveQuestion(q.question_type)) {
          // If grading is still in progress or AI score not yet set, wait and grade now
          if (q.ai_score_out_of_10 === undefined && q.user_answer?.trim()) {
            try {
              console.log(`📝 Grading subjective question ${idx + 1} on submit...`);
              const { data: gradingResult } = await base44.functions.invoke('gradeShortAnswer', {
                question_text: q.question_text,
                question_type: q.question_type,
                difficulty_index: q.difficulty_index,
                correct_answer: q.correct_answer,
                explanation: q.explanation,
                assessed_competencies: q.assessed_competencies,
                targeted_misconception: q.targeted_misconception,
                student_answer: q.user_answer,
                student_grade_level: learningProfile.grade || "N/A",
                course_name: lesson.course_name
              });
              
              console.log(`✅ Question ${idx + 1} graded: ${gradingResult.score_out_of_10}/10`);
              return {
                ...q,
                ai_score_out_of_10: gradingResult.score_out_of_10,
                ai_verdict: gradingResult.verdict,
                ai_rationale_short: gradingResult.rationale_short,
                ai_keypoints_hit: gradingResult.keypoints_hit,
                ai_keypoints_missed: gradingResult.keypoints_missed,
                ai_misconception_detected: gradingResult.misconception_detected,
                is_correct: gradingResult.score_out_of_10 >= 7
              };
            } catch (gradingError) {
              console.error('Error grading subjective question:', gradingError);
              // Don't mark as 0 - use a lenient fallback
              return { ...q, is_correct: false, ai_score_out_of_10: 0, ai_rationale_short: 'Grading failed - please ask AI for help understanding this question.' };
            }
          }
          // Already graded - use existing score
          const aiScore = q.ai_score_out_of_10 ?? 0;
          return { ...q, is_correct: aiScore >= 7 };
        }
        
        // For objective questions, use letter-based comparison
        const isCorrect = checkAnswerCorrect(q.user_answer, q.correct_answer, q.options, q.question_type);
        return { ...q, is_correct: isCorrect };
      }));

      const correctCount = questionsWithGrading.filter(q => q.is_correct).length;

      await base44.entities.Exam.update(exam.id, {
        questions: questionsWithGrading,
        correct_count: correctCount,
        total_score: Math.round((correctCount / questionsWithGrading.length) * 100),
        time_taken_seconds: finalElapsedSeconds,
        status: "completed",
        completed: true
      });

      try {
        const studyPlans = await base44.entities.StudyPlan.filter({ 
          lesson_id: lesson.id, 
          status: 'active' 
        });
        if (studyPlans.length > 0) {
          const plan = studyPlans[0];
          let taskJustCompleted = false;
          
          const updatedTasks = plan.tasks?.map(task => {
            if (task.task_type === 'practice_exam' && !task.completed) {
              const newCount = (task.completed_count || 0) + 1;
              const wasComplete = task.completed;
              const isComplete = newCount >= (task.target_count || 1);
              
              if (isComplete && !wasComplete) {
                taskJustCompleted = true;
              }
              
              return {
                ...task,
                completed_count: newCount,
                completed: isComplete,
                completed_date: isComplete ? new Date().toISOString() : null
              };
            }
            return task;
          });
          
          const allComplete = updatedTasks?.every(t => t.completed);
          
          await base44.entities.StudyPlan.update(plan.id, { 
            tasks: updatedTasks,
            all_tasks_completed: allComplete,
            official_exam_unlocked: allComplete
          });
          
          // Task completion toast removed - was blocking UI
        }
      } catch (planError) {
        console.error("Error updating study plan:", planError);
      }

      let xpAmount = 15;
      if (correctCount === questionsWithGrading.length) xpAmount += 10;
      await awardDailyXP(xpAmount, 'Practice quiz completed!');
      setXpToast({ show: true, xp: xpAmount, reason: 'Practice complete!' });

      const completedExam = { 
        ...exam, 
        questions: questionsWithGrading, 
        correct_count: correctCount, 
        total_score: Math.round((correctCount / questionsWithGrading.length) * 100),
        completed: true, 
        exam_type: 'practice',
        time_taken_seconds: finalElapsedSeconds
      };
      setExam(completedExam);
      
      // For practice exams, show the question review (FeedbackDisplay)
      setViewingCompletedExam(completedExam);

      // Always trigger Polly engine after practice exam completion
      base44.functions.invoke('runPollyEngine', {
        trigger_event: 'practice_exam_completed',
        lesson_id: lesson.id,
        exam_id: exam.id
      }).catch(err => console.warn('Polly engine trigger failed:', err.message));
      
      if (onExamComplete) onExamComplete();
      setIsSubmitting(false);
    } catch (error) {
      console.error("Error submitting practice exam:", error);
      setIsSubmitting(false);
    }
  };

  const submitExam = async () => {
    if (exam.exam_type === 'practice') {
      return submitPracticeExam();
    }

    setIsSubmitting(true);
    recordQuestionTime(currentQuestion);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const questionTimeLaps = Object.keys(questionTimesRef.current).map(key => ({
      question_index: parseInt(key),
      total_seconds: questionTimesRef.current[key]
    }));

    try {
      const user = await base44.auth.me();
      const learningProfile = await getLearningProfile();

      const questionsWithGrading = exam.questions.map((q) => {
        // Use AI grading for subjective questions
        if (isSubjectiveQuestion(q.question_type)) {
          if (q.ai_score_out_of_10 !== undefined) {
            return {
              ...q,
              is_correct: q.ai_score_out_of_10 >= 7.5 
            };
          }
        }

        // Use letter-based comparison for objective questions
        const isCorrect = checkAnswerCorrect(q.user_answer, q.correct_answer, q.options, q.question_type);
        return { ...q, is_correct: isCorrect };
      });

      let contentDescription = lesson.compressed_content || lesson.extracted_content || lesson.description || "N/A";

      const examPerformanceData = questionsWithGrading.map((q) => ({
        question_number: q.question_number,
        question_type: q.question_type,
        difficulty_index: q.difficulty_index,
        question_text: q.question_text,
        options: q.options || [],
        student_answer: q.user_answer || "No answer provided",
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        assessed_competencies: q.assessed_competencies,
        targeted_misconception: q.targeted_misconception,
        is_correct: q.is_correct,
        ai_grading: q.ai_score_out_of_10 !== undefined ? {
          score_out_of_10: q.ai_score_out_of_10,
          verdict: q.ai_verdict,
          rationale: q.ai_rationale_short,
          keypoints_hit: q.ai_keypoints_hit,
          keypoints_missed: q.ai_keypoints_missed
        } : null
      }));

      // Always refresh lesson to get latest curriculum_map if available
      const refreshedLessons = await base44.entities.Lesson.filter({ id: lesson.id });
      let currentLesson = refreshedLessons.length > 0 ? refreshedLessons[0] : lesson;
      
      // Note: curriculum_map is optional - feedbackGrade will handle missing data gracefully

// NOTE: Grading is done via feedbackGrade backend function ONLY
      // This prompt is NOT used - it's passed to feedbackGrade which handles it

      const correctCount = questionsWithGrading.filter(q => q.is_correct).length;
      const totalQuestions = questionsWithGrading.length;

      const questionFeedback = questionsWithGrading.map((q, idx) => {
        let feedback = "";
        let pointsEarned = 0;
        
        if (isSubjectiveQuestion(q.question_type) && q.ai_score_out_of_10 !== undefined) {
          feedback = q.ai_rationale_short || "Your answer shows understanding.";
          pointsEarned = q.ai_score_out_of_10;
        } else {
          if (q.is_correct) {
            feedback = `Excellent! Your answer demonstrates strong understanding.`;
            pointsEarned = 10;
          } else {
            feedback = `Review the explanation to strengthen your understanding.`;
            pointsEarned = 0;
          }
        }
        
        return {
          question_index: idx,
          is_correct: q.is_correct,
          feedback,
          points_earned: pointsEarned
        };
      });

      // Save exam with questions and feedback
      await retryOperation(() => 
        base44.entities.Exam.update(exam.id, {
          questions: questionsWithGrading,
          feedback: questionFeedback,
          time_taken_seconds: elapsedSeconds,
          question_time_laps: questionTimeLaps,
          status: "completed",
          completed: true
        })
      );

      // Dispatch study plan loading state (but don't navigate away from exam tab)
      window.dispatchEvent(new CustomEvent('studyPlanGenerating', { detail: { generating: true } }));

      // Get AI feedback FIRST (blocking) so we have the grade before generating the study plan
      let aiGrade = null;
      let aiScore = null;
      let aiConfidence = null;
      let feedbackMasteryGap = null;
      
      try {
        const { data: feedbackData } = await base44.functions.invoke('feedbackGrade', {
          exam_id: exam.id,
          lesson_id: lesson.id,
          exam_performance_data: examPerformanceData,
          curriculum_map: currentLesson.curriculum_map,
          student_grade: learningProfile.grade || "N/A",
          course_name: currentLesson.course_name,
          exam_number: exam.exam_number
        });
        
        if (feedbackData?.predicted_exam_score_percentage) {
          aiScore = parseInt(feedbackData.predicted_exam_score_percentage);
          if (!isNaN(aiScore) && aiScore > 0) {
            aiGrade = "F";
            if (aiScore >= 90) aiGrade = "A+";
            else if (aiScore >= 85) aiGrade = "A";
            else if (aiScore >= 80) aiGrade = "A-";
            else if (aiScore >= 77) aiGrade = "B+";
            else if (aiScore >= 73) aiGrade = "B";
            else if (aiScore >= 70) aiGrade = "B-";
            else if (aiScore >= 67) aiGrade = "C+";
            else if (aiScore >= 63) aiGrade = "C";
            else if (aiScore >= 60) aiGrade = "C-";
            else if (aiScore >= 50) aiGrade = "D";
            
            aiConfidence = feedbackData.prediction_confidence_percentage || 45;
            feedbackMasteryGap = feedbackData.mastery_gap || null;
            
            console.log(`📊 AI Feedback: Score=${aiScore}%, Grade=${aiGrade}, Confidence=${aiConfidence}`);
            
            // Update exam with AI feedback
            await base44.entities.Exam.update(exam.id, {
              total_score: aiScore,
              predicted_grade: aiGrade,
              prediction_confidence: aiConfidence,
              confidence_level: feedbackData.confidence_level || 'Low',
              mastery_gap: feedbackMasteryGap,
              ai_feedback: feedbackData
            });
          }
        }
      } catch (err) {
        console.warn("AI feedback error (non-blocking):", err.message);
      }

      // Now generate study plan - exam already has grade so plan will pick it up
      base44.functions.invoke('generateStudyPlan', {
        exam_id: exam.id,
        lesson_id: lesson.id
      }).then(() => {
        window.dispatchEvent(new CustomEvent('studyPlanGenerating', { detail: { generating: false } }));
        window.dispatchEvent(new Event('reloadLesson'));
      }).catch(planError => {
        console.error("Error generating study plan:", planError);
        window.dispatchEvent(new CustomEvent('studyPlanGenerating', { detail: { generating: false } }));
      });

      // Award XP and track stats
      const examXP = 25 + (correctCount >= 8 ? 25 : 0) + (correctCount === questionsWithGrading.length ? 50 : 0);
      
      try {
        const xpResult = await awardDailyXP(examXP, 'Diagnostic completed!');
        const currentUserXP = await base44.auth.me();
        
        // Track badges
        const earnedBadges = [...(currentUserXP.badges || [])];
        const badgeIds = earnedBadges.map(b => b.badge_id);
        const earnedNow = [];

        if (!badgeIds.includes('first_exam')) {
          earnedBadges.push({
            badge_id: 'first_exam',
            badge_name: 'First Exam',
            badge_description: 'Completed your first exam!',
            badge_icon: '📝',
            earned_date: new Date().toISOString()
          });
          earnedNow.push(earnedBadges[earnedBadges.length - 1]);
        }

        await base44.auth.updateMe({
          total_exams_completed: (currentUserXP.total_exams_completed || 0) + 1,
          questions_completed: (currentUserXP.questions_completed || 0) + questionsWithGrading.length,
          time_spent_seconds: (currentUserXP.time_spent_seconds || 0) + elapsedSeconds,
          badges: earnedBadges
        });

        if (xpResult.success) {
          const xpReason = correctCount === questionsWithGrading.length ? 'Perfect exam! 🌟' : 
                          correctCount >= 8 ? 'Great score! 🎯' : 'Exam completed!';
          setXpToast({ show: true, xp: examXP, reason: xpReason });
        }

        if (earnedNow.length > 0 || correctCount >= 8) {
          setShowConfetti(true);
          setNewBadges(earnedNow);
        }
      } catch (xpError) {
        console.error("Error awarding exam XP:", xpError);
      }

      // Track lesson completion (first exam = diagnostic complete) - FUNNEL STEP 3
      base44.analytics.track({
        eventName: "diagnostic_exam_completed",
        properties: {
          lesson_id: lesson.id,
          course_name: lesson.course_name,
          time_taken_seconds: elapsedSeconds,
          correct_count: correctCount,
          total_questions: questionsWithGrading.length
        }
      });

      // PostHog: check if this is the user's first-ever diagnostic completion
      try {
        const allCompletedExams = (exams || []).filter(e => e.completed && e.exam_type !== 'practice');
        // Only the current exam is completed (others were not completed before this submit)
        const isFirstDiagnostic = allCompletedExams.length === 0;
        
        posthog?.capture('diagnostic_exam_completed', {
          lesson_id: lesson.id,
          course_name: lesson.course_name,
          predicted_grade: aiGrade,
          predicted_score: aiScore,
          time_taken_seconds: elapsedSeconds,
          correct_count: correctCount,
          total_questions: questionsWithGrading.length,
          is_first_diagnostic: isFirstDiagnostic
        });

        if (isFirstDiagnostic) {
          posthog?.capture('first_diagnostic_completed', {
            lesson_id: lesson.id,
            course_name: lesson.course_name,
            predicted_grade: aiGrade,
            predicted_score: aiScore,
            time_taken_seconds: elapsedSeconds
          });

          // TikTok pixel for first diagnostic
          if (window.ttq) {
            window.ttq.track('CompleteRegistration', {
              content_name: 'first_diagnostic_completed',
              content_id: exam.id,
            });
          }

          // Google Analytics for first diagnostic
          if (window.gtag) {
            window.gtag('event', 'first_diagnostic_completed', {
              event_category: 'conversion',
              event_label: lesson.course_name,
            });
          }
        }
      } catch (phErr) {
        console.warn('PostHog diagnostic tracking error:', phErr);
      }

      // TikTok Pixel: Track Submit Application for diagnostic quiz submission
      if (window.ttq) {
        window.ttq.track('SubmitApplication', {
          contents: [{
            content_id: exam.id,
            content_type: 'product',
            content_name: 'Diagnostic Quiz Submission'
          }],
          value: 0,
          currency: 'USD'
        });
        console.log('📊 TikTok Pixel: SubmitApplication tracked for diagnostic quiz');
      }

      // Mark guest diagnostic as completed — triggers sign-up modal
      if (isGuest) {
        markGuestDiagnosticCompleted();
      }

      // Stay on exam tab and show the completed exam results
      // Reload exams to get the updated data with AI feedback
      if (onExamComplete) await onExamComplete();
      
      // Fetch the freshly updated exam with AI feedback
      const freshExams = await base44.entities.Exam.filter({ id: exam.id });
      const freshExam = freshExams[0] || { ...exam, completed: true, predicted_grade: aiGrade, total_score: aiScore, prediction_confidence: aiConfidence, ai_feedback: null };
      
      // Send Polly message directing user to the study plan
      window.dispatchEvent(new CustomEvent('pollyDiagnosticComplete', {
        detail: {
          predicted_grade: aiGrade,
          total_score: aiScore,
          confidence: aiConfidence,
          mastery_gap: feedbackMasteryGap
        }
      }));

      setViewingCompletedExam(freshExam);
      setExam(null);
      setSelectedExamNumber(null);
      hasAutoSelectedRef.current = false;
      setIsSubmitting(false);
    } catch (error) {
      console.error("Error submitting exam:", error);
      await logError('exam_submission', error, { lesson_id: lesson?.id, exam_id: exam?.id });
      alert("Failed to submit exam. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="px-3 py-8 w-full max-w-[320px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-800 font-medium mb-3">{error}</p>
          <Button 
            onClick={() => {
              setError(null);
              setIsGenerating(false);
              if (onExamComplete) onExamComplete();
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (viewingCompletedExam) {
    return (
      <div className="pb-4">
        <div className="px-3 py-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setViewingCompletedExam(null);
              setExam(null);
              setSelectedExamNumber(null);
              setCurrentQuestion(0);
              hasAutoSelectedRef.current = false;
            }}
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 h-8 px-3"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            <span className="text-xs">All Exams</span>
          </Button>
        </div>
        <FeedbackDisplay 
          exam={viewingCompletedExam} 
          lesson={lesson} 
          allExams={exams}
          courseName={lesson?.course_name}
        />
      </div>
    );
  }

  // Show loading when exam is selected but not yet loaded (generating in background)
  const isWaitingForExam = selectedExamNumber && !exam && !isGenerating;
  
  if (!exam && !isGenerating) {
    if (exams === undefined || isWaitingForExam) {
      return (
        <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
          <Loader2 className="w-10 h-10 animate-spin text-purple-600 mb-3" />
          <span className="text-slate-700 font-medium">
            {isWaitingForExam ? 'Generating your diagnostic exam...' : 'Loading exams...'}
          </span>
          {isWaitingForExam && (
            <span className="text-slate-500 text-sm mt-1">This takes about 10-15 seconds</span>
          )}
        </div>
      );
    }
    
    const allExamsForLesson = exams || [];
    // Only exam 1 (diagnostic) is official, everything else is practice from study plan
    const diagnosticExam = allExamsForLesson.find(e => e.exam_number === 1 && e.exam_type !== 'practice');
    const practiceExams = allExamsForLesson.filter(e => e.exam_type === 'practice');
    const sortedPracticeExams = practiceExams.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    
    return (
        <div className="px-3 md:px-6 py-3 w-full max-w-full mx-auto space-y-3 md:space-y-4 pb-8" style={{ boxSizing: 'border-box', overflowX: 'hidden', maxWidth: '100vw' }}>
        {/* Practice Exams Section - Show first if they exist */}
        {sortedPracticeExams.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className={`text-base md:text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Practice Exams</h2>
                <p className={`text-[10px] md:text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Quick drills • No grade impact</p>
              </div>
            </div>
            
            <div className="space-y-2 w-full max-w-full" style={{ boxSizing: 'border-box' }}>
              {sortedPracticeExams.slice(0, 6).map((e) => {
                const isCompleted = e.completed;
                const correctCount = e.correct_count || 0;
                const totalQuestions = e.questions?.length || 0;
                // Use title if available, otherwise fall back to a generic name
                const displayTitle = e.title || `Practice Quiz`;
                
                return (
                  <button
                    key={e.id}
                    onClick={() => {
                      if (isCompleted) {
                        setViewingCompletedExam(e);
                      } else {
                        setExam(e);
                        setCurrentQuestion(0);
                        hasAutoSelectedRef.current = true;
                      }
                    }}
                    className={`group relative w-full overflow-hidden p-2.5 md:p-3 rounded-xl transition-all text-left shadow-sm hover:shadow-md ${
                      isCompleted
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-600'
                        : 'bg-white border border-blue-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="relative flex items-center gap-2 md:gap-3">
                      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isCompleted ? 'bg-white/20' : 'bg-blue-50'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        ) : (
                          <Zap className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold text-xs md:text-sm truncate ${isCompleted ? 'text-white' : 'text-slate-900'}`}>
                          {displayTitle}
                        </h3>
                        <p className={`text-[10px] md:text-xs ${isCompleted ? 'text-white/70' : 'text-slate-500'}`}>
                          {totalQuestions} questions
                        </p>
                      </div>
                      
                      {isCompleted ? (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-base md:text-lg font-black text-white">{correctCount}/{totalQuestions}</span>
                          <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-white/70" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Play className="w-2.5 h-2.5 md:w-3 md:h-3 text-blue-600" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Official Exams Section - Only Exam 1 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Trophy className="w-4 h-4 text-yellow-300" />
            </div>
            <div>
              <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Official Exams</h2>
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Establishes your baseline grade</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {diagnosticExam ? (
              <button
                onClick={() => {
                  if (diagnosticExam.completed) {
                    setViewingCompletedExam(diagnosticExam);
                  } else {
                    setExam(null);
                    setSelectedExamNumber(1);
                    hasAutoSelectedRef.current = true;
                  }
                }}
                className={`group relative w-full overflow-hidden p-2.5 rounded-xl transition-all text-left shadow-sm hover:shadow-md ${
                  diagnosticExam.completed
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                    : 'bg-gradient-to-r from-purple-500 to-indigo-600'
                }`}
              >
                <div className="relative flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    {diagnosticExam.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : (
                      <span className="text-base font-black text-white">1</span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="font-bold text-white text-xs">Diagnostic</h3>
                      {diagnosticExam.status === 'in_progress' && !diagnosticExam.completed && (
                        <span className="text-[8px] bg-white/30 text-white px-1.5 py-0.5 rounded-full font-bold uppercase">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/70 truncate">Baseline assessment</p>
                  </div>
                  
                  {diagnosticExam.completed && diagnosticExam.predicted_grade ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-lg font-black text-white">{diagnosticExam.predicted_grade}</span>
                        <p className="text-[8px] text-white/70">{diagnosticExam.total_score}%</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-white/70" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Play className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
              </button>
            ) : (() => {
              // Check if exam record exists but questions not ready yet
              const pendingExam = (exams || []).find(e => e.exam_number === 1 && e.exam_type !== 'practice' && (!e.questions || e.questions.length === 0));
              const isExamGenerating = !!pendingExam;

              return (
                <button
                  onClick={() => {
                    if (isExamGenerating) return;
                    setExam(null);
                    setSelectedExamNumber(1);
                    hasAutoSelectedRef.current = true;
                  }}
                  disabled={isExamGenerating}
                  className={`group relative w-full overflow-hidden p-2.5 rounded-xl shadow-sm transition-all text-left ${
                    isExamGenerating 
                      ? 'bg-gradient-to-r from-slate-400 to-slate-500 cursor-not-allowed opacity-80'
                      : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:shadow-md'
                  }`}
                >
                  <div className="relative flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                      {isExamGenerating ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <span className="text-base font-black text-white">1</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-xs">Diagnostic</h3>
                      <p className="text-[10px] text-white/70">
                        {isExamGenerating ? 'Generating questions...' : 'Baseline assessment'}
                      </p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      {isExamGenerating ? (
                        <Loader2 className="w-2.5 h-2.5 text-white/60 animate-spin" />
                      ) : (
                        <Play className="w-2.5 h-2.5 text-white" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })()}
          </div>
        </div>

        {/* Create Practice Quiz Button - below Official Exams, only when diagnostic is done */}
        <CreatePracticeQuizButton 
          lesson={lesson}
          extractedContent={extractedContent}
          diagnosticCompleted={!!diagnosticExam?.completed}
          onExamCreated={(newExam) => {
            setExam(newExam);
            setCurrentQuestion(0);
            hasAutoSelectedRef.current = true;
            if (onExamComplete) onExamComplete();
          }}
        />

      </div>
    );
  }

  if (waitingForCompression) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="relative w-20 h-20 mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className={isDark ? 'stroke-slate-700' : 'stroke-slate-200'} />
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-purple-500 animate-pulse" 
              style={{ strokeDasharray: '50 220' }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">📄</span>
          </div>
        </div>
        <h3 className={`font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Optimizing Content</h3>
        <p className={`text-sm text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Preparing your document...</p>
      </div>
    );
  }

  if (isGenerating) {
    return <ExamGeneratingLoader isPractice={practiceExamGeneratingRef.current} />;
  }

  if (!exam) return null;

  if (exam?.completed && !viewingCompletedExam) {
    setTimeout(() => {
      setExam(null);
      setSelectedExamNumber(null);
      hasAutoSelectedRef.current = false;
    }, 0);
    return null;
  }

  if (!exam.questions || exam.questions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-2 text-slate-600">Loading questions...</span>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / exam.questions.length) * 100;
  const isLastQuestion = currentQuestion === exam.questions.length - 1;
  const currentQ = exam.questions[currentQuestion];
  
  if (!currentQ) {
    setCurrentQuestion(0);
    return null;
  }
  
  const canProceed = currentQ.user_answer?.trim() !== "";
  
  const isPracticeExam = exam.exam_type === 'practice';
  
  const handleExitExam = async () => {
    await saveExamProgress();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // For practice exams, preserve exam state so it can be resumed
    // For official exams, also preserve state
    setExam(null);
    setSelectedExamNumber(null);
    setCurrentQuestion(0);
    hasAutoSelectedRef.current = false;
    // Refresh exams list to show updated progress
    if (onExamComplete) onExamComplete();
  };

  return (
    <>
      <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      <AnimatePresence>
        {newBadges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
            onClick={() => setNewBadges([])}
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-5 max-w-sm w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setNewBadges([])}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">New Badge Earned!</h3>
              </div>
              <div className="space-y-2">
                {newBadges.map((badge, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                    <span className="text-3xl">{badge.badge_icon}</span>
                    <div>
                      <p className="font-bold text-slate-900">{badge.badge_name}</p>
                      <p className="text-sm text-slate-600">{badge.badge_description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button 
                onClick={() => setNewBadges([])} 
                className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
              >
                Awesome!
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col h-full md:h-auto md:pb-4">
        <div className="flex-1 flex flex-col dark:bg-[#12121a]/95 bg-white/95 backdrop-blur-xl md:rounded-2xl border-0 md:border dark:md:border-purple-500/30 border-purple-200/80 shadow-none md:shadow-sm md:mx-0 overflow-hidden">
          {/* Exam Header with Back Button and Type Indicator */}
          <div className="flex items-center justify-between px-3 py-2 border-b dark:border-white/10 border-purple-100 dark:bg-[#12121a]/95 bg-white/95 backdrop-blur-sm sticky top-0 z-10 shrink-0 relative">
            <div className="flex items-center gap-2">
                  <button
                    onClick={handleExitExam}
                    className="flex items-center gap-1 dark:text-slate-300 dark:hover:text-white text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-xs font-medium hidden sm:inline">Exit</span>
                  </button>
                </div>

                {/* Centered badge */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                  <div className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wide ${
                    isPracticeExam 
                      ? (isDark ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-100 text-blue-700')
                      : (isDark ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-100 text-purple-700')
                  }`}>
                    {isPracticeExam ? 'Practice' : 'Official'}
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isDark ? 'text-slate-300 bg-white/10' : 'text-slate-600 bg-slate-100'}`}>
                    {currentQuestion + 1}/{exam.questions.length}
                  </span>
                </div>
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-1.5 w-16 hidden sm:block" />
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isDark ? 'text-purple-300 bg-purple-600/20' : 'text-purple-600 bg-purple-50'}`}>
                <Clock className="w-3 h-3" />
                <span className="text-xs font-semibold tabular-nums">{formatTime(elapsedSeconds)}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-3 md:p-5 dark:bg-[#0a0a12]" style={{ WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
            <AnimatePresence mode="wait">
              <ExamQuestion
                key={currentQuestion}
                question={currentQ}
                answer={currentQ.user_answer}
                onAnswer={handleAnswer}
                showFeedback={true}
                lesson={lesson}
              />
            </AnimatePresence>
          </div>

          <div className="shrink-0 border-t dark:border-white/10 border-purple-100 dark:bg-[#12121a]/95 bg-white/95 backdrop-blur-sm">
            <div className="flex gap-2 px-3 py-3 md:px-5 md:pb-3">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                className="flex-1 dark:text-white text-xs h-10 rounded-xl font-medium"
              >
                Previous
              </Button>
              {isLastQuestion ? (
                <Button
                  onClick={submitExam}
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-xs h-10 rounded-xl font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Exam"
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white text-xs h-10 rounded-xl font-medium"
                >
                  Next Question
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}