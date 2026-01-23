import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Sparkles, AlertCircle, LogOut, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trackUserSession } from "../components/utils/userTracking";

// Import onboarding components
import StudyTypeSelector from "../components/onboarding/StudyTypeSelector";
import UniversityYearSelector from "../components/onboarding/UniversityYearSelector";
import OnboardingQuestion from "../components/onboarding/OnboardingQuestion";
import CourseNameInput from "../components/onboarding/CourseNameInput";
import MaterialUploader from "../components/onboarding/MaterialUploader";
import OnboardingLoader from "../components/onboarding/OnboardingLoader";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/ea1c6b1a9_StudyAppAI1024x1024px.png";

// Question definitions
const baseQuestions = [
  {
    id: "study_type",
    question: "What are you studying for?",
    type: "study-type",
    icon: "🎯",
    subtitle: "Select your learning path"
  },
  {
    id: "university_year",
    question: "What year are you in?",
    type: "university-year",
    icon: "📅",
    subtitle: "Tell us where you are in your journey",
    showIf: (answers) => answers.study_type === "university"
  },
  {
    id: "school",
    question: "What School Do You Go To?",
    type: "school-search",
    placeholder: "Search for your school...",
    icon: "🏫",
    subtitle: "Let's personalize your learning",
    showIf: (answers) => ["university", "grad_school", "high_school", "med_school"].includes(answers.study_type)
  },
  {
    id: "course_name",
    question: "What course would you like to study?",
    type: "course-name",
    icon: "📚",
    subtitle: "We'll create your first lesson"
  },
  {
    id: "materials",
    question: "StudyApp will predict your grade and help you study.",
    type: "materials",
    icon: "✨",
    subtitle: "Upload your materials to get started"
  }
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [materialData, setMaterialData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(false);
  const [loaderComplete, setLoaderComplete] = useState(false);
  const [createdLessonId, setCreatedLessonId] = useState(null);
  const [error, setError] = useState("");
  
  // Prefetch schools data on mount
  const prefetchedSchoolsRef = useRef(null);

  useEffect(() => {
    checkExistingProfile();
    // Prefetch nearby schools immediately on page load
    prefetchNearbySchools();
  }, []);

  const prefetchNearbySchools = async () => {
    try {
      const result = await base44.functions.invoke('getNearbySchools', { searchQuery: '' });
      if (result?.data?.success) {
        prefetchedSchoolsRef.current = {
          schools: result.data.schools || [],
          location: result.data.location
        };
      }
    } catch (error) {
      console.warn("Prefetch schools error:", error);
    }
  };

  const checkExistingProfile = async () => {
    try {
      const user = await base44.auth.me();
      if (user.onboarding_completed) {
        navigate(createPageUrl("Home"), { replace: true });
        return;
      }
    } catch {}
    setIsLoading(false);
  };

  // Get visible questions based on answers
  const getVisibleQuestions = () => {
    return baseQuestions.filter(q => !q.showIf || q.showIf(answers));
  };

  const visibleQuestions = getVisibleQuestions();
  const currentQuestion = visibleQuestions[currentStep];
  const totalSteps = visibleQuestions.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    setError("");
  };

  const handleMaterialReady = (data) => {
    setMaterialData(data);
  };

  const isCurrentAnswered = () => {
    if (!currentQuestion) return false;
    
    if (currentQuestion.id === "materials") {
      return materialData !== null;
    }
    
    const answer = answers[currentQuestion.id];
    return answer !== undefined && answer !== "";
  };

  const handleNext = () => {
    if (currentStep < visibleQuestions.length - 1) {
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
    setShowLoader(true);

    try {
      const user = await base44.auth.me();

      // 1. Create/update learning profile
      const profileData = {
        school: answers.school || "",
        grade: answers.university_year || answers.study_type || "",
        study_type: answers.study_type
      };

      let profile;
      if (user.learning_profile_id) {
        profile = await base44.entities.LearningProfile.update(user.learning_profile_id, profileData);
      } else {
        profile = await base44.entities.LearningProfile.create(profileData);
        await base44.auth.updateMe({ learning_profile_id: profile.id });
      }

      // 2. Create the lesson
      const lessonData = {
        course_name: answers.course_name,
        status: "created"
      };

      // Handle different material types
      if (materialData?.type === "file" && materialData.files?.length > 0) {
        lessonData.file_url = materialData.files[0].url;
        lessonData.file_urls = materialData.files.map(f => f.url);
        lessonData.input_type = "file";
      } else if (materialData?.type === "notes") {
        lessonData.description = materialData.content;
        lessonData.input_type = "description";
      } else if (materialData?.type === "topic") {
        lessonData.description = materialData.content;
        lessonData.input_type = "description";
      }

      const lesson = await base44.entities.Lesson.create(lessonData);
      setCreatedLessonId(lesson.id);

      // 3. Trigger curriculum mapping in background
      base44.functions.invoke('curriculumMapping', {
        lesson_id: lesson.id
      }).catch(err => console.warn("Curriculum mapping error:", err));

      // 4. Mark onboarding complete
      await base44.auth.updateMe({ onboarding_completed: true });

      // Track session
      await trackUserSession();

      // Trigger welcome email
      base44.functions.invoke('triggerAutomaticEmails', {
        trigger_type: 'onboarding_completed',
        user_email: user.email
      }).catch(() => {});

      // Wait for loader animation then mark complete
      setTimeout(() => {
        setLoaderComplete(true);
      }, 5000);

    } catch (error) {
      console.error("Error completing onboarding:", error);
      setError(error.message || "Failed to complete onboarding. Please try again.");
      setIsSubmitting(false);
      setShowLoader(false);
    }
  };

  const handleLoaderComplete = () => {
    // Navigate to the created lesson
    if (createdLessonId) {
      navigate(createPageUrl("DocumentViewer") + `?lessonId=${createdLessonId}`, { replace: true });
    } else {
      navigate(createPageUrl("Home"), { replace: true });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    );
  }

  // Show loader when processing
  if (showLoader) {
    const fileName = materialData?.type === "file" && materialData.files?.[0]?.name;
    return (
      <OnboardingLoader 
        fileName={fileName}
        isComplete={loaderComplete}
        onAnimationComplete={handleLoaderComplete}
      />
    );
  }

  // Get step-specific styling
  const getStepStyle = () => {
    const styles = {
      "study_type": { 
        bg: 'from-purple-600 via-indigo-600 to-purple-700',
        accent: 'from-yellow-400 to-amber-500'
      },
      "university_year": { 
        bg: 'from-indigo-600 via-purple-600 to-pink-600',
        accent: 'from-pink-400 to-rose-500'
      },
      "school": { 
        bg: 'from-purple-600 via-violet-600 to-indigo-600',
        accent: 'from-emerald-400 to-teal-500'
      },
      "course_name": { 
        bg: 'from-indigo-700 via-purple-600 to-violet-600',
        accent: 'from-cyan-400 to-blue-500'
      },
      "materials": { 
        bg: 'from-purple-700 via-violet-600 to-indigo-600',
        accent: 'from-amber-400 to-orange-500'
      }
    };
    return styles[currentQuestion?.id] || styles["study_type"];
  };

  const stepStyle = getStepStyle();

  // Render current question content
  const renderQuestionContent = () => {
    if (!currentQuestion) return null;

    switch (currentQuestion.type) {
      case "study-type":
        return (
          <StudyTypeSelector
            value={answers.study_type}
            onChange={(val) => handleAnswer("study_type", val)}
          />
        );
      
      case "university-year":
        return (
          <UniversityYearSelector
            value={answers.university_year}
            onChange={(val) => handleAnswer("university_year", val)}
          />
        );
      
      case "school-search":
        return (
          <OnboardingQuestion
            question={currentQuestion}
            value={answers.school}
            onChange={(val) => handleAnswer("school", val)}
            prefetchedData={prefetchedSchoolsRef.current}
          />
        );
      
      case "course-name":
        return (
          <CourseNameInput
            value={answers.course_name}
            onChange={(val) => handleAnswer("course_name", val)}
            school={answers.school}
            year={answers.university_year}
          />
        );
      
      case "materials":
        return (
          <MaterialUploader
            courseName={answers.course_name}
            school={answers.school}
            onMaterialReady={handleMaterialReady}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${stepStyle.bg} flex items-center justify-center p-4 transition-colors duration-300`}>
      <div className="w-full max-w-lg md:max-w-2xl relative z-10">
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

        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden bg-white/10 backdrop-blur-sm border-2 border-white/20 shadow-xl">
            <img 
              src={LOGO_URL} 
              alt="StudyApp" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="text-center mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1">{currentQuestion?.question}</h1>
          <p className="text-white/70 text-xs md:text-sm">{currentQuestion?.subtitle}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {visibleQuestions.map((_, idx) => (
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

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-4 md:p-5 border border-white/20">
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
              {renderQuestionContent()}
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
              disabled={!isCurrentAnswered() || isSubmitting}
              className={`bg-gradient-to-r ${stepStyle.accent} hover:opacity-90 text-white font-bold gap-2 px-6 shadow-lg`}
            >
              {currentStep === visibleQuestions.length - 1 ? (
                isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
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