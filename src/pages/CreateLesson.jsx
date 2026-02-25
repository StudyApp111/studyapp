import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2 } from "lucide-react";
import MaterialUploader from "@/components/onboarding/MaterialUploader";
import CreateLessonLoader from "@/components/create-lesson/CreateLessonLoader";
import { useSubscription } from "@/components/subscription/SubscriptionContext";
import { useGuestSession } from "@/components/guest/GuestSessionContext";
// GuestLessonCreatedModal removed — guests proceed directly to DocumentViewer
import posthog from 'posthog-js';

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/ea1c6b1a9_StudyAppAI1024x1024px.png";

export default function CreateLesson() {
  const navigate = useNavigate();
  const { canUpload, incrementUploadCount, triggerUpgradeModal } = useSubscription();
  const { isGuest, guestLessonCreated, setGuestLesson, guestData } = useGuestSession();

  const [courseName, setCourseName] = useState("");
  const [materialData, setMaterialData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [loaderComplete, setLoaderComplete] = useState(false);
  const [createdLessonId, setCreatedLessonId] = useState(null);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [learningProfile, setLearningProfile] = useState(null);
  const [stepStatuses, setStepStatuses] = useState({ extracted: false, compressed: false, examGenerated: false });
  // Guest modal removed — guests go straight to DocumentViewer

  useEffect(() => {
    // Guest users who already created a lesson cannot create another
    if (isGuest && guestLessonCreated) {
      setError("Guest preview allows only 1 lesson. Sign up to create more!");
      return;
    }
    
    if (!isGuest) {
      loadUserData();
    }
    
    // Check for course name from URL (coming from PredictedGradeDisplay)
    const urlParams = new URLSearchParams(window.location.search);
    const courseNameParam = urlParams.get('courseName');
    if (courseNameParam) {
      setCourseName(decodeURIComponent(courseNameParam));
    }
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Load learning profile for school/grade info
      if (currentUser.learning_profile_id) {
        const profiles = await base44.entities.LearningProfile.filter({ id: currentUser.learning_profile_id });
        if (profiles.length > 0) {
          setLearningProfile(profiles[0]);
        }
      }
    } catch (error) {
      // Allow guests through without redirecting
      if (!isGuest) {
        base44.auth.redirectToLogin(window.location.pathname);
      }
    }
  };

  const handleMaterialReady = (data) => {
    setMaterialData(data);
  };

  const canSubmit = courseName.trim() && materialData !== null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    
    // Block guests who already created a lesson
    if (isGuest && guestLessonCreated) {
      setError("Guest preview allows only 1 lesson. Sign up to create more!");
      return;
    }
    
    setIsSubmitting(true);
    setError("");

    try {
      // Skip subscription checks for guests
      if (!isGuest) {
        // Check upload limit FIRST
        const uploadCheck = await canUpload();
        if (!uploadCheck.allowed) {
          setIsSubmitting(false);
          triggerUpgradeModal('uploads');
          return;
        }
      }
      
      setShowLoader(true);
      
      // Increment upload counter (skip for guests)
      if (!isGuest) {
        await incrementUploadCount();
      }
      // Create the lesson - handle file extraction inline for reliability
      const lessonData = {
        course_name: courseName.trim(),
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
          
          const extractedParts = extractionResults
            .filter(r => r.status === 'fulfilled' && r.value?.data?.extracted_content)
            .map(r => r.value.data.extracted_content);
          
          extractedContent = extractedParts.join("\n\n--- NEXT DOCUMENT ---\n\n").trim();
          console.log("✅ Extracted content length:", extractedContent.length, "chars");
          
          // Mark step 1 complete
          setStepStatuses(prev => ({ ...prev, extracted: true }));
          
          // Compress if needed
          if (extractedContent.length > 2500) {
            console.log("📦 Compressing content...");
            try {
              const compResult = await base44.functions.invoke('compressDocument', { content: extractedContent });
              compressedContent = compResult?.data?.compressed_content || extractedContent;
              // Save structured topics if returned
              if (compResult?.data?.topics?.length > 0) {
                lessonData.topics = compResult.data.topics;
                console.log("✅ Extracted", compResult.data.topics.length, "topics from document");
              }
            } catch (compErr) {
              console.warn("⚠️ Compression failed, using raw:", compErr);
              compressedContent = extractedContent;
            }
          } else {
            compressedContent = extractedContent;
          }
          
          // Mark step 2 complete
          setStepStatuses(prev => ({ ...prev, compressed: true }));
          
          lessonData.extracted_content = extractedContent;
          lessonData.compressed_content = compressedContent;
        } catch (err) {
          console.error("❌ Content extraction error:", err);
          // Still mark as done to progress the UI
          setStepStatuses(prev => ({ ...prev, extracted: true, compressed: true }));
        }
      } else if (materialData?.type === "notes") {
        lessonData.description = materialData.content;
        lessonData.extracted_content = materialData.content;
        lessonData.compressed_content = materialData.content;
        lessonData.input_type = "description";
        extractedContent = materialData.content;
        compressedContent = materialData.content;
        // Mark first two steps complete immediately for text input
        setStepStatuses(prev => ({ ...prev, extracted: true, compressed: true }));
      } else if (materialData?.type === "topic") {
        lessonData.description = materialData.content;
        lessonData.extracted_content = materialData.content;
        lessonData.compressed_content = materialData.content;
        lessonData.input_type = "description";
        extractedContent = materialData.content;
        compressedContent = materialData.content;
        // Mark first two steps complete immediately for text input
        setStepStatuses(prev => ({ ...prev, extracted: true, compressed: true }));
      }

      // For guests: create lesson via the transfer backend function (service role)
      // so that backend functions (exam gen, topic suggestions) can find the lesson
      if (isGuest) {
        try {
          const { data: transferResult } = await base44.functions.invoke('checkGuestEligibility', {
            fingerprint: guestData?.fingerprint || 'guest',
            action: 'create_guest_lesson',
            lesson_data: lessonData
          });
          
          if (transferResult?.lesson_id) {
            const guestLessonId = transferResult.lesson_id;
            setCreatedLessonId(guestLessonId);
            setGuestLesson({ ...lessonData, id: guestLessonId });
            
            // Fire-and-forget: Generate exam + topic suggestions for the guest lesson
            base44.functions.invoke('autoGenerateExam1', { lesson_id: guestLessonId })
              .catch(err => console.error("❌ Guest exam gen error:", err.message));
            base44.functions.invoke('generateTopicSuggestions', { lesson_id: guestLessonId })
              .catch(err => console.error("❌ Guest topic suggestions error:", err.message));
          }
        } catch (guestErr) {
          console.error("❌ Guest lesson creation error:", guestErr);
        }
        setStepStatuses(prev => ({ ...prev, examGenerated: true }));
        setLoaderComplete(true);
        return;
      }

      const lesson = await base44.entities.Lesson.create(lessonData);
      setCreatedLessonId(lesson.id);
      console.log("✅ Lesson created:", lesson.id);

      // Analytics: track lesson creation events
      try {
        const allLessons = await base44.entities.Lesson.list('-created_date', 2);
        const isFirstLesson = allLessons.length === 1;

        posthog?.capture('lesson_created', {
          course_name: courseName.trim(),
          input_type: lessonData.input_type,
          lesson_id: lesson.id,
          is_first_lesson: isFirstLesson,
          has_file: lessonData.input_type === 'file',
          file_count: lessonData.file_urls?.length || 0,
          content_length: (compressedContent || extractedContent || '').length,
        });

        if (isFirstLesson) {
          posthog?.capture('first_lesson_created', {
            course_name: courseName.trim(),
            input_type: lessonData.input_type,
            lesson_id: lesson.id,
          });
          if (window.ttq) {
            window.ttq.track('SubmitForm', {
              content_name: 'first_lesson_created',
              content_id: lesson.id,
            });
          }
          if (window.gtag) {
            window.gtag('event', 'first_lesson_created', {
              event_category: 'conversion',
              event_label: courseName.trim(),
            });
          }
        } else {
          posthog?.capture('returning_lesson_created', {
            course_name: courseName.trim(),
            input_type: lessonData.input_type,
            lesson_id: lesson.id,
            total_lessons: allLessons.length,
          });
        }
      } catch (trackErr) {
        console.warn('Analytics tracking error:', trackErr);
      }

      // Fire-and-forget: Generate Exam 1 + Topic Suggestions simultaneously
      console.log("🎯 Triggering diagnostic exam + topic suggestions in background...");
      base44.functions.invoke('autoGenerateExam1', { lesson_id: lesson.id })
        .then(examResult => {
          if (examResult?.data?.success) {
            console.log("✅ Exam 1 generated:", examResult.data.exam_id);
          }
        })
        .catch(err => console.error("❌ Exam generation error:", err.message));

      base44.functions.invoke('generateTopicSuggestions', { lesson_id: lesson.id })
        .then(result => {
          if (result?.data?.success) {
            console.log("✅ Topic suggestions generated:", result.data.sections?.length, "sections");
          }
        })
        .catch(err => console.error("❌ Topic suggestions error:", err.message));

      // Fire-and-forget: Curriculum mapping in background (not critical path)
      console.log('🗺️ Triggering curriculum mapping for lesson:', lesson.id);
      base44.functions.invoke('curriculumMapping', {
        courseName: courseName.trim(),
        learningProfile: {
          school: learningProfile?.school || "N/A",
          grade: learningProfile?.grade || "N/A"
        },
        extractedContent: compressedContent || extractedContent || null,
        lessonId: lesson.id
      })
        .then((result) => {
          if (result?.data) {
            console.log("✅ Curriculum map generated and saved automatically");
          }
        })
        .catch(err => console.warn("Curriculum mapping error:", err));

      // Complete loader immediately after OCR + compression - no need to wait for exam
      setStepStatuses(prev => ({ ...prev, examGenerated: true }));
      setLoaderComplete(true);

    } catch (error) {
      console.error("Error creating lesson:", error);
      setError(error.message || "Failed to create lesson. Please try again.");
      setIsSubmitting(false);
      setShowLoader(false);
    }
  };

  const handleLoaderComplete = () => {
    if (createdLessonId) {
      navigate(createPageUrl("DocumentViewer") + `?lessonId=${createdLessonId}`, { replace: true });
    } else {
      navigate(createPageUrl("Home"), { replace: true });
    }
  };

  // Show loader when processing
  if (showLoader) {
    return (
      <CreateLessonLoader 
        fileName={materialData?.type === "file" ? materialData.files?.[0]?.name : null}
        isComplete={loaderComplete}
        onAnimationComplete={handleLoaderComplete}
        stepStatuses={stepStatuses}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 pb-28 md:pb-4">
      <div className="w-full max-w-lg md:max-w-3xl relative z-10">
        {/* Hero Header - Large like Onboarding */}
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="text-white">App</span>
          </h1>
          <p className="text-purple-200 text-lg md:text-xl">
            Upload your materials 📚
          </p>
        </div>

        <div className="text-center mb-4 md:mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
            Create a new lesson
          </h2>
          <p className="text-purple-200 text-sm md:text-base">
            We'll predict your grade and help you study
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-4 md:p-5 border border-slate-700">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Course Name Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Course Name
            </label>
            <Input
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g., Biology 101, Calculus II, etc."
              className="h-12 text-base bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-400 rounded-xl"
            />
          </div>

          {/* Material Uploader */}
          <MaterialUploader
            courseName={courseName}
            school={learningProfile?.school}
            onMaterialReady={handleMaterialReady}
          />

          <div className="mt-6 pt-4 border-t border-slate-700">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold gap-2 shadow-lg shadow-purple-500/30 rounded-xl text-base"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Let's Go!
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-slate-500 text-xs">Powered by StudyApp.AI</p>
        </div>
      </div>
    </div>
  );
}