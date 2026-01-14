import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, Clock, Sparkles, Play, Pause, CheckCircle2, Trophy, Zap, ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import ExamQuestion from "@/components/exam/ExamQuestion.jsx";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";
import EducationalLoader from "@/components/ui/EducationalLoader";
import { logError } from "@/components/utils/errorLogger";
import XPGainToast from "@/components/gamification/XPGainToast";
import { recordDailyActivity, awardDailyXP } from "@/components/utils/dailyReset";
import FeedbackDisplay from "@/components/feedback/FeedbackDisplay";

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

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

export default function ExamTab({ lesson, exams, onExamComplete }) {
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
  
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const questionTimesRef = useRef({});
  const currentQuestionStartTimeRef = useRef(null);
  const examIdRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const lastSavedQuestionsRef = useRef(null);
  const generationTriggeredRef = useRef(new Set()); // Track which exams we've triggered generation for

  // Auto-select in-progress exam ONLY - don't auto-start new exams
  useEffect(() => {
    // CRITICAL: Only auto-select once when exams first load
    if (!lesson?.id || exams === undefined || selectedExamNumber || hasAutoSelectedRef.current) return;

    const allExamsForLesson = exams || [];

    // Only auto-select if there's an in-progress exam
    const inProgressExam = allExamsForLesson.find(e => e.status === 'in_progress' && !e.completed);
    if (inProgressExam) {
      hasAutoSelectedRef.current = true;
      setSelectedExamNumber(inProgressExam.exam_number);
    }
    // Otherwise, show the exam selection screen - don't auto-start anything
  }, [lesson?.id, exams, selectedExamNumber]);

  // Load exam when selection changes - wait for exams to be loaded from database
  useEffect(() => {
    // CRITICAL: Don't run until exams are loaded (not undefined) to avoid duplicate generation
    if (!lesson?.id || !selectedExamNumber || exams === undefined) return;
    // Don't reload if we already have the exam loaded
    if (exam && exam.exam_number === selectedExamNumber) return;
    // Also don't proceed if waiting for compression
    if (waitingForCompression) return;
    
    loadOrGenerateExam(selectedExamNumber);
  }, [lesson?.id, selectedExamNumber, waitingForCompression, exams]);

  // Wait for background extraction+compression if file upload without content ready
  useEffect(() => {
    if (!lesson?.id) return;
    
    // For file uploads: must wait for BOTH extraction AND compression to complete
    // Content is NOT ready if: file upload AND (no extracted_content OR no compressed_content)
    const isFileUpload = lesson.input_type === 'file';
    const hasExtractedContent = lesson.extracted_content?.length > 0;
    const hasCompressedContent = lesson.compressed_content?.length > 0;
    
    // Need to wait if: file upload AND content not ready yet
    const needsToWait = isFileUpload && (!hasExtractedContent || !hasCompressedContent);
    
    console.log('📊 ExamTab content check:', { 
      isFileUpload, 
      hasExtractedContent, 
      hasCompressedContent, 
      needsToWait 
    });
    
    if (needsToWait) {
      setWaitingForCompression(true);
      let attempts = 0;
      const maxAttempts = 60; // Wait up to 60 seconds for large documents
      
      const interval = setInterval(async () => {
        attempts++;
        console.log(`⏳ Waiting for content... attempt ${attempts}/${maxAttempts}`);
        try {
          const refreshed = await base44.entities.Lesson.filter({ id: lesson.id });
          const updated = refreshed?.[0];
          
          // Check if BOTH extracted AND compressed content are now available
          if (updated?.extracted_content?.length > 0 && updated?.compressed_content?.length > 0) {
            console.log('✅ Content ready! Extracted:', updated.extracted_content.length, 'chars, Compressed:', updated.compressed_content.length, 'chars');
            clearInterval(interval);
            setWaitingForCompression(false);
            window.dispatchEvent(new Event('reloadLesson'));
          } else if (attempts >= maxAttempts) {
            console.warn('⚠️ Timeout waiting for content, proceeding anyway');
            clearInterval(interval);
            setWaitingForCompression(false);
            // Still reload to get whatever content is available
            window.dispatchEvent(new Event('reloadLesson'));
          }
        } catch (err) {
          console.error('Error checking content:', err);
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setWaitingForCompression(false);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
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
      
      // Restore elapsed time from saved exam data
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

  // Auto-save progress every 10 seconds and on answer changes
  const saveExamProgress = async () => {
    if (!exam || exam.completed) return;
    
    const questionsJson = JSON.stringify(exam.questions);
    if (lastSavedQuestionsRef.current === questionsJson) return; // No changes
    
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

  // Auto-save every 1 second
  useEffect(() => {
    if (!exam || exam.completed) return;
    
    const intervalId = setInterval(saveExamProgress, 1000);
    return () => clearInterval(intervalId);
  }, [exam?.id, exam?.completed, elapsedSeconds]);

  // Save on page unload/visibility change
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
    // Wait until compression is ready (if file upload with extracted content)
    if (waitingForCompression) {
      console.log('⏳ Waiting for compression to complete...');
      return;
    }

    // Prevent double generation triggers
    if (generationTriggeredRef.current.has(examNumber)) {
      console.log(`⚠️ Generation already in progress for Exam ${examNumber}, skipping duplicate call.`);
      return;
    }

    try {
      // Use exams prop (already loaded from database by parent)
      const existingExams = (exams || []).filter(e => e.exam_number === examNumber);
      console.log(`📋 Looking for Exam ${examNumber} in loaded exams:`, existingExams.length > 0 ? 'FOUND' : 'NOT FOUND');

      if (existingExams?.length > 0) {
        const loadedExam = existingExams[0];
        
        if (loadedExam.completed) {
          setExam(loadedExam);
          return;
        }
        
        // Check if questions are ready
        if (loadedExam.questions?.length > 0) {
          setExam(loadedExam);
          // Restore position to first unanswered
          const firstUnanswered = loadedExam.questions.findIndex(q => !q.user_answer?.trim());
          setCurrentQuestion(firstUnanswered >= 0 ? firstUnanswered : loadedExam.questions.length - 1);
        } else {
          // Questions not ready - trigger generation
          generationTriggeredRef.current.add(examNumber);
          setIsGenerating(true);
          try {
            await generateExam(loadedExam.id, examNumber);
          } finally {
            setIsGenerating(false);
            generationTriggeredRef.current.delete(examNumber);
          }
        }
      } else {
        generationTriggeredRef.current.add(examNumber);
        setIsGenerating(true);
        try {
          await generateExam(null, examNumber);
        } finally {
          setIsGenerating(false);
          generationTriggeredRef.current.delete(examNumber);
        }
      }
    } catch (error) {
      console.error("Error loading exam:", error);
      await logError('exam_loading', error, { lesson_id: lesson?.id, examNumber });
      setIsGenerating(false);
      generationTriggeredRef.current.delete(examNumber);
    }
  };

  const generateExam = async (existingExamId = null, examNumber = 1) => {
    console.log("🎯 generateExam called:", { existingExamId, examNumber, lessonId: lesson?.id });
    
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });
      const learningProfile = profile[0] || {};

      let contentDescription = "";
      if (lesson.input_type === "description" && lesson.description) {
        contentDescription = lesson.description;
        console.log("📝 Using description as content");
      } else if (lesson.compressed_content) {
        contentDescription = lesson.compressed_content;
        console.log("📦 Using compressed_content");
      } else if (lesson.extracted_content) {
        contentDescription = lesson.extracted_content;
        console.log("📄 Using extracted_content");
      } else {
        contentDescription = lesson.description || "N/A";
        console.log("⚠️ Fallback to description or N/A");
      }

      console.log("📏 Content length:", contentDescription.length, "characters");

      let aiPrompt;

      if (examNumber === 1) {
        // Exam 1: Diagnostic baseline
        aiPrompt = `

[Context]
You are an expert assessment designer. Generate a 5-question exam-authentic worksheet for ${lesson.course_name}. This worksheet establishes an accurate learning baseline and must stay tightly grounded in the student’s materials.

Do NOT rely on prior diagnostics.

────────────────────────────
Input Context

Student Grade Level: ${learningProfile.grade || "N/A"}
Course / Unit Name: ${lesson.course_name}
School: ${learningProfile.school || "N/A"}

Content Summary (OCR notes or user description):
${contentDescription}

────────────────────────────
Internal Rules (Do NOT Output)

• Topic Lock:
If content specifies a concrete skill/topic (e.g., “factoring”, “photosynthesis”), ALL questions must stay strictly within it.
Only broaden scope if the user explicitly requests review or exam prep.

• Light Search (Minimal):
Use Google Search ONLY to confirm terminology or common exam phrasing for this course.
Do NOT introduce new topics.

• Difficulty Progression:
Q1–2: Moderate
Q3–4: Challenging
Q5: Challenging → High Challenge (depth, not new content)

────────────────────────────
QUESTION-TYPE RULES (STRICT)

Choose question_type for EACH question:
Multiple Choice | True/False | Fill in the Blank | Short Answer

• Multiple Choice → EXACTLY 4 options (A–D)
• True/False → options = ["True","False"]
• Fill in the Blank → ONE blank written as ____ , options = []
• Short Answer → options = []

MCQ cue phrases are FORBIDDEN in non-MCQ questions.
If violated, auto-convert to Multiple Choice.

────────────────────────────
Output Requirements

Generate EXACTLY 5 questions.
Each must include:
question_type, question_text, options, difficulty_index

Then include an answer key with:
correct_answer, explanation (2–3 sentences),
assessed_competencies, targeted_misconception

Output Format
Return ONE valid JSON object matching the required schema.
No extra text.`;
      } else {
        // Exams 2-6: Adaptive based on prior performance
        let suggestedFutureSessions = null;
        let priorPredictedScore = null;
        let difficultyCalibration = "Moderate → Challenging";
        
        try {
          // Fetch all completed exams to get the most recent performance
          const completedExams = await base44.entities.Exam.filter({ 
            lesson_id: lesson.id,
            completed: true
          });
          
          if (completedExams && completedExams.length > 0) {
            // Get most recent completed exam
            const sortedExams = completedExams.sort((a, b) => b.exam_number - a.exam_number);
            const mostRecentExam = sortedExams[0];
            
            // Extract predicted score percentage
            if (mostRecentExam.total_score !== undefined) {
              priorPredictedScore = mostRecentExam.total_score;
              
              // Set difficulty calibration based on performance
              if (priorPredictedScore >= 85) {
                difficultyCalibration = "Challenging → High Challenge (student excelling, increase rigor)";
              } else if (priorPredictedScore >= 70) {
                difficultyCalibration = "Moderate → Challenging (steady progress)";
              } else {
                difficultyCalibration = "Scaffold with Moderate, then gradually increase (needs support)";
              }
            }
            
            // Get Exam 1 feedback for future sessions plan
            const exam1 = completedExams.find(e => e.exam_number === 1);
            if (exam1?.ai_feedback?.suggested_future_sessions_plan) {
              suggestedFutureSessions = exam1.ai_feedback.suggested_future_sessions_plan;
            }
          }
        } catch (e) {
          console.warn("Could not fetch prior exam data for adaptive difficulty:", e);
        }

        aiPrompt = `
[Context]
You are an expert assessment designer. Generate a 5-question exam-authentic worksheet for ${lesson.course_name}, calibrated using the student's prior exam performance and targeted improvement plan.

This worksheet MUST adapt based on prior results.
Do NOT repeat Exam 1 questions or trivial variants.

────────────────────────────
Input Context

Student Grade Level: ${learningProfile.grade || "N/A"}
Course / Unit Name: ${lesson.course_name}
School: ${learningProfile.school || "N/A"}
Exam Number: ${examNumber} of 6

Content Summary (OCR notes or user description):
${contentDescription}

Targeted Improvement Signals (from previous prediction):
${JSON.stringify(suggestedFutureSessions, null, 2)}

Prior Exam Performance:
- Most Recent Predicted Score: ${priorPredictedScore !== null ? `${priorPredictedScore}%` : 'N/A'}
- Adaptive Difficulty Strategy: ${difficultyCalibration}

────────────────────────────
Internal Rules (Do NOT Output)

• Focus Lock:
Use ONLY the session_name and session_focus_description relevant to this exam iteration.
Treat these as PRIMARY scope.
Do NOT introduce unrelated topics.

• Light Search (Minimal):
Use Google Search ONLY to validate terminology or common exam phrasing.
Do NOT expand topic scope.

• CRITICAL - Adaptive Difficulty Calibration:
${priorPredictedScore !== null && priorPredictedScore >= 85 ? `
STUDENT EXCELLING (${priorPredictedScore}%):
- Q1-2: Challenging (no warm-up needed)
- Q3-4: High Challenge (push boundaries)
- Q5: High Challenge with multi-step reasoning
- Minimize "Moderate" - only if essential for concept scaffolding
` : priorPredictedScore !== null && priorPredictedScore >= 70 ? `
STEADY PROGRESS (${priorPredictedScore}%):
- Q1-2: Moderate
- Q3-4: Challenging
- Q5: High Challenge
- Balance between consolidation and growth
` : `
NEEDS SUPPORT (${priorPredictedScore !== null ? priorPredictedScore + '%' : 'baseline'}):
- Q1-2: Moderate (build confidence)
- Q3: Moderate-to-Challenging transition
- Q4-5: Challenging (gradual stretch)
- Provide clear explanations and partial credit opportunities
`}

• Coverage Design:
- 3 questions directly targeting session_focus_description
- 1 application or edge-case question
- 1 calibration/twin item (same concept, different reasoning demand)

────────────────────────────
QUESTION-TYPE RULES (STRICT)

Choose question_type for EACH question:
Multiple Choice | True/False | Fill in the Blank | Short Answer

• Multiple Choice → EXACTLY 4 options (A–D)
• True/False → options = ["True","False"]
• Fill in the Blank → ONE blank written as ____ , options = []
• Short Answer → options = []

MCQ cue phrases are FORBIDDEN in non-MCQ questions.
If violated, auto-convert to Multiple Choice.

────────────────────────────
Output Requirements

Generate EXACTLY 5 questions.
Each must include:
question_type, question_text, options, difficulty_index

Then include an answer key with:
correct_answer, explanation (2–3 sentences),
assessed_competencies, targeted_misconception

Return ONE valid JSON object. No extra text.
`;
      }

      console.log("📏 Final prompt length:", aiPrompt.length, "characters");
      console.log("🚀 Calling generateExam API...");
      const apiStartTime = Date.now();

      const { data: examData } = await retryOperation(
        () => base44.functions.invoke('generateExam', {
          prompt: aiPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              exam_questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question_number: { type: "integer" },
                    question_type: { type: "string" },
                    difficulty_index: { type: "string" },
                    question_text: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                    correct_answer: { type: "string" },
                    explanation: { type: "string" },
                    assessed_competencies: { type: "array", items: { type: "string" } },
                    targeted_misconception: { type: "string" }
                  }
                }
              }
            }
          }
        }),
        3,
        2000
      );

      const apiDuration = ((Date.now() - apiStartTime) / 1000).toFixed(2);
      console.log(`✅ API returned in ${apiDuration}s`);
      console.log("📊 Response structure:", examData ? Object.keys(examData) : 'null');
      console.log("📊 exam_questions array length:", examData?.exam_questions?.length || 0);

      // Guard against missing or invalid exam_questions
      const examQuestions = examData?.exam_questions || [];
      if (!Array.isArray(examQuestions) || examQuestions.length === 0) {
        console.error("❌ Invalid exam_questions:", examData);
        throw new Error("Failed to generate exam questions. Please try again.");
      }
      
      console.log("✅ Valid exam questions received:", examQuestions.length);
      
      const questionsWithPlaceholder = examQuestions.map(q => ({
        ...q,
        user_answer: ""
      }));

      console.log("💾 Saving exam to database...");
      let createdExam;
      
      if (existingExamId) {
        createdExam = await base44.entities.Exam.update(existingExamId, {
          questions: questionsWithPlaceholder,
          status: "in_progress"
        });
      } else {
        createdExam = await base44.entities.Exam.create({
          lesson_id: lesson.id,
          exam_number: examNumber,
          questions: questionsWithPlaceholder,
          status: "in_progress",
          completed: false,
          time_taken_seconds: 0,
          question_time_laps: []
        });
      }

      console.log("✅ Exam saved successfully:", createdExam.id);
      setExam(createdExam);
      
      // Notify parent to refresh (will be picked up by periodic refetch)
      if (onExamComplete) onExamComplete();
    } catch (error) {
      console.error("❌ Error in generateExam:", error);
      console.error("❌ Error stack:", error.stack);
      await logError('exam_generation', error, { 
        lesson_id: lesson?.id, 
        existingExamId, 
        examNumber,
        contentLength: lesson?.extracted_content?.length || 0
      });
    }
  };

  const isSubjectiveQuestion = (questionType) => {
    const type = questionType.toLowerCase();
    return type.includes("short answer") || 
           type.includes("long answer") || 
           type.includes("fill-in-the-blank") ||
           type.includes("structured response");
  };

  const gradeSubjectiveQuestion = async (question, questionIndex) => {
    if (!question.user_answer || question.user_answer.trim() === "") return;

    try {
      setGradingInProgress(prev => ({ ...prev, [questionIndex]: true }));

      const profile = await base44.entities.LearningProfile.filter({ 
        id: (await base44.auth.me()).learning_profile_id 
      });
      const learningProfile = profile[0] || {};

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
      // Use centralized XP tracking
      const result = await awardDailyXP(amount, reason);
      if (result.success) {
        // Also record question activity
        await recordDailyActivity('questions', 1);
        
        // Update questions_completed count
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

  const handleAnswer = (answer) => {
    const updatedQuestions = [...exam.questions];
    updatedQuestions[currentQuestion].user_answer = answer;

    setExam(prev => ({
      ...prev,
      questions: updatedQuestions
    }));

    // Debounce auto-save on answer change
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

    // Award XP for answering a question
    const currentQ = exam.questions[currentQuestion];
    if (currentQ.user_answer) {
      awardXP(3, 'Question answered!');
    }

    // Save progress when navigating
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

  const submitExam = async () => {
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
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });
      const learningProfile = profile[0] || {};

      const questionsWithGrading = exam.questions.map((q) => {
        const questionType = q.question_type.toLowerCase();

        if (questionType.includes("multiple choice") || 
            questionType.includes("mcq") ||
            (questionType.includes("true") && questionType.includes("false"))) {
          return {
            ...q,
            is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
          };
        }

        if (isSubjectiveQuestion(q.question_type)) {
          if (q.ai_score_out_of_10 !== undefined) {
            return {
              ...q,
              is_correct: q.ai_score_out_of_10 >= 7.5 
            };
          }
        }

        return {
          ...q,
          is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
        };
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

      // Fetch fresh lesson data to ensure curriculum_map is available
      let currentLesson = lesson;
      if (!lesson.curriculum_map || !lesson.curriculum_map.core_competencies) {
        const refreshedLessons = await base44.entities.Lesson.filter({ id: lesson.id });
        if (refreshedLessons.length > 0 && refreshedLessons[0].curriculum_map?.core_competencies) {
          currentLesson = refreshedLessons[0];
        } else {
          throw new Error("Curriculum analysis not ready. Please wait and try submitting again.");
        }
      }

      const feedbackPrompt = `Expert educator for ${currentLesson.course_name} (grade ${learningProfile.grade || "N/A"}). Analyze exam performance using curriculum map to predict grade.

Input: Grade ${learningProfile.grade || "N/A"}, ${currentLesson.course_name}, Exam ${exam.exam_number}/6
Curriculum: ${JSON.stringify(currentLesson.curriculum_map, null, 2)}
Performance: ${JSON.stringify(examPerformanceData, null, 2)}

Fields: question_number, question_type, difficulty_index, question_text, options, student_answer, correct_answer, explanation, assessed_competencies[], targeted_misconception, is_correct, ai_grading{score_out_of_10, verdict, rationale, keypoints_hit[], keypoints_missed[]}.

Prediction Algorithm:
1) Per-item: base=0.90(correct) or 0.20. Blend w/ai_grading partial=(score/10). Apply difficulty multipliers: Correct→High×1.05(cap 0.98), Challenging×1.02(cap 0.96), Moderate×1.01(cap 0.92); Incorrect→High×0.90(floor 0.10), Challenging×0.80(floor 0.08), Moderate×0.70(floor 0.05). Misconception penalty -0.05/-0.07/-0.09. Clamp [0.05,0.98].
2) Competency mastery: mean scores per competency from curriculum_map.core_competencies; if none→0.50.
3) Weighted aggregate: parse competency_weightings ("30%"→0.30), normalize, Σ(mastery×weight)×100.
4) Question-type adjust: AvgTypeScore vs curriculum_map.question_formats frequency. If <0.40 & ≥30%→-3 to -6; if ≥0.80 & ≥30%→+0 to +2. Cap [-8,+4].
5) Coverage: competency weight≥25% & <2 items→-2 each (max -4); ≥80% assessed→+1 to +2. Cap [-8,+4].
6) Final: round(aggregate+modifier) [0,100]+"%". If 0/10→"Not Calculable".

Planning Signals (internal): priority_competencies (bottom 2-3 weighted), misconception_targets (recurring/weighted), exam_format_deficits (type<40% & weight≥20%), trend_direction (trajectory). Use to shape suggested_future_sessions_plan & learning_patterns.

JSON Output (exact schema):
- feedback_session_title: "Exam ${exam.exam_number} Performance & Grade Prediction"
- predicted_exam_score_percentage: "%"|"Not Calculable"
- prediction_calculation_rationale: 1-3 sentences (difficulty, weighting, type, coverage)
- overall_performance_summary_text: 1-2 sentences w/next-focus
- identified_strengths_list: 2-3 items
- key_areas_for_improvement_list: 2-3 items (tied to misconceptions)
- suggested_future_sessions_plan: 5 objects {session_number(2..6), session_name, session_focus_description} grounded in signals
No extra fields. % as strings.`;

      const { data: feedbackData } = await retryOperation(() => 
        base44.functions.invoke('feedbackGrade', {
          prompt: feedbackPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              feedback_session_title: { type: "string" },
              predicted_exam_score_percentage: { type: "string" },
              prediction_calculation_rationale: { type: "string" },
              overall_performance_summary_text: { type: "string" },
              identified_strengths_list: { type: "array", items: { type: "string" } },
              key_areas_for_improvement_list: { type: "array", items: { type: "string" } },
              suggested_future_sessions_plan: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    session_number: { type: "integer" },
                    session_name: { type: "string" },
                    session_focus_description: { type: "string" }
                  }
                }
              }
            }
          }
        })
      );

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

      const scoreNum = parseInt(feedbackData.predicted_exam_score_percentage);
      let letterGrade = "F";
      if (!isNaN(scoreNum)) {
        if (scoreNum >= 90) letterGrade = "A+";
        else if (scoreNum >= 85) letterGrade = "A";
        else if (scoreNum >= 80) letterGrade = "A-";
        else if (scoreNum >= 77) letterGrade = "B+";
        else if (scoreNum >= 73) letterGrade = "B";
        else if (scoreNum >= 70) letterGrade = "B-";
        else if (scoreNum >= 67) letterGrade = "C+";
        else if (scoreNum >= 63) letterGrade = "C";
        else if (scoreNum >= 60) letterGrade = "C-";
        else if (scoreNum >= 50) letterGrade = "D";
      }

      await retryOperation(() => 
        base44.entities.Exam.update(exam.id, {
          questions: questionsWithGrading,
          feedback: questionFeedback,
          total_score: isNaN(scoreNum) ? 0 : scoreNum,
          predicted_grade: letterGrade,
          ai_feedback: feedbackData,
          time_taken_seconds: elapsedSeconds,
          question_time_laps: questionTimeLaps,
          status: "completed",
          completed: true
        })
      );

      // Create all 6 exams after completing exam 1
      if (exam.exam_number === 1 && feedbackData.suggested_future_sessions_plan) {
        const existingExams = await base44.entities.Exam.filter({ lesson_id: lesson.id });
        const existingNumbers = existingExams.map(e => e.exam_number);
        
        await Promise.all(
          feedbackData.suggested_future_sessions_plan.map(async (session) => {
            if (!existingNumbers.includes(session.session_number)) {
              await base44.entities.Exam.create({
                lesson_id: lesson.id,
                exam_type: "official",
                exam_number: session.session_number,
                focus_description: session.session_focus_description,
                status: "not_started",
                completed: false,
                questions: [],
                feedback: [],
                time_taken_seconds: 0,
                question_time_laps: []
              });
            }
          })
        );
      }

      // Generate study plan after official exam completion
      try {
        await base44.functions.invoke('generateStudyPlan', {
          exam_id: exam.id,
          lesson_id: lesson.id
        });
      } catch (planError) {
        console.error("Error generating study plan:", planError);
        // Non-blocking - continue even if plan generation fails
      }

      const correctCount = questionsWithGrading.filter(q => q.is_correct).length;

      // Award XP for exam completion using centralized tracking
      let examXP = 25; // Base XP for completing exam
      if (correctCount >= 8) examXP += 25; // Bonus for high score
      if (correctCount === questionsWithGrading.length) examXP += 50; // Perfect score bonus

      try {
        // Use centralized XP tracking
        const xpResult = await awardDailyXP(examXP, 'Exam completed!');
        
        // Update exam-specific stats
        const currentUserXP = await base44.auth.me();
        await base44.auth.updateMe({
          total_exams_completed: (currentUserXP.total_exams_completed || 0) + 1
        });

        let xpReason = 'Exam completed!';
        if (correctCount === questionsWithGrading.length) xpReason = 'Perfect exam! 🌟';
        else if (correctCount >= 8) xpReason = 'Great score! 🎯';

        if (xpResult.success) {
          setXpToast({ show: true, xp: examXP, reason: xpReason });
        }
      } catch (xpError) {
        console.error("Error awarding exam XP:", xpError);
      }

      let pointsEarned = 50;
      
      questionsWithGrading.forEach(q => {
        if (isSubjectiveQuestion(q.question_type) && q.ai_score_out_of_10 !== undefined) {
          pointsEarned += Math.round(q.ai_score_out_of_10 * 2.5);
        } else if (q.is_correct) {
          pointsEarned += 15;
        }
      });

      if (correctCount === questionsWithGrading.length) {
        pointsEarned += 100;
      }

      if (letterGrade.startsWith('A')) {
        pointsEarned += 50;
      }

      const earnedBadges = [...(user.badges || [])];
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

      const newTotalPoints = (user.total_points || 0) + pointsEarned;
      const newLevel = Math.floor(newTotalPoints / 100) + 1;

      await retryOperation(() => 
        base44.auth.updateMe({
          questions_completed: (user.questions_completed || 0) + questionsWithGrading.length,
          time_spent_seconds: (user.time_spent_seconds || 0) + elapsedSeconds,
          total_points: newTotalPoints,
          level: newLevel,
          badges: earnedBadges
        })
      );

      if (earnedNow.length > 0 || correctCount >= 8) {
        setShowConfetti(true);
        setNewBadges(earnedNow);
      }

      // Clear exam state and notify completion
      setExam(null);
      setSelectedExamNumber(null);
      hasAutoSelectedRef.current = false;
      
      if (onExamComplete) onExamComplete();
      setIsSubmitting(false);
      
      // Switch to study plan tab after a short delay
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('switchToStudyPlanTab'));
      }, 500);
    } catch (error) {
      console.error("Error submitting exam:", error);
      await logError('exam_submission', error, { lesson_id: lesson?.id, exam_id: exam?.id });
      alert("Failed to submit exam. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Show completed exam feedback inline
  if (viewingCompletedExam) {
    return (
      <div className="pb-4">
        <div className="px-3 py-2">
          <Button 
            variant="ghost" 
            onClick={() => setViewingCompletedExam(null)}
            className="mb-3 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Exams
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

  // Show exam selection if no exam selected
  if (!exam && !isGenerating) {
    // Wait for exams to load from database
    if (exams === undefined) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-2 text-slate-600">Loading exams...</span>
        </div>
      );
    }
    
    const allExamsForLesson = exams || [];
    // Deduplicate by exam_number, keeping the most recent or completed one
    const examsByNumber = {};
    allExamsForLesson.forEach(e => {
      const existing = examsByNumber[e.exam_number];
      if (!existing || e.completed || (!existing.completed && e.updated_date > existing.updated_date)) {
        examsByNumber[e.exam_number] = e;
      }
    });
    const sortedExams = Object.values(examsByNumber).sort((a, b) => a.exam_number - b.exam_number);
    
    return (
      <div className="pb-4">
        <Card className="bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl p-3 md:p-6 m-1 md:m-2">
        <div className="mb-3 md:mb-6">
          <h3 className="text-base md:text-2xl font-bold text-slate-900 mb-1 md:mb-2 flex items-center gap-1.5 md:gap-2">
            <Trophy className="w-5 h-5 md:w-7 md:h-7 text-yellow-500" />
            Your Roadmap to 90%+
          </h3>
          <p className="text-xs md:text-base text-slate-600">Complete exams to track your progress and improve your predicted grade</p>
        </div>
        
        <div className="grid gap-2 md:gap-3">
          {sortedExams.length > 0 ? sortedExams.map((e) => {
            const isCompleted = e.completed;
            const canStart = e.exam_number === 1 || sortedExams.find(ex => ex.exam_number === e.exam_number - 1)?.completed;
            
            return (
              <button
              key={e.id}
              onClick={() => {
                if (isCompleted) {
                  // Show feedback inline
                  setViewingCompletedExam(e);
                } else if (canStart) {
                  setExam(null); // Clear any previous exam
                  setSelectedExamNumber(e.exam_number);
                  hasAutoSelectedRef.current = true;
                }
              }}
                disabled={!canStart && !isCompleted}
                className={`p-3 md:p-5 rounded-xl border-2 transition-all text-left ${
                  isCompleted
                    ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer'
                    : canStart
                    ? 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300 hover:shadow-lg hover:scale-[1.02]'
                    : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1 md:mb-2">
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                    {isCompleted ? (
                      <div className="w-9 h-9 md:w-12 md:h-12 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 md:w-6 md:h-6 text-white" />
                      </div>
                    ) : canStart ? (
                      <div className="w-9 h-9 md:w-12 md:h-12 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Play className="w-4 h-4 md:w-6 md:h-6 text-white" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 md:w-12 md:h-12 bg-slate-300 rounded-full flex items-center justify-center flex-shrink-0">
                        <Lock className="w-4 h-4 md:w-6 md:h-6 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-slate-900 text-sm md:text-lg">
                        Exam {e.exam_number}
                      </h5>
                      <p className="text-xs md:text-sm text-slate-600 line-clamp-2">
                        {e.focus_description || (e.exam_number === 1 ? 'Diagnostic Assessment' : 'Practice Exam')}
                      </p>
                    </div>
                  </div>
                  {isCompleted && e.predicted_grade && (
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge className="bg-emerald-600 text-white font-bold text-base md:text-xl px-3 py-1.5 md:px-4 md:py-2">
                        {e.predicted_grade}
                      </Badge>
                      {e.total_score !== undefined && (
                        <span className="text-xs text-emerald-700 font-medium">{e.total_score}%</span>
                      )}
                    </div>
                  )}
                </div>
                {isCompleted && (
                  <p className="text-xs md:text-sm text-emerald-700 font-medium ml-11 md:ml-12 flex items-center gap-1">
                    View detailed feedback →
                  </p>
                )}
                {canStart && !isCompleted && e.status === 'in_progress' && e.questions?.length > 0 && (
                  <p className="text-xs md:text-sm text-purple-700 font-medium ml-11 md:ml-12">
                    Continue exam →
                  </p>
                )}
                {canStart && !isCompleted && e.status !== 'in_progress' && (
                  <p className="text-xs md:text-sm text-purple-700 font-medium ml-11 md:ml-12">
                    Start exam →
                  </p>
                )}
              </button>
            );
          }) : (
            <button
              onClick={() => {
                setExam(null);
                setSelectedExamNumber(1);
                hasAutoSelectedRef.current = true;
              }}
              className="p-3 md:p-5 rounded-xl border-2 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300 hover:shadow-lg hover:scale-[1.02] transition-all text-left"
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-9 h-9 md:w-12 md:h-12 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Play className="w-4 h-4 md:w-6 md:h-6 text-white" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 text-sm md:text-lg">Exam 1</h5>
                  <p className="text-xs md:text-sm text-slate-600">Diagnostic Assessment</p>
                </div>
              </div>
              <p className="text-xs md:text-sm text-purple-700 font-medium ml-11 md:ml-12 mt-1 md:mt-2">
                Click to start your first exam →
              </p>
            </button>
          )}
        </div>
        </Card>
      </div>
    );
  }

  if (waitingForCompression) {
    return <EducationalLoader 
      title="Optimizing Content" 
      description="Compressing your document for faster exam generation..."
    />;
  }

  if (isGenerating) {
    return <EducationalLoader 
      title="Creating Your Exam" 
      description="Generating personalized exam questions based on your diagnostic results..."
    />;
  }

  if (!exam) return null;

  // If current exam is completed and we're not viewing it, reset to selection
  if (exam?.completed && !viewingCompletedExam) {
    // Use setTimeout to avoid state update during render
    setTimeout(() => {
      setExam(null);
      setSelectedExamNumber(null);
      hasAutoSelectedRef.current = false;
    }, 0);
    return null;
  }

  // Guard against missing questions array
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
  
  // Guard against invalid current question
  if (!currentQ) {
    setCurrentQuestion(0);
    return null;
  }
  
  const canProceed = currentQ.user_answer?.trim() !== "";

  return (
    <>
      <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      {newBadges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl p-4 max-w-sm mx-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            <h3 className="text-base font-bold text-slate-900">New Badge Earned!</h3>
          </div>
          <div className="space-y-2">
            {newBadges.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                <span className="text-xl">{badge.badge_icon}</span>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{badge.badge_name}</p>
                  <p className="text-xs text-slate-600">{badge.badge_description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Mobile-optimized full-height layout */}
      <div className="flex flex-col h-full md:h-auto md:pb-4">
        <div className="flex-1 flex flex-col bg-white/95 backdrop-blur-xl md:rounded-2xl border-0 md:border border-purple-200/80 shadow-none md:shadow-sm md:mx-0 overflow-hidden">
          {/* Sticky compact header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-purple-100 bg-white/95 backdrop-blur-sm sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                {currentQuestion + 1}/{exam.questions.length}
              </span>
              <Progress value={progress} className="h-1.5 w-20" />
            </div>
            <div className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
              <Clock className="w-3 h-3" />
              <span className="text-xs font-semibold tabular-nums">{formatTime(elapsedSeconds)}</span>
            </div>
          </div>

          {/* Scrollable question content */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3 md:p-5">
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

          {/* Fixed bottom navigation */}
          <div className="flex gap-2 px-3 py-3 md:px-5 md:pb-4 border-t border-purple-100 bg-white/95 backdrop-blur-sm shrink-0">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              className="flex-1 text-xs h-10 rounded-xl font-medium"
            >
              Previous
            </Button>
            {isLastQuestion ? (
              <Button
                onClick={submitExam}
                disabled={!canProceed || isSubmitting}
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
                disabled={!canProceed}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-xs h-10 rounded-xl font-medium"
              >
                Next Question
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}