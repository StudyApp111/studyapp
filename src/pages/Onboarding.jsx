import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { trackUserSession } from "../components/utils/userTracking";

// Import onboarding components
import NameInput from "../components/onboarding/NameInput";
import SchoolInput from "../components/onboarding/SchoolInput";
import CourseCodeInput from "../components/onboarding/CourseCodeInput";

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Store answers in ref to avoid race conditions
  const answersRef = useRef({ name: '', school: '', courseCode: '' });
  const [answers, setAnswers] = useState({ name: '', school: '', courseCode: '' });

  // 3 questions: Name, School, Course Code
  const totalSteps = 3;

  useEffect(() => {
    checkExistingProfile();
  }, []);

  const checkExistingProfile = async () => {
    try {
      const user = await base44.auth.me();
      if (user && user.onboarding_completed) {
        navigate(createPageUrl("Home"), { replace: true });
        return;
      }
    } catch {
      // User not authenticated - that's OK for onboarding
    }
    setIsLoading(false);
  };

  const handleAnswer = (key, value) => {
    answersRef.current[key] = value;
    setAnswers(prev => ({ ...prev, [key]: value }));
    setError("");
  };

  const handleNext = (valueFromComponent, key) => {
    // Update ref immediately with passed value
    if (valueFromComponent && key) {
      answersRef.current[key] = valueFromComponent;
    }
    
    if (currentStep < totalSteps - 1) {
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
      window.location.href = '/';
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const name = answersRef.current.name || '';
      const school = answersRef.current.school || '';
      const courseCode = answersRef.current.courseCode || '';
      
      console.log('🚀 Submitting with:', { name, school, courseCode });
      
      // Navigate to DiagnosticQuiz with collected data
      const params = new URLSearchParams({ name, school, courseCode });
      navigate(createPageUrl("DiagnosticQuiz") + `?${params.toString()}`, { replace: true });

    } catch (error) {
      console.error("Error transitioning to diagnostic quiz:", error);
      setError(error.message || "Failed to proceed. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
      </div>
    );
    }

    // Calculate progress based on actual answered questions
    let answeredCount = 0;
    if (answersRef.current.name) answeredCount++;
    if (answersRef.current.school) answeredCount++;
    if (answersRef.current.courseCode) answeredCount++;
    const progress = (answeredCount / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg md:max-w-2xl relative z-10">
        {/* StudyApp Branding */}
        <div className="text-center mb-4">
          <h1 className="text-2xl md:text-3xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-purple-300 font-medium">Step {currentStep + 1} of {totalSteps}</span>
            <span className="text-sm text-purple-300">{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
          {error && (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Name */}
          {currentStep === 0 && (
            <NameInput
              value={answers.name}
              onChange={(val) => handleAnswer("name", val)}
              onNext={(val) => handleNext(val, "name")}
              onBack={null}
            />
          )}

          {/* Step 2: School */}
          {currentStep === 1 && (
            <SchoolInput
              value={answers.school}
              onChange={(val) => handleAnswer("school", val)}
              onNext={(val) => handleNext(val, "school")}
              onBack={handleBack}
            />
          )}

          {/* Step 3: Course Code */}
          {currentStep === 2 && (
            <CourseCodeInput
              value={answers.courseCode}
              onChange={(val) => handleAnswer("courseCode", val)}
              onNext={(val) => handleNext(val, "courseCode")}
              onBack={handleBack}
              school={answersRef.current.school}
            />
          )}

          {/* Loading state */}
          {isSubmitting && (
            <div className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-purple-300">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Preparing your quiz...</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-slate-500 text-xs">Powered by StudyApp.AI</p>
          <button
            onClick={() => base44.auth.redirectToLogin()}
            className="text-slate-500 hover:text-slate-300 text-xs underline transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}