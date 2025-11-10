
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText, Clock } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import WorksheetQuestion from "../components/worksheet/WorksheetQuestion";
import ConfettiEffect from "../components/gamification/ConfettiEffect";
import { Sparkles } from "lucide-react";

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function Worksheet() {
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [worksheet, setWorksheet] = useState(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      console.log('Starting timer for worksheet:', worksheet.id);
      
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
        console.log('Cleaning up timer');
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
      
      console.log(`Question ${questionIndex} time: ${timeSpentOnQuestion}s (total: ${questionTimesRef.current[questionIndex]}s)`);
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

      let quizData = null;
      if (worksheetNum === 1) {
        const diagnosticQuizData = await base44.entities.DiagnosticQuiz.filter({ lesson_id: lessonId });
        if (diagnosticQuizData.length === 0) {
          navigate(createPageUrl("DiagnosticQuiz") + `?lessonId=${lessonId}`);
          return;
        }
        setQuiz(diagnosticQuizData[0]);
        quizData = diagnosticQuizData[0];
      } else {
        const existingQuiz = await base44.entities.DiagnosticQuiz.filter({ lesson_id: lessonId });
        if (existingQuiz.length > 0) {
          setQuiz(existingQuiz[0]);
          quizData = existingQuiz[0];
        }
      }

      const existingWorksheet = await base44.entities.Worksheet.filter({ 
        lesson_id: lessonId,
        worksheet_number: worksheetNum
      });

      if (existingWorksheet.length > 0) {
        console.log("Loading existing worksheet", worksheetNum);
        const loadedWorksheet = existingWorksheet[0];
        
        if (loadedWorksheet.completed) {
          navigate(createPageUrl("Feedback") + `?lessonId=${lessonId}&worksheet=${worksheetNum}`);
          return;
        }
        
        if (!loadedWorksheet.questions || loadedWorksheet.questions.length === 0) {
          console.log("Worksheet is a placeholder, generating questions now");
          await generateWorksheet(lessonId, lessonData[0], quizData, worksheetNum, loadedWorksheet.id);
        } else {
          setWorksheet(loadedWorksheet);
        }
      } else {
        console.log("Generating new worksheet", worksheetNum);
        await generateWorksheet(lessonId, lessonData[0], quizData, worksheetNum);
      }
    } catch (error) {
      console.error("Error loading or generating worksheet:", error);
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
        const diagnosticResults = quizData.questions.map((q, index) => ({
          QuestionText: q.question_text,
          QuestionType: q.question_type,
          AssignedDifficultyIndex: q.difficulty_index,
          TargetedMisconception: q.targeted_misconception || "N/A",
          StudentAnswer: quizData.user_answers?.[index] || "No answer provided",
          IsCorrect: quizData.user_answers?.[index] === q.correct_answer
        }));
        
        aiPrompt = `Context
[Role Definition]
You are a master assessment designer and expert tutor (simulated 180 IQ). Your function is to generate a 10-question predictive worksheet that accurately forecasts a student’s performance on their actual exam for ${lessonData.course_name}. The worksheet must be personalized to the student’s demonstrated weaknesses and misconceptions, strictly using the data provided below.

[Input Educational Context]
Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lessonData.course_name}
School (for context): ${learningProfile.school || "N/A"}
City/Region (for context): ${learningProfile.city || "N/A"}

Detailed Curriculum Profile:
${JSON.stringify(lessonData.curriculum_map, null, 2)}

Content Source (User Notes, Uploaded Materials, or Typed Requests):
${contentDescription}

Diagnostic Quiz Results:
${JSON.stringify(diagnosticResults, null, 2)}

[Data Preprocessing (Internal Logic)]
- Pair diagnosticResults.questions[i] with diagnosticResults.user_answer[i].
- For each pair, compute is_correct = (user_answer[i] === questions[i].correct_answer).
- Internally attach user_answer and is_correct to each question record for analysis.
- Use difficulty_index (not "AssignedDifficultyIndex").
- Determine overall diagnostic accuracy using diagnosticResults.score if available; otherwise compute as correct_count / total_questions.
- If contentDescription is long or detailed (e.g., multi-page notes), ground factual details, topics, and examples primarily in those notes while using lessonData.curriculum_map to maintain curricular alignment and authentic question formats.
- If contentDescription is brief or generic (e.g., "I need help with final"), rely more heavily on lessonData.curriculum_map to infer appropriate content scope and standards.

[Task 1 – Internal Analysis (Reasoning Only, Do Not Output)]
Internally perform structured reasoning using the data above before generating questions.

Correlate diagnostic performance to competencies:
- Map incorrect responses to lessonData.curriculum_map.core_competencies.
- Prioritize competencies with higher weights from lessonData.curriculum_map.competency_weightings.

Map misconceptions:
- Align incorrect responses to lessonData.curriculum_map.common_misconceptions and each item's targeted_misconception.
- Identify recurring patterns for remediation through new question design.

Calibrate difficulty:
- If accuracy ≤ 50 % → bias toward "Moderate Exam-Level".
- If accuracy ≥ 80 % → bias toward "High Challenge Exam-Level".
- Otherwise → balanced progression (Moderate → Challenging → High Challenge).

Establish question allocation:
- 6–7 questions → weak competencies / misconceptions.
- 2–3 questions → key or high-weight competencies.
- Ensure broad coverage of essential curricular areas.

Align to authentic exam style:
- Mirror format distributions and stylistic conventions from lessonData.curriculum_map.question_formats.
- Preserve the phrasing and cognitive style typical of ${learningProfile.school || "the school"}.

(All reasoning must occur internally and never be output.)

[Task 2 – Worksheet Generation (Output-Only)]
Generate exactly 10 unique, exam-authentic questions derived from the internal analysis.
Each question must reflect identified weaknesses, misconceptions, and weighting priorities.

Subject-Specific Design Guidelines:
{
  "Mathematics": "Multi-step problems, proofs, applied word problems, function and graph interpretation, connecting formulas to real data.",
  "Natural Sciences": "Experimental design, data-table interpretation, quantitative calculations, model explanation, and application of theory to scenarios.",
  "Social Sciences": "Source or case analysis, cause-effect reasoning, comparative evaluation, interpretation of charts, and structured short answers.",
  "Humanities": "Text or excerpt analysis, critical interpretation, argument construction, thematic comparison, and evaluation of perspectives.",
  "Languages": "Reading comprehension, vocabulary-in-context, grammar correction, translation or composition, and interpretive short responses.",
  "Business Economics Accounting Finance": "Case-based decision scenarios, journal entries, ratio or data analysis, policy evaluation, cost-benefit interpretation, and quantitative justification.",
  "Computer Science Technology Engineering": "Algorithm tracing, pseudo-code completion, debugging logic, applied calculations, and conceptual questions on data structures or systems.",
  "Fine Arts and Creative Subjects": "Visual or aural analysis, style recognition, composition planning, interpretive reasoning, and contextual or historical linkage.",
  "Interdisciplinary and Professional Courses": "Case-study interpretation, ethical or policy analysis, applied reasoning, scenario-based judgments, and reflective synthesis."
}

General Construction Rules:
- Use clear, grade-appropriate language for ${learningProfile.grade}.
- Include four plausible options (A–D) if question_type = "Multiple Choice"; otherwise set options = [].
- Assign each question a difficulty_index of "Moderate Exam-Level", "Challenging Exam-Level", or "High Challenge Exam-Level".
- Each question must test a distinct concept or skill for predictive breadth.
- Maintain authentic exam wording and format grounded in ${lessonData.course_name} and ${learningProfile.school || "the school"} context.
- When extensive notes are provided, ensure question content, terminology, and examples align factually with those materials; when notes are minimal, extrapolate content scope from the curriculum map and question_formats.

CRITICAL FORMATTING REQUIREMENTS:
1. Question Text: Write as PLAIN TEXT without markdown formatting (no **, no *, no special symbols)
   - For math: use x^2 for superscripts, H_2O for subscripts (auto-rendered)
2. Answer Options: MUST use proper capitalization
3. Correct Answer: Must match one of the options EXACTLY

Task 3: Provide Complete Answer Key Details
For each question include: correct_answer, explanation (2-3 sentences), assessed_competencies, targeted_misconception.

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

        let currentWorksheetDescription = `Worksheet ${worksheetNum}: Continue building toward 90%+ mastery`;
        if (existingWorksheetId) {
          const placeholderData = await base44.entities.Worksheet.filter({ id: existingWorksheetId });
          if (placeholderData.length > 0 && placeholderData[0].focus_description) {
            currentWorksheetDescription = placeholderData[0].focus_description;
          }
        }

        aiPrompt = `Context
You are a master assessment designer creating the next 10-question adaptive worksheet for ${lessonData.course_name}.

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

Task: Generate 10 adaptive questions following curriculum alignment. Provide complete answer key with explanations.

Output Format: Valid JSON object matching the schema.`;
      }

      const { data: worksheetData } = await base44.functions.invoke('generateWorksheet', {
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
      });

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
          diagnostic_quiz_id: worksheetNum === 1 ? quizData?.id : undefined,
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
    setIsSubmitting(true);
    
    // Record final question time
    recordQuestionTime(currentQuestion);
    
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    console.log('Final elapsed time:', elapsedSeconds);
    console.log('Question times:', questionTimesRef.current);
    
    // Convert question times to laps format
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

      const feedbackPrompt = `Context: You are an experienced teacher grading Worksheet ${worksheet.worksheet_number} of 6 for ${lesson.course_name}.

Input Data:
Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lesson.course_name}
Worksheet Number: ${worksheet.worksheet_number} of 6

Curriculum Profile:
${JSON.stringify(lesson.curriculum_map, null, 2)}

Worksheet Performance:
${JSON.stringify(worksheetPerformanceData, null, 2)}

Mission: Provide comprehensive feedback including predicted grade, strengths, and improvement areas.

Output Format: Valid JSON matching the required schema.`;

      const { data: feedbackData } = await base44.functions.invoke('feedbackGrade', {
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
            }
          },
          required: ["feedback_session_title", "predicted_exam_score_percentage", "prediction_calculation_rationale", "overall_performance_summary_text", "identified_strengths_list", "key_areas_for_improvement_list", "suggested_future_sessions_plan"]
        }
      });

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
      await base44.entities.Worksheet.update(worksheet.id, {
        questions: questionsWithGrading,
        feedback: questionFeedback,
        total_score: isNaN(scoreNum) ? 0 : scoreNum,
        predicted_grade: letterGrade,
        ai_feedback: feedbackData,
        time_taken_seconds: elapsedSeconds,
        question_time_laps: questionTimeLaps,
        status: "completed",
        completed: true
      });

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

      await base44.entities.Lesson.update(lesson.id, {
        status: "worksheet_completed"
      });

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

      await base44.auth.updateMe({
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
      });

      if (earnedNow.length > 0 || correctCount >= (questionsWithGrading.length * 0.8)) {
        setShowConfetti(true);
        setNewBadges(earnedNow);
      }

      setTimeout(() => {
        navigate(createPageUrl("Feedback") + `?lessonId=${lesson.id}&worksheet=${worksheet.worksheet_number}`);
      }, earnedNow.length > 0 ? 2000 : 500);
    } catch (error) {
      console.error("Error submitting worksheet:", error);
      alert("Failed to submit worksheet. Please try again. Error: " + error.message);
      setIsSubmitting(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-4 md:p-6">
        <Card className="w-full max-w-md text-center p-6 md:p-8 shadow-2xl">
          <FileText className="w-12 h-12 md:w-16 md:h-16 mx-auto text-purple-600 mb-4 animate-pulse" />
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
            {worksheet ? "Loading Your Worksheet" : "Generating Your Worksheet"}
          </h2>
          <p className="text-sm md:text-base text-slate-600 mb-6">
            {worksheet 
              ? `Retrieving your saved Worksheet ${worksheet.worksheet_number || ''}...`
              : "Creating a personalized exam based on your diagnostic results..."}
          </p>
          <Loader2 className="w-6 h-6 md:w-8 md:h-8 mx-auto animate-spin text-purple-600" />
        </Card>
      </div>
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
          {gradingInProgress[currentQuestion] && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>AI grading...</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 md:py-6">
        <AnimatePresence mode="wait">
          <WorksheetQuestion
            key={currentQuestion}
            question={currentQ}
            answer={currentQ.user_answer}
            onAnswer={handleAnswer}
          />
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:left-[256px] z-20 bg-white/95 backdrop-blur-sm border-t border-purple-200/60 shadow-lg">
        <div className="max-w-4xl mx-auto px-3 py-3 md:px-6 md:py-4">
          <div className="flex justify-between gap-3">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              size="sm"
              className="md:text-base"
            >
              Previous
            </Button>
            {isLastQuestion ? (
              <Button
                onClick={submitWorksheet}
                disabled={!canProceed || isSubmitting}
                size="sm"
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 md:text-base"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 md:text-base"
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
