import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import QuizQuestion from "@/components/quiz/QuizQuestion";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";

export default function QuizTab({ lesson, quiz, onQuizComplete }) {
  const [localQuiz, setLocalQuiz] = useState(quiz);
  const [isGenerating, setIsGenerating] = useState(!quiz);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [questionMetadata, setQuestionMetadata] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (quiz) {
      setLocalQuiz(quiz);
      setIsGenerating(false);
      if (!quiz.completed) {
        setUserAnswers(quiz.user_answers || new Array(quiz.questions.length).fill(null));
        setQuestionMetadata(quiz.question_metadata || new Array(quiz.questions.length).fill({}));
      }
    } else {
      generateQuiz();
    }
  }, [quiz, lesson]);

  const generateQuiz = async () => {
    if (!lesson) return;
    
    setIsGenerating(true);
    try {
      const existingQuiz = await base44.entities.DiagnosticQuiz.filter({
        lesson_id: lesson.id
      });

      if (existingQuiz.length > 0) {
        setLocalQuiz(existingQuiz[0]);
        if (!existingQuiz[0].completed) {
          setUserAnswers(existingQuiz[0].user_answers || new Array(existingQuiz[0].questions.length).fill(null));
          setQuestionMetadata(existingQuiz[0].question_metadata || new Array(existingQuiz[0].questions.length).fill({}));
        }
        setIsGenerating(false);
        return;
      }

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

      const aiPrompt = `Objective: You are an expert supportive tutor. Your goal is to design a 5-question "Diagnostic Quiz" with ONLY Multiple Choice Questions (MCQs) to effectively gauge the student's current understanding across core curriculum areas.

This entire experience should be warm, ${learningProfile.grade || 'student'}-friendly, and presented as if you are guiding the student step-by-step towards success.

CRITICAL: Base your questions EXCLUSIVELY on the provided lesson content below.

Input Educational Context:
Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lesson.course_name}
School: ${learningProfile.school || "N/A"}
City/Region: ${learningProfile.city || "N/A"}
Detailed Curriculum Profile: ${JSON.stringify(lesson.curriculum_map)}

LESSON CONTENT:
${contentDescription}

Task: Design the 5-Question Diagnostic Quiz

CRITICAL: ALL questions MUST be Multiple Choice Questions (MCQs) with exactly 4 answer options.

Question Design & Coverage (5 MCQ Questions Total):
- Each question must assess understanding of different core competencies
- Strive for a balance: include items that touch upon foundational skills/knowledge as well as those requiring more granular understanding or simple application
- Scaffold difficulty across the 5 questions

Question Characteristics (FOR EACH of the 5 MCQ questions):

a. Question Type: MUST be "Multiple Choice" or "MCQ"

b. Question Options - CRITICAL FORMATTING:
   - MUST provide exactly 4 plausible answer options
   - Each option should be JUST the answer text - NO letters, NO numbers, NO punctuation prefixes
   - DO NOT include: "A.", "B.", "C.", "D.", "A,", "A)", or ANY letter prefixes
   - CORRECT examples: ["Simile", "Metaphor", "Personification", "Hyperbole"]
   - All options MUST use proper capitalization
   - One option must be the correct answer
   - Other 3 options should be plausible distractors

c. Question Text Formatting:
   - CRITICAL: Write question_text as PLAIN TEXT without any markdown formatting
   - For math notation: use x^2 for superscripts, H_2O for subscripts

d. Difficulty Index: Assign one label from:
   - "Foundational": Basic recall, definitions, essential facts
   - "Conceptual": Understanding of concepts, relationships
   - "Applied/Multi-step": Application to new scenarios

e. Targeted Misconception: If this question tests a known common misconception, briefly state it. Otherwise use null.`;

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

      setLocalQuiz(createdQuiz);
      setUserAnswers(new Array(quizData.questions.length).fill(null));
      setQuestionMetadata(new Array(quizData.questions.length).fill({}));
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

  const handleMetadataChange = (metadata) => {
    const newMetadata = [...questionMetadata];
    newMetadata[currentQuestion] = {
      question_index: currentQuestion,
      ...metadata
    };
    setQuestionMetadata(newMetadata);
  };

  const handleNext = () => {
    setShowConfetti(true);
    if (currentQuestion < localQuiz.questions.length - 1) {
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
        const correctAnswer = String(localQuiz.questions[idx].correct_answer || "").trim().toLowerCase();
        return userAnswer === correctAnswer;
      }).length;

      const finalScore = (correctAnswers / localQuiz.questions.length) * 100;

      const updatedQuiz = await base44.entities.DiagnosticQuiz.update(localQuiz.id, {
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

      setShowConfetti(true);
      onQuizComplete(updatedQuiz);
      setTimeout(() => {
        window.dispatchEvent(new Event('switchToExamTab'));
      }, 2000);
    } catch (error) {
      console.error("Error submitting quiz:", error);
      setIsSubmitting(false);
    }
  };

  if (isGenerating) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl min-h-[400px] shadow-xl flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Generating Diagnostic Quiz</h3>
            <p className="text-sm text-slate-600 mt-1">Creating personalized questions based on your content...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!localQuiz || !localQuiz.questions || localQuiz.questions.length === 0) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl min-h-[400px] shadow-xl flex items-center justify-center p-8">
        <p className="text-slate-600">Unable to load quiz</p>
      </Card>
    );
  }

  if (localQuiz.completed) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl min-h-[400px] shadow-xl flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Quiz Completed!</h3>
            <p className="text-slate-600 mt-2">Move to the Exam tab to start your practice</p>
          </div>
          <Button
            onClick={() => window.dispatchEvent(new Event('switchToExamTab'))}
            className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
          >
            Go to Exams
          </Button>
        </div>
      </Card>
    );
  }

  const currentQ = localQuiz.questions[currentQuestion];
  if (!currentQ) return null;

  const progress = ((currentQuestion + 1) / localQuiz.questions.length) * 100;
  const currentMetadata = questionMetadata[currentQuestion] || {};
  const canProceed = userAnswers[currentQuestion] !== null && 
                     userAnswers[currentQuestion] !== "" &&
                     currentMetadata.reasoning_method &&
                     currentMetadata.confidence_level;
  const isLastQuestion = currentQuestion === localQuiz.questions.length - 1;

  return (
    <>
      <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl overflow-hidden mx-1 md:mx-0">
        <div className="border-b border-purple-200/60 p-2 md:p-4">
          <div className="flex items-center justify-between mb-1.5 md:mb-2">
            <h2 className="text-sm md:text-lg font-bold text-slate-900">Diagnostic Quiz</h2>
            <span className="text-xs md:text-sm font-medium text-slate-600">
              {currentQuestion + 1}/{localQuiz.questions.length}
            </span>
          </div>
          <Progress value={progress} className="h-1.5 md:h-2" />
        </div>

        <div className="p-2 md:p-6">
          <AnimatePresence mode="wait">
            <QuizQuestion
              key={currentQuestion}
              question={localQuiz.questions[currentQuestion]}
              questionNumber={currentQuestion + 1}
              selectedAnswer={userAnswers[currentQuestion]}
              onSelectAnswer={handleAnswer}
              metadata={currentMetadata}
              onMetadataChange={handleMetadataChange}
            />
          </AnimatePresence>

          <div className="mt-3 md:mt-6 flex gap-2 md:gap-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              className="flex-1 text-xs md:text-sm h-9 md:h-10"
            >
              Previous
            </Button>
            {isLastQuestion ? (
              <Button
                onClick={submitQuiz}
                disabled={!canProceed || isSubmitting}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-xs md:text-sm h-9 md:h-10"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Complete Quiz"
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-xs md:text-sm h-9 md:h-10"
              >
                Next Question
              </Button>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}