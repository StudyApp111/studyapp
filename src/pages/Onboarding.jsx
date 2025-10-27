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
    id: "school",
    question: "What school do you attend?",
    type: "text",
    placeholder: "e.g., Lincoln High School"
  },
  {
    id: "grade",
    question: "What grade are you in?",
    type: "single",
    options: ["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "College/University", "Other"]
  },
  {
    id: "city",
    question: "What city do you live in?",
    type: "text",
    placeholder: "e.g., New York City"
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
        school: answers.school,
        grade: answers.grade,
        city: answers.city
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg mb-4">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-slate-700">Get Started</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Welcome to StudyApp.AI</h1>
          <p className="text-slate-600">Tell us a bit about yourself</p>
        </motion.div>

        <Card className="bg-white/90 backdrop-blur-sm shadow-2xl border-0">
          <CardContent className="p-8">
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-slate-600">
                  Question {currentStep + 1} of {questions.length}
                </span>
                <span className="text-sm font-medium text-purple-600">{Math.round(progress)}%</span>
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
                className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 gap-2"
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