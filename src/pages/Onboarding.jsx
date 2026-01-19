import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Sparkles, AlertCircle, LogOut, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import OnboardingQuestion from "../components/onboarding/OnboardingQuestion";
// AddToHomeScreen removed - tracking kept via userTracking
import { trackUserSession } from "../components/utils/userTracking";

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
        const profiles = await base44.entities.LearningProfile.filter({ id: user.learning_profile_id });
        const profile = profiles[0];
        if (profile) {
          setAnswers({
            school: profile.school || "",
            grade: profile.grade || "",
            city: profile.city || ""
          });
        }
      }
    } catch {}
    setIsLoading(false);
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

      // Track user session after onboarding
      await trackUserSession();

      // Trigger welcome email (fire and forget, don't block)
      base44.functions.invoke('triggerAutomaticEmails', {
        trigger_type: 'onboarding_completed',
        user_email: user.email
      }).catch(emailError => {
        console.error('Error triggering welcome email:', emailError);
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

  // Get step-specific styling
  const getStepStyle = () => {
    const styles = [
      { 
        bg: 'from-purple-600 via-indigo-600 to-purple-700',
        accent: 'from-yellow-400 to-amber-500',
        icon: '🏫',
        subtitle: "Let's personalize your learning"
      },
      { 
        bg: 'from-indigo-600 via-purple-600 to-pink-600',
        accent: 'from-pink-400 to-rose-500',
        icon: '📚',
        subtitle: 'Tailored to your level'
      },
      { 
        bg: 'from-purple-700 via-violet-600 to-indigo-600',
        accent: 'from-emerald-400 to-teal-500',
        icon: '🌍',
        subtitle: 'Almost there!'
      }
    ];
    return styles[currentStep] || styles[0];
  };

  const stepStyle = getStepStyle();

  return (
    <div className={`min-h-screen bg-gradient-to-br ${stepStyle.bg} flex items-center justify-center p-4 transition-colors duration-300`}>
      <div className="w-full max-w-lg relative z-10">
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-2 text-white/70 hover:text-white hover:bg-white/10"
          >
            <LogOut className="w-4 h-4" />
            Back to Login
          </Button>
        </div>

        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{stepStyle.icon}</div>
          <h1 className="text-2xl font-bold text-white mb-1">{currentQuestion.question}</h1>
          <p className="text-white/70 text-sm">{stepStyle.subtitle}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {questions.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-200 ${
                idx === currentStep 
                  ? 'w-8 bg-white' 
                  : idx < currentStep 
                    ? 'w-2 bg-white/60' 
                    : 'w-2 bg-white/30'
              }`}
            />
          ))}
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-5 border border-white/20">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <AnimatePresence mode="wait">
            <div
              key={currentStep}
              className="animate-in fade-in slide-in-from-right-4 duration-200"
            >
              <OnboardingQuestion
                question={currentQuestion}
                value={answers[currentQuestion.id]}
                onChange={(value) => handleAnswer(currentQuestion.id, value)}
              />
            </div>
          </AnimatePresence>

          <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
            <Button
              variant="ghost"
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
              className={`bg-gradient-to-r ${stepStyle.accent} hover:opacity-90 text-white font-bold gap-2 px-6 shadow-lg`}
            >
              {currentStep === questions.length - 1 ? (
                isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Let's Go!
                  </>
                )
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-white/50 text-xs">Powered by StudyApp.AI</p>
        </div>
      </div>
    </div>
  );
}