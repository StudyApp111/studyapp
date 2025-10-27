import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Brain, CheckCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
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

      const learningProfile = profile[0] || {};

      const aiPrompt = `Objective: You are an expert supportive tutor. Your goal is to:

Create a clear, concise, and engaging "Smart Summary" of key concepts for the student, leveraging the provided detailed curriculum.

Design a 5-question "Diagnostic Quiz" to effectively gauge the student's current understanding across core curriculum areas. This quiz will inform the creation of a subsequent personalized worksheet.

This entire experience should be warm, ${learningProfile.grade || 'student'}-friendly, and presented as if you are guiding the student step-by-step towards success.

Input Educational Context:

Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lessonData[0].course_name}
School: ${learningProfile.school || "N/A"}
City/Region: ${learningProfile.city || "N/A"}
Detailed Curriculum Profile: ${JSON.stringify(lessonData[0].curriculum_map)}
Student Description: ${lessonData[0].description || "N/A"}

Task 1: Create the Smart Summary

Based on the curriculum map and considering any student description:

Structure & Content:
- Synthesize information primarily from core competencies and high-yield focal points.
- If a student description is provided and is relevant, ensure this summary gives particular attention or slightly more detailed, clear explanations to those concepts.
- Organize the summary logically: begin with foundational concepts and smoothly progress to more complex or granular details, ensuring a natural flow of information.

Language & Tone:
- Use clear, intuitive, and engaging language precisely tailored to the specified grade level for easy comprehension. Employ techniques like short sentences, relatable analogies (where appropriate), and simple definitions for key terminology.
- Maintain a consistently supportive, encouraging, and patient tone, as an effective teacher would when guiding a student.
- Where pedagogically valuable, briefly explain the importance or relevance of key concepts.

Length & Focus:
- Aim for a summary that is comprehensive enough to be a valuable revision tool but concise enough not to overwhelm. Typically 300-600 words, or structured into 3-5 distinct key sections with clear headings.
- Use markdown formatting for structure (headings with ##, bold text with **, italic with *, lists with -)

Task 2: Design the 5-Question Diagnostic Quiz

Grounded in mastery learning principles and utilizing the curriculum map. Ensure the 5 questions collectively provide broad diagnostic coverage across several distinct core competencies.

Question Design & Coverage (5 Questions Total):
- Employ multi-step questions where appropriate to assess multiple facets of a competency.
- Strive for a balance: include items that touch upon foundational skills/knowledge as well as those requiring more granular understanding or simple application.
- Scaffold difficulty across the 5 questions (e.g., starting with a more accessible concept).

Question Characteristics (FOR EACH of the 5 questions):

a. Question Type: Select appropriate types (e.g., MCQ, Short Answer, True/False, Fill-in-the-Blank, simple Problem-Solving).
   - For MCQs, provide 3-4 plausible distractors and clearly indicate the correct answer choice.
   - For other types, provide the ideal correct answer.

b. Difficulty Index: Assign one label from:
   - "Foundational": Basic recall, definitions, essential facts, or core prerequisite skills.
   - "Conceptual": Understanding of concepts, relationships between ideas, interpretations, or simple applications.
   - "Applied/Multi-step": Application to new scenarios, or involves multiple steps/concepts.

c. Targeted Misconception (Optional): If this question specifically tests a known common misconception, briefly state it. Otherwise use null.

Clarity & Appropriateness: Ensure all questions are clearly worded, unambiguous, and entirely appropriate for the specified grade level.

Output Format:
Provide your response as a single, valid JSON object with the following structure. Ensure the content_markdown field uses proper markdown formatting including ## for headings, ** for bold, * for italic, and - for lists.`;

      const quizData = await base44.integrations.Core.InvokeLLM({
        prompt: aiPrompt,
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            smart_summary: {
              type: "object",
              properties: {
                title: { type: "string" },
                content_markdown: { type: "string" }
              },
              required: ["title", "content_markdown"]
            },
            diagnostic_quiz: {
              type: "object",
              properties: {
                title: { type: "string" },
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question_number: { type: "integer" },
                      question_type: { type: "string" },
                      difficulty_index: { type: "string" },
                      targeted_misconception: { type: "string" },
                      question_text: { type: "string" },
                      options: {
                        type: "array",
                        items: { type: "string" }
                      },
                      correct_answer: { type: "string" }
                    },
                    required: ["question_number", "question_type", "difficulty_index", "question_text", "correct_answer"]
                  }
                }
              },
              required: ["questions"]
            }
          },
          required: ["smart_summary", "diagnostic_quiz"]
        }
      });

      const createdQuiz = await base44.entities.DiagnosticQuiz.create({
        lesson_id: lessonId,
        smart_summary: quizData.smart_summary,
        questions: quizData.diagnostic_quiz.questions,
        completed: false
      });

      setQuiz(createdQuiz);
      setUserAnswers(new Array(quizData.diagnostic_quiz.questions.length).fill(null));
    } catch (error) {
      console.error("Error generating quiz:", error);
    }
    setIsGenerating(false);
  };

  const handleAnswer = (answer) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestion] = answer;
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
                          <p className="text-sm text-slate-700">{q.question_text}</p>
                          {!isCorrect && (
                            <p className="text-xs text-slate-600 mt-2">
                              <strong>Correct:</strong> {q.correct_answer}
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
        <Card className="mb-6 shadow-xl sticky top-6 z-10 bg-white/95 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">{lesson.course_name}</h2>
            
            {quiz.smart_summary && (
              <div className="mb-4 p-4 bg-purple-50/50 rounded-lg border border-purple-200">
                <h3 className="font-semibold text-purple-900 mb-2">{quiz.smart_summary.title}</h3>
                <div className="prose prose-sm max-w-none text-slate-700">
                  <ReactMarkdown>{quiz.smart_summary.content_markdown}</ReactMarkdown>
                </div>
              </div>
            )}

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
            disabled={userAnswers[currentQuestion] === null || userAnswers[currentQuestion] === ""}
            className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
          >
            {currentQuestion === quiz.questions.length - 1 ? "Submit Quiz" : "Next Question"}
          </Button>
        </div>
      </div>
    </div>
  );
}