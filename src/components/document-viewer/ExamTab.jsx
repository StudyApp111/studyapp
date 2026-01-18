import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, Clock, Sparkles, Play, Pause, CheckCircle2, Trophy, Zap, ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import ExamQuestion from "@/components/exam/ExamQuestion.jsx";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";
import EducationalLoader from "@/components/ui/EducationalLoader";
import { logError } from "@/components/utils/errorLogger";
import XPGainToast from "@/components/gamification/XPGainToast";
import { recordDailyActivity, awardDailyXP } from "@/components/utils/dailyReset";
import FeedbackDisplay from "@/components/feedback/FeedbackDisplay";
import TaskCompletionToast from "@/components/gamification/TaskCompletionToast";

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
  const [taskCompletionToast, setTaskCompletionToast] = useState(false);
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
  const generationTriggeredRef = useRef(new Set());

  const practiceExamGeneratingRef = useRef(false);

  useEffect(() => {
    const handleGeneratePracticeExam = async (e) => {
      if (practiceExamGeneratingRef.current) {
        console.log('⚠️ Practice exam generation already in progress, skipping');
        return;
      }

      const { task, focus_topics, target_competency, misconception_addressed } = e.detail;
      console.log('🎯 Received practice exam generation request from study plan');

      practiceExamGeneratingRef.current = true;
      setIsGenerating(true);

      try {
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
      } finally {
        setIsGenerating(false);
        practiceExamGeneratingRef.current = false;
      }
    };

    window.addEventListener('generatePracticeExamFromTask', handleGeneratePracticeExam);
    return () => window.removeEventListener('generatePracticeExamFromTask', handleGeneratePracticeExam);
  }, [lesson?.id]);

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
    if (waitingForCompression) return;

    loadOrGenerateExam(selectedExamNumber);
  }, [lesson?.id, selectedExamNumber, waitingForCompression, exams]);

  // Wait for lesson content to be ready using realtime subscriptions instead of polling
  useEffect(() => {
    if (!lesson?.id) return;
    
    const isFileUpload = lesson.input_type === 'file';
    const hasExtractedContent = lesson.extracted_content?.length > 0;
    const hasCompressedContent = lesson.compressed_content?.length > 0;
    const needsToWait = isFileUpload && (!hasExtractedContent || !hasCompressedContent);
    
    if (needsToWait) {
      setWaitingForCompression(true);
      console.log('⏳ Waiting for content extraction and compression to complete...');
      
      // Subscribe to lesson updates
      const unsubscribe = base44.entities.Lesson.subscribe((event) => {
        if (event.id === lesson.id && event.type === 'update') {
          const updated = event.data;
          if (updated?.extracted_content?.length > 0 && updated?.compressed_content?.length > 0) {
            console.log('✅ Content ready via realtime update!');
            setWaitingForCompression(false);
            window.dispatchEvent(new Event('reloadLesson'));
          }
        }
      });
      
      return () => unsubscribe();
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

    if (generationTriggeredRef.current.has(examNumber)) {
      console.log(`⚠️ Generation already in progress for Exam ${examNumber}, skipping duplicate call.`);
      return;
    }

    try {
      const existingExams = (exams || []).filter(e => e.exam_number === examNumber);
      console.log(`📋 Looking for Exam ${examNumber} in loaded exams:`, existingExams.length > 0 ? 'FOUND' : 'NOT FOUND');

      if (existingExams?.length > 0) {
        const loadedExam = existingExams[0];
        
        if (loadedExam.completed) {
          setExam(loadedExam);
          return;
        }
        
        if (loadedExam.questions?.length > 0) {
          setExam(loadedExam);
          const firstUnanswered = loadedExam.questions.findIndex(q => !q.user_answer?.trim());
          setCurrentQuestion(firstUnanswered >= 0 ? firstUnanswered : loadedExam.questions.length - 1);
        } else {
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

      // All official exams use the same core prompt structure from autoGenerateExam1
      const aiPrompt = `
[Context]
You are an expert assessment designer. Generate a 5-question exam-authentic DIAGNOSTIC worksheet for ${lesson.course_name}. 
This exam establishes an accurate learning baseline and must reflect how the course is ACTUALLY assessed.

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
If content specifies a concrete skill/topic (e.g., "factoring", "photosynthesis", "short story analysis"),
ALL questions must stay strictly within it.
Only broaden scope if the user explicitly requests review or exam prep.

• TASK-FORM ENFORCEMENT (CRITICAL):
Questions MUST require the student to PERFORM the skill, not describe it.

Examples:
- English / Humanities:
  Use short passages, excerpts, scenarios, or claims.
  Test analysis, interpretation, or argument by asking the student to respond TO the material.
  DO NOT ask for definitions of literary or analytical terms.

- Math / Sciences:
  Use problems, data, equations, diagrams, or experimental setups.
  DO NOT ask conceptual description-only questions unless the course explicitly assesses them.

- Computer Science / Engineering:
  Use code snippets, logic traces, outputs, or system behavior.
  DO NOT ask "what is" or "explain the concept" unless required by curriculum.

- Business / Economics:
  Use case scenarios, numbers, or decisions.
  DO NOT test abstract definitions without application.

• Light Search (Minimal):
Use Google Search ONLY to confirm typical exam TASK TYPES for this course
(e.g., "short story analysis", "data interpretation", "problem solving").
Do NOT introduce new topics.

• Difficulty Progression:
Q1–2: Moderate
Q3–4: Challenging
Q5: Challenging → High Challenge (depth, edge cases, or precision—not new content)

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

CRITICAL ANSWER FORMAT:
• For Multiple Choice: correct_answer MUST be ONLY the letter (A, B, C, or D) - NOT the full option text
• For True/False: correct_answer MUST be "True" or "False"

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
          exam_type: "official",
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

  const handleAnswer = (answer) => {
    const updatedQuestions = [...exam.questions];
    updatedQuestions[currentQuestion].user_answer = answer;

    setExam(prev => ({
      ...prev,
      questions: updatedQuestions
    }));

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
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });
      const learningProfile = profile[0] || {};

      const questionsWithGrading = await Promise.all(exam.questions.map(async (q) => {
        // For subjective questions, use AI grading if not already graded
        if (isSubjectiveQuestion(q.question_type)) {
          if (q.ai_score_out_of_10 === undefined && q.user_answer?.trim()) {
            try {
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
              
              return {
                ...q,
                ai_score_out_of_10: gradingResult.score_out_of_10,
                ai_verdict: gradingResult.verdict,
                ai_rationale_short: gradingResult.rationale_short,
                ai_keypoints_hit: gradingResult.keypoints_hit,
                ai_keypoints_missed: gradingResult.keypoints_missed,
                ai_misconception_detected: gradingResult.misconception_detected,
                is_correct: gradingResult.score_out_of_10 >= 7.5
              };
            } catch (gradingError) {
              console.error('Error grading subjective question:', gradingError);
              return { ...q, is_correct: false };
            }
          }
          // Already graded
          return { ...q, is_correct: q.ai_score_out_of_10 >= 7.5 };
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
          
          if (taskJustCompleted) {
            setTaskCompletionToast(true);
          }
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
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });
      const learningProfile = profile[0] || {};

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

      let currentLesson = lesson;
      if (!lesson.curriculum_map || !lesson.curriculum_map.core_competencies) {
        const refreshedLessons = await base44.entities.Lesson.filter({ id: lesson.id });
        if (refreshedLessons.length > 0 && refreshedLessons[0].curriculum_map?.core_competencies) {
          currentLesson = refreshedLessons[0];
        } else {
          throw new Error("Curriculum analysis not ready. Please wait and try submitting again.");
        }
      }

      const feedbackPrompt = `Expert educator for ${currentLesson.course_name} (grade ${learningProfile.grade || "N/A"}). Analyze exam performance using curriculum map to predict grade as if you were a teacher at this school teaching this course.

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

JSON Output (exact schema):
- feedback_session_title: "Exam ${exam.exam_number} Performance & Grade Prediction"
- predicted_exam_score_percentage: "%"|"Not Calculable"`;

      const { data: feedbackData } = await retryOperation(() => 
        base44.functions.invoke('feedbackGrade', {
          prompt: feedbackPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              feedback_session_title: { type: "string" },
              predicted_exam_score_percentage: { type: "string" }
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

      if (exam.exam_number === 1) {
        const existingExams = await base44.entities.Exam.filter({ lesson_id: lesson.id });
        const existingNumbers = existingExams.map(e => e.exam_number);
        
        for (let i = 2; i <= 6; i++) {
          if (!existingNumbers.includes(i)) {
            await base44.entities.Exam.create({
              lesson_id: lesson.id,
              exam_type: "official",
              exam_number: i,
              focus_description: "Adaptive assessment based on your progress",
              status: "not_started",
              completed: false,
              questions: [],
              feedback: [],
              time_taken_seconds: 0,
              question_time_laps: []
            });
          }
        }
      }

      try {
        await base44.functions.invoke('generateStudyPlan', {
          exam_id: exam.id,
          lesson_id: lesson.id
        });
      } catch (planError) {
        console.error("Error generating study plan:", planError);
      }

      const correctCount = questionsWithGrading.filter(q => q.is_correct).length;

      let examXP = 25;
      if (correctCount >= 8) examXP += 25;
      if (correctCount === questionsWithGrading.length) examXP += 50;

      try {
        const xpResult = await awardDailyXP(examXP, 'Exam completed!');
        
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

      setExam(null);
      setSelectedExamNumber(null);
      hasAutoSelectedRef.current = false;
      
      if (onExamComplete) onExamComplete();
      setIsSubmitting(false);
      
      // Navigate to study plan tab immediately
      window.dispatchEvent(new CustomEvent('switchToStudyPlanTab'));
    } catch (error) {
      console.error("Error submitting exam:", error);
      await logError('exam_submission', error, { lesson_id: lesson?.id, exam_id: exam?.id });
      alert("Failed to submit exam. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (viewingCompletedExam) {
    return (
      <div className="pb-4">
        <div className="px-3 py-2">
          <Button 
            variant="ghost" 
            onClick={() => {
              setViewingCompletedExam(null);
              setExam(null);
              setSelectedExamNumber(null);
              setCurrentQuestion(0);
              hasAutoSelectedRef.current = false;
            }}
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

  if (!exam && !isGenerating) {
    if (exams === undefined) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-2 text-slate-600">Loading exams...</span>
        </div>
      );
    }
    
    const allExamsForLesson = exams || [];
    const officialExams = allExamsForLesson.filter(e => e.exam_type !== 'practice');
    const practiceExams = allExamsForLesson.filter(e => e.exam_type === 'practice');
    
    const examsByNumber = {};
    officialExams.forEach(e => {
      const existing = examsByNumber[e.exam_number];
      if (!existing || e.completed || (!existing.completed && e.updated_date > existing.updated_date)) {
        examsByNumber[e.exam_number] = e;
      }
    });
    const sortedOfficialExams = Object.values(examsByNumber).sort((a, b) => a.exam_number - b.exam_number);
    const sortedPracticeExams = practiceExams.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    
    return (
        <div className="px-3 py-4 w-full max-w-[calc(100vw-1rem)] md:max-w-lg md:mx-auto md:px-6 space-y-6 overflow-x-hidden">
        {/* Practice Quizzes Section - Show first if they exist */}
        {sortedPracticeExams.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Practice Quizzes</h2>
                <p className="text-[11px] text-slate-500">Quick drills • No grade impact</p>
              </div>
            </div>
            
            <div className="space-y-2">
              {sortedPracticeExams.slice(0, 5).map((e) => {
                const isCompleted = e.completed;
                const correctCount = e.correct_count || 0;
                const totalQuestions = e.questions?.length || 0;
                
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
                    className={`group relative w-full overflow-hidden p-3 rounded-xl transition-all text-left shadow-sm hover:shadow-md ${
                      isCompleted
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-600'
                        : 'bg-white border border-blue-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="relative flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isCompleted ? 'bg-white/20' : 'bg-blue-50'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <Zap className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold text-sm truncate ${isCompleted ? 'text-white' : 'text-slate-900'}`}>
                          {e.focus_description || 'Practice Quiz'}
                        </h3>
                        <p className={`text-[11px] ${isCompleted ? 'text-white/70' : 'text-slate-500'}`}>
                          {totalQuestions} questions
                        </p>
                      </div>
                      
                      {isCompleted ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-lg font-black text-white">{correctCount}/{totalQuestions}</span>
                          <ChevronRight className="w-4 h-4 text-white/70" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Play className="w-3 h-3 text-blue-600" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Official Exams Section */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Trophy className="w-4 h-4 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Official Exams</h2>
              <p className="text-[11px] text-slate-500">Updates your predicted grade</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {sortedOfficialExams.length > 0 ? sortedOfficialExams.map((e) => {
              const isCompleted = e.completed;
              const canStart = e.exam_number === 1 || sortedOfficialExams.find(ex => ex.exam_number === e.exam_number - 1)?.completed;
              const isFirstExam = e.exam_number === 1;
              const isInProgress = e.status === 'in_progress' && !isCompleted;
              
              return (
                <button
                  key={e.id}
                  onClick={() => {
                    if (isCompleted) {
                      setViewingCompletedExam(e);
                    } else if (canStart) {
                      setExam(null);
                      setSelectedExamNumber(e.exam_number);
                      hasAutoSelectedRef.current = true;
                    }
                  }}
                  disabled={!canStart && !isCompleted}
                  className={`group relative w-full overflow-hidden p-3 rounded-xl transition-all text-left shadow-sm hover:shadow-md ${
                    isCompleted
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                      : canStart
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600'
                      : 'bg-slate-200 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="relative flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isCompleted || canStart ? 'bg-white/20' : 'bg-white/10'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : canStart ? (
                        <span className="text-lg font-black text-white">{e.exam_number}</span>
                      ) : (
                        <Lock className="w-4 h-4 text-white/60" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-white text-sm">
                          {isFirstExam ? 'Diagnostic' : `Exam ${e.exam_number}`}
                        </h3>
                        {isInProgress && (
                          <span className="text-[9px] bg-white/30 text-white px-1.5 py-0.5 rounded-full font-bold uppercase">
                            In Progress
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/70 truncate">
                        {isFirstExam ? 'Baseline assessment' : 'Adaptive assessment'}
                      </p>
                    </div>
                    
                    {isCompleted && e.predicted_grade ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <span className="text-xl font-black text-white">{e.predicted_grade}</span>
                          <p className="text-[9px] text-white/70">{e.total_score}%</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/70" />
                      </div>
                    ) : canStart ? (
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Play className="w-3 h-3 text-white" />
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            }) : (
              <button
                onClick={() => {
                  setExam(null);
                  setSelectedExamNumber(1);
                  hasAutoSelectedRef.current = true;
                }}
                className="group relative w-full overflow-hidden p-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 shadow-sm hover:shadow-md transition-all text-left"
              >
                <div className="relative flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-black text-white">1</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-sm">Diagnostic</h3>
                    <p className="text-[11px] text-white/70">Baseline assessment</p>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Play className="w-3 h-3 text-white" />
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>

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
      
      <TaskCompletionToast 
        show={taskCompletionToast}
        gradeIncrease={2.5}
        onComplete={() => setTaskCompletionToast(false)}
      />
      
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
        <div className="flex-1 flex flex-col bg-white/95 backdrop-blur-xl md:rounded-2xl border-0 md:border border-purple-200/80 shadow-none md:shadow-sm md:mx-0 overflow-hidden">
          {/* Exam Header with Back Button and Type Indicator */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-purple-100 bg-white/95 backdrop-blur-sm sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handleExitExam}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">Exit</span>
              </button>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                isPracticeExam 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-purple-100 text-purple-700'
              }`}>
                {isPracticeExam ? 'Practice' : 'Official'}
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                {currentQuestion + 1}/{exam.questions.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-1.5 w-16 hidden sm:block" />
              <div className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                <Clock className="w-3 h-3" />
                <span className="text-xs font-semibold tabular-nums">{formatTime(elapsedSeconds)}</span>
              </div>
            </div>
          </div>

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