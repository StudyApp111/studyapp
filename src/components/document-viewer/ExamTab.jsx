import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, Clock, Sparkles, Play, Pause, CheckCircle2, Trophy, Zap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import ExamQuestion from "@/components/exam/ExamQuestion.jsx";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";
import EducationalLoader from "@/components/ui/EducationalLoader";
import { logError } from "@/components/utils/errorLogger";
import XPGainToast from "@/components/gamification/XPGainToast";
import { recordDailyActivity, awardDailyXP } from "@/components/utils/dailyReset";

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
  
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const questionTimesRef = useRef({});
  const currentQuestionStartTimeRef = useRef(null);
  const examIdRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const lastSavedQuestionsRef = useRef(null);
  const generationTriggeredRef = useRef(new Set()); // Track which exams we've triggered generation for

  // Auto-select Exam 1 (or in-progress) to trigger generation in background
          useEffect(() => {
            if (lesson && !selectedExamNumber) {
              const allExamsForLesson = exams || [];

              // First priority: in-progress exam
              const inProgressExam = allExamsForLesson.find(e => e.status === 'in_progress' && !e.completed);
              if (inProgressExam) {
                console.log("📋 Auto-selecting in-progress exam:", inProgressExam.exam_number);
                setSelectedExamNumber(inProgressExam.exam_number);
                return;
              }

              // Second priority: Exam 1 if it exists
              const exam1 = allExamsForLesson.find(e => e.exam_number === 1);
              if (exam1) {
                console.log("📋 Auto-selecting Exam 1:", exam1.id, "| has questions:", exam1.questions?.length || 0);
                setSelectedExamNumber(1);
                return;
              }

              // Fallback: trigger Exam 1 generation even if exams list is empty (fresh lesson)
              console.log("📋 No exams found yet; defaulting to Exam 1 to generate in background");
              setSelectedExamNumber(1);
            }
          }, [lesson?.id, exams, selectedExamNumber]);

  useEffect(() => {
            if (lesson?.id && selectedExamNumber) {
              loadOrGenerateExam(selectedExamNumber);
            }
          }, [lesson?.id, lesson?.compressed_content, selectedExamNumber]);

  // Wait briefly for background compression to finish to reduce prompt size
  useEffect(() => {
    if (!lesson?.id) return;
    const cc = lesson?.compressed_content;
    if (cc && cc.length > 2500 && (lesson?.extracted_content?.length || 0) > 0) {
      setWaitingForCompression(true);
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const refreshed = await base44.entities.Lesson.filter({ id: lesson.id });
          const updated = refreshed?.[0];
          if (updated?.compressed_content && updated.compressed_content.length <= 2500) {
            clearInterval(interval);
            setWaitingForCompression(false);
            // Ask the viewer to reload so child components get the optimized content
            window.dispatchEvent(new Event('reloadLesson'));
          } else if (attempts >= 10) {
            clearInterval(interval);
            setWaitingForCompression(false);
          }
        } catch {
          if (attempts >= 10) {
            clearInterval(interval);
            setWaitingForCompression(false);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lesson?.id]);

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
    // Wait until OCR compression is available (for file uploads) to minimize prompt size and meet UX requirement
    if (lesson.input_type === 'file' && !lesson.compressed_content) {
      console.log('⏳ Waiting for compressed_content before generating exam...');
      return;
    }

    try {
      const existingExams = await base44.entities.Exam.filter({ 
        lesson_id: lesson.id,
        exam_number: examNumber
      });

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
          // Questions not ready, show generating state
          setIsGenerating(true);
          
          // Poll efficiently with exponential backoff
          let pollCount = 0;
          const maxPolls = 60; // allow up to ~2-3 minutes total
          const pollExam = async () => {
            if (pollCount++ >= maxPolls) {
              setIsGenerating(false);
              return;
            }
            
            const updated = await base44.entities.Exam.filter({ id: loadedExam.id });
            if (updated[0]?.questions?.length > 0) {
              setExam(updated[0]);
              setIsGenerating(false);
            } else {
              setTimeout(pollExam, Math.min(2000 * Math.pow(1.2, pollCount), 5000));
            }
          };
          pollExam();
        }
      } else {
        setIsGenerating(true);
        await generateExam(null, examNumber);
        setIsGenerating(false);
      }
    } catch (error) {
      console.error("Error loading exam:", error);
      await logError('exam_loading', error, { lesson_id: lesson?.id, examNumber });
      setIsGenerating(false);
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

      const aiPrompt = `

Context
You are an expert assessment designer. Generate a 5-question predictive worksheet for ${lesson.course_name} that both reflects authentic exam standards and establishes an accurate learning baseline.

This worksheet must stand alone.
Do NOT rely on prior diagnostics.
Ground content in the student’s materials and light web search when needed.

────────────────────────────────

Input Context

Student Grade Level: ${learningProfile.grade || "N/A"}
Course / Unit Name: ${lesson.course_name}
School: ${learningProfile.school || "N/A"}

Content Summary:
${contentDescription}

────────────────────────────────

Internal Reasoning (Do NOT Output)

1. Scope Lock
- If lesson content specifies a concrete topic or skill (e.g., “factoring”, “photosynthesis”, “Du Bois double-consciousness”):
  → ALL questions MUST stay strictly within that topic.
- Do NOT add prerequisites, review topics, or adjacent units unless required to execute the task.
- Only broaden scope if the user explicitly requests review or exam prep.

2. Topic Validation (Light Search)
- Use search ONLY to confirm terminology, typical exam phrasing, or standard question styles for this course.
- Do NOT introduce new topics beyond the locked scope.

3. Difficulty Progression
- Q1–2: Moderate Exam-Level
- Q3: Challenging Exam-Level
- Q4-5: Challenging → High Challenge (depth, edge cases, reasoning—not new topics)

4. Coverage Design
- 2 questions: core skill / primary topic
- 2 questions: applications, traps, or conceptual stress tests
- 1 twin items: same concept, different reasoning demand

5. Exam Authenticity
- Match tone, rigor, and structure typical of ${learningProfile.school || "the school"} assessments.

────────────────────────────────

QUESTION-TYPE ENFORCEMENT (EXECUTE FIRST)

For EACH question:

1. Choose question_type from:
   - Multiple Choice
   - True/False
   - Fill in the Blank
   - Short Answer

2. Apply strict formatting rules:

Multiple Choice:
- EXACTLY four options labeled A, B, C, D.
- MCQ cue phrases allowed.

True/False:
- options = ["True", "False"]
- Single declarative statement only.

Fill in the Blank:
- options = []
- EXACTLY one blank written as ____.
- Blank must be a key term, value, or short phrase.

Short Answer:
- options = []
- Direct prompt requesting a value, explanation, justification, or worked solution.

MCQ cue phrases are FORBIDDEN in non-MCQ questions:
“Which of the following”, “Select”, “Identify the correct”, “Choose”, “is/are true about”

If a forbidden cue appears, IMMEDIATELY convert the question to Multiple Choice and regenerate.

This layer overrides all other instructions.

────────────────────────────────

Exam Generation (Output Only)

Generate EXACTLY 5 questions.

Each question MUST include:
- question_type
- question_text
- options (or [] where required)
- difficulty_index:
  • Moderate Exam-Level
  • Challenging Exam-Level
  • High Challenge Exam-Level

Each question MUST:
- Test a distinct reasoning demand (no duplicates)
- Use exam-authentic wording
- Stay strictly within the locked topic scope

Subject guidance:
- Math / Science: execution, reasoning steps, interpretation, unit checks
- Humanities / Social Sciences: claim precision, evidence use, conceptual clarity
- CS / Engineering: tracing, correctness, edge cases
- Business / Econ: method selection, applied reasoning, interpretation

────────────────────────────────

Answer Key Requirements

For EACH question include:
- correct_answer
- explanation (2–3 sentences; instructional, not restated)
- assessed_competencies (infer from content)
- targeted_misconception

────────────────────────────────

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

      // Guard: Ensure curriculum_map exists before predicting grade
      if (!lesson.curriculum_map || !lesson.curriculum_map.core_competencies) {
        throw new Error("Curriculum analysis not ready. Please wait and try submitting again.");
      }

      const feedbackPrompt = `You are an expert educator and assessment analyst for ${lesson.course_name} at ${learningProfile.school || "the school"} (grade: ${learningProfile.grade || "N/A"}, region: ${learningProfile.city || "N/A"}). Use the curriculum map and the student's 10-question exam performance to produce an accurate predicted exam grade, a concise rationale, a brief performance summary, strengths/weaknesses, a structured multi-signal learning plan, and behavior-based learning patterns. Keep all reasoning internal; output ONLY valid JSON that matches the provided response_json_schema.

      Input Data:
      Student's Grade Level: ${learningProfile.grade || "N/A"}
      Course/Unit Name: ${lesson.course_name}
      Exam Number: ${exam.exam_number} of 6

      Curriculum Profile:
      ${JSON.stringify(lesson.curriculum_map, null, 2)}

      Exam Performance:
      ${JSON.stringify(examPerformanceData, null, 2)}

      [Assumptions & Fields]
      Each exam item may include:
      question_number, question_type, difficulty_index, question_text,
      options, student_answer, correct_answer, explanation,
      assessed_competencies[] (names), targeted_misconception (string),
      is_correct (boolean),
      ai_grading { score_out_of_10, verdict, rationale, keypoints_hit[], keypoints_missed[] }.
      Ignore missing fields; do not invent values.

      [Part 1 — Performance Analysis & Prediction]
      Edge Handling
      - If total correct = 0/10: skip calculations and output "Not Calculable" for predicted_exam_score_percentage with a foundation-rebuild rationale.
      - If total correct = 10/10: still compute; expect a top score (~95–100).

      1) Per-Item Mastery (blend binary, partial credit, difficulty)
      - Base = 0.90 if is_correct else 0.20.
      - If ai_grading exists:
      partial = clamp(ai_grading.score_out_of_10 / 10, 0, 1);
      base = 0.75*partial + 0.25*base.
      - Difficulty multiplier:
      Correct: High Challenge ×1.05 (cap 0.98), Challenging ×1.02 (cap 0.96), Moderate ×1.01 (cap 0.92)
      Incorrect: High Challenge ×0.90 (floor 0.10), Challenging ×0.80 (floor 0.08), Moderate ×0.70 (floor 0.05)
      - Misconception penalty (if targeted_misconception && !is_correct): −0.05/−0.07/−0.09
      - Explanation alignment (if ai_grading && verdict!="Correct" && explanation): −0.03.
      - Keypoints bonus (if ai_grading && keypoints_hit length ≥2): +0.02.
      - Clamp final item score ∈ [0.05, 0.98].

      2) Competency Mastery
      - For each competency in lesson.curriculum_map.core_competencies:
      MasteryScore = mean of scores from items whose assessed_competencies include that competency name.
      If none: set 0.50 (neutral) and note "not assessed in this exam" for rationale.

      3) Weighted Aggregate (curriculum-aligned)
      - Parse lesson.curriculum_map.competency_weightings ("30%") → 0.30; normalize to sum = 1.
      - PreliminaryAggregate = Σ(MasteryScore * weight) * 100.

      4) Question-Type Adjustment (exam fidelity)
      - For each question_type:
      AvgTypeScore = mean score for that type.
      ExamTypeFrequency = from curriculum_map.question_formats.
      - If AvgTypeScore < 0.40 and ExamTypeFrequency ≥ 30% → −3 to −6 total.
      - If AvgTypeScore ≥ 0.80 and ExamTypeFrequency ≥ 30% → +0 to +2 total.
      - Cap total style modifier to [−8, +4].

      5) Coverage Reliability Adjustment
      - For any competency weight ≥25% and <2 assessed items → −2 each (max −4).
      - If ≥80% of weighted competencies assessed → +1 to +2.
      - Combine with previous modifiers; cap overall to [−8, +4].

      6) Final Prediction
      - PredictedExamScorePercentage = round(PreliminaryAggregate + Modifier), clamped to [0, 100], then "%".
      - Exception: if 0/10 → "Not Calculable".

      [Part 2 — Structured Multi-Signal Planning Pipeline (Internal Only)]
      Before generating suggested_future_sessions_plan and learning_patterns, internally compute planning signals:
      1. priority_competencies = bottom 2–3 competencies by weighted mastery.
      2. misconception_targets = misconceptions recurring across exam or tied to weighted competencies.
      3. exam_format_deficits = question types where AvgTypeScore < 40% AND exam weight ≥ 20%.
      4. trend_direction = {improving, plateauing, declining} based on difficulty × mastery trajectory.

      These signals MUST shape both:
      - suggested_future_sessions_plan  
      - learning_patterns  

      Do not output these internal signals directly; only use them to generate the required JSON fields.

      [Global Output Rules]
      Output ONLY a single JSON object matching the response_json_schema:
      - feedback_session_title: "Exam ${exam.exam_number} Performance & Grade Prediction"
      - predicted_exam_score_percentage: "% string" or "Not Calculable"
      - prediction_calculation_rationale: 1–3 sentences referencing item difficulty, competency weighting, question-type frequency, and coverage limits.
      - overall_performance_summary_text: 1–2 empathetic sentences with a clear next-focus cue.
      - identified_strengths_list: 2–3 specific competency or exam-format strengths.
      - key_areas_for_improvement_list: 2–3 high-impact weaknesses tied to misconceptions.
      - suggested_future_sessions_plan:  
      5 objects with session_number (2..6), session_name, session_focus_description.  
      Each session MUST be directly grounded in at least ONE of the internal planning signals.
      - learning_patterns:  
      3–5 objects with:
      • pattern_type: behavior label  
      • what_it_means: 1 sentence explaining the pattern  
      • how_to_improve: 1 sentence linking to tactics the next sessions/exams will reinforce.   
      - No extra fields. No explanations outside the JSON. All percentages must be strings with "%".

      Output Format: Valid JSON matching the required schema.`;

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
              },
              learning_patterns: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    pattern_type: { type: "string" },
                    what_it_means: { type: "string" },
                    how_to_improve: { type: "string" }
                  }
                },
                minItems: 3,
                maxItems: 5
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

      // Reload lesson data to refresh exams list
      window.dispatchEvent(new Event('reloadLesson'));
      if (onExamComplete) onExamComplete();
      setTimeout(() => {
        window.dispatchEvent(new Event('switchToGradeTab'));
      }, 1000);
    } catch (error) {
      console.error("Error submitting exam:", error);
      await logError('exam_submission', error, { lesson_id: lesson?.id, exam_id: exam?.id });
      alert("Failed to submit exam. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Show exam selection if no exam in progress
  if (!exam && !isGenerating && !selectedExamNumber) {
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
                    // Navigate to grade tab to view feedback
                    window.dispatchEvent(new Event('switchToGradeTab'));
                  } else if (canStart) {
                    setSelectedExamNumber(e.exam_number);
                  }
                }}
                disabled={!canStart && !isCompleted}
                className={`p-3 md:p-5 rounded-xl border-2 transition-all text-left ${
                  isCompleted
                    ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300 hover:shadow-lg'
                    : canStart
                    ? 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300 hover:shadow-lg hover:scale-[1.02]'
                    : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1 md:mb-2">
                  <div className="flex items-center gap-2 md:gap-3">
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
                    <div>
                      <h5 className="font-bold text-slate-900 text-sm md:text-lg">
                        Exam {e.exam_number}
                      </h5>
                      <p className="text-xs md:text-sm text-slate-600 line-clamp-1">
                        {e.focus_description || (e.exam_number === 1 ? 'Diagnostic Assessment' : 'Practice Exam')}
                      </p>
                    </div>
                  </div>
                  {isCompleted && e.predicted_grade && (
                    <Badge className="bg-emerald-600 text-white font-bold text-sm md:text-lg px-2 py-1 md:px-4 md:py-2">
                      {e.predicted_grade}
                    </Badge>
                  )}
                </div>
                {isCompleted && (
                  <p className="text-xs md:text-sm text-emerald-700 font-medium ml-11 md:ml-12">
                    Click to view feedback →
                  </p>
                )}
                {canStart && !isCompleted && (
                  <p className="text-xs md:text-sm text-purple-700 font-medium ml-11 md:ml-12">
                    Click to start exam →
                  </p>
                )}
              </button>
            );
          }) : (
            <button
              onClick={() => setSelectedExamNumber(1)}
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

  if (exam.completed) {
    // Go back to selection view after completion
    setExam(null);
    setSelectedExamNumber(null);
    window.dispatchEvent(new Event('reloadLesson'));
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