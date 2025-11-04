
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import WorksheetQuestion from "../components/worksheet/WorksheetQuestion";
import ConfettiEffect from "../components/gamification/ConfettiEffect";
import { Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const gradingTimeoutRef = useRef(null);
  const lastGradedAnswerRef = useRef({});

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');
    
    if (!lessonId) {
      navigate(createPageUrl("Home"));
      return;
    }

    loadOrGenerateWorksheet(lessonId);
  }, [navigate, retryCount]); // Added retryCount as dependency for re-attempting on retry

  const loadOrGenerateWorksheet = async (lessonId) => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const worksheetNum = parseInt(urlParams.get('worksheet')) || 1;
      
      const lessonData = await base44.entities.Lesson.filter({ id: lessonId });
      if (lessonData.length === 0) {
        setError({
          title: "Lesson Not Found",
          message: "The lesson you're looking for doesn't exist.",
          canRetry: false
        });
        setIsGenerating(false);
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
      console.error("Error loading worksheet:", error);
      setError({
        title: "Failed to Load Worksheet",
        message: error.message || "An unexpected error occurred while loading the worksheet.",
        canRetry: true,
        details: error.toString()
      });
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
          completed: false
        });
      }

      setWorksheet(updatedWorksheet);
    } catch (error) {
      console.error("Error generating worksheet:", error);
      throw error; // Re-throw to be caught by loadOrGenerateWorksheet
    }
  };

  // Helper function to determine if question needs AI grading
  const needsAIGrading = (questionType) => {
    const type = questionType.toLowerCase();
    return type.includes("short answer") || 
           type.includes("long answer") || 
           type.includes("fill-in-the-blank") ||
           type.includes("problem-solving");
  };

  // AI Grading function
  const gradeAnswerWithAI = async (question, answer) => {
    if (!answer || answer.trim() === "") {
      return null;
    }

    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
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
        student_answer: answer,
        student_grade_level: learningProfile.grade,
        course_name: lesson.course_name
      });

      return gradingResult;
    } catch (error) {
      console.error("Error grading answer with AI:", error);
      return null;
    }
  };

  // Update answer and trigger AI grading if needed
  const handleAnswer = async (answer) => {
    const updatedQuestions = [...worksheet.questions];
    const currentQ = updatedQuestions[currentQuestion];
    currentQ.user_answer = answer;
    
    // Update worksheet immediately with new answer
    setWorksheet({
      ...worksheet,
      questions: updatedQuestions
    });

    // Save to database
    await base44.entities.Worksheet.update(worksheet.id, {
      questions: updatedQuestions
    });

    // Check if this question needs AI grading
    if (needsAIGrading(currentQ.question_type)) {
      // Clear any existing timeout
      if (gradingTimeoutRef.current) {
        clearTimeout(gradingTimeoutRef.current);
      }

      // Only grade if answer has changed
      const answerKey = `${currentQuestion}_${answer}`;
      if (lastGradedAnswerRef.current[currentQuestion] === answerKey) {
        return; // Same answer, don't re-grade
      }

      // Set a timeout to grade after user stops typing (debounce)
      gradingTimeoutRef.current = setTimeout(async () => {
        setIsGrading(true);
        const gradingResult = await gradeAnswerWithAI(currentQ, answer);
        
        if (gradingResult) {
          // Update the question with AI grading
          const questionsWithGrading = [...updatedQuestions];
          questionsWithGrading[currentQuestion].ai_grading = gradingResult;
          
          setWorksheet({
            ...worksheet,
            questions: questionsWithGrading
          });

          // Save to database
          await base44.entities.Worksheet.update(worksheet.id, {
            questions: questionsWithGrading
          });

          // Mark this answer as graded
          lastGradedAnswerRef.current[currentQuestion] = answerKey;
        }
        setIsGrading(false);
      }, 1500); // Wait 1.5 seconds after user stops typing
    }
  };

  const handleNext = () => {
    if (currentQuestion < worksheet.questions.length - 1) {
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
    setError(null);
    
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });
      const learningProfile = profile[0] || {};

      // Grade each question appropriately
      const questionsWithGrading = await Promise.all(worksheet.questions.map(async (q) => {
        const questionType = q.question_type.toLowerCase();
        
        // For MCQ and T/F, use exact matching
        if (questionType.includes("multiple choice") || 
            questionType.includes("mcq") || 
            (questionType.includes("true") && questionType.includes("false"))) {
          return {
            ...q,
            is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
          };
        }
        
        // For short/long answer or fill-in-blank, use AI grading if available
        if (needsAIGrading(q.question_type)) {
          // If we already have AI grading, use it
          if (q.ai_grading && q.ai_grading.score_out_of_10 !== undefined) {
            // Score >= 7.0 is considered correct
            return {
              ...q,
              is_correct: q.ai_grading.score_out_of_10 >= 7.0
            };
          }
          
          // If no AI grading yet (shouldn't happen, but fallback), grade now
          const gradingResult = await gradeAnswerWithAI(q, q.user_answer);
          if (gradingResult) {
            return {
              ...q,
              ai_grading: gradingResult,
              is_correct: gradingResult.score_out_of_10 >= 7.0
            };
          }
          
          // Fallback to exact match if AI grading fails
          return {
            ...q,
            is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
          };
        }
        
        // Default: exact match
        return {
          ...q,
          is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
        };
      }));

      // Prepare worksheet performance data for the AI - UPDATED FORMAT
      const worksheetPerformanceData = questionsWithGrading.map((q) => {
        // Calculate score_out_of_10 for the new prompt format
        let scoreOutOf10;
        if (q.ai_grading && q.ai_grading.score_out_of_10 !== undefined) {
          scoreOutOf10 = q.ai_grading.score_out_of_10;
        } else {
          // For MCQ/T/F, convert binary to 0 or 10
          scoreOutOf10 = q.is_correct ? 10 : 0;
        }

        return {
          question_number: q.question_number,
          question_type: q.question_type,
          worksheet_difficulty_index: q.difficulty_index, // Renamed to match new prompt
          question_text: q.question_text,
          assessed_competencies: q.assessed_competencies || [],
          student_answer: q.user_answer || "No answer provided",
          score_out_of_10: scoreOutOf10, // New format - score at top level
          targeted_misconception: q.targeted_misconception || "N/A"
        };
      });

      const feedbackPrompt = `You are an experienced teacher and assessment specialist for ${lesson.course_name} at ${learningProfile.grade || "N/A"},
operating within the academic standards of ${learningProfile.school || "N/A"} in ${learningProfile.city || "N/A"}.
You have a deep understanding of the curriculum (defined in Lesson.curriculum_map) and how it is assessed.

The student has just completed a 10-question worksheet that mirrors real exam conditions.
Your mission is to analyze their worksheet performance to provide:
1. An accurate predicted exam grade.
2. Insightful feedback grounded in the curriculum map.
3. Actionable, data-driven next-step recommendations aligned with key competencies.

---

### Input Data

Course / Unit Name: ${lesson.course_name}
Student Written Description: ${lesson.description || "N/A"}
Grade Level: ${learningProfile.grade || "N/A"}
School: ${learningProfile.school || "N/A"}
City / Region: ${learningProfile.city || "N/A"}

Diagnostic Quiz Results:
${quiz ? JSON.stringify(quiz.questions.map((q, idx) => ({
  question_text: q.question_text,
  user_answer: quiz.user_answers?.[idx],
  is_correct: quiz.user_answers?.[idx] === q.correct_answer
}))) : "N/A"}

Detailed Curriculum Profile:
${JSON.stringify(lesson.curriculum_map, null, 2)}

Worksheet ${worksheet.worksheet_number} Performance Data:
${JSON.stringify(worksheetPerformanceData, null, 2)}

---

## Part 1: Performance Analysis & Grade Prediction Calculation

(If WorksheetPerformanceData shows all scores = 0 / 10, skip calculations and directly fill "Predicted Grade & Rationale" in Part 2 with the 0 / 10 guidance.  
If all = 10 / 10, handle with the exceptional-performance narrative.)

### 1️⃣ Initialize Per-Question Score  
For each question in WorksheetPerformanceData: convert score_out_of_10 to base score = (score_out_of_10 ÷ 10).

### 2️⃣ Adjust Score by Question Difficulty  
Modify each base score using worksheet_difficulty_index:
- High Challenge Exam-Level → × 1.05 (max 1.00)  
- Challenging Exam-Level → × 1.02 (max 0.98)  
- Moderate Exam-Level → × 1.00 (max 0.95)

If base score is very low (< 0.25), scale slightly higher (× 0.7–0.9) to acknowledge minimal exposure.  
Clamp all adjusted scores within 0.05–1.00.

### 3️⃣ Calculate Weighted Competency Mastery  
For each competency in the curriculum map core_competencies:
- Identify all questions linked via assessed_competencies.  
- Compute average adjusted score → MasteryScore.  
- Weight by that competency's weight from competency_weightings.

If a competency was not tested, set to "not assessed," neutral (0.5), or infer from related competencies.  
Sum (MasteryScore × Weight) for all competencies → preliminary aggregate (0–1 scale).

### 4️⃣ Adjust for Performance by Question Format  
Compare average performance by question_type with expected frequencies in curriculum map question_formats.  
If a high-frequency type (> 30%) shows low mastery (< 0.4), apply −3 to −6 points.  
If strong on high-frequency types, add +0 to +2 points.

### 5️⃣ Finalize Predicted Exam Score  
Multiply weighted aggregate by 100 to get percentage.  
Apply any format-based adjustments from Step 4.  
Round to nearest whole number → PredictedExamScorePercentage.

---

## Part 2: Feedback Generation

Use professional, supportive language appropriate for ${learningProfile.grade || "the student's grade level"}.  
All comments should connect directly to competencies in the curriculum map.

### A. Predicted Grade & Rationale  
- predicted_exam_score_percentage: [from Part 1 Step 5]  
- prediction_rationale: "This score reflects competency-weighted mastery adjusted for difficulty and alignment with curriculum question formats."

Edge cases: if all ≤ 1 / 10 → "Not Calculable. Foundational review required." If all ≥ 9 / 10 → "Exceptional performance demonstrating exam-level mastery."

### B. Overall Performance Summary (≤ 2 sentences)  
Provide an empathetic summary of patterns and readiness.

### C. Identified Strengths (2–3 points)  
Reference competencies with strong mastery (≥ 0.8).

### D. Key Areas for Improvement (2–3 points)  
List weaker competencies (< 0.6) or recurring misconceptions.

---

### E. Suggested Future Sessions (5 sessions)

${worksheet.worksheet_number === 1 ? `
Generate 5 adaptive learning sessions. Each session is generated from competency-level data and directly addresses weak areas.

#### Session 1 – Foundations First: [Most Critical Weak Area / Competency]  
Purpose: Repair the competency with lowest mastery or frequent misconceptions.  
session_focus_description: Re-teach core concepts through simplified examples and guided practice.

#### Session 2 – Bridging the Gap: [Secondary Weakness / Linked Competency]  
Purpose: Strengthen the next-most-affected competency.  
session_focus_description: Provide guided practice on near-miss questions and error-analysis tasks.

#### Session 3 – Exam Question Strategy: [Challenging Format / Question Type]  
Purpose: Develop exam-style fluency on formats that caused difficulty.  
session_focus_description: Replicate real exam conditions with timed practice on high-frequency types.

#### Session 4 – Applied Competency Integration: [Cross-Linking Concepts]  
Purpose: Transfer learning between related competencies.  
session_focus_description: Design tasks that blend two or more competencies.

#### Session 5 – Mastery Simulation & Feedback Loop  
Purpose: Measure growth and reinforce learning.  
session_focus_description: Deliver a mini exam with revisited misconceptions to test retention.
` : `
These recommendations build on previous performance and aim to move towards 90%+ mastery.
Generate 3-5 tailored sessions based on current weak areas.
`}

---

### Output (JSON-Only)`;

      const { data: feedbackData } = await base44.functions.invoke('feedbackGrade', {
        prompt: feedbackPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            predicted_exam_score_percentage: { type: "integer" },
            prediction_rationale: { type: "string" },
            performance_summary: { type: "string" },
            strengths: {
              type: "array",
              items: { type: "string" }
            },
            areas_for_improvement: {
              type: "array",
              items: { type: "string" }
            },
            suggested_next_sessions: {
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
            competency_mastery_breakdown: {
              type: "object",
              additionalProperties: { type: "number" }
            }
          },
          required: [
            "predicted_exam_score_percentage",
            "prediction_rationale",
            "performance_summary",
            "strengths",
            "areas_for_improvement",
            "suggested_next_sessions"
          ]
        }
      });

      // Calculate points for feedback based on AI grading where available
      const questionFeedback = questionsWithGrading.map((q, idx) => {
        let pointsEarned = 0;
        let feedback = "";
        
        if (q.ai_grading) {
          pointsEarned = q.ai_grading.score_out_of_10;
          feedback = q.ai_grading.rationale_short;
        } else {
          pointsEarned = q.is_correct ? 10 : 0;
          feedback = q.is_correct 
            ? `Excellent! Your answer demonstrates strong understanding of ${q.assessed_competencies?.[0] || 'this concept'}.`
            : `This question assessed ${q.assessed_competencies?.[0] || 'key concepts'}. Review the explanation provided to strengthen your understanding.`;
        }
        
        return {
          question_index: idx,
          is_correct: q.is_correct,
          feedback: feedback,
          points_earned: pointsEarned
        };
      });

      const scoreNum = feedbackData.predicted_exam_score_percentage;
      let letterGrade = "F";
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

      // Map new response format to existing ai_feedback structure
      const mappedAiFeedback = {
        feedback_session_title: `Worksheet ${worksheet.worksheet_number} Feedback`,
        predicted_exam_score_percentage: scoreNum.toString(), // Convert back to string for consistency with old type
        prediction_calculation_rationale: feedbackData.prediction_rationale,
        overall_performance_summary_text: feedbackData.performance_summary,
        identified_strengths_list: feedbackData.strengths,
        key_areas_for_improvement_list: feedbackData.areas_for_improvement,
        suggested_future_sessions_plan: feedbackData.suggested_next_sessions,
        competency_mastery_breakdown: feedbackData.competency_mastery_breakdown || {}
      };

      await base44.entities.Worksheet.update(worksheet.id, {
        questions: questionsWithGrading,
        feedback: questionFeedback,
        total_score: scoreNum,
        predicted_grade: letterGrade,
        ai_feedback: mappedAiFeedback,
        status: "completed",
        completed: true
      });

      if (worksheet.worksheet_number === 1 && feedbackData.suggested_next_sessions) {
        await Promise.all(
          feedbackData.suggested_next_sessions.map((session, idx) =>
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

      const correctCount = questionsWithGrading.filter(q => q.is_correct).length;
      let pointsEarned = 0;
      
      pointsEarned += 50;
      
      questionsWithGrading.forEach(q => {
        if (q.is_correct) {
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

      if (correctCount === 10) {
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

      if (!badgeIds.includes('perfect_score') && correctCount === 10) {
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

      const allCompletedWorksheets = await base44.entities.Worksheet.filter({ completed: true });
      if (!badgeIds.includes('five_worksheets') && allCompletedWorksheets.length >= 5) {
        const badge = {
          badge_id: 'five_worksheets',
          badge_name: 'Dedicated Learner',
          badge_description: 'Completed 5 worksheets!',
          badge_icon: '🎯',
          earned_date: new Date().toISOString()
        };
        earnedBadges.push(badge);
        earnedNow.push(badge);
      }

      if (!badgeIds.includes('ten_worksheets') && allCompletedWorksheets.length >= 10) {
        const badge = {
          badge_id: 'ten_worksheets',
          badge_name: 'Knowledge Seeker',
          badge_description: 'Completed 10 worksheets!',
          badge_icon: '⭐',
          earned_date: new Date().toISOString()
        };
        earnedBadges.push(badge);
        earnedNow.push(badge);
      }

      const newTotalPoints = (user.total_points || 0) + pointsEarned;
      const newLevel = Math.floor(newTotalPoints / 100) + 1;

      const totalQuizzes = (user.total_quizzes_taken || 0) + 1;
      const currentAvg = user.average_score || 0;
      const newAvg = ((currentAvg * (totalQuizzes - 1)) + scoreNum) / totalQuizzes;

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

      if (earnedNow.length > 0 || correctCount >= 8) {
        setShowConfetti(true);
        setNewBadges(earnedNow);
      }

      setTimeout(() => {
        navigate(createPageUrl("Feedback") + `?lessonId=${lesson.id}&worksheet=${worksheet.worksheet_number}`);
      }, earnedNow.length > 0 ? 2000 : 500);
    } catch (error) {
      console.error("Error submitting worksheet:", error);
      setError({
        title: "Failed to Submit Worksheet",
        message: error.message || "An unexpected error occurred while submitting your worksheet.",
        canRetry: false,
        details: error.toString()
      });
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');
    setRetryCount(prev => prev + 1);
    // Explicitly call loadOrGenerateWorksheet to re-attempt
    loadOrGenerateWorksheet(lessonId); 
  };

  // Error Display
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{error.title}</h2>
              <p className="text-slate-600 mb-6">{error.message}</p>
              
              {error.details && (
                <details className="w-full mb-6 text-left">
                  <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
                    Technical Details
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-100 rounded text-xs overflow-auto max-h-40">
                    {error.details}
                  </pre>
                </details>
              )}
              
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={() => navigate(createPageUrl("Home"))}
                  className="flex-1"
                >
                  Go Home
                </Button>
                {error.canRetry && (
                  <Button
                    onClick={handleRetry}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            
            {/* Show grading indicator */}
            {isGrading && (
              <div className="mt-3 flex items-center gap-2 text-sm text-purple-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Grading your answer...</span>
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
