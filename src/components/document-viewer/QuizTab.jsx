import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, Play, CheckCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import QuizQuestion from "@/components/quiz/QuizQuestion";
import { motion, AnimatePresence } from "framer-motion";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";

export default function QuizTab({ lesson, quiz: initialQuiz, onQuizComplete }) {
  const [quiz, setQuiz] = useState(initialQuiz);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [questionMetadata, setQuestionMetadata] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (quiz && !quiz.completed) {
      setUserAnswers(quiz.user_answers || new Array(quiz.questions?.length || 0).fill(null));
      setQuestionMetadata(quiz.question_metadata || new Array(quiz.questions?.length || 0).fill({}));
    }
  }, [quiz]);

  const generateQuiz = async () => {
    setIsGenerating(true);
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({
        id: user.learning_profile_id
      });

      const learningProfile = profile[0] || {};

      let contentDescription = "";
      if (lesson.input_type === "description" && lesson.description) {
        contentDescription = lesson.description;
      } else if (lesson.extracted_content) {
        contentDescription = lesson.extracted_content;
      } else {
        contentDescription = lesson.description || "N/A";
      }

      const aiPrompt = `Objective: You are an expert supportive tutor. Your goal is to design a 5-question "Diagnostic Quiz" with ONLY Multiple Choice Questions (MCQs) to effectively gauge the student's current understanding across core curriculum areas. This quiz will inform the creation of a subsequent personalized worksheet.

This entire experience should be warm, ${learningProfile.grade || 'student'}-friendly, and presented as if you are guiding the student step-by-step towards success.

CRITICAL: Base your questions EXCLUSIVELY on the provided lesson content below. Do NOT generate questions about unrelated topics.

Input Educational Context:

Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lesson.course_name}
School: ${learningProfile.school || "N/A"}
City/Region: ${learningProfile.city || "N/A"}
Detailed Curriculum Profile: ${JSON.stringify(lesson.curriculum_map)}

LESSON CONTENT (Questions MUST be based on this content but should not be taken literally. If user asks for help on a specific unit, or midterm, or final, or chapter, find that topic(s) within the curriculum and adhere to that. Do not produce questions like 'What does it mean to ask for a final exam' when user enters in the description 'I need help on my final exam'):
${contentDescription}

Task: Design the 5-Question Diagnostic Quiz

CRITICAL: ALL questions MUST be Multiple Choice Questions (MCQs) with exactly 4 answer options.

Grounded in mastery learning principles and utilizing the curriculum map. Ensure the 5 MCQs collectively provide broad diagnostic coverage across several distinct core competencies.

Question Design & Coverage (5 MCQ Questions Total):
- Each question must assess understanding of different core competencies
- Strive for a balance: include items that touch upon foundational skills/knowledge as well as those requiring more granular understanding or simple application
- Scaffold difficulty across the 5 questions (e.g., starting with a more accessible concept)

Question Characteristics (FOR EACH of the 5 MCQ questions):

a. Question Type: MUST be "Multiple Choice" or "MCQ"

b. Question Options - CRITICAL FORMATTING:
   - MUST provide exactly 4 plausible answer options
   - Each option should be JUST the answer text - NO letters, NO numbers, NO punctuation prefixes
   - DO NOT include: "A.", "B.", "C.", "D.", "A,", "A)", or ANY letter prefixes
   - CORRECT examples: ["Simile", "Metaphor", "Personification", "Hyperbole"]
   - WRONG examples: ["A. Simile", "A., Simile", "A,. ,Simile", "B,. ,Metaphor"]
   - All options MUST use proper capitalization
   - One option must be the correct answer
   - Other 3 options should be plausible distractors that test common misconceptions

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
Provide your response as a single, valid JSON object with the following structure.`;

      const { data: quizData } = await base44.functions.invoke('smartSummaryQuiz', {
        prompt: aiPrompt,
        response_json_schema: {
          type: "object",
          properties: {
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
      });

      const createdQuiz = await base44.entities.DiagnosticQuiz.create({
        lesson_id: lesson.id,
        questions: quizData.questions,
        completed: false
      });

      setQuiz(createdQuiz);
      setUserAnswers(new Array(quizData.questions.length).fill(null));
      setQuestionMetadata(new Array(quizData.questions.length).fill({}));
      setCurrentQuestion(0);
    } catch (error) {
      console.error("Error generating quiz:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (answer) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestion] = answer;
    setUserAnswers(newAnswers);
  };

  const handleMetadataChange = (metadata) => {
    const newMetadata = [...questionMetadata];
    newMetadata[currentQuestion] = {
      question_index: currentQuestion,
      ...metadata
    };
    setQuestionMetadata(newMetadata);
  };

  const handleNext = () => {
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
        question_metadata: questionMetadata,
        score: finalScore,
        completed: true
      });

      await base44.entities.Lesson.update(lesson.id, {
        status: "diagnostic_completed"
      });

      const user = await base44.auth.me();
      const currentPoints = user.total_points || 0;
      const newTotalPoints = currentPoints + 10;
      const newLevel = Math.floor(newTotalPoints / 100) + 1;

      await base44.auth.updateMe({
        total_points: newTotalPoints,
        level: newLevel
      });

      const updatedQuiz = { ...quiz, completed: true, score: finalScore };
      setQuiz(updatedQuiz);
      setShowConfetti(true);
      
      if (onQuizComplete) {
        onQuizComplete(updatedQuiz);
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
      alert("Failed to submit quiz. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col h-[600px]">
        <CardHeader className="border-b border-purple-200">
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Generating Quiz...
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mb-4" />
          <p className="text-slate-600 text-sm">Creating personalized questions for you...</p>
        </CardContent>
      </div>
    );
  }

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="flex flex-col h-[600px]">
        <CardHeader className="border-b border-purple-200">
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Diagnostic Quiz
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center mx-auto">
              <Brain className="w-10 h-10 text-purple-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Start Your Diagnostic Quiz</h3>
              <p className="text-slate-600 text-sm">
                Take a personalized quiz to assess your understanding and identify areas for improvement.
              </p>
            </div>
            <Button
              onClick={generateQuiz}
              className="bg-gradient-to-r from-purple-600 to-yellow-500 hover:from-purple-700 hover:to-yellow-600 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Generate Quiz
            </Button>
          </div>
        </CardContent>
      </div>
    );
  }

  if (quiz.completed) {
    return (
      <div className="flex flex-col h-[600px]">
        <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
        <CardHeader className="border-b border-purple-200">
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Quiz Results
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Quiz Completed!</h3>
              <div className="text-4xl font-bold text-yellow-600 mb-4">
                {quiz.score}%
              </div>
              <p className="text-slate-600 text-sm">
                Great job! Check out the Predicted Grade tab to continue your learning journey.
              </p>
            </div>
          </div>
        </CardContent>
      </div>
    );
  }

  const currentQ = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
  const currentMetadata = questionMetadata[currentQuestion] || {};
  const canProceed = userAnswers[currentQuestion] !== null && 
                     userAnswers[currentQuestion] !== "" &&
                     currentMetadata.reasoning_method &&
                     currentMetadata.confidence_level;
  const isLastQuestion = currentQuestion === quiz.questions.length - 1;

  return (
    <div className="flex flex-col h-[600px]">
      <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      <CardHeader className="border-b border-purple-200">
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Question {currentQuestion + 1} of {quiz.questions.length}
          </CardTitle>
        </div>
        <Progress value={progress} className="h-2" />
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          <QuizQuestion
            key={currentQuestion}
            question={currentQ}
            questionNumber={currentQuestion + 1}
            selectedAnswer={userAnswers[currentQuestion]}
            onSelectAnswer={handleAnswer}
            metadata={currentMetadata}
            onMetadataChange={handleMetadataChange}
          />
        </AnimatePresence>
      </CardContent>

      <div className="border-t border-purple-200 p-4">
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            size="lg"
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          {isLastQuestion ? (
            <Button
              onClick={submitQuiz}
              disabled={!canProceed || isSubmitting}
              size="lg"
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>Complete Quiz</>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              size="lg"
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}