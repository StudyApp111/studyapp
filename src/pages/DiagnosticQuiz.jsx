
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Brain, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import QuizQuestion from "../components/quiz/QuizQuestion";
import ConfettiEffect from "../components/gamification/ConfettiEffect";

export default function DiagnosticQuiz() {
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

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

      const existingQuiz = await base44.entities.DiagnosticQuiz.filter({
        lesson_id: lessonId
      });

      if (existingQuiz.length > 0) {
        console.log("Loading existing diagnostic quiz");
        const loadedQuiz = existingQuiz[0];
        setQuiz(loadedQuiz);

        if (loadedQuiz.completed) {
          navigate(createPageUrl("Worksheet") + `?lessonId=${lessonId}`);
          return;
        } else {
          setUserAnswers(loadedQuiz.user_answers || new Array(loadedQuiz.questions.length).fill(null));
        }
      } else {
        console.log("Generating new diagnostic quiz");
        await generateDiagnosticQuiz(lessonId, lessonData[0]);
      }
    } catch (error) {
      console.error("Error loading quiz:", error);
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

      // Determine the lesson content source
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
Content Source: ${contentDescription}

Task 1: Create the Smart Summary

Based on the curriculum map and considering the lesson content:

Structure & Content:
- Synthesize information primarily from core competencies and high-yield focal points.
- If lesson content is provided and is relevant, ensure this summary gives particular attention or slightly more detailed, clear explanations to those concepts.
- Organize the summary logically: begin with foundational concepts and smoothly progress to more complex or granular details, ensuring a natural flow of information.

Length Requirement:
- CRITICAL: The summary MUST be between 250-350 words total. Be concise and focused.
- Structure into 2-4 key sections with clear headings
- Prioritize the most essential concepts only

Language & Tone:
- Use clear, intuitive, and engaging language precisely tailored to the specified grade level for easy comprehension. Employ techniques like short sentences, relatable analogies (where appropriate), and simple definitions for key terminology.
- Maintain a consistently supportive, encouraging, and patient tone, as an effective teacher would when guiding a student.
- Where pedagogically valuable, briefly explain the importance or relevance of key concepts.

Math Notation for Summary:
- For superscripts (exponents, powers): use the format x^2 or E^2 (will be rendered properly)
- For subscripts (chemical formulas): use the format H_2O or C_6H_12O_6 (will be rendered properly)
- Use markdown italics for emphasis: *important concept*

Formatting for Summary:
- Use markdown: ## for headings, **bold** for key terms, *italic* for emphasis
- This markdown will be rendered in the summary display

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
   - DO NOT include letter prefixes in the options (no "A.", "B.", etc.) - just the answer text
   - One option must be the correct answer
   - Other 3 options should be plausible distractors that test common misconceptions
   - Example: ["Mitochondria", "Nucleus", "Ribosome", "Chloroplast"]

c. Question Text Formatting:
   - CRITICAL: Write question_text as PLAIN TEXT without any markdown formatting (no **, no *, no special formatting)
   - For math notation: use x^2 for superscripts, H_2O for subscripts (these will be auto-rendered)
   - Example: "Simplify the expression: (5x^-3y^2)(2x^5y^-1)"
   - DO NOT use **bold** or *italic* in question_text - just write plain text

d. Difficulty Index: Assign one label from:
   - "Foundational": Basic recall, definitions, essential facts, or core prerequisite skills
   - "Conceptual": Understanding of concepts, relationships between ideas, interpretations, or simple applications
   - "Applied/Multi-step": Application to new scenarios, or involves multiple steps/concepts

e. Targeted Misconception (Optional): If this question specifically tests a known common misconception, briefly state it. Otherwise use null.

Clarity & Appropriateness: Ensure all questions are clearly worded, unambiguous, and entirely appropriate for the specified grade level.

Output Format:
Provide your response as a single, valid JSON object with the following structure. Ensure the content_markdown field uses proper markdown formatting including ## for headings, ** for bold, * for italic, - for lists, and proper math notation (x^2, H_2O).`;

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
    setShowConfetti(true);
    
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const submitQuiz = async () => {
    setIsSubmitting(true);
    try {
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

      setShowConfetti(true);
      setTimeout(() => {
        navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}`);
      }, 3500);
    } catch (error) {
      console.error("Error submitting quiz:", error);
      alert("Failed to submit quiz. Please try again.");
      setIsSubmitting(false);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 pb-24 md:pb-6">
      <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-purple-200/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base md:text-xl font-bold text-slate-900 truncate">{lesson.course_name}</h2>
            <span className="text-xs md:text-sm font-medium text-slate-600 whitespace-nowrap ml-2">
              {currentQuestion + 1}/{quiz.questions.length}
            </span>
          </div>

          {quiz.smart_summary && (
            <div className="mb-2 p-2 md:p-3 bg-purple-50/50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between mb-1 cursor-pointer" onClick={() => setSummaryExpanded(!summaryExpanded)}>
                <h3 className="font-semibold text-xs md:text-sm text-purple-900">{quiz.smart_summary.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                >
                  {summaryExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <AnimatePresence>
                {summaryExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="prose prose-sm max-w-none text-slate-700 text-xs pt-2">
                      <ReactMarkdown>{quiz.smart_summary.content_markdown}</ReactMarkdown>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {!summaryExpanded && (
                <div className="prose prose-sm max-w-none text-slate-700 text-xs line-clamp-2">
                  <ReactMarkdown>{quiz.smart_summary.content_markdown}</ReactMarkdown>
                </div>
              )}
            </div>
          )}

          <Progress value={progress} className="h-1.5 md:h-2" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 md:py-6">
        <AnimatePresence mode="wait">
          <QuizQuestion
            key={currentQuestion}
            question={quiz.questions[currentQuestion]}
            questionNumber={currentQuestion + 1}
            selectedAnswer={userAnswers[currentQuestion]}
            onSelectAnswer={handleAnswer}
          />
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:left-[256px] z-30 bg-white border-t border-purple-200/60 shadow-2xl safe-area-inset-bottom">
        <div className="max-w-4xl mx-auto px-4 py-4 md:px-6 md:py-5">
          <div className="flex justify-between gap-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              size="lg"
              className="flex-1 min-h-[48px] md:min-h-[44px] text-base font-semibold touch-manipulation active:scale-95 transition-transform"
            >
              Previous
            </Button>
            {isLastQuestion ? (
              <Button
                onClick={submitQuiz}
                disabled={!canProceed || isSubmitting}
                size="lg"
                className="flex-1 min-h-[48px] md:min-h-[44px] bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-base font-semibold touch-manipulation active:scale-95 transition-transform"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
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
                size="lg"
                className="flex-1 min-h-[48px] md:min-h-[44px] bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-base font-semibold touch-manipulation active:scale-95 transition-transform"
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
