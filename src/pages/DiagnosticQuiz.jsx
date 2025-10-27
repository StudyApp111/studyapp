
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Brain, CheckCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import QuizQuestion from "../components/quiz/QuizQuestion";

export default function DiagnosticQuiz() {
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');
    
    if (!lessonId) {
      navigate(createPageUrl("Home"));
      return;
    }

    generateDiagnosticQuiz(lessonId);
  }, [navigate]);

  const generateDiagnosticQuiz = async (lessonId) => {
    setIsGenerating(true);
    try {
      const lessonData = await base44.entities.Lesson.filter({ id: lessonId });
      if (lessonData.length === 0) {
        navigate(createPageUrl("Home"));
        return;
      }
      setLesson(lessonData[0]);

      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });

      const aiPrompt = `
You are an expert educational assessment designer. Create a diagnostic quiz to assess the learner's current knowledge.

Course: ${lessonData[0].course_name}
Curriculum Map: ${JSON.stringify(lessonData[0].curriculum_map)}
Learner Profile: ${JSON.stringify(profile[0] || {})}

Create:
1. A brief, engaging summary (2-3 sentences) of what the learner will be assessed on
2. Exactly 5 multiple choice questions that:
   - Progress from basic to more advanced concepts
   - Cover different aspects of the curriculum
   - Have 4 options each
   - Include clear, helpful explanations for correct answers

The questions should accurately diagnose the learner's current knowledge level.
`;

      const quizData = await base44.integrations.Core.InvokeLLM({
        prompt: aiPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  correct_answer: { type: "integer" },
                  explanation: { type: "string" }
                }
              }
            }
          }
        }
      });

      const createdQuiz = await base44.entities.DiagnosticQuiz.create({
        lesson_id: lessonId,
        summary: quizData.summary,
        questions: quizData.questions,
        completed: false
      });

      setQuiz(createdQuiz);
      setUserAnswers(new Array(quizData.questions.length).fill(null));
    } catch (error) {
      console.error("Error generating quiz:", error);
    }
    setIsGenerating(false);
  };

  const handleAnswer = (answerIndex) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestion] = answerIndex;
    setUserAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      submitQuiz();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const submitQuiz = async () => {
    const correctAnswers = userAnswers.filter((answer, idx) => 
      answer === quiz.questions[idx].correct_answer
    ).length;
    const finalScore = (correctAnswers / quiz.questions.length) * 100;
    
    setScore(finalScore);
    setShowResults(true);

    await base44.entities.DiagnosticQuiz.update(quiz.id, {
      user_answers: userAnswers,
      score: finalScore,
      completed: true
    });

    await base44.entities.Lesson.update(lesson.id, {
      status: "diagnostic_completed"
    });
  };

  const proceedToWorksheet = () => {
    navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}`);
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center p-8 shadow-2xl">
          <Brain className="w-16 h-16 mx-auto text-purple-600 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Generating Your Diagnostic Quiz</h2>
          <p className="text-slate-600 mb-6">Our AI is analyzing the curriculum and creating personalized questions...</p>
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-600" />
        </Card>
      </div>
    );
  }

  if (!quiz) return null;

  if (showResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl"
        >
          <Card className="shadow-2xl">
            <CardHeader className="text-center pb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-3xl">Diagnostic Complete!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-purple-600 mb-2">{Math.round(score)}%</div>
                <p className="text-slate-600">Your diagnostic score</p>
              </div>

              <div className="space-y-3">
                {quiz.questions.map((q, idx) => {
                  const isCorrect = userAnswers[idx] === q.correct_answer;
                  return (
                    <div key={idx} className={`p-4 rounded-lg border-2 ${isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      <div className="flex items-start gap-3">
                        {isCorrect ? (
                          <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 mb-1">Question {idx + 1}</p>
                          <p className="text-sm text-slate-700">{q.question}</p>
                          {!isCorrect && (
                            <p className="text-xs text-slate-600 mt-2">
                              <strong>Correct:</strong> {q.options[q.correct_answer]}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={proceedToWorksheet}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 py-6 text-lg"
              >
                Continue to Worksheet
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6 shadow-xl">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">{lesson.course_name}</h2>
            <p className="text-slate-600 mb-4">{quiz.summary}</p>
            <div className="flex items-center gap-3">
              <Progress value={progress} className="flex-1 h-3" />
              <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                {currentQuestion + 1} / {quiz.questions.length}
              </span>
            </div>
          </CardContent>
        </Card>

        <AnimatePresence mode="wait">
          <QuizQuestion
            key={currentQuestion}
            question={quiz.questions[currentQuestion]}
            questionNumber={currentQuestion + 1}
            selectedAnswer={userAnswers[currentQuestion]}
            onSelectAnswer={handleAnswer}
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
          <Button
            onClick={handleNext}
            disabled={userAnswers[currentQuestion] === null}
            className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
          >
            {currentQuestion === quiz.questions.length - 1 ? "Submit Quiz" : "Next Question"}
          </Button>
        </div>
      </div>
    </div>
  );
}
