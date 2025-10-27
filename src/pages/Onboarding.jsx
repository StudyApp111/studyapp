import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import OnboardingQuestion from "../components/onboarding/OnboardingQuestion";

const questions = [
  {
    id: "learning_style",
    question: "How do you learn best?",
    type: "single",
    options: ["Visual (images, diagrams)", "Auditory (listening, discussion)", "Kinesthetic (hands-on, practice)"]
  },
  {
    id: "experience_level",
    question: "What's your current experience level?",
    type: "single",
    options: ["Beginner - Just starting out", "Intermediate - Some knowledge", "Advanced - Experienced learner"]
  },
  {
    id: "study_time",
    question: "How much time can you dedicate per week?",
    type: "single",
    options: ["1-3 hours", "4-7 hours", "8-12 hours", "12+ hours"]
  },
  {
    id: "preferred_pace",
    question: "What's your preferred learning pace?",
    type: "single",
    options: ["Slow and steady", "Moderate pace", "Fast-paced and intensive"]
  },
  {
    id: "goals",
    question: "What are your main learning goals?",
    type: "text",
    placeholder: "e.g., Career advancement, personal development, exam preparation..."
  },
  {
    id: "interests",
    question: "What subjects interest you most?",
    type: "multiple",
    options: ["Technology", "Business", "Science", "Arts", "Mathematics", "Languages", "Health", "Other"]
  },
  {
    id: "challenges",
    question: "What challenges do you face when learning?",
    type: "text",
    placeholder: "e.g., Time management, staying motivated, understanding complex concepts..."
  },
  {
    id: "motivation",
    question: "What motivates you to learn?",
    type: "single",
    options: ["Career growth", "Personal satisfaction", "Certification/Degree", "Problem-solving", "Curiosity"]
  },
  {
    id: "preferred_format",
    question: "Which content format do you prefer?",
    type: "single",
    options: ["Video lessons", "Text and reading", "Interactive exercises", "Mixed formats"]
  },
  {
    id: "background",
    question: "Tell us about your educational background",
    type: "text",
    placeholder: "e.g., High school, Bachelor's degree, Self-taught..."
  }
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = ((currentStep + 1) / questions.length) * 100;

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const profileData = {
        learning_style: answers.learning_style,
        experience_level: answers.experience_level,
        study_time: answers.study_time,
        preferred_pace: answers.preferred_pace,
        goals: answers.goals,
        interests: answers.interests || [],
        challenges: answers.challenges,
        motivation: answers.motivation,
        preferred_format: answers.preferred_format,
        background: answers.background
      };

      const profile = await base44.entities.LearningProfile.create(profileData);
      await base44.auth.updateMe({
        onboarding_completed: true,
        learning_profile_id: profile.id
      });

      navigate(createPageUrl("Home"));
    } catch (error) {
      console.error("Error saving profile:", error);
    }
    setIsSubmitting(false);
  };

  const currentQuestion = questions[currentStep];
  const isAnswered = answers[currentQuestion.id] !== undefined && answers[currentQuestion.id] !== "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg mb-4">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-medium text-slate-700">Personalized Learning Journey</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Welcome to LearnSmart</h1>
          <p className="text-slate-600">Let's personalize your learning experience</p>
        </motion.div>

        <Card className="bg-white/80 backdrop-blur-sm shadow-2xl border-0">
          <CardContent className="p-8">
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-slate-600">
                  Question {currentStep + 1} of {questions.length}
                </span>
                <span className="text-sm font-medium text-indigo-600">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <OnboardingQuestion
                  question={currentQuestion}
                  value={answers[currentQuestion.id]}
                  onChange={(value) => handleAnswer(currentQuestion.id, value)}
                />
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!isAnswered || isSubmitting}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 gap-2"
              >
                {currentStep === questions.length - 1 ? (
                  isSubmitting ? "Creating Profile..." : "Complete"
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}