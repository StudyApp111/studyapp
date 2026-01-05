import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText, Clock } from "lucide-react";
import EducationalLoader from "../components/ui/EducationalLoader";
import { AnimatePresence, motion } from "framer-motion";
import WorksheetQuestion from "../components/worksheet/WorksheetQuestion";
import ConfettiEffect from "../components/gamification/ConfettiEffect";
import { Sparkles } from "lucide-react";
import { logError } from "@/components/utils/errorLogger";

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

export default function Worksheet() {
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [worksheet, setWorksheet] = useState(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [newBadges, setNewBadges] = React.useState([]);
  const gradingTimeoutRef = useRef(null);
  const [gradingInProgress, setGradingInProgress] = useState({});
  
  // Timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  
  // Question time tracking
  const questionTimesRef = useRef({});
  const currentQuestionStartTimeRef = useRef(null);
  
  // Worksheet ID ref to track which worksheet the timer is running for
  const worksheetIdRef = useRef(null);
  
  // Prevent duplicate generation (similar to ExamTab)
  const generationStartedRef = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');
    
    if (!lessonId) {
      navigate(createPageUrl("Home"));
      return;
    }

    // Guard against duplicate calls
    if (!generationStartedRef.current) {
      generationStartedRef.current = true;
      loadOrGenerateWorksheet(lessonId);
    }
  }, [navigate]);

  // Main timer effect - Only runs when worksheet changes AND is not completed
  useEffect(() => {
    // Start timer only if:
    // 1. Worksheet exists
    // 2. Worksheet is not completed
    // 3. This is a new worksheet (different ID) OR timer hasn't started yet
    if (worksheet && !worksheet.completed && worksheet.id !== worksheetIdRef.current) {
      
      // Store the worksheet ID
      worksheetIdRef.current = worksheet.id;
      
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Initialize start time
      startTimeRef.current = Date.now();
      currentQuestionStartTimeRef.current = Date.now();
      
      // Initialize question times from existing data if any
      if (worksheet.question_time_laps && worksheet.question_time_laps.length > 0) {
        const timesObj = {};
        worksheet.question_time_laps.forEach(lap => {
          timesObj[lap.question_index] = lap.total_seconds;
        });
        questionTimesRef.current = timesObj;
      } else {
        // Initialize all questions to 0
        questionTimesRef.current = {};
        for (let i = 0; i < (worksheet.questions?.length || 10); i++) {
          questionTimesRef.current[i] = 0;
        }
      }
      
      // Start the interval timer
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const now = Date.now();
          const totalElapsed = Math.floor((now - startTimeRef.current) / 1000);
          setElapsedSeconds(totalElapsed);
        }
      }, 1000);

      // Cleanup function - only clears timer when component unmounts or worksheet changes
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [worksheet?.id, worksheet?.completed]); // Only depend on worksheet ID and completion status

  // Record time when question changes
  const recordQuestionTime = (questionIndex) => {
    if (currentQuestionStartTimeRef.current) {
      const now = Date.now();
      const timeSpentOnQuestion = Math.floor((now - currentQuestionStartTimeRef.current) / 1000);
      
      // Add time to this question's total
      questionTimesRef.current[questionIndex] = (questionTimesRef.current[questionIndex] || 0) + timeSpentOnQuestion;
    }
  };

  const loadOrGenerateWorksheet = async (lessonId) => {
    setIsGenerating(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const worksheetNum = parseInt(urlParams.get('worksheet')) || 1;
      
      const lessonData = await base44.entities.Lesson.filter({ id: lessonId });
      if (lessonData.length === 0) {
        navigate(createPageUrl("Home"));
        return;
      }
      setLesson(lessonData[0]);

      // No longer requiring diagnostic quiz - worksheets work directly from lesson content
      let quizData = null;
      const existingQuiz = await base44.entities.DiagnosticQuiz.filter({ lesson_id: lessonId });
      if (existingQuiz.length > 0) {
        setQuiz(existingQuiz[0]);
        quizData = existingQuiz[0];
      }

      const existingWorksheet = await base44.entities.Worksheet.filter({ 
        lesson_id: lessonId,
        worksheet_number: worksheetNum
      });

      if (existingWorksheet.length > 0) {

        const loadedWorksheet = existingWorksheet[0];
        
        if (loadedWorksheet.completed) {
          navigate(createPageUrl("Feedback") + `?lessonId=${lessonId}&worksheet=${worksheetNum}`);
          return;
        }
        
        if (!loadedWorksheet.questions || loadedWorksheet.questions.length === 0) {

          await generateWorksheet(lessonId, lessonData[0], quizData, worksheetNum, loadedWorksheet.id);
        } else {
          setWorksheet(loadedWorksheet);
        }
      } else {

        await generateWorksheet(lessonId, lessonData[0], quizData, worksheetNum);
      }
    } catch (error) {
      console.error("Error loading or generating worksheet:", error);
      
      // Log error to database
      try {
        const user = await base44.auth.me();
        await base44.entities.ErrorLog.create({
          error_type: "worksheet_load",
          error_message: error.message || String(error),
          error_stack: error.stack || "",
          context: {
            lesson_id: lessonId,
            error_details: error.response?.data || {}
          },
          user_email: user.email
        });
      } catch (logError) {
        console.error("Failed to log error:", logError);
      }
      
      alert("Failed to load or generate worksheet. Please try again. Error: " + error.message);
      navigate(createPageUrl("Home"));
    }
    setIsGenerating(false);
  };

  const generateWorksheet = async (lessonId, lessonData, quizData, worksheetNum, existingWorksheetId = null) => {
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });

      const learningProfile = profile[0] || {};

      let contentDescription = "";
      if (lessonData.input_type === "description" && lessonData.description) {
        contentDescription = lessonData.description;
      } else if (lessonData.input_type === "url" && lessonData.extracted_content) {
        contentDescription = lessonData.extracted_content;
      } else if (lessonData.input_type === "file" && lessonData.extracted_content) {
        contentDescription = lessonData.extracted_content;
      } else {
        contentDescription = lessonData.description || "N/A";
      }

      let aiPrompt = "";

      if (worksheetNum === 1) {
        // Worksheet 1 now uses lesson content directly without diagnostic quiz
        aiPrompt = `Context
You are an expert assessment designer. Generate a 10-question predictive worksheet for ${lessonData.course_name} that both reflects authentic exam standards and establishes an accurate learning baseline.

This worksheet must stand alone.
Do NOT rely on prior diagnostics.
Ground content in the student’s materials and light web search when needed.

────────────────────────────────

[Input Context]

Student Grade Level: ${learningProfile.grade || "N/A"}
Course / Unit Name: ${lessonData.course_name}
School: ${learningProfile.school || "N/A"}

Lesson Content (notes, uploaded material, or student description):
${contentDescription}

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
- Q1–3: Moderate Exam-Level
- Q4–7: Challenging Exam-Level
- Q8–10: Challenging → High Challenge (depth, edge cases, reasoning—not new topics)

4. Coverage Design
- 6–7 questions: core skill / primary topic
- 2–3 questions: applications, traps, or conceptual stress tests
- 1–2 twin items: same concept, different reasoning demand

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
   - Structured Response

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

Short Answer / Structured Response:
- options = []
- Direct prompt requesting a value, explanation, justification, or worked solution.

MCQ cue phrases are FORBIDDEN in non-MCQ questions:
“Which of the following”, “Select”, “Identify the correct”, “Choose”, “is/are true about”

If a forbidden cue appears, IMMEDIATELY convert the question to Multiple Choice and regenerate.

This layer overrides all other instructions.

────────────────────────────────

Worksheet Generation (Output Only)

Generate EXACTLY 10 questions.

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
- Mathematics / Sciences: multi-step reasoning, application, interpretation, unit checks
- Humanities / Social Sciences: argument alignment, evidence interpretation, conceptual precision
- Computer Science / Engineering: tracing, correctness, edge cases, applied logic
- Business / Economics: method selection, case reasoning, quantitative interpretation

────────────────────────────────

[Answer Key Requirements]

For EACH question include:
- correct_answer
- explanation (2–3 sentences; instructional and corrective)
- assessed_competencies
- targeted_misconception (or null if none)

Explanations should teach the *reason* behind the answer and how to avoid common mistakes.

────────────────────────────────

Output Format:
Provide your response as a single, valid JSON object with the structure specified.`;
      } else {
        const prevWorksheets = await base44.entities.Worksheet.filter({ 
          lesson_id: lessonId,
          completed: true
        });
        
        if (prevWorksheets.length === 0) {
          throw new Error("No previous worksheet found. Cannot generate adaptive worksheet.");
        }

        const latestWorksheet = prevWorksheets.sort((a, b) => b.worksheet_number - a.worksheet_number)[0];
        
        const previousWorksheetPerformance = latestWorksheet.questions.map(q => ({
          question_number: q.question_number,
          question_type: q.question_type,
          difficulty_index: q.difficulty_index,
          question_text: q.question_text,
          options: q.options || [],
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          assessed_competencies: q.assessed_competencies,
          targeted_misconception: q.targeted_misconception,
          student_answer: q.user_answer || "No answer provided",
          is_correct: q.is_correct || false
        }));

        const cumulativePerformance = {
          worksheet_number: latestWorksheet.worksheet_number,
          predicted_grade: latestWorksheet.predicted_grade,
          total_score: latestWorksheet.total_score,
          strengths: latestWorksheet.ai_feedback?.identified_strengths_list || [],
          weaknesses: latestWorksheet.ai_feedback?.key_areas_for_improvement_list || []
        };

        const suggestedFutureSessions = latestWorksheet.ai_feedback?.suggested_future_sessions_plan || [];
        const learningPatterns = latestWorksheet.ai_feedback?.learning_patterns || [];

        let currentWorksheetDescription = `Worksheet ${worksheetNum}: Continue building toward 90%+ mastery`;
        if (existingWorksheetId) {
          const placeholderData = await base44.entities.Worksheet.filter({ id: existingWorksheetId });
          if (placeholderData.length > 0 && placeholderData[0].focus_description) {
            currentWorksheetDescription = placeholderData[0].focus_description;
          }
        }

        aiPrompt = `Context
You are an expert assessment designer generating the next 10-question adaptive worksheet for ${lessonData.course_name}.
This worksheet should build on prior guidance and focus on the most important skills for this student right now.

────────────────────────────────

Input Context

Student Grade Level: ${learningProfile.grade || "N/A"}
Course / Unit Name: ${lessonData.course_name}
Current Iteration: ${currentWorksheetDescription}

Lesson Content (notes, uploaded material, or student description):
${contentDescription}

Suggested Focus Areas (from prior session):
${JSON.stringify(suggestedFutureSessions || [], null, 2)}

────────────────────────────────

Internal Design Rules (Do NOT Output)

1. Scope Control
- If lesson content specifies a narrow topic or skill, generate ALL questions from that topic only.
- Do NOT introduce adjacent or prerequisite topics unless strictly required.
- Only broaden scope if the user explicitly requests review or exam prep.

2. Question Allocation
- 6–7 questions on the primary focus areas.
- 2–3 questions on application, edge cases, or exam-style traps.
- 1–2 “twin” questions testing the same concept with different reasoning demands.

3. Difficulty Progression
- Start with Moderate Exam-Level.
- Progress to Challenging, then High Challenge by reasoning depth (not topic expansion).

────────────────────────────────

QUESTION-TYPE ENFORCEMENT (MUST EXECUTE FIRST)

For EACH question:

Choose question_type from:
- Multiple Choice
- True/False
- Fill in the Blank
- Short Answer
- Structured Response

Apply strict rules:

Multiple Choice:
- EXACTLY four options labeled A, B, C, D.
- MCQ cue phrases ARE allowed.

True/False:
- options MUST be ["True", "False"] only.
- Stem must be a single declarative statement.

Fill in the Blank:
- options MUST be [].
- Include exactly ONE blank written as ____.

Short Answer / Structured Response:
- options MUST be [].
- Stem must directly request a value, explanation, or worked solution.

MCQ cue phrases are FORBIDDEN in non-MCQ questions:
Which of the following, Select, Choose, Identify the correct, is/are true about

If an MCQ cue appears in a non-MCQ question,
you MUST convert it to Multiple Choice and regenerate.

This rule overrides all other instructions.

────────────────────────────────

Worksheet Generation (Output Only)

Generate EXACTLY 10 questions.

Each question MUST include:
- question_number
- question_type
- question_text (plain text)
- options (A–D for MCQ, otherwise [])
- difficulty_index:
  - Moderate Exam-Level
  - Challenging Exam-Level
  - High Challenge Exam-Level

Subject Guidance:
- Math / Science: multi-step reasoning, application, interpretation, unit checks
- Humanities / Social Sciences: argument alignment, evidence use, conceptual precision
- CS / Engineering: tracing, correctness, edge cases, applied logic
- Business / Economics: method selection, case reasoning, quantitative interpretation

Each question must test a distinct concept or reasoning demand.

────────────────────────────────

Answer Key (Output Only)

For EACH question include:
- correct_answer
- explanation (2–3 sentences; instructional and corrective)
- assessed_competencies (short inferred labels)
- targeted_misconception (or null)

Explanations should teach why the answer is correct and how to avoid common mistakes.

────────────────────────────────

Output Format
Return a single valid JSON object matching the expected schema.

Output Format: Valid JSON object matching the schema.`;
      }

      const { data: worksheetData } = await retryOperation(
        () => base44.functions.invoke('generateWorksheet', {
          prompt: aiPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              worksheet_title: { type: "string" },
              analysis_summary_for_worksheet_design: {
                type: "object",
                properties: {
                  targeted_weak_competencies: { type: "array", items: { type: "string" } },
                  key_gaps_or_misconceptions_addressed: { type: "array", items: { type: "string" } },
                  focused_differentiating_competencies: { type: "array", items: { type: "string" } }
                },
                required: ["targeted_weak_competencies", "key_gaps_or_misconceptions_addressed", "focused_differentiating_competencies"]
              },
              worksheet_questions: {
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
                  },
                  required: ["question_number", "question_type", "difficulty_index", "question_text", "correct_answer", "explanation", "assessed_competencies", "targeted_misconception"]
                }
              }
            },
            required: ["worksheet_title", "analysis_summary_for_worksheet_design", "worksheet_questions"]
          }
        }),
        3,
        2000
      );



      if (!worksheetData || !worksheetData.worksheet_questions || worksheetData.worksheet_questions.length === 0) {
        throw new Error("Invalid worksheet data received from AI");
      }

      const questionsWithPlaceholder = worksheetData.worksheet_questions.map(q => ({
        ...q,
        user_answer: ""
      }));

      let updatedWorksheet;
      
      if (existingWorksheetId) {
        updatedWorksheet = await base44.entities.Worksheet.update(existingWorksheetId, {
          questions: questionsWithPlaceholder,
          analysis_summary: worksheetData.analysis_summary_for_worksheet_design,
          status: "in_progress"
        });
      } else {
        updatedWorksheet = await base44.entities.Worksheet.create({
          lesson_id: lessonId,
          worksheet_number: worksheetNum,
          diagnostic_quiz_id: quizData?.id || undefined,
          questions: questionsWithPlaceholder,
          analysis_summary: worksheetData.analysis_summary_for_worksheet_design,
          status: "in_progress",
          completed: false,
          time_taken_seconds: 0,
          question_time_laps: []
        });
      }

      setWorksheet(updatedWorksheet);
    } catch (error) {
      console.error("Error generating worksheet:", error);
      generationStartedRef.current = false; // Allow retry on error
      
      // Log error to database
      try {
        const user = await base44.auth.me();
        await base44.entities.ErrorLog.create({
          error_type: "worksheet_generation",
          error_message: error.message || String(error),
          error_stack: error.stack || "",
          context: {
            lesson_id: lessonId,
            course_name: lessonData?.course_name,
            worksheet_number: worksheetNum,
            error_details: error.response?.data || {}
          },
          user_email: user.email
        });
      } catch (logError) {
        console.error("Failed to log error:", logError);
      }
      
      alert("Failed to generate worksheet. Please try again. Error: " + error.message);
      navigate(createPageUrl("Home"));
    }
  };

  const isSubjectiveQuestion = (questionType) => {
    const type = questionType.toLowerCase();
    return type.includes("short answer") || 
           type.includes("long answer") || 
           type.includes("fill-in-the-blank") ||
           type.includes("problem-solving") ||
           type.includes("multi-step");
  };

  const gradeSubjectiveQuestion = async (question, questionIndex) => {
    if (!question.user_answer || question.user_answer.trim() === "") {
      return;
    }

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

      const updatedQuestions = [...worksheet.questions];
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
      
      if (JSON.stringify(worksheet.questions) !== JSON.stringify(updatedQuestions)) {
        await base44.entities.Worksheet.update(worksheet.id, {
          questions: updatedQuestions
        });
      }

      setWorksheet(prev => ({
        ...prev,
        questions: updatedQuestions
      }));

      setGradingInProgress(prev => ({ ...prev, [questionIndex]: false }));
    } catch (error) {
      console.error("Error grading question:", error);
      setGradingInProgress(prev => ({ ...prev, [questionIndex]: false }));
      const updatedQuestions = [...worksheet.questions];
      if (updatedQuestions[questionIndex]) {
        updatedQuestions[questionIndex].ai_grading_pending = false;
        setWorksheet(prev => ({
          ...prev,
          questions: updatedQuestions
        }));
      }
    }
  };

  const handleAnswer = (answer) => {
    const updatedQuestions = [...worksheet.questions];
    updatedQuestions[currentQuestion].user_answer = answer;
    
    // Update worksheet state WITHOUT triggering timer reset
    setWorksheet(prev => ({
      ...prev,
      questions: updatedQuestions
    }));

    if (gradingTimeoutRef.current) {
      clearTimeout(gradingTimeoutRef.current);
    }

    if (isSubjectiveQuestion(updatedQuestions[currentQuestion].question_type)) {
      updatedQuestions[currentQuestion].ai_grading_pending = true;
      setWorksheet(prev => ({
        ...prev,
        questions: updatedQuestions
      }));
      
      gradingTimeoutRef.current = setTimeout(() => {
        gradeSubjectiveQuestion(updatedQuestions[currentQuestion], currentQuestion);
      }, 2000);
    }
  };

  const handleNext = () => {
    setShowConfetti(true);
    
    // Record time for current question before moving
    recordQuestionTime(currentQuestion);
    
    if (currentQuestion < worksheet.questions.length - 1) {
      if (gradingTimeoutRef.current) {
        clearTimeout(gradingTimeoutRef.current);
        const currentQ = worksheet.questions[currentQuestion];
        if (isSubjectiveQuestion(currentQ.question_type) && currentQ.user_answer) {
          gradeSubjectiveQuestion(currentQ, currentQuestion);
        }
      }
      
      // Reset timer for next question
      currentQuestionStartTimeRef.current = Date.now();
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      // Record time for current question before going back
      recordQuestionTime(currentQuestion);
      
      // Reset timer for previous question
      currentQuestionStartTimeRef.current = Date.now();
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const submitWorksheet = async () => {
    try { window.__appStep = 'worksheet_submit_start'; } catch {}
    setIsSubmitting(true);
    setIsGrading(false);
    console.log('[SUBMIT] Starting worksheet submission...');

    // Record final question time
    recordQuestionTime(currentQuestion);

    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Convert question times to laps format
    const questionTimeLaps = Object.keys(questionTimesRef.current).map(key => ({
      question_index: parseInt(key),
      total_seconds: questionTimesRef.current[key]
    }));

    try {
      const user = await base44.auth.me();
      console.log('[SUBMIT] User authenticated:', user.email);

      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });
      const learningProfile = profile[0] || {};
      console.log('[SUBMIT] Learning profile loaded:', learningProfile);

      const questionsWithGrading = worksheet.questions.map((q) => {
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
          } else {
            return {
              ...q,
              is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
            };
          }
        }

        return {
          ...q,
          is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
        };
      });

      console.log('[SUBMIT] Questions graded. Total:', questionsWithGrading.length);

      let contentDescription = "";
      if (lesson.input_type === "description" && lesson.description) {
        contentDescription = lesson.description;
      } else if (lesson.input_type === "url" && lesson.extracted_content) {
        contentDescription = lesson.extracted_content;
      } else if (lesson.input_type === "file" && lesson.extracted_content) {
        contentDescription = lesson.extracted_content;
      } else {
        contentDescription = lesson.description || "N/A";
      }

      const worksheetPerformanceData = questionsWithGrading.map((q, idx) => ({
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

      console.log('[SUBMIT] Worksheet performance data prepared:', worksheetPerformanceData.length, 'questions');

      const feedbackPrompt = `You are an expert educator and assessment analyst for ${lesson.course_name} at ${learningProfile.school || "the school"}
(grade: ${learningProfile.grade || "N/A"}, region: ${learningProfile.city || "N/A"}).

Goal: Predict what this student would likely score on their real course exam/assessment, graded by their teacher/school norms (not overly harsh, not overly generous).
Use ONLY the curriculum map + the student’s 10-question worksheet performance. Keep reasoning internal.
Output ONLY valid JSON that matches response_json_schema (and only the fields listed below).

Input Data:
Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lesson.course_name}
Worksheet Number: ${worksheet.worksheet_number} of 6

Curriculum Profile:
${JSON.stringify(lesson.curriculum_map, null, 2)}

Worksheet Performance:
${JSON.stringify(worksheetPerformanceData, null, 2)}

[Assumptions & Fields]
Each worksheet item may include:
question_number, question_type, difficulty_index, question_text,
options, student_answer, correct_answer, explanation,
assessed_competencies[] (names), targeted_misconception (string),
is_correct (boolean),
ai_grading { score_out_of_10, verdict, rationale, keypoints_hit[], keypoints_missed[] }.
Ignore missing fields; do not invent values.

────────────────────────────────
INTERNAL SCORING LOGIC (DO NOT OUTPUT)

Edge Handling (must be deterministic)
- If correct_count = 0/10 → predicted_exam_score_percentage = "Not Calculable" (insufficient baseline); still produce strengths/weaknesses + plan.
- If correct_count = 10/10 → still compute; cap realism at 95–100 unless evidence suggests weaker explanations/partial-credit patterns.

1) Item Mastery Score (bounded, teacher-realistic)
For each item, compute mastery ∈ [0.05, 0.98] using:
- correctness (primary)
- partial credit if ai_grading exists (strong secondary)
- difficulty_index (harder correct = higher mastery; harder wrong = lower mastery)
- misconception penalty if targeted_misconception present and wrong
- explanation quality signal: if ai_grading verdict ≠ "Correct" OR keypoints_missed non-empty → reduce mastery slightly
Do NOT over-reward lucky correctness: if correct but ai_grading shows weak rationale/low score, keep mastery moderate.

2) Competency Mastery
For each curriculum competency:
- mastery = mean(item mastery for items tagged with that competency)
- if competency unassessed → set 0.50 and mark as low-evidence internally

3) Weighted Aggregate (curriculum-aligned)
- Parse curriculum competency weightings (normalize to sum=1)
- Preliminary = Σ(competency_mastery × weight) × 100

4) Exam-Format Realism Modifier (bounded)
Apply a single bounded modifier in [-8, +4] based on:
- Format mismatch risk: weak performance on high-frequency exam formats (from curriculum_map.question_formats)
- Coverage risk: any competency weight ≥25% with <2 assessed items → reliability penalty
- Consistency: large gap between correctness and ai_grading partial credit/explanations → reduce optimism
Purpose: keep predictions teacher-realistic given only 10 items.

5) Final Prediction
- If not edge case: predicted = round(clamp(Preliminary + Modifier, 0, 100)) + "%"
- Ensure the prediction reflects school-style grading realism (avoid systematic inflation).

────────────────────────────────
PLANNING (DO NOT OUTPUT INTERNAL SIGNALS)
Derive 5 sessions that directly target:
- the bottom 2–3 weighted competencies
- recurring misconceptions (or most damaging misconceptions)
- high-frequency exam formats where the student underperformed
Each session must specify a concrete practice focus (what to drill + what to change).

────────────────────────────────
OUTPUT RULES (STRICT)
Return ONE JSON object with EXACTLY these fields (and no others):

- feedback_session_title: "Worksheet ${worksheet.worksheet_number} Performance & Grade Prediction"
- predicted_exam_score_percentage: string with "%" OR "Not Calculable"
- overall_performance_summary_text: 1–2 sentences (empathetic, teacher-like, clear next focus)
- identified_strengths_list: 2–3 items grounded in observed evidence (competency or format)
- key_areas_for_improvement_list: 2–3 items grounded in observed evidence (competency/misconception/format)
- suggested_future_sessions_plan: 5 objects:
    session_number: ${worksheet.worksheet_number + 1} ... ${worksheet.worksheet_number + 5}
    session_name: short, specific
    session_focus_description: 1–2 sentences describing what to practice, what to fix, and what “good” looks like

No extra fields. No prose outside JSON. All percentages must be strings.
Output Format: Valid JSON matching the required schema.`;

    console.log('[SUBMIT] Prompt length:', feedbackPrompt.length, 'characters');
    console.log('[SUBMIT] Calling feedbackGrade function...');

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
                },
                required: ["session_number", "session_name", "session_focus_description"]
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
                },
                required: ["pattern_type", "what_it_means", "how_to_improve"]
              },
              minItems: 3,
              maxItems: 5
            }
          },
          required: ["feedback_session_title", "predicted_exam_score_percentage", "prediction_calculation_rationale", "overall_performance_summary_text", "identified_strengths_list", "key_areas_for_improvement_list", "suggested_future_sessions_plan", "learning_patterns"]
        }
        })
        );

        console.log('[SUBMIT] Feedback data received:', feedbackData ? 'SUCCESS' : 'NULL');
        if (feedbackData) {
        console.log('[SUBMIT] Feedback keys:', Object.keys(feedbackData));
        }

        const questionFeedback = questionsWithGrading.map((q, idx) => {
        let feedback = "";
        let pointsEarned = 0;
        
        if (isSubjectiveQuestion(q.question_type) && q.ai_score_out_of_10 !== undefined) {
          feedback = q.ai_rationale_short || "Your answer shows understanding.";
          pointsEarned = q.ai_score_out_of_10;
        } else {
          if (q.is_correct) {
            feedback = `Excellent! Your answer demonstrates strong understanding of ${q.assessed_competencies?.[0] || 'this concept'}.`;
            pointsEarned = 10;
          } else {
            feedback = `This question assessed ${q.assessed_competencies?.[0] || 'key concepts'}. Review the explanation provided to strengthen your understanding.`;
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

      // Save worksheet with timer data and question laps
      console.log('[SUBMIT] Attempting to save worksheet:', {
        worksheetId: worksheet.id,
        questionCount: questionsWithGrading.length,
        score: scoreNum,
        grade: letterGrade,
        elapsedSeconds
      });

      try {
        await retryOperation(() => 
          base44.entities.Worksheet.update(worksheet.id, {
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
          console.log('[SUBMIT] Worksheet saved successfully');
      } catch (worksheetUpdateError) {
        console.error('[SUBMIT ERROR] Failed to update worksheet:', worksheetUpdateError);

        // Log to ErrorLog entity
        await base44.entities.ErrorLog.create({
          error_type: "worksheet_submission",
          error_message: worksheetUpdateError.message || String(worksheetUpdateError),
          error_stack: worksheetUpdateError.stack || "",
          context: {
            worksheet_id: worksheet.id,
            lesson_id: lesson.id,
            course_name: lesson.course_name,
            worksheet_number: worksheet.worksheet_number,
            question_count: questionsWithGrading.length,
            score: scoreNum
          },
          user_email: user.email
        });
        
        throw worksheetUpdateError;
      }

      if (worksheet.worksheet_number === 1 && feedbackData.suggested_future_sessions_plan) {
        await Promise.all(
          feedbackData.suggested_future_sessions_plan.map((session, idx) =>
            base44.entities.Worksheet.create({
              lesson_id: lesson.id,
              worksheet_number: idx + 2,
              focus_description: session.session_focus_description,
              status: "not_started",
              completed: false,
              questions: [],
              feedback: [],
              time_taken_seconds: 0,
              question_time_laps: []
            })
          )
        );
      }

      await retryOperation(() => 
        base44.entities.Lesson.update(lesson.id, {
          status: "worksheet_completed"
        })
      );

      const correctCount = questionsWithGrading.filter(q => q.is_correct).length;
      let pointsEarned = 50;
      
      questionsWithGrading.forEach(q => {
        if (isSubjectiveQuestion(q.question_type) && q.ai_score_out_of_10 !== undefined) {
          pointsEarned += Math.round(q.ai_score_out_of_10 * 2.5);
        } else if (q.is_correct) {
          const difficultyMultiplier = {
            "Foundational": 5,
            "Conceptual": 10,
            "Moderate Exam-Level": 15,
            "Challenging Exam-Level": 20,
            "High Challenge Exam-Level": 25
          }[q.difficulty_index] || 10;
          pointsEarned += difficultyMultiplier;
        }
      });

      if (correctCount === questionsWithGrading.length) {
        pointsEarned += 100;
      }

      if (letterGrade.startsWith('A')) {
        pointsEarned += 50;
      }

      const today = new Date().toDateString();
      const lastActivity = user.last_activity_date ? new Date(user.last_activity_date).toDateString() : null;
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      let newStreak = user.current_streak || 0;
      if (lastActivity === yesterday) {
        newStreak += 1;
      } else if (lastActivity !== today) {
        newStreak = 1;
      }
      if (!lastActivity) {
          newStreak = 1;
      }

      const longestStreak = Math.max(newStreak, user.longest_streak || 0);

      const earnedBadges = [...(user.badges || [])];
      const badgeIds = earnedBadges.map(b => b.badge_id);
      const earnedNow = [];

      if (!badgeIds.includes('first_lesson') && worksheet.worksheet_number === 1) {
        earnedBadges.push({
          badge_id: 'first_lesson',
          badge_name: 'First Steps',
          badge_description: 'Completed your first worksheet!',
          badge_icon: '📚',
          earned_date: new Date().toISOString()
        });
        earnedNow.push(earnedBadges[earnedBadges.length - 1]);
      }

      if (!badgeIds.includes('perfect_score') && correctCount === questionsWithGrading.length) {
        earnedBadges.push({
          badge_id: 'perfect_score',
          badge_name: 'Perfect Score',
          badge_description: 'Got 100% on a worksheet!',
          badge_icon: '🏆',
          earned_date: new Date().toISOString()
        });
        earnedNow.push(earnedBadges[earnedBadges.length - 1]);
      }

      if (!badgeIds.includes('grade_a') && letterGrade === 'A+') {
        earnedBadges.push({
          badge_id: 'grade_a',
          badge_name: 'Excellence',
          badge_description: 'Achieved an A+ grade!',
          badge_icon: '🌟',
          earned_date: new Date().toISOString()
        });
        earnedNow.push(earnedBadges[earnedBadges.length - 1]);
      }

      if (!badgeIds.includes('seven_day_streak') && newStreak >= 7) {
        earnedBadges.push({
          badge_id: 'seven_day_streak',
          badge_name: 'Week Warrior',
          badge_description: '7-day study streak!',
          badge_icon: '🔥',
          earned_date: new Date().toISOString()
        });
        earnedNow.push(earnedBadges[earnedBadges.length - 1]);
      }

      if (!badgeIds.includes('thirty_day_streak') && newStreak >= 30) {
        earnedBadges.push({
          badge_id: 'thirty_day_streak',
          badge_name: 'Month Master',
          badge_description: '30-day study streak!',
          badge_icon: '🔥',
          earned_date: new Date().toISOString()
        });
        earnedNow.push(earnedBadges[earnedBadges.length - 1]);
      }

      const allCompletedWorksheets = await base44.entities.Worksheet.filter({ completed: true, lesson_id: lesson.id });
      if (!badgeIds.includes('five_worksheets') && allCompletedWorksheets.length >= 5) {
        earnedBadges.push({
          badge_id: 'five_worksheets',
          badge_name: 'Dedicated Learner',
          badge_description: 'Completed 5 worksheets in a lesson!',
          badge_icon: '🎯',
          earned_date: new Date().toISOString()
        });
        earnedNow.push(earnedBadges[earnedBadges.length - 1]);
      }

      if (!badgeIds.includes('ten_worksheets') && allCompletedWorksheets.length >= 10) {
        earnedBadges.push({
          badge_id: 'ten_worksheets',
          badge_name: 'Knowledge Seeker',
          badge_description: 'Completed 10 worksheets in a lesson!',
          badge_icon: '⭐',
          earned_date: new Date().toISOString()
        });
        earnedNow.push(earnedBadges[earnedBadges.length - 1]);
      }

      const newTotalPoints = (user.total_points || 0) + pointsEarned;
      const newLevel = Math.floor(newTotalPoints / 100) + 1;

      const totalQuizzes = (user.total_quizzes_taken || 0) + 1;
      const currentAvg = user.average_score || 0;
      const newAvg = isNaN(scoreNum) ? currentAvg : ((currentAvg * (totalQuizzes - 1)) + scoreNum) / totalQuizzes;

      await retryOperation(() => 
        base44.auth.updateMe({
          total_quizzes_taken: totalQuizzes,
          average_score: Math.round(newAvg),
          questions_completed: (user.questions_completed || 0) + questionsWithGrading.length,
          time_spent_seconds: (user.time_spent_seconds || 0) + elapsedSeconds,
          total_points: newTotalPoints,
          level: newLevel,
          badges: earnedBadges,
          current_streak: newStreak,
          longest_streak: longestStreak,
          last_activity_date: today
        })
      );

      if (earnedNow.length > 0 || correctCount >= (questionsWithGrading.length * 0.8)) {
        setShowConfetti(true);
        setNewBadges(earnedNow);
      }

      setTimeout(() => {
        navigate(createPageUrl("Feedback") + `?lessonId=${lesson.id}&worksheet=${worksheet.worksheet_number}`);
      }, earnedNow.length > 0 ? 2000 : 500);
    } catch (error) {
      console.error('[SUBMIT ERROR] Error submitting worksheet:', error);

      // Extract detailed error message
      const errorDetails = error.response?.data?.error || error.response?.data?.message || error.message || String(error);
      const fullError = error.response?.data || error;

      console.error('[SUBMIT ERROR] Full error object:', JSON.stringify(fullError, null, 2));
      console.error('[SUBMIT ERROR] Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        stack: error.stack
      });

      // Send to centralized logger (emails support automatically)
      try {
        await logError('worksheet_submission', error, {
          lesson_id: lesson?.id,
          worksheet_id: worksheet?.id,
          worksheet_number: worksheet?.worksheet_number,
        });
      } catch {}

      const errorMessage = `Failed to submit worksheet: ${errorDetails}`;
      alert(errorMessage);

      // Return to last question
      setIsSubmitting(false);
      setIsGrading(false);
      setCurrentQuestion(worksheet.questions.length - 1);
    }
  };

  if (isGenerating) {
    return (
      <EducationalLoader
        title={worksheet ? "Loading Your Worksheet" : "Generating Your Worksheet"}
        description={worksheet 
          ? `Retrieving your saved Worksheet ${worksheet.worksheet_number || ''}...`
          : "Creating personalized questions based on your content..."}
        grade={lesson?.grade}
      />
    );
  }

    if (isGrading) {
      return (
        <EducationalLoader
          title="Predicting Your Grade"
          description="Our AI is analyzing your answers and predicting your exam performance..."
          grade={lesson?.grade}
        />
      );
    }

    if (!worksheet || !lesson) return null;

  const progress = ((currentQuestion + 1) / worksheet.questions.length) * 100;
  const isLastQuestion = currentQuestion === worksheet.questions.length - 1;
  const currentQ = worksheet.questions[currentQuestion];
  const canProceed = currentQ.user_answer?.trim() !== "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 pb-24 md:pb-6">
      <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      {newBadges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl p-4 md:p-6 max-w-md mx-4"
        >
          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />
            <h3 className="text-lg md:text-xl font-bold text-slate-900">New Badge{newBadges.length > 1 ? 's' : ''} Earned!</h3>
          </div>
          <div className="space-y-2">
            {newBadges.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-purple-50 rounded-lg">
                <span className="text-xl md:text-2xl">{badge.badge_icon}</span>
                <div>
                  <p className="font-semibold text-sm md:text-base text-slate-900">{badge.badge_name}</p>
                  <p className="text-xs md:text-sm text-slate-600">{badge.badge_description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-purple-200/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base md:text-xl font-bold text-slate-900 truncate">
              {lesson.course_name} - Worksheet {worksheet?.worksheet_number || 1}
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200">
                <Clock className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-700">{formatTime(elapsedSeconds)}</span>
              </div>
              <span className="text-xs md:text-sm font-medium text-slate-600 whitespace-nowrap">
                {currentQuestion + 1}/{worksheet.questions.length}
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-1.5 md:h-2" />

        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 md:py-6 pb-24 md:pb-6">
        <AnimatePresence mode="wait">
          <WorksheetQuestion
            key={currentQuestion}
            question={currentQ}
            answer={currentQ.user_answer}
            onAnswer={handleAnswer}
          />
        </AnimatePresence>

        <div className="mt-6">
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              size="lg"
              className="flex-1 min-h-[52px] md:min-h-[44px] text-base font-semibold touch-manipulation active:scale-95 transition-transform"
            >
              Previous
            </Button>
            {isLastQuestion ? (
              <Button
                onClick={submitWorksheet}
                disabled={!canProceed || isSubmitting}
                size="lg"
                className="flex-1 min-h-[52px] md:min-h-[44px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-base font-semibold touch-manipulation active:scale-95 transition-transform"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    <span className="hidden sm:inline">Submitting...</span>
                    <span className="sm:hidden">Submit</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Submit Worksheet</span>
                    <span className="sm:hidden">Submit</span>
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed}
                size="lg"
                className="flex-1 min-h-[52px] md:min-h-[44px] bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-base font-semibold touch-manipulation active:scale-95 transition-transform"
              >
                <span className="hidden sm:inline">Next Question</span>
                <span className="sm:hidden">Next</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}