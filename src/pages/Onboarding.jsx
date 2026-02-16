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
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const user = await base44.auth.me();
        // If user just logged in (fromOnboarding param) OR has completed onboarding, send to Home
        const urlParams = new URLSearchParams(window.location.search);
        const fromOnboarding = urlParams.get('fromOnboarding');
        
        if (user && (user.onboarding_completed || fromOnboarding === 'true')) {
          navigate(createPageUrl("Home"), { replace: true });
          return;
        }
        // If authenticated but incomplete onboarding, let them continue
      }
      // Not authenticated - allow them to proceed with onboarding
    } catch {
      // Error checking auth - allow onboarding
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
      console.log('🗺️ Triggering curriculum mapping for course:', valueFromComponent);
      base44.functions.invoke('curriculumMapping', {
        courseName: valueFromComponent,
        learningProfile: {
          school: answersRef.current.school,
          grade: 'Post-Secondary'
        },
        extractedContent: null
        // No lessonId yet - onboarding flow
      })
        .then(result => {
          if (result.data) {
            console.log('✅ Curriculum mapping completed for onboarding');
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
      
      // Track Complete Registration TikTok event (user finished onboarding questions)
      try {
        if (window.ttq) {
          window.ttq.track('CompleteRegistration', {
            content_name: courseCode,
            content_category: school
          });
          console.log('📊 TikTok CompleteRegistration event sent');
        }
      } catch (ttqError) {
        console.error('TikTok tracking error (non-blocking):', ttqError);
      }
      
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

    // Progress tracks the current step position (not answered count)
    const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Gradient Hero Top */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900 via-indigo-950 to-slate-950 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-br from-purple-500/25 via-pink-500/15 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-lg md:max-w-2xl relative z-10">
        {/* StudyApp Branding - Logo + Text */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/ab568e731_LogoOnly.png"
            alt="StudyApp Logo"
            className="w-10 h-10 md:w-12 md:h-12"
          />
          <h1 className="text-3xl md:text-4xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-purple-300 font-medium">Step {currentStep + 1} of {totalSteps}</span>
            <span className="text-sm text-purple-300">{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 rounded-full transition-all duration-500 ease-out"
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
            onClick={async () => {
              const progressData = {
                name: answersRef.current.name,
                school: answersRef.current.school,
                courseCode: answersRef.current.courseCode,
                fromReportCard: false
              };
              sessionStorage.setItem('pendingOnboardingData', JSON.stringify(progressData));
              base44.auth.redirectToLogin(createPageUrl("Home") + "?fromOnboarding=true");
            }}
            className="text-slate-400 hover:text-slate-200 text-sm underline transition-colors"
          >
            Already a user? Sign In
          </button>
          <p className="text-slate-500 text-xs">Powered by StudyApp.AI</p>
        </div>
        </div>
        </div>
        </div>
        );
}