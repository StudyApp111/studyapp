
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import WorksheetQuestion from "../components/worksheet/WorksheetQuestion";

export default function Worksheet() {
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [worksheet, setWorksheet] = useState(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      const quizData = await base44.entities.DiagnosticQuiz.filter({ lesson_id: lessonId });
      if (quizData.length === 0) {
        navigate(createPageUrl("DiagnosticQuiz") + `?lessonId=${lessonId}`);
        return;
      }
      setQuiz(quizData[0]);

      const existingWorksheet = await base44.entities.Worksheet.filter({ 
        lesson_id: lessonId,
        worksheet_number: worksheetNum
      });

      if (existingWorksheet.length > 0) {
        console.log("Loading existing worksheet", worksheetNum);
        const loadedWorksheet = existingWorksheet[0];
        setWorksheet(loadedWorksheet);
        
        if (loadedWorksheet.completed) {
          navigate(createPageUrl("Feedback") + `?lessonId=${lessonId}&worksheet=${worksheetNum}`);
          return;
        }
      } else {
        console.log("Generating new worksheet", worksheetNum);
        await generateWorksheet(lessonId, lessonData[0], quizData[0], worksheetNum);
      }
    } catch (error) {
      console.error("Error loading worksheet:", error);
      alert("Failed to load or generate worksheet. Please try again. Error: " + error.message);
      navigate(createPageUrl("Home"));
    }
    setIsGenerating(false);
  };

  const generateWorksheet = async (lessonId, lessonData, quizData, worksheetNum) => {
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });

      const learningProfile = profile[0] || {};

      // For worksheet 1, use diagnostic results
      // For worksheets 2-6, use previous worksheet performance
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
      } else {
        // Get previous worksheet for context
        const prevWorksheets = await base44.entities.Worksheet.filter({ 
          lesson_id: lessonId,
          completed: true
        });
        if (prevWorksheets.length > 0) {
          const latest = prevWorksheets[prevWorksheets.length - 1];
          contextData = `Previous Worksheet Performance:\n${JSON.stringify({
            worksheet_number: latest.worksheet_number,
            predicted_grade: latest.predicted_grade,
            total_score: latest.total_score,
            strengths: latest.ai_feedback?.identified_strengths_list,
            areas_for_improvement: latest.ai_feedback?.key_areas_for_improvement_list
          }, null, 2)}`;
        }
      }

      const aiPrompt = `Context
You are a master assessment designer creating Worksheet ${worksheetNum} of 6 for ${lessonData.course_name}.

Input Educational Context
Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lessonData.course_name}
School (for context): ${learningProfile.school || "N/A"}
City/Region (for context): ${learningProfile.city || "N/A"}

Detailed Curriculum Profile:
${JSON.stringify(lessonData.curriculum_map, null, 2)}

${contextData}

${worksheetNum > 1 ? `Focus for Worksheet ${worksheetNum}: Target the areas of weakness identified in previous worksheets while building toward 90%+ mastery.` : ''}

Task 1: Analyze Student Performance & Curriculum Profile
${worksheetNum === 1 ? 'Based on diagnostic quiz results' : 'Based on previous worksheet performance'}, identify:
- Weak Competencies
- Gaps & Misconceptions
- Key & Differentiating Competencies for Assessment

Task 2: Generate the 10-Question Predictive Worksheet
Create 10 unique questions following the curriculum map's style and difficulty distribution.

Task 3: Provide Complete Answer Key Details
For each question include: correct_answer, explanation (2-3 sentences), assessed_competencies, targeted_misconception.

IMPORTANT JSON FORMATTING:
- Keep all text fields concise
- Use simple language in explanations
- Avoid complex punctuation
- Keep question_text clear

Output Format:
Provide your response as a single, valid JSON object with the structure specified.`;

      const { data: worksheetData } = await base44.functions.invoke('generateWorksheet', {
        prompt: aiPrompt,
        response_json_schema: {
          type: "object",
          properties: {
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
          required: ["analysis_summary_for_worksheet_design", "worksheet_questions"]
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

      const createdWorksheet = await base44.entities.Worksheet.create({
        lesson_id: lessonId,
        worksheet_number: worksheetNum,
        diagnostic_quiz_id: worksheetNum === 1 ? quizData.id : undefined,
        questions: questionsWithPlaceholder,
        analysis_summary: worksheetData.analysis_summary_for_worksheet_design,
        status: "in_progress",
        completed: false
      });

      setWorksheet(createdWorksheet);
    } catch (error) {
      console.error("Error generating worksheet:", error);
      alert("Failed to generate worksheet. Please try again. Error: " + error.message);
      navigate(createPageUrl("Home"));
    }
  };

  const handleAnswer = (answer) => {
    const updatedQuestions = [...worksheet.questions];
    updatedQuestions[currentQuestion].user_answer = answer;
    
    setWorksheet({
      ...worksheet,
      questions: updatedQuestions
    });
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
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });
      const learningProfile = profile[0] || {};

      // First, do a quick grade check for each question
      const questionsWithGrading = worksheet.questions.map((q) => ({
        ...q,
        is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
      }));

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
        is_correct: q.is_correct
      }));

      const feedbackPrompt = `Context: You are an experienced teacher grading Worksheet ${worksheet.worksheet_number} of 6 for ${lesson.course_name} at ${learningProfile.grade || "N/A"}. You operate within the educational standards of ${learningProfile.school || "N/A"} and ${learningProfile.city || "N/A"}. You have a deep understanding of the curriculum and how it's assessed. The student has just completed a 10-question worksheet that was meticulously designed to mirror actual exam conditions in terms of style, question types, wording, and difficulty, based on the curriculum map. Your primary task is to analyze their worksheet performance to provide an accurate predicted exam grade, insightful feedback, and actionable recommendations for future study.

Input Data:
Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lesson.course_name}
School: ${learningProfile.school || "N/A"}
City/Region: ${learningProfile.city || "N/A"}
Worksheet Number: ${worksheet.worksheet_number} of 6

Detailed Curriculum Profile (JSON object):
${JSON.stringify(lesson.curriculum_map, null, 2)}

Diagnostic Quiz Performance:
- Diagnostic Score: ${quiz.score || 'N/A'}%
- Diagnostic Results:
${JSON.stringify(quiz.questions.map((q, idx) => ({
  question_text: q.question_text,
  user_answer: quiz.user_answers?.[idx],
  is_correct: quiz.user_answers?.[idx] === q.correct_answer
})), null, 2)}

Worksheet ${worksheet.worksheet_number} Performance:
- Analysis Summary:
${JSON.stringify(worksheet.analysis_summary, null, 2)}
- Questions with Student Answers:
${JSON.stringify(worksheetPerformanceData, null, 2)}

Mission: Deliver a comprehensive performance analysis, including an accurate predicted exam grade (with clear calculation reasoning), constructive feedback, and targeted future session plans.

Part 1: Performance Analysis & Grade Prediction Calculation

(If WorksheetPerformanceData shows 0 correct answers out of 10, do NOT perform steps 1-6. Instead, directly populate the "Predicted Grade & Rationale" section in Part 2 with the specific 0/10 guidance. Similarly, handle 10/10 performance with adjusted narrative as outlined in Part 2.)

1. Initialize Per-Question Score:
For each question: If is_correct is true, assign a base score of 0.9 (strong indication of knowledge). If false, assign 0.2 (acknowledging some exposure but incorrect application).

2. Adjust Score Based on Worksheet Question Difficulty:
Modify the base score using the difficulty_index for each question:
- Correct on "High Challenge Exam-Level": Multiply score by 1.05 (max score 0.98).
- Correct on "Challenging Exam-Level": Multiply score by 1.02 (max score 0.96).
- Correct on "Moderate Exam-Level": No change or multiply score by 1.01 (max score 0.92).
- Incorrect on "Moderate Exam-Level": Multiply score by 0.7 (min score 0.05).
- Incorrect on "Challenging Exam-Level": Multiply score by 0.8 (min score 0.08).
- Incorrect on "High Challenge Exam-Level": Multiply score by 0.9 (min score 0.1).

3. Calculate Weighted Competency Mastery:
For each core_competency in the curriculum map:
- Identify all worksheet questions linked to this competency via assessed_competencies.
- Calculate the average adjusted score for these questions. This is the "MasteryScore" for that competency.
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
- prediction_calculation_rationale: "This prediction is based on your detailed performance on the 10-question exam-style worksheet. It considers the difficulty of each question you answered, your demonstrated mastery of core competencies (weighted by their exam importance), and your effectiveness with different exam question formats. Strengths and areas for targeted improvement are outlined below."

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
Provide your response as a single, valid JSON object matching the exact structure specified.`;

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

      // Generate simple per-question feedback for display
      const questionFeedback = questionsWithGrading.map((q, idx) => ({
        question_index: idx,
        is_correct: q.is_correct,
        feedback: q.is_correct 
          ? `Excellent! Your answer demonstrates strong understanding of ${q.assessed_competencies?.[0] || 'this concept'}.`
          : `This question assessed ${q.assessed_competencies?.[0] || 'key concepts'}. Review the explanation provided to strengthen your understanding.`,
        points_earned: q.is_correct ? 10 : 0
      }));

      // Convert predicted score to letter grade
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

      // If this is worksheet 1, create placeholders for worksheets 2-6
      if (worksheet.worksheet_number === 1 && feedbackData.suggested_future_sessions_plan) {
        await Promise.all(
          feedbackData.suggested_future_sessions_plan.map((session, idx) =>
            base44.entities.Worksheet.create({
              lesson_id: lesson.id,
              worksheet_number: idx + 2, // Start from worksheet 2
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

      const totalQuizzes = (user.total_quizzes_taken || 0) + 1;
      const currentAvg = user.average_score || 0;
      const newAvg = isNaN(scoreNum) ? currentAvg : ((currentAvg * (totalQuizzes - 1)) + scoreNum) / totalQuizzes;

      await base44.auth.updateMe({
        total_quizzes_taken: totalQuizzes,
        average_score: Math.round(newAvg)
      });

      navigate(createPageUrl("Feedback") + `?lessonId=${lesson.id}&worksheet=${worksheet.worksheet_number}`);
    } catch (error) {
      console.error("Error submitting worksheet:", error);
      alert("Failed to submit worksheet. Please try again. Error: " + error.message);
    }
    setIsSubmitting(false);
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

  if (!worksheet || !lesson) return null; // Ensure lesson is loaded before attempting to access its properties

  const progress = ((currentQuestion + 1) / worksheet.questions.length) * 100;
  const isLastQuestion = currentQuestion === worksheet.questions.length - 1;
  const currentQ = worksheet.questions[currentQuestion];
  const canProceed = currentQ.user_answer?.trim() !== "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
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
