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
  const [userAnswers, setUserAnswers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');
    
    if (!lessonId) {
      navigate(createPageUrl("Home"));
      return;
    }

    generateWorksheet(lessonId);
  }, [navigate]);

  const generateWorksheet = async (lessonId) => {
    setIsGenerating(true);
    try {
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

      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });

      const aiPrompt = `
You are an expert exam creator. Generate a comprehensive mock exam worksheet.

Course: ${lessonData[0].course_name}
Curriculum: ${JSON.stringify(lessonData[0].curriculum_map)}
Diagnostic Quiz Score: ${quizData[0].score}%
Learner Profile: ${JSON.stringify(profile[0] || {})}

Create a mock exam with 10-12 questions in varied formats:
- 40% Multiple Choice (4 options each)
- 20% True/False
- 20% Short Answer (1-2 sentence responses)
- 20% Long Answer (paragraph responses)

Questions should:
- Cover all key concepts from the curriculum
- Be appropriate for the learner's diagnostic score
- Progress from easier to harder
- Include point values (multiple choice=5, true/false=3, short=8, long=15)

For each question, include the correct answer and type.
`;

      const worksheetData = await base44.integrations.Core.InvokeLLM({
        prompt: aiPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  type: { type: "string", enum: ["multiple_choice", "true_false", "short_answer", "long_answer"] },
                  options: { type: "array", items: { type: "string" } },
                  correct_answer: { type: "string" },
                  points: { type: "number" }
                }
              }
            }
          }
        }
      });

      const createdWorksheet = await base44.entities.Worksheet.create({
        lesson_id: lessonId,
        diagnostic_quiz_id: quizData[0].id,
        questions: worksheetData.questions,
        completed: false
      });

      setWorksheet(createdWorksheet);
      setUserAnswers(new Array(worksheetData.questions.length).fill(""));
    } catch (error) {
      console.error("Error generating worksheet:", error);
    }
    setIsGenerating(false);
  };

  const handleAnswer = (answer) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestion] = answer;
    setUserAnswers(newAnswers);
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

      const gradingPrompt = `
You are an expert educator. Grade this worksheet and provide detailed feedback.

Questions and Answers:
${worksheet.questions.map((q, idx) => `
Question ${idx + 1} (${q.type}, ${q.points} points):
${q.question}
Correct Answer: ${q.correct_answer}
Student Answer: ${userAnswers[idx] || "No answer"}
`).join('\n')}

For each question, provide:
1. Whether it's correct (for objective questions) or a partial score
2. Detailed, constructive feedback
3. Points earned

Also provide:
- Total score as a percentage
- Predicted grade (A+, A, B+, B, C+, C, D, F)
- Overall performance summary
`;

      const grading = await base44.integrations.Core.InvokeLLM({
        prompt: gradingPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            feedback: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question_index: { type: "integer" },
                  is_correct: { type: "boolean" },
                  feedback: { type: "string" },
                  points_earned: { type: "number" }
                }
              }
            },
            total_score: { type: "number" },
            predicted_grade: { type: "string" }
          }
        }
      });

      await base44.entities.Worksheet.update(worksheet.id, {
        user_answers: userAnswers,
        feedback: grading.feedback,
        total_score: grading.total_score,
        predicted_grade: grading.predicted_grade,
        completed: true
      });

      await base44.entities.Lesson.update(lesson.id, {
        status: "worksheet_completed"
      });

      const totalLessons = (user.total_lessons_completed || 0);
      const totalQuizzes = (user.total_quizzes_taken || 0) + 1;
      const currentAvg = user.average_score || 0;
      const newAvg = ((currentAvg * (totalQuizzes - 1)) + grading.total_score) / totalQuizzes;

      await base44.auth.updateMe({
        total_quizzes_taken: totalQuizzes,
        average_score: Math.round(newAvg)
      });

      navigate(createPageUrl("Feedback") + `?lessonId=${lesson.id}`);
    } catch (error) {
      console.error("Error submitting worksheet:", error);
    }
    setIsSubmitting(false);
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center p-8 shadow-2xl">
          <FileText className="w-16 h-16 mx-auto text-indigo-600 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Generating Your Worksheet</h2>
          <p className="text-slate-600 mb-6">Creating a personalized exam based on your diagnostic results...</p>
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
        </Card>
      </div>
    );
  }

  if (!worksheet) return null;

  const progress = ((currentQuestion + 1) / worksheet.questions.length) * 100;
  const isLastQuestion = currentQuestion === worksheet.questions.length - 1;
  const canProceed = userAnswers[currentQuestion]?.trim() !== "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6 shadow-xl">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Mock Exam: {lesson.course_name}</h2>
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
            question={worksheet.questions[currentQuestion]}
            questionNumber={currentQuestion + 1}
            answer={userAnswers[currentQuestion]}
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
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            >
              Next Question
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}