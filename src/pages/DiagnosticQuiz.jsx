
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Brain } from "lucide-react"; // Removed CheckCircle, XCircle as they are no longer used
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
  const [isSubmitting, setIsSubmitting] = useState(false); // Added isSubmitting state

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');

    if (!lessonId) {
      navigate(createPageUrl("Home"));
      return;
    }

    loadOrGenerateQuiz(lessonId);
  }, [navigate]);

  const loadOrGenerateQuiz = async (lessonId) => {
    setIsGenerating(true);
    try {
      const lessonData = await base44.entities.Lesson.filter({ id: lessonId });
      if (lessonData.length === 0) {
        navigate(createPageUrl("Home"));
        return;
      }
      setLesson(lessonData[0]);

      // Check if a quiz already exists for this lesson
      const existingQuiz = await base44.entities.DiagnosticQuiz.filter({
        lesson_id: lessonId
      });

      if (existingQuiz.length > 0) {
        // Load existing quiz
        console.log("Loading existing diagnostic quiz");
        const loadedQuiz = existingQuiz[0];
        setQuiz(loadedQuiz);

        // Check if quiz was already completed
        if (loadedQuiz.completed) {
          // If completed, directly navigate to worksheet
          navigate(createPageUrl("Worksheet") + `?lessonId=${lessonId}`);
          return; // Important: exit early after navigating
        } else {
          // Quiz exists but not completed - resume where they left off
          setUserAnswers(loadedQuiz.user_answers || new Array(loadedQuiz.questions.length).fill(null));
        }
      } else {
        // Generate new quiz
        console.log("Generating new diagnostic quiz");
        await generateDiagnosticQuiz(lessonId, lessonData[0]);
      }
    } catch (error) {
      console.error("Error loading quiz:", error);
      // Optionally navigate to home or show an error on failure to load/generate
      navigate(createPageUrl("Home"));
    }
    setIsGenerating(false);
  };

  const generateDiagnosticQuiz = async (lessonId, lessonData) => {
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({
        id: user.learning_profile_id
      });

      const learningProfile = profile[0] || {};

      const aiPrompt = `Objective: You are an expert supportive tutor. Your goal is to:

Create a clear, concise, and engaging "Smart Summary" of key concepts for the student, leveraging the provided detailed curriculum.

Design a 5-question "Diagnostic Quiz" with ONLY Multiple Choice Questions (MCQs) to effectively gauge the student's current understanding across core curriculum areas. This quiz will inform the creation of a subsequent personalized worksheet.

This entire experience should be warm, ${learningProfile.grade || 'student'}-friendly, and presented as if you are guiding the student step-by-step towards success.

Input Educational Context:

Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lessonData.course_name}
School: ${learningProfile.school || "N/A"}
City/Region: ${learningProfile.city || "N/A"}
Detailed Curriculum Profile: ${JSON.stringify(lessonData.curriculum_map)}
Student Description: ${lessonData.description || "N/A"}

Task 1: Create the Smart Summary

Based on the curriculum map and considering any student description:

Structure & Content:
- Synthesize information primarily from core competencies and high-yield focal points.
- If a student description is provided and is relevant, ensure this summary gives particular attention or slightly more detailed, clear explanations to those concepts.
- Organize the summary logically: begin with foundational concepts and smoothly progress to more complex or granular details, ensuring a natural flow of information.

Length Requirement:
- CRITICAL: The summary MUST be between 250-350 words total. Be concise and focused.
- Structure into 2-4 key sections with clear headings
- Prioritize the most essential concepts only

Language & Tone:
- Use clear, intuitive, and engaging language precisely tailored to the specified grade level for easy comprehension. Employ techniques like short sentences, relatable analogies (where appropriate), and simple definitions for key terminology.
- Maintain a consistently supportive, encouraging, and patient tone, as an effective teacher would when guiding a student.
- Where pedagogically valuable, briefly explain the importance or relevance of key concepts.

Math Notation:
- For superscripts (exponents, powers): use the format x^2 or E^2 (will be rendered properly)
- For subscripts (chemical formulas): use the format H_2O or C_6H_12O_6 (will be rendered properly)
- Use italics for variables: *x*, *y*, *velocity*
- Example: "The equation *E* = *m*c^2 shows that energy equals mass times the speed of light squared"

Formatting:
- Use markdown: ## for headings, **bold** for key terms, *italic* for emphasis and variables, - for lists

Task 2: Design the 5-Question Diagnostic Quiz

CRITICAL: ALL questions MUST be Multiple Choice Questions (MCQs) with exactly 4 answer options.

Grounded in mastery learning principles and utilizing the curriculum map. Ensure the 5 MCQs collectively provide broad diagnostic coverage across several distinct core competencies.

Question Design & Coverage (5 MCQ Questions Total):
- Each question must assess understanding of different core competencies
- Strive for a balance: include items that touch upon foundational skills/knowledge as well as those requiring more granular understanding or simple application
- Scaffold difficulty across the 5 questions (e.g., starting with a more accessible concept)

Question Characteristics (FOR EACH of the 5 MCQ questions):

a. Question Type: MUST be "Multiple Choice" or "MCQ"

b. Question Options: 
   - MUST provide exactly 4 plausible answer options
   - All options MUST use proper capitalization and maintain original case
   - One option must be the correct answer
   - Other 3 options should be plausible distractors that test common misconceptions
   - Example: ["Mitochondria", "Nucleus", "Ribosome", "Chloroplast"]

c. Question Text Formatting:
   - Use markdown for formatting: **bold** for emphasis, *italic* for variables/special terms
   - For math notation: use x^2 for superscripts, H_2O for subscripts, *x* for variables
   - Example: "If *x*^2 + 5*x* + 6 = 0, what are the values of *x*?"

d. Difficulty Index: Assign one label from:
   - "Foundational": Basic recall, definitions, essential facts, or core prerequisite skills
   - "Conceptual": Understanding of concepts, relationships between ideas, interpretations, or simple applications
   - "Applied/Multi-step": Application to new scenarios, or involves multiple steps/concepts

e. Targeted Misconception (Optional): If this question specifically tests a known common misconception, briefly state it. Otherwise use null.

Clarity & Appropriateness: Ensure all questions are clearly worded, unambiguous, and entirely appropriate for the specified grade level.

Output Format:
Provide your response as a single, valid JSON object with the following structure. Ensure the content_markdown field uses proper markdown formatting including ## for headings, ** for bold, * for italic and variables, - for lists, and proper math notation (x^2, H_2O).`;

      const { data: quizData } = await base44.functions.invoke('smartSummaryQuiz', {
        prompt: aiPrompt,
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
                      question_type: { type: "string", enum: ["Multiple Choice", "MCQ"] },
                      difficulty_index: { type: "string" },
                      targeted_misconception: { type: "string" },
                      question_text: { type: "string" },
                      options: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 4,
                        maxItems: 4
                      },
                      correct_answer: { type: "string" }
                    },
                    required: ["question_number", "question_type", "difficulty_index", "question_text", "options", "correct_answer"]
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
      navigate(createPageUrl("Home"));
    }
  };

  const handleAnswer = (answer) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestion] = answer;
    setUserAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
    // The submitQuiz logic is now handled directly by the button when it's the last question
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const submitQuiz = async () => {
    setIsSubmitting(true); // Set submitting state to true
    try {
      // Improved validation - trim whitespace and case-insensitive comparison
      const correctAnswers = userAnswers.filter((answer, idx) => {
        const userAnswer = String(answer || "").trim().toLowerCase();
        const correctAnswer = String(quiz.questions[idx].correct_answer || "").trim().toLowerCase();
        return userAnswer === correctAnswer;
      }).length;

      const finalScore = (correctAnswers / quiz.questions.length) * 100;

      await base44.entities.DiagnosticQuiz.update(quiz.id, {
        user_answers: userAnswers,
        score: finalScore,
        completed: true
      });

      await base44.entities.Lesson.update(lesson.id, {
        status: "diagnostic_completed"
      });

      // Directly proceed to worksheet - don't show results
      navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}`);
    } catch (error) {
      console.error("Error submitting quiz:", error);
      alert("Failed to submit quiz. Please try again.");
      setIsSubmitting(false); // Reset submitting state on error
    }
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-4 md:p-6">
        <Card className="w-full max-w-md text-center p-6 md:p-8 shadow-2xl">
          <Brain className="w-12 h-12 md:w-16 md:h-16 mx-auto text-purple-600 mb-4 animate-pulse" />
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
            {quiz ? "Loading Your Diagnostic Quiz" : "Generating Your Diagnostic Quiz"}
          </h2>
          <p className="text-sm md:text-base text-slate-600 mb-6">
            {quiz
              ? "Retrieving your saved quiz..."
              : "Our AI is analyzing the curriculum and creating personalized questions..."}
          </p>
          <Loader2 className="w-6 h-6 md:w-8 md:h-8 mx-auto animate-spin text-purple-600" />
        </Card>
      </div>
    );
  }

  if (!quiz) return null;

  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
  const canProceed = userAnswers[currentQuestion] !== null && userAnswers[currentQuestion] !== "";
  const isLastQuestion = currentQuestion === quiz.questions.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-3 md:p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-4 md:mb-6 shadow-xl sticky top-2 md:top-6 z-10 bg-white/95 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <h2 className="text-lg md:text-2xl font-bold text-slate-900 mb-2 md:mb-3">{lesson.course_name}</h2>

            {quiz.smart_summary && (
              <div className="mb-3 md:mb-4 p-3 md:p-4 bg-purple-50/50 rounded-lg border border-purple-200">
                <h3 className="font-semibold text-sm md:text-base text-purple-900 mb-2">{quiz.smart_summary.title}</h3>
                <div className="prose prose-sm max-w-none text-slate-700 text-xs md:text-sm">
                  <ReactMarkdown>{quiz.smart_summary.content_markdown}</ReactMarkdown>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 md:gap-3">
              <Progress value={progress} className="flex-1 h-2 md:h-3" />
              <span className="text-xs md:text-sm font-medium text-slate-600 whitespace-nowrap">
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

        <div className="flex justify-between mt-4 md:mt-6">
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
              onClick={submitQuiz}
              disabled={!canProceed || isSubmitting}
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 md:text-base"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Submitting...</span>
                  <span className="sm:hidden">Submit</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Complete & Continue</span>
                  <span className="sm:hidden">Complete</span>
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
  );
}
