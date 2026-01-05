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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');
    
    if (!lessonId) {
      navigate(createPageUrl("Home"));
      return;
    }

    loadOrGenerateWorksheet(lessonId);
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
You are a master assessment designer creating the next 10-question adaptive worksheet for ${lessonData.course_name}. This worksheet must evolve from ALL prior data: previous worksheet performance, cumulative performance trends, curriculum weightings, high-yield competencies, and the suggested_future_sessions_plan + learning_patterns generated during the last prediction cycle.

Input Educational Context
Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lessonData.course_name}
Current Iteration: ${currentWorksheetDescription}

Detailed Curriculum Profile:
${JSON.stringify(lessonData.curriculum_map, null, 2)}

Content Source:
${contentDescription}

Previous Worksheet Performance:
${JSON.stringify(previousWorksheetPerformance, null, 2)}

Cumulative Performance:
${JSON.stringify(cumulativePerformance, null, 2)}

Suggested Future Sessions (from predictor):
${JSON.stringify(suggestedFutureSessions || [], null, 2)}

Learning Patterns (from predictor):
${JSON.stringify(learningPatterns || [], null, 2)}

------------------------------------------------------------
INTERNAL PROCESSING (Do Not Output)
------------------------------------------------------------

Using the inputs above, internally compute the following adaptation signals:

1. priority_competencies
   - Extract the lowest-performing competencies across previous worksheets.
   - Weight deficiencies using curriculum_map.competency_weightings.
   - Select the bottom 2–3 competencies as primary targets.

2. misconception_targets
   - Identify any misconceptions that appeared more than once (worksheet-based).
   - Map these to specific curriculum concepts and integrate them into new items.

3. exam_format_deficits
   - For each question_type in curriculum_map.question_formats:
       If (AvgScore(previousWorksheetPerformance for that type) < 40%)
       AND (Exam weight for that type ≥ 20%)
       → include at least 2 questions of this type.

4. performance_trend_direction
   - Compare difficulty-adjusted performance across worksheets:
       Improving, Plateauing, or Declining.
   - If improving → increase difficulty.
   - If plateauing → mix procedural + conceptual twins.
   - If declining → scaffold early questions before raising difficulty.

5. learning_behavior_signals
   - Derived from learningPatterns array:
       Examples: “Formula-first solving”, “Low-confidence but correct”, “Pattern-matching under time”.
   - Integrate these behaviors into question design:
       • If overconfidence-like patterns → include justification steps.
       • If low-confidence patterns → include early confidence-building items.
       • If method-bias patterns → force alternate reasoning forms.

------------------------------------------------------------
TASK 1 – Internal Design (Do Not Output)
------------------------------------------------------------

Use the adaptation signals above to determine:

• Difficulty progression  
  - If student is strong (≥80% last worksheet): bias toward Challenging → High Challenge.
  - If mixed (50–79%): Moderate → Challenging → High Challenge.
  - If struggling (<50%): scaffold Moderate → Moderate → Challenging.

• Allocation of 10 questions  
  - 5–6 targeting priority_competencies and misconception_targets.
  - 2–3 targeting exam_format_deficits.
  - 1–2 “twin calibration items” (conceptual vs procedural or recognition vs application).
  
• Style and authenticity  
  - Mirror curriculum_map.question_formats distributions.
  - Ground all content in curriculum_map and ${contentDescription}.
  - Use phrasing consistent with ${learningProfile.school || "the school"} exam norms.

------------------------------------------------------------
TASK 2 – Worksheet Generation (Output-Only)
------------------------------------------------------------

Generate exactly 10 adaptive, exam-authentic questions.

Each question must include:
• question_number  
• question_type (“Multiple Choice”, “Short Answer”, “Structured Response”)  
• question_text (plain text)  
• options (A–D) if question_type = “Multiple Choice”; otherwise []  
• difficulty_index (“Moderate Exam-Level”, “Challenging Exam-Level”, or “High Challenge Exam-Level”)  

Strict MCQ Rules:
- If the stem contains cues like “Which of the following”, “Select”, “Which statement”, “is/are true about”, “Identify the correct”, “Choose the option”—  
  You MUST produce a Multiple Choice question with exactly four options A–D.
- If question_type ≠ “Multiple Choice”, the stem MUST avoid MCQ cue phrases and options MUST be empty.

Subject-Specific Design Guidelines:
{
  "Mathematics": "Multi-step problems, proofs, applied word problems, function/graph interpretation, formula-to-context mapping.",
  "Natural Sciences": "Data tables, experimental design, calculations, model explanation, scenario-based application.",
  "Social Sciences": "Source/case analysis, cause-effect reasoning, chart interpretation, structured short responses.",
  "Humanities": "Excerpt analysis, argument evaluation, thematic comparison, inference-based distractors.",
  "Languages": "Reading comprehension, vocab-in-context, grammar, translation, interpretive responses.",
  "Business Economics Accounting Finance": "Case scenarios, journal entries, ratio analysis, cost-benefit interpretation.",
  "Computer Science Technology Engineering": "Algorithm tracing, pseudocode completion, debugging, conceptual systems questions.",
  "Fine Arts and Creative Subjects": "Visual/aural analysis, style recognition, historical/contextual linkage.",
  "Interdisciplinary/Professional": "Ethical/policy dilemmas, applied reasoning, real-world judgment tasks."
}

General Construction Rules:
- Write grade-appropriate stems.
- Ensure questions explicitly target adaptation signals.
- Each question must test a distinct concept or reasoning demand.
- Align terminology and context with the supplied notes (if any).
- If notes are sparse, rely on curriculum_map for concept selection.

------------------------------------------------------------
TASK 3 – Provide Complete Answer Key Details (Output-Only)
------------------------------------------------------------

For each question include:
• correct_answer  
• explanation (2–3 sentences; give conceptual correction, not just the answer)  
• assessed_competencies[]  
• targeted_misconception (string or null)

Explanations MUST:
- Address common reasoning errors observed in past worksheets.
- Provide actionable micro-feedback (“Check unit consistency before substitution”, etc.).
- Reinforce learning_patterns from the prediction stage where relevant.

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

      const feedbackPrompt = `You are an expert educator and assessment analyst for ${lesson.course_name} at ${learningProfile.school || "the school"} (grade: ${learningProfile.grade || "N/A"}, region: ${learningProfile.city || "N/A"}). Use the curriculum map, the student’s 10-question worksheet performance, and the diagnostic quiz meta-data (reasoning_method, confidence_level) to produce an accurate predicted exam grade, a concise rationale, a brief performance summary, strengths/weaknesses, a structured multi-signal learning plan, and behavior-based learning patterns. Keep all reasoning internal; output ONLY valid JSON that matches the provided response_json_schema.

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

[Part 0 — Diagnostic Meta Synthesis (Internal Only)]
- Pair each diagnostic question with its user_answer and question_metadata (reasoning_method, confidence_level) to compute:
  • is_correct_d = (user_answer === correct_answer) when available.
  • Overconfidence flag: is_correct_d=false AND confidence=High.
  • Underconfidence flag: is_correct_d=true AND confidence=Low.
  • Guess-correct risk: is_correct_d=true AND (reasoning_method=Guess OR confidence=Low).
  • Method bias counts by competency/topic when mappable (Pattern, Formula, Algorithmic, Heuristic, Recall).
- Derive an “Early Insight Profile”:
  • dominant_methods: top 1–2 reasoning_method labels by frequency.
  • confidence_alignment: accuracy when High vs Medium vs Low confidence (if computable).
  • primary_risk: one of {Overconfidence, Underconfidence, Guess-correct, Method-mismatch} if observed ≥2 times or clearly indicated.

[Part 1 — Performance Analysis & Prediction]
Edge Handling
- If total correct = 0/10: skip calculations and output “Not Calculable” for predicted_exam_score_percentage with a foundation-rebuild rationale.
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
  If none: set 0.50 (neutral) and note “not assessed in this worksheet” for rationale.

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
- PredictedExamScorePercentage = round(PreliminaryAggregate + Modifier), clamped to [0, 100], then “%”.
- Exception: if 0/10 → "Not Calculable".

[Part 2 — Structured Multi-Signal Planning Pipeline (Internal Only)]
Before generating suggested_future_sessions_plan and learning_patterns, internally compute planning signals:
1. priority_competencies = bottom 2–3 competencies by weighted mastery.
2. misconception_targets = misconceptions recurring across worksheet or tied to weighted competencies.
3. exam_format_deficits = question types where AvgTypeScore < 40% AND exam weight ≥ 20%.
4. trend_direction = {improving, plateauing, declining} based on difficulty × mastery trajectory.

These signals MUST shape both:
- suggested_future_sessions_plan  
- learning_patterns  

Do not output these internal signals directly; only use them to generate the required JSON fields.

[Global Output Rules]
Output ONLY a single JSON object matching the response_json_schema:
- feedback_session_title: "Worksheet ${worksheet.worksheet_number} Performance & Grade Prediction"
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
    • how_to_improve: 1 sentence linking to tactics the next sessions/worksheets will reinforce.   
- No extra fields. No explanations outside the JSON. All percentages must be strings with “%”.

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
            }
          },
          required: ["feedback_session_title", "predicted_exam_score_percentage", "overall_performance_summary_text", "identified_strengths_list", "key_areas_for_improvement_list", "suggested_future_sessions_plan"]
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