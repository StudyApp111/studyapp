
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import WorksheetQuestion from "../components/worksheet/WorksheetQuestion";
import ConfettiEffect from "../components/gamification/ConfettiEffect";
import { Sparkles } from "lucide-react";

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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');
    
    if (!lessonId) {
      navigate(createPageUrl("Home"));
      return;
    }

    loadOrGenerateWorksheet(lessonId);
  }, [navigate]);

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

      // Only load quiz data if worksheetNum is 1
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
        // For adaptive worksheets, load quiz for potential reference
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
        
        // Check if worksheet is completed - redirect to feedback
        if (loadedWorksheet.completed) {
          navigate(createPageUrl("Feedback") + `?lessonId=${lessonId}&worksheet=${worksheetNum}`);
          return;
        }
        
        // CRITICAL FIX: Check if this is just a placeholder (empty or no questions)
        if (!loadedWorksheet.questions || loadedWorksheet.questions.length === 0) {
          console.log("Worksheet is a placeholder, generating questions now");
          await generateWorksheet(lessonId, lessonData[0], quizData, worksheetNum, loadedWorksheet.id);
        } else {
          // Worksheet has questions, use it
          setWorksheet(loadedWorksheet);
        }
      } else {
        console.log("Generating new worksheet", worksheetNum);
        await generateWorksheet(lessonId, lessonData[0], quizData, worksheetNum);
      }
    } catch (error) {
      console.error("Error loading worksheet:", error);
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

      let aiPrompt = "";
      let contextData = "";

      if (worksheetNum === 1) {
        // Original prompt for Worksheet 1 (based on diagnostic)
        const diagnosticResults = quizData.questions.map((q, index) => ({
          QuestionText: q.question_text,
          QuestionType: q.question_type,
          AssignedDifficultyIndex: q.difficulty_index,
          TargetedMisconception: q.targeted_misconception || "N/A",
          StudentAnswer: quizData.user_answers?.[index] || "No answer provided",
          IsCorrect: quizData.user_answers?.[index] === q.correct_answer
        }));
        contextData = `Diagnostic Quiz Results:\n${JSON.stringify(diagnosticResults, null, 2)}`;

        aiPrompt = `Context
You are a master assessment designer creating Worksheet ${worksheetNum} of 6 for ${lessonData.course_name}.

Input Educational Context
Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lessonData.course_name}
School (for context): ${learningProfile.school || "N/A"}
City/Region (for context): ${learningProfile.city || "N/A"}

Detailed Curriculum Profile:
${JSON.stringify(lessonData.curriculum_map, null, 2)}

${contextData}

Task 1: Analyze Student Performance & Curriculum Profile
Based on diagnostic quiz results, identify:
- Weak Competencies
- Gaps & Misconceptions
- Key & Differentiating Competencies for Assessment

Task 2: Generate the 10-Question Predictive Worksheet
Create 10 unique questions following the curriculum map's style and difficulty distribution.

CRITICAL FORMATTING REQUIREMENTS:
1. Question Text: Use markdown formatting - **bold** for emphasis, *italic* for special terms
   Example: "Read the sentence: 'The ancient scroll was **fragile**, so the historian handled it with extreme care.' What does the word 'fragile' most likely mean in this sentence?"
2. Answer Options: MUST use proper capitalization (e.g., "Fought" not "fought", "Brave" not "brave")
3. Correct Answer: Must match one of the options EXACTLY, with same capitalization

Task 3: Provide Complete Answer Key Details
For each question include: correct_answer, explanation (2-3 sentences), assessed_competencies, targeted_misconception.

IMPORTANT JSON FORMATTING:
- Keep all text fields concise
- Use simple language in explanations
- Avoid complex punctuation
- Keep question_text clear
- Maintain proper capitalization in all answer options

Output Format:
Provide your response as a single, valid JSON object with the structure specified.`;
      } else {
        // Adaptive prompt for Worksheets 2-6
        
        const prevWorksheets = await base44.entities.Worksheet.filter({ 
          lesson_id: lessonId,
          completed: true
        });
        
        if (prevWorksheets.length === 0) {
          throw new Error("No previous worksheet found. Cannot generate adaptive worksheet.");
        }

        const latestWorksheet = prevWorksheets.sort((a, b) => b.worksheet_number - a.worksheet_number)[0];
        
        // Prepare previous worksheet performance data
        const previousWorksheetPerformance = latestWorksheet.questions.map(q => ({
          question_number: q.question_number,
          question_type: q.question_type,
          difficulty_index: q.difficulty_index,
          question_text: q.question_text,
          options: q.options || [],
          correct_answer: q.correct_answer,
          assessed_competencies: q.assessed_competencies,
          targeted_misconception: q.targeted_misconception,
          student_answer: q.user_answer || "No answer provided",
          is_correct: q.is_correct || false
        }));

        // Prepare cumulative performance summary
        const cumulativePerformance = {
          worksheet_number: latestWorksheet.worksheet_number,
          predicted_grade: latestWorksheet.predicted_grade,
          total_score: latestWorksheet.total_score,
          strengths: latestWorksheet.ai_feedback?.identified_strengths_list || [],
          weaknesses: latestWorksheet.ai_feedback?.key_areas_for_improvement_list || []
        };

        // Get the current worksheet description
        let currentWorksheetDescription = `Worksheet ${worksheetNum}: Continue building toward 90%+ mastery`;
        if (existingWorksheetId) {
          const placeholderData = await base44.entities.Worksheet.filter({ id: existingWorksheetId });
          if (placeholderData.length > 0 && placeholderData[0].focus_description) {
            currentWorksheetDescription = placeholderData[0].focus_description;
          }
        }

        aiPrompt = `Context
You are a master assessment designer and expert tutor (simulated 180 IQ). Your primary function is to create the next 10-question adaptive worksheet for the student in ${lessonData.course_name}. This worksheet must continue to be highly predictive of exam performance by iteratively building upon the student's performance on the previous worksheet and aligning with the curriculum map. The questions must precisely mirror the style, type, wording, and difficulty detailed in the curriculum map.

Input Educational Context
Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lessonData.course_name}
School (for context): ${learningProfile.school || "N/A"}
City/Region (for context): ${learningProfile.city || "N/A"}
Current Iteration/Worksheet Number and Description: ${currentWorksheetDescription}

Detailed Curriculum Profile (JSON object):
${JSON.stringify(lessonData.curriculum_map, null, 2)}

Previous Worksheet Performance Data (Worksheet ${latestWorksheet.worksheet_number}):
${JSON.stringify(previousWorksheetPerformance, null, 2)}

Cumulative Performance Summary:
${JSON.stringify(cumulativePerformance, null, 2)}

Task 1: Analyze Previous Performance to Guide Current Worksheet Design
Based on the curriculum map, previous worksheet performance, and cumulative performance summary:

1. Identify Current Weak Competencies: Pinpoint core competencies where the student answered questions incorrectly in the previous worksheet, especially those with a higher difficulty_index or those reflecting cumulative trends of persistent weakness.

2. Identify Competencies Showing Improvement: Note competencies where previous worksheet indicates recent success, especially if they were previously weak.

3. Identify Mastered/Consistently Strong Competencies: Note competencies where the student performed well on higher-difficulty questions.

4. Track Persistent Misconceptions: Note if previous worksheet shows continued errors on questions targeting common misconceptions.

Task 2: Generate the Next Iterative 10-Question Predictive Worksheet
Create 10 unique questions. Adhere strictly to the following criteria:

Adaptive & Targeted Question Distribution:
- Primary Focus (approx. 5-6 questions): Target Current Weak Competencies and Persistent Misconceptions. Select appropriate difficulty_index for these questions (e.g., if a student struggles with "Moderate Exam-Level," provide more "Moderate Exam-Level" or even a "Foundational" review question before retrying "Moderate Exam-Level").
- Reinforce & Solidify (approx. 2-3 questions): For Competencies Showing Improvement, provide questions at a similar or slightly increased difficulty_index to solidify understanding and build confidence.
- Review & Extend (approx. 1-2 questions): For Mastered/Consistently Strong Competencies, include a question to ensure retention (spaced repetition) OR to extend understanding (e.g., a "High Challenge Exam-Level" question, a novel application, or integration with another competency).

Exact Alignment with Exam Style:
- Question distribution must mirror the curriculum map's question_formats frequency
- Type, wording, style, difficulty must emulate the curriculum map's question_formats examples
- All Multiple Choice Questions MUST have exactly 4 options as a simple array of strings

CRITICAL FORMATTING REQUIREMENTS:
1. Question Text: Use markdown formatting - **bold** for emphasis, *italic* for special terms
   Example: "Which of the following sentences uses **proper capitalization** for a title?"
2. Answer Options: MUST use proper capitalization (e.g., "California" not "california", "The Great Gatsby" not "the great gatsby")
3. Correct Answer: Must match one of the options EXACTLY, with same capitalization

Assigned Difficulty Index (Per Question):
For each question, assign a difficulty_index from: "Foundational", "Conceptual", "Moderate Exam-Level", "Challenging Exam-Level", or "High Challenge Exam-Level"
This assignment must be adaptive based on your analysis in Task 1.

Grade-Appropriate Language:
Use language appropriate for ${learningProfile.grade || "the student's grade level"}.

Task 3: Provide Complete Answer Key Details
For each question include:
- correct_answer: The correct answer (with proper capitalization matching the option)
- explanation: Detailed explanation (2-3 sentences)
- assessed_competencies: Array of competency names being assessed
- targeted_misconception: The specific misconception this question addresses (or "N/A" if not applicable)

CRITICAL JSON FORMATTING RULES:
1. All text fields must have properly escaped quotes and special characters
2. For Multiple Choice questions: ALWAYS provide exactly 4 options as a simple array of strings with proper capitalization
   Example: "options": ["California", "New York", "Texas", "Florida"]
3. NEVER leave the "options" array empty for Multiple Choice questions
4. If you cannot create valid multiple choice options, use a different question_type instead
5. Use simple, clear language in all fields
6. Keep question_text concise and unambiguous
7. Correct answer MUST match one of the options exactly

Output Format:
Provide your response as a single, valid JSON object with this exact structure.`;
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
                targeted_weak_competencies: {
                  type: "array",
                  items: { type: "string" }
                },
                key_gaps_or_misconceptions_addressed: {
                  type: "array",
                  items: { type: "string" }
                },
                focused_differentiating_competencies: {
                  type: "array",
                  items: { type: "string" }
                }
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
                  options: {
                    type: "array",
                    items: { type: "string" }
                  },
                  correct_answer: { type: "string" },
                  explanation: { type: "string" },
                  assessed_competencies: {
                    type: "array",
                    items: { type: "string" }
                  },
                  targeted_misconception: { type: "string" }
                },
                required: ["question_number", "question_type", "difficulty_index", "question_text", "correct_answer", "explanation", "assessed_competencies", "targeted_misconception"]
              }
            }
          },
          required: ["worksheet_title", "analysis_summary_for_worksheet_design", "worksheet_questions"]
        }
      });

      // Validate the response
      if (!worksheetData || !worksheetData.worksheet_questions || worksheetData.worksheet_questions.length === 0) {
        throw new Error("Invalid worksheet data received from AI");
      }

      const questionsWithPlaceholder = worksheetData.worksheet_questions.map(q => ({
        ...q,
        user_answer: ""
      }));

      let updatedWorksheet;
      
      if (existingWorksheetId) {
        // Update existing placeholder worksheet with generated questions
        updatedWorksheet = await base44.entities.Worksheet.update(existingWorksheetId, {
          questions: questionsWithPlaceholder,
          analysis_summary: worksheetData.analysis_summary_for_worksheet_design,
          status: "in_progress"
        });
      } else {
        // Create new worksheet
        updatedWorksheet = await base44.entities.Worksheet.create({
          lesson_id: lessonId,
          worksheet_number: worksheetNum,
          diagnostic_quiz_id: worksheetNum === 1 ? quizData?.id : undefined,
          questions: questionsWithPlaceholder,
          analysis_summary: worksheetData.analysis_summary_for_worksheet_design,
          status: "in_progress",
          completed: false
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
      return; // Don't grade empty answers
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

      // Update the worksheet with AI grading results
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
      
      // Only update if there are actual changes
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
      // Also reset ai_grading_pending if an error occurs
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
    
    setWorksheet({
      ...worksheet,
      questions: updatedQuestions
    });

    // Clear any existing timeout
    if (gradingTimeoutRef.current) {
      clearTimeout(gradingTimeoutRef.current);
    }

    // For subjective questions, trigger AI grading after a short delay
    if (isSubjectiveQuestion(updatedQuestions[currentQuestion].question_type)) {
      // Mark as pending
      updatedQuestions[currentQuestion].ai_grading_pending = true;
      // Update worksheet immediately with pending status to show UI feedback
      setWorksheet(prev => ({
        ...prev,
        questions: updatedQuestions
      }));
      
      // Debounce the grading call (wait 2 seconds after user stops typing)
      gradingTimeoutRef.current = setTimeout(() => {
        gradeSubjectiveQuestion(updatedQuestions[currentQuestion], currentQuestion);
      }, 2000);
    }
  };

  const handleNext = () => {
    if (currentQuestion < worksheet.questions.length - 1) {
      // If there's a pending grading call for the *current* question, execute it immediately
      if (gradingTimeoutRef.current) {
        clearTimeout(gradingTimeoutRef.current);
        const currentQ = worksheet.questions[currentQuestion];
        if (isSubjectiveQuestion(currentQ.question_type) && currentQ.user_answer) {
          gradeSubjectiveQuestion(currentQ, currentQuestion);
        }
      }
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const submitWorksheet = async () => {
    setIsSubmitting(true);
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });
      const learningProfile = profile[0] || {};

      // Grade all questions appropriately
      const questionsWithGrading = worksheet.questions.map((q) => {
        const questionType = q.question_type.toLowerCase();
        
        // For MCQ and T/F, use simple string comparison
        if (questionType.includes("multiple choice") || 
            questionType.includes("mcq") ||
            (questionType.includes("true") && questionType.includes("false"))) {
          return {
            ...q,
            is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
          };
        }
        
        // For subjective questions, use AI grading if available
        if (isSubjectiveQuestion(q.question_type)) {
          if (q.ai_score_out_of_10 !== undefined) {
            // AI grading is available: consider 7.5+ as "correct" for the boolean flag
            return {
              ...q,
              is_correct: q.ai_score_out_of_10 >= 7.5 
            };
          } else {
            // Fallback if AI grading failed or wasn't triggered
            // For now, matching the original fallback to simple comparison.
            // In a real scenario, could mark as 'un-graded' or force AI grading here.
            return {
              ...q,
              is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
            };
          }
        }
        
        // Default fallback for any other unexpected question types
        return {
          ...q,
          is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
        };
      });

      // Prepare worksheet performance data for the AI
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
        } : null // Include AI grading details if present
      }));

      const feedbackPrompt = `Context: You are an experienced teacher grading Worksheet ${worksheet.worksheet_number} of 6 for ${lesson.course_name} at ${learningProfile.grade || "N/A"}. You operate within the educational standards of ${learningProfile.school || "N/A"} and ${learningProfile.city || "N/A"}. You have a deep understanding of the curriculum and how it's assessed. The student has just completed a 10-question worksheet that was meticulously designed to mirror actual exam conditions in terms of style, question types, wording, and difficulty, based on the curriculum map. Your primary task is to analyze their worksheet performance to provide an accurate predicted exam grade, insightful feedback, and actionable recommendations for future study.

IMPORTANT: Some questions have been AI-graded with detailed scoring. When a question has "ai_grading" data, USE THAT SCORE as the base score out of 10 for that question. This reflects nuanced understanding and partial credit. For questions without "ai_grading" data (e.g., Multiple Choice), use the 'is_correct' boolean to assign a score.

Input Data:
Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lesson.course_name}
School: ${learningProfile.school || "N/A"}
City/Region: ${learningProfile.city || "N/A"}
Worksheet Number: ${worksheet.worksheet_number} of 6

Detailed Curriculum Profile (JSON object):
${JSON.stringify(lesson.curriculum_map, null, 2)}

Diagnostic Quiz Performance:
- Diagnostic Score: ${quiz?.score || 'N/A'}%
- Diagnostic Results:
${JSON.stringify(quiz?.questions.map((q, idx) => ({
  question_text: q.question_text,
  user_answer: quiz.user_answers?.[idx],
  is_correct: quiz.user_answers?.[idx] === q.correct_answer
})) || [], null, 2)}

Worksheet ${worksheet.worksheet_number} Performance:
- Analysis Summary:
${JSON.stringify(worksheet.analysis_summary, null, 2)}
- Questions with Student Answers:
${JSON.stringify(worksheetPerformanceData, null, 2)}

Mission: Deliver a comprehensive performance analysis, including an accurate predicted exam grade (with clear calculation reasoning), constructive feedback, and targeted future session plans.

Part 1: Performance Analysis & Grade Prediction Calculation

(If WorksheetPerformanceData shows 0 correct answers out of 10, do NOT perform steps 1-6. Instead, directly populate the "Predicted Grade & Rationale" section in Part 2 with the specific 0/10 guidance. Similarly, handle 10/10 performance with adjusted narrative as outlined in Part 2.)

1. Initialize Per-Question Score (on a 0-10 scale):
For each question: 
- If it has ai_grading data (i.e., 'ai_grading' is not null), use ai_grading.score_out_of_10 directly as the base score (this is already on a 0-10 scale).
- If 'ai_grading' is null (for MCQ/True-False questions):
  - If is_correct is true, assign a base score of 9.0 (strong indication of knowledge).
  - If is_correct is false, assign 0.2 (acknowledging some exposure but incorrect application).

2. Adjust Score Based on Worksheet Question Difficulty (apply only to non-AI-graded questions, as AI-graded scores inherently account for difficulty):
For questions where 'ai_grading' is null:
- If base score is 9.0:
  - Correct on "High Challenge Exam-Level": Multiply score by 1.05 (max score 9.8).
  - Correct on "Challenging Exam-Level": Multiply score by 1.02 (max score 9.6).
  - Correct on "Moderate Exam-Level": No change or multiply score by 1.01 (max score 9.2).
- If base score is 0.2 (incorrect):
  - No further adjustment needed based on difficulty, keep at 0.2.

3. Calculate Weighted Competency Mastery:
For each core_competency in the curriculum map:
- Identify all worksheet questions linked to this competency via assessed_competencies.
- Calculate the average adjusted score (from step 2 or direct AI score from step 1) for these questions. This is the "MasteryScore" for that competency.
- Calculate a preliminary aggregate score: Sum of (MasteryScore_for_Competency_X * Weight_of_Competency_X). Normalize to be out of 100.

4. Adjust for Performance on Exam Question Styles:
Analyze student's average scores for each question_type present in the worksheet.
Compare this performance against the frequency of those types in the curriculum map's question_formats.
If significant underperformance (<40% average score) on a question_type with high exam frequency (>30%), apply a small negative modifier to the aggregate score (e.g., -3 to -6 points). Conversely, strong performance on high-frequency types might warrant a smaller positive modifier (+0 to +2 points).

5. Finalize Predicted Exam Score:
The result is the PredictedExamScorePercentage. Round to the nearest whole number.

Part 2: Feedback Generation

(Adopt a supportive, constructive, and experienced teacher persona. Use grade-appropriate language.)

A. Predicted Grade & Rationale:

(Handle Edge Cases First)

If 0/10 Correct on Worksheet:
- predicted_exam_score_percentage: "Not Calculable"
- prediction_calculation_rationale: "With 0 correct answers on this predictive worksheet, a numerical exam prediction is not meaningful. This indicates a critical need to revisit foundational concepts across the curriculum before focusing on exam-style performance."

If 10/10 Correct on Worksheet:
- predicted_exam_score_percentage: [Output score from Part 1; likely 95-100%]
- prediction_calculation_rationale: "Exceptional performance (10/10 correct) on this challenging, exam-style worksheet demonstrates outstanding mastery across all assessed competencies and question types, leading to this high predicted score."

(Standard Case: 1-9/10 Correct)
- predicted_exam_score_percentage: [Output score from Part 1]
- prediction_calculation_rationale: "This prediction is based on your detailed performance on the 10-question exam-style worksheet. It considers the difficulty of each question you answered, your demonstrated mastery of core competencies (weighted by their exam importance), and your effectiveness with different exam question formats. For subjective questions, AI grading provided nuanced scores reflecting partial credit where appropriate. Strengths and areas for targeted improvement are outlined below."

B. Concise Overall Performance Summary (1-2 empathetic sentences):
[Tailor to performance. E.g., "This worksheet provided a good challenge! It shows you're building a solid understanding of [Competency X], while areas like [Competency Y] and handling [Question Type Z] are good next steps for focus."]

C. Identified Strengths (2-3 specific bullet points):
[Reference specific competencies where performance was strong. E.g., "Strong problem-solving in 'Algebraic Manipulations', correctly answering challenging multi-step questions."]

D. Key Areas for Improvement (2-3 specific, actionable bullet points):
[Reference specific competencies or misconceptions linked to incorrect answers. E.g., "Focus on 'Interpreting Figurative Language': the worksheet questions for this competency proved tricky."]

E. Suggested Future Sessions (3-5 tailored sessions):
Must be directly relevant to the course, targeting 90%+ mastery.
${worksheet.worksheet_number === 1 ? `
- Session 1: Focus on the most critical weak area/competency
- Session 2: Address the next gap or build on a strength
- Session 3: Exam question strategy with targeted question types
- Sessions 4-5 (optional): Comprehensive review or mixed practice` : `
These recommendations build on previous performance and aim to move you towards 90%+ mastery.`}

Output Format:
Provide your response as a single, valid JSON object with this exact structure.`;

      const { data: feedbackData } = await base44.functions.invoke('feedbackGrade', {
        prompt: feedbackPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            feedback_session_title: { type: "string" },
            predicted_exam_score_percentage: { type: "string" },
            prediction_calculation_rationale: { type: "string" },
            overall_performance_summary_text: { type: "string" },
            identified_strengths_list: {
              type: "array",
              items: { type: "string" }
            },
            key_areas_for_improvement_list: {
              type: "array",
              items: { type: "string" }
            },
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
          required: [
            "feedback_session_title",
            "predicted_exam_score_percentage",
            "prediction_calculation_rationale",
            "overall_performance_summary_text",
            "identified_strengths_list",
            "key_areas_for_improvement_list",
            "suggested_future_sessions_plan"
          ]
        }
      });

      const questionFeedback = questionsWithGrading.map((q, idx) => {
        let feedback = "";
        let pointsEarned = 0;
        
        if (isSubjectiveQuestion(q.question_type) && q.ai_score_out_of_10 !== undefined) {
          // Use AI grading feedback for subjective questions
          feedback = q.ai_rationale_short || "Your answer shows understanding.";
          pointsEarned = q.ai_score_out_of_10; // 0-10 scale
        } else {
          // MCQ/T/F feedback
          if (q.is_correct) {
            feedback = `Excellent! Your answer demonstrates strong understanding of ${q.assessed_competencies?.[0] || 'this concept'}.`;
            pointsEarned = 10; // Full points for correct MCQ/T/F
          } else {
            feedback = `This question assessed ${q.assessed_competencies?.[0] || 'key concepts'}. Review the explanation provided to strengthen your understanding.`;
            pointsEarned = 0; // No points for incorrect MCQ/T/F
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

      await base44.entities.Worksheet.update(worksheet.id, {
        questions: questionsWithGrading,
        feedback: questionFeedback,
        total_score: isNaN(scoreNum) ? 0 : scoreNum,
        predicted_grade: letterGrade,
        ai_feedback: feedbackData,
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
              feedback: []
            })
          )
        );
      }

      await base44.entities.Lesson.update(lesson.id, {
        status: "worksheet_completed"
      });

      // GAMIFICATION: Calculate points and badges
      const correctCount = questionsWithGrading.filter(q => q.is_correct).length;
      let pointsEarned = 0;
      
      // Base points for completion
      pointsEarned += 50;
      
      // Points per correct answer (scaled by difficulty, potentially from AI score)
      questionsWithGrading.forEach(q => {
        if (isSubjectiveQuestion(q.question_type) && q.ai_score_out_of_10 !== undefined) {
          // For subjective questions, points proportional to AI score
          pointsEarned += Math.round(q.ai_score_out_of_10 * 2.5); // Scale 0-10 to max 25
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

      // Bonus for perfect score (all questions considered correct by some measure)
      if (correctCount === questionsWithGrading.length) {
        pointsEarned += 100;
      }

      // Bonus for high grades
      if (letterGrade.startsWith('A')) {
        pointsEarned += 50;
      }

      // Update streak
      const today = new Date().toDateString();
      const lastActivity = user.last_activity_date ? new Date(user.last_activity_date).toDateString() : null;
      const yesterday = new Date(Date.now() - 86400000).toDateString(); // 24 hours in milliseconds
      
      let newStreak = user.current_streak || 0;
      if (lastActivity === yesterday) { // Continued streak
        newStreak += 1;
      } else if (lastActivity !== today) { // New activity, reset streak unless it's the same day
        newStreak = 1;
      }
      // If no activity at all, newStreak will be 0 and then set to 1 below.
      if (!lastActivity) {
          newStreak = 1; // First activity ever starts streak at 1
      }

      const longestStreak = Math.max(newStreak, user.longest_streak || 0);

      // Award badges
      const earnedBadges = [...(user.badges || [])];
      const badgeIds = earnedBadges.map(b => b.badge_id);
      const earnedNow = [];

      // First lesson completion
      if (!badgeIds.includes('first_lesson') && worksheet.worksheet_number === 1) {
        const badge = {
          badge_id: 'first_lesson',
          badge_name: 'First Steps',
          badge_description: 'Completed your first worksheet!',
          badge_icon: '📚',
          earned_date: new Date().toISOString()
        };
        earnedBadges.push(badge);
        earnedNow.push(badge);
      }

      // Perfect score (based on `is_correct` boolean for all questions)
      if (!badgeIds.includes('perfect_score') && correctCount === questionsWithGrading.length) {
        const badge = {
          badge_id: 'perfect_score',
          badge_name: 'Perfect Score',
          badge_description: 'Got 100% on a worksheet!',
          badge_icon: '🏆',
          earned_date: new Date().toISOString()
        };
        earnedBadges.push(badge);
        earnedNow.push(badge);
      }

      // A+ grade
      if (!badgeIds.includes('grade_a') && letterGrade === 'A+') {
        const badge = {
          badge_id: 'grade_a',
          badge_name: 'Excellence',
          badge_description: 'Achieved an A+ grade!',
          badge_icon: '🌟',
          earned_date: new Date().toISOString()
        };
        earnedBadges.push(badge);
        earnedNow.push(badge);
      }

      // 7-day streak
      if (!badgeIds.includes('seven_day_streak') && newStreak >= 7) {
        const badge = {
          badge_id: 'seven_day_streak',
          badge_name: 'Week Warrior',
          badge_description: '7-day study streak!',
          badge_icon: '🔥',
          earned_date: new Date().toISOString()
        };
        earnedBadges.push(badge);
        earnedNow.push(badge);
      }

      // 30-day streak
      if (!badgeIds.includes('thirty_day_streak') && newStreak >= 30) {
        const badge = {
          badge_id: 'thirty_day_streak',
          badge_name: 'Month Master',
          badge_description: '30-day study streak!',
          badge_icon: '🔥',
          earned_date: new Date().toISOString()
        };
        earnedBadges.push(badge);
        earnedNow.push(badge);
      }

      // 5 worksheets completed
      const allCompletedWorksheets = await base44.entities.Worksheet.filter({ completed: true, lesson_id: lesson.id }); // Filter by lesson_id to count completed worksheets for THIS lesson
      if (!badgeIds.includes('five_worksheets') && allCompletedWorksheets.length >= 5) {
        const badge = {
          badge_id: 'five_worksheets',
          badge_name: 'Dedicated Learner',
          badge_description: 'Completed 5 worksheets in a lesson!',
          badge_icon: '🎯',
          earned_date: new Date().toISOString()
        };
        earnedBadges.push(badge);
        earnedNow.push(badge);
      }

      // 10 worksheets completed
      if (!badgeIds.includes('ten_worksheets') && allCompletedWorksheets.length >= 10) {
        const badge = {
          badge_id: 'ten_worksheets',
          badge_name: 'Knowledge Seeker',
          badge_description: 'Completed 10 worksheets in a lesson!',
          badge_icon: '⭐',
          earned_date: new Date().toISOString()
        };
        earnedBadges.push(badge);
        earnedNow.push(badge);
      }

      // Calculate level (100 points per level)
      const newTotalPoints = (user.total_points || 0) + pointsEarned;
      const newLevel = Math.floor(newTotalPoints / 100) + 1;

      const totalQuizzes = (user.total_quizzes_taken || 0) + 1;
      const currentAvg = user.average_score || 0;
      const newAvg = isNaN(scoreNum) ? currentAvg : ((currentAvg * (totalQuizzes - 1)) + scoreNum) / totalQuizzes;

      await base44.auth.updateMe({
        total_quizzes_taken: totalQuizzes,
        average_score: Math.round(newAvg),
        total_points: newTotalPoints,
        level: newLevel,
        badges: earnedBadges,
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_activity_date: today
      });

      // Show confetti and badges
      if (earnedNow.length > 0 || correctCount >= (questionsWithGrading.length * 0.8)) { // Confetti for 80%+ correct or new badges
        setShowConfetti(true);
        setNewBadges(earnedNow);
      }

      // Navigate after a short delay to show confetti
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center p-8 shadow-2xl">
          <FileText className="w-16 h-16 mx-auto text-purple-600 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {worksheet ? "Loading Your Worksheet" : "Generating Your Worksheet"}
          </h2>
          <p className="text-slate-600 mb-6">
            {worksheet 
              ? `Retrieving your saved Worksheet ${worksheet.worksheet_number || ''}...`
              : "Creating a personalized exam based on your diagnostic results..."}
          </p>
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-600" />
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
      <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      {/* New Badges Toast */}
      {newBadges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl p-6 max-w-md"
        >
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-yellow-500" />
            <h3 className="text-xl font-bold text-slate-900">New Badge{newBadges.length > 1 ? 's' : ''} Earned!</h3>
          </div>
          <div className="space-y-2">
            {newBadges.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <span className="text-2xl">{badge.badge_icon}</span>
                <div>
                  <p className="font-semibold text-slate-900">{badge.badge_name}</p>
                  <p className="text-sm text-slate-600">{badge.badge_description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="max-w-4xl mx-auto">
        <Card className="mb-6 shadow-xl">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              {lesson.course_name} - Worksheet {worksheet?.worksheet_number || 1}
            </h2>
            <p className="text-slate-600 mb-4">Answer all questions to the best of your ability</p>
            <div className="flex items-center gap-3">
              <Progress value={progress} className="flex-1 h-3" />
              <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                {currentQuestion + 1} / {worksheet.questions.length}
              </span>
            </div>
            {gradingInProgress[currentQuestion] && (
              <div className="mt-3 flex items-center gap-2 text-sm text-purple-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI is grading your answer...</span>
              </div>
            )}
          </CardContent>
        </Card>

        <AnimatePresence mode="wait">
          <WorksheetQuestion
            key={currentQuestion}
            question={currentQ}
            answer={currentQ.user_answer}
            onAnswer={handleAnswer}
          />
        </AnimatePresence>

        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
          >
            Previous
          </Button>
          {isLastQuestion ? (
            <Button
              onClick={submitWorksheet}
              disabled={!canProceed || isSubmitting}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting & Grading...
                </>
              ) : (
                "Submit Worksheet"
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
            >
              Next Question
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
