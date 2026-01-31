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
import DocumentUploadStep from "../components/onboarding/DocumentUploadStep";

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Store answers in ref to avoid race conditions
  const answersRef = useRef({ 
    name: '', 
    school: '', 
    courseCode: '', 
    documentData: null, 
    curriculumData: null 
  });
  const [answers, setAnswers] = useState({ name: '', school: '', courseCode: '' });
  const [isMappingCurriculum, setIsMappingCurriculum] = useState(false);

  // 4 steps: Name, School, Course Code, Optional Document Upload
  const totalSteps = 4;

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

  const handleNext = async (valueFromComponent, key) => {
    // Update ref immediately with passed value
    if (valueFromComponent && key) {
      answersRef.current[key] = valueFromComponent;
    }
    
    // After course code (step 2), trigger curriculum mapping in background
    if (currentStep === 2 && key === 'courseCode') {
      setIsMappingCurriculum(true);
      
      // Run curriculum mapping in background (don't await)
      base44.functions.invoke('curriculumMapping', {
        courseName: valueFromComponent,
        learningProfile: {
          school: answersRef.current.school,
          grade: 'Post-Secondary'
        },
        extractedContent: null
      })
        .then(result => {
          if (result.data) {
            answersRef.current.curriculumData = result.data;
          }
        })
        .catch(err => {
          console.error('Curriculum mapping failed:', err);
        })
        .finally(() => {
          setIsMappingCurriculum(false);
        });
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

  const handleDocumentUpload = (documentData) => {
    answersRef.current.documentData = documentData;
    handleSubmit();
  };

  const handleSkipDocument = () => {
    handleSubmit();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const name = answersRef.current.name || '';
      const school = answersRef.current.school || '';
      const courseCode = answersRef.current.courseCode || '';
      const documentData = answersRef.current.documentData;
      const curriculumData = answersRef.current.curriculumData;
      
      console.log('🚀 Submitting with:', { name, school, courseCode, hasDocument: !!documentData, hasCurriculum: !!curriculumData });
      
      // Navigate to DiagnosticQuiz with collected data
      const params = new URLSearchParams({ 
        name, 
        school, 
        courseCode,
        ...(documentData?.compressedContent && { documentContent: documentData.compressedContent }),
        ...(curriculumData && { curriculumData: JSON.stringify(curriculumData) })
      });
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
    if (currentStep >= 3) answeredCount++; // Document step (can be skipped)
    const progress = (answeredCount / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-lg md:max-w-2xl relative z-10">
        {/* StudyApp Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black text-white drop-shadow-lg">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* Progress Bar */}
        <div className="mb-6 bg-white/20 backdrop-blur-sm rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white font-semibold">Step {currentStep + 1} of {totalSteps}</span>
            <span className="text-sm text-white/90">{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-yellow-400 to-pink-400 rounded-full transition-all duration-500 ease-out shadow-lg"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl shadow-2xl overflow-hidden">
          {error && (
            <Alert variant="destructive" className="m-4 bg-red-50 border-red-200">
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

          {/* Step 4: Optional Document Upload */}
          {currentStep === 3 && (
            <DocumentUploadStep
              userName={answersRef.current.name}
              courseName={answersRef.current.courseCode}
              onNext={handleDocumentUpload}
              onBack={handleBack}
              onSkip={handleSkipDocument}
            />
          )}

          {/* Loading state */}
          {(isSubmitting || isMappingCurriculum) && (
            <div className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-purple-300">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{isMappingCurriculum ? 'Analyzing course...' : 'Preparing your quiz...'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-3">
          <button
            onClick={() => base44.auth.redirectToLogin()}
            className="text-white/80 hover:text-white text-sm underline transition-colors font-medium"
          >
            Already a user? Sign In
          </button>
          <p className="text-white/60 text-xs">Powered by StudyApp.AI</p>
        </div>
        </div>
        </div>
        );
}