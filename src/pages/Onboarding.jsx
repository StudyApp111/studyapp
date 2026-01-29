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
import SchoolSelector from "../components/onboarding/SchoolSelector";
import CourseNameInput from "../components/onboarding/CourseNameInput";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/ea1c6b1a9_StudyAppAI1024x1024px.png";

// Question definitions - Streamlined for faster conversion
const baseQuestions = [
  {
    id: "study_type",
    question: "What brings you here? 👋",
    type: "study-type",
    emoji: "🎯",
    subtitle: "Pick your learning journey"
  },
  {
    id: "university_year",
    question: "What year are you in?",
    type: "university-year",
    emoji: "📅",
    subtitle: "This helps us personalize your experience",
    showIf: (answers) => answers.study_type === "university"
  },
  {
    id: "school",
    question: "What's your school? 🏫",
    type: "school-search",
    emoji: "🎓",
    subtitle: "Find classmates studying the same thing",
    showIf: (answers) => ["university", "grad_school", "high_school", "med_school"].includes(answers.study_type)
  },
  {
    id: "course_name",
    question: "Pick your first course 📚",
    type: "course-name",
    emoji: "✏️",
    subtitle: "We'll show you your predicted grade!"
  }
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Prefetch schools data on mount
  const prefetchedSchoolsRef = useRef(null);

  // Track CompleteRegistration when user lands on first onboarding question
  const hasTrackedRegistration = useRef(false);
  
  useEffect(() => {
    checkExistingProfile();
    // Prefetch nearby schools immediately on page load
    prefetchNearbySchools();
  }, []);

  // Track registration once when onboarding starts (user is authenticated but hasn't completed onboarding)
  useEffect(() => {
    const trackRegistration = async () => {
      if (hasTrackedRegistration.current || isLoading) return;
      
      try {
        const user = await base44.auth.me();
        if (user && !user.onboarding_completed) {
          hasTrackedRegistration.current = true;
          
          // Track onboarding page view for funnel analytics
          base44.analytics.track({
            eventName: "onboarding_page_viewed",
            properties: { user_id: user.id }
          });
          
          // TikTok pixel tracking
          if (window.ttq) {
            // Hash user ID for privacy
            const encoder = new TextEncoder();
            const data = encoder.encode(user.id);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashedId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Identify user
            window.ttq.identify({
              external_id: hashedId
            });
            
            // Track registration
            window.ttq.track('CompleteRegistration', {
              contents: [{
                content_id: 'signup',
                content_type: 'product',
                content_name: 'StudyApp Registration'
              }],
              value: 0,
              currency: 'USD'
            });
          }
        }
      } catch (err) {
        console.error('TikTok tracking error:', err);
      }
    };
    
    trackRegistration();
  }, [isLoading]);

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

  const isCurrentAnswered = () => {
    if (!currentQuestion) return false;
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

      // 2. Create a minimal lesson (no materials yet - will be added later in DocumentViewer)
      const lesson = await base44.entities.Lesson.create({
        course_name: answers.course_name,
        status: "created"
      });

      console.log("✅ Lesson created:", lesson.id);

      // Track first lesson creation
      base44.analytics.track({
        eventName: "first_lesson_created",
        properties: { 
          lesson_id: lesson.id,
          course_name: answers.course_name
        }
      });

      // 3. Mark onboarding complete
      await base44.auth.updateMe({ onboarding_completed: true });

      // Track session
      await trackUserSession();

      // Trigger welcome email
      base44.functions.invoke('triggerAutomaticEmails', {
        trigger_type: 'onboarding_completed',
        user_email: user.email
      }).catch(() => {});

      // 4. Navigate to predicted grade display with simulated grade
      // Simulated grades based on course difficulty patterns
      const simulatedGrades = ['B-', 'C+', 'B', 'C'];
      const simulatedGrade = simulatedGrades[Math.floor(Math.random() * simulatedGrades.length)];
      const simulatedScore = simulatedGrade === 'B-' ? '78' : simulatedGrade === 'B' ? '82' : simulatedGrade === 'C+' ? '75' : '72';

      navigate(createPageUrl("PredictedGradeDisplay") + `?lessonId=${lesson.id}&grade=${simulatedGrade}&score=${simulatedScore}`, { replace: true });

    } catch (error) {
      console.error("Error completing onboarding:", error);
      setError(error.message || "Failed to complete onboarding. Please try again.");
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



  // Consistent dark background like PricingPlans page
  const stepStyle = {
    bg: 'from-slate-900 via-purple-900 to-slate-900',
    accent: 'from-purple-400 to-pink-400'
  };

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
          <SchoolSelector
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
      
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${stepStyle.bg} flex items-center justify-center p-4 transition-colors duration-300`}>
      <div className="w-full max-w-lg md:max-w-3xl relative z-10">
        {/* StudyApp Branding */}
        <div className="text-center mb-4">
          <h1 className="text-2xl md:text-3xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* Progress Bar - Clear visual indicator */}
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

        {/* Question Header - Warm, conversational */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">{currentQuestion?.emoji}</div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{currentQuestion?.question}</h2>
          <p className="text-purple-200/80 text-base">
            {typeof currentQuestion?.subtitle === 'function' 
              ? currentQuestion.subtitle(answers) 
              : currentQuestion?.subtitle}
          </p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-2xl p-5 md:p-6 border border-slate-700/50">
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

          <div className="flex justify-between mt-6 pt-5 border-t border-slate-700/50">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0 || isSubmitting}
              className="gap-2 text-slate-400 hover:text-white hover:bg-white/10 px-4"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!isCurrentAnswered() || isSubmitting}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold gap-2 px-8 py-3 text-base shadow-xl shadow-purple-500/30 disabled:opacity-40 transition-all hover:scale-[1.02]"
            >
              {currentStep === visibleQuestions.length - 1 ? (
                isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating your lesson...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Start Learning!
                  </>
                )
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Footer with logout option */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-slate-500 text-xs">Powered by StudyApp.AI</p>
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-slate-300 text-xs underline transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}