import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Sparkles, AlertCircle, LogOut, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import OnboardingQuestion from "../components/onboarding/OnboardingQuestion";

const questions = [
  {
    id: "school",
    question: "What School Do You Go To?",
    type: "text",
    placeholder: "e.g., Lincoln High School, University of Toronto"
  },
  {
    id: "grade",
    question: "What Grade Are You In?",
    type: "single",
    options: [
      "Grade 6",
      "Grade 7", 
      "Grade 8",
      "Grade 9",
      "Grade 10",
      "Grade 11",
      "Grade 12",
      "1st Year University",
      "2nd Year University",
      "3rd Year University",
      "4th Year University",
      "Post Graduate"
    ]
  },
  {
    id: "city",
    question: "What City Do You Live In?",
    type: "text",
    placeholder: "e.g., New York City, Toronto, London"
  }
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadExistingProfile();
  }, []);

  const loadExistingProfile = async () => {
    try {
      const user = await base44.auth.me();
      
      if (user.learning_profile_id) {
        const profiles = await base44.entities.LearningProfile.filter({ 
          id: user.learning_profile_id 
        });
        
        if (profiles.length > 0) {
          const profile = profiles[0];
          setAnswers({
            school: profile.school || "",
            grade: profile.grade || "",
            city: profile.city || ""
          });
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const progress = ((currentStep + 1) / questions.length) * 100;

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    setError("");
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

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
    } catch (error) {
      console.error("Error logging out:", error);
      window.location.href = '/';
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError("");
    
    try {
      if (!answers.school || !answers.grade || !answers.city) {
        throw new Error("Please answer all questions before completing onboarding");
      }

      const profileData = {
        school: answers.school.trim(),
        grade: answers.grade.trim(),
        city: answers.city.trim()
      };

      const user = await base44.auth.me();
      
      let profile;
      if (user.learning_profile_id) {
        const existingProfiles = await base44.entities.LearningProfile.filter({ 
          id: user.learning_profile_id 
        });
        
        if (existingProfiles.length > 0) {
          profile = await base44.entities.LearningProfile.update(user.learning_profile_id, profileData);
        } else {
          profile = await base44.entities.LearningProfile.create(profileData);
          await base44.auth.updateMe({
            learning_profile_id: profile.id
          });
        }
      } else {
        profile = await base44.entities.LearningProfile.create(profileData);
        await base44.auth.updateMe({
          learning_profile_id: profile.id
        });
      }

      await base44.auth.updateMe({
        onboarding_completed: true
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      
      navigate(createPageUrl("Home"), { replace: true });
    } catch (error) {
      console.error("Error saving profile:", error);
      setError(error.message || "Failed to complete onboarding. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    );
  }

  const currentQuestion = questions[currentStep];
  const isAnswered = answers[currentQuestion.id] !== undefined && answers[currentQuestion.id] !== "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2 bg-white/90 backdrop-blur-sm shadow-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300"
          >
            <LogOut className="w-4 h-4" />
            Back to Login
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center mb-6">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/02b2ff5d6_StudyAppAI500x500.png"
              alt="StudyApp.AI Logo"
              className="w-24 h-24 rounded-2xl shadow-2xl"
            />
          </div>
          <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg mb-4">
            <Sparkles className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-slate-700">Get Started</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Welcome to StudyApp.AI</h1>
          <p className="text-slate-600">Tell us a bit about yourself to personalize your experience</p>
        </motion.div>

        <Card className="bg-white/90 backdrop-blur-sm shadow-2xl border-0">
          <CardContent className="p-8">
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-slate-600">
                  Question {currentStep + 1} of {questions.length}
                </span>
                <span className="text-sm font-medium text-yellow-600">{Math.round(progress)}%</span>
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
                disabled={currentStep === 0 || isSubmitting}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!isAnswered || isSubmitting}
                className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-slate-900 font-semibold gap-2"
              >
                {currentStep === questions.length - 1 ? (
                  isSubmitting ? "Saving..." : "Complete"
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