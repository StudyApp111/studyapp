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
import MaterialUploader from "../components/onboarding/MaterialUploader";
import OnboardingLoader from "../components/onboarding/OnboardingLoader";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/ea1c6b1a9_StudyAppAI1024x1024px.png";

// Question definitions - Optimized for engagement & reduced drop-off
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
    subtitle: "We'll create AI-powered study tools for it"
  },
  {
    id: "materials",
    question: "Add your study materials ✨",
    type: "materials",
    emoji: "📄",
    subtitle: (answers) => `Upload notes for ${answers.course_name || 'your course'}`
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

      // 2. Create the lesson - handle file extraction inline for reliability
      const lessonData = {
        course_name: answers.course_name,
        status: "created"
      };

      let extractedContent = "";
      let compressedContent = "";

      // Handle different material types
      if (materialData?.type === "file" && materialData.files?.length > 0) {
        lessonData.file_url = materialData.files[0].url;
        lessonData.file_urls = materialData.files.map(f => f.url);
        lessonData.input_type = "file";
        
        // Extract content from files BEFORE creating lesson
        console.log("📄 Extracting content from", materialData.files.length, "file(s)...");
        try {
          const extractionResults = await Promise.allSettled(
            materialData.files.map(f => {
              console.log("📤 Calling extractDocumentContent for:", f.url);
              return base44.functions.invoke('extractDocumentContent', { file_url: f.url });
            })
          );
          
          console.log("📥 Extraction results:", extractionResults.map(r => r.status));
          
          const extractedParts = extractionResults
            .filter(r => r.status === 'fulfilled' && r.value?.data?.extracted_content)
            .map(r => r.value.data.extracted_content);
          
          extractedContent = extractedParts.join("\n\n--- NEXT DOCUMENT ---\n\n").trim();
          console.log("✅ Extracted content length:", extractedContent.length, "chars");
          
          // Compress if needed
          if (extractedContent.length > 2500) {
            console.log("📦 Compressing content...");
            try {
              const compResult = await base44.functions.invoke('compressDocument', { content: extractedContent });
              compressedContent = compResult?.data?.compressed_content || extractedContent;
              console.log("✅ Compressed to:", compressedContent.length, "chars");
            } catch (compErr) {
              console.warn("⚠️ Compression failed, using raw:", compErr);
              compressedContent = extractedContent;
            }
          } else {
            compressedContent = extractedContent;
          }
          
          lessonData.extracted_content = extractedContent;
          lessonData.compressed_content = compressedContent;
        } catch (err) {
          console.error("❌ Content extraction error:", err);
        }
      } else if (materialData?.type === "notes") {
        lessonData.description = materialData.content;
        lessonData.extracted_content = materialData.content;
        lessonData.compressed_content = materialData.content;
        lessonData.input_type = "description";
        extractedContent = materialData.content;
        compressedContent = materialData.content;
      } else if (materialData?.type === "topic") {
        lessonData.description = materialData.content;
        lessonData.extracted_content = materialData.content;
        lessonData.compressed_content = materialData.content;
        lessonData.input_type = "description";
        extractedContent = materialData.content;
        compressedContent = materialData.content;
      }

      console.log("📝 Creating lesson with content:", {
        hasExtracted: !!lessonData.extracted_content,
        extractedLen: lessonData.extracted_content?.length || 0,
        hasCompressed: !!lessonData.compressed_content,
        compressedLen: lessonData.compressed_content?.length || 0
      });

      const lesson = await base44.entities.Lesson.create(lessonData);
      setCreatedLessonId(lesson.id);
      console.log("✅ Lesson created:", lesson.id);

      // Track first lesson creation for funnel analytics
      base44.analytics.track({
        eventName: "first_lesson_created",
        properties: { 
          lesson_id: lesson.id,
          course_name: answers.course_name,
          input_type: lessonData.input_type || "unknown"
        }
      });

      // 3. Fire-and-forget: Generate exam in background (content is already in lesson)
      console.log("🎯 Starting background exam generation...");
      base44.functions.invoke('autoGenerateExam1', { lesson_id: lesson.id })
        .then(result => {
          if (result?.data?.success) {
            console.log("✅ Exam 1 auto-generated:", result.data.exam_id);
          } else {
            console.warn("⚠️ Exam generation response:", result?.data);
          }
        })
        .catch(err => console.error("❌ Background exam generation error:", err.message));

      // 4. Fire-and-forget: Curriculum mapping in background
      const curriculumPrompt = `Educational Curriculum Analysis Request
Role: Expert curriculum analyst. Generate concise curriculum profile for ${answers.course_name}.
Student Grade: ${profileData.grade || "N/A"}
School: ${profileData.school || "N/A"}
Content: ${compressedContent || extractedContent || "N/A"}

Output JSON with: core_competencies, competency_weightings, question_formats, high_yield_focal_points, common_misconceptions.`;

      console.log("🗺️ Starting background curriculum mapping...");
      base44.functions.invoke('curriculumMapping', { prompt: curriculumPrompt })
        .then(async (result) => {
          if (result?.data) {
            await base44.entities.Lesson.update(lesson.id, { curriculum_map: result.data });
            console.log("✅ Curriculum map saved");
          }
        })
        .catch(err => console.warn("Curriculum mapping error:", err));

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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
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