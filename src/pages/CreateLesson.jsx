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

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/ea1c6b1a9_StudyAppAI1024x1024px.png";

export default function CreateLesson() {
  const navigate = useNavigate();
  const { canUpload, incrementUploadCount, triggerUpgradeModal } = useSubscription();
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

  useEffect(() => {
    loadUserData();
    
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
      // Redirect to login if not authenticated
      base44.auth.redirectToLogin(window.location.pathname);
    }
  };

  const handleMaterialReady = (data) => {
    setMaterialData(data);
  };

  const canSubmit = courseName.trim() && materialData !== null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    
    setIsSubmitting(true);
    setError("");

    try {
      // Check upload limit FIRST
      const uploadCheck = await canUpload();
      if (!uploadCheck.allowed) {
        setIsSubmitting(false);
        if (uploadCheck.requiresPro) {
          triggerUpgradeModal('tasks');
        } else {
          triggerUpgradeModal('uploads', {
            message: `You've created ${uploadCheck.current} lessons today. Upgrade for unlimited lessons!`
          });
        }
        return;
      }
      
      setShowLoader(true);
      
      // Increment upload counter
      await incrementUploadCount();
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

      const lesson = await base44.entities.Lesson.create(lessonData);
      setCreatedLessonId(lesson.id);
      console.log("✅ Lesson created:", lesson.id);

      // CRITICAL: Generate Exam 1 BEFORE completing loader - user needs this ready
      console.log("🎯 Generating diagnostic exam...");
      let examGenerated = false;
      
      try {
        const examResult = await base44.functions.invoke('autoGenerateExam1', { lesson_id: lesson.id });
        if (examResult?.data?.success) {
          console.log("✅ Exam 1 generated:", examResult.data.exam_id);
          examGenerated = true;
          setStepStatuses(prev => ({ ...prev, examGenerated: true }));
        } else {
          console.warn("⚠️ Exam generation returned but no success flag");
          setStepStatuses(prev => ({ ...prev, examGenerated: true }));
        }
      } catch (examErr) {
        console.error("❌ Exam generation error:", examErr.message);
        // Continue anyway - user can still view materials
        setStepStatuses(prev => ({ ...prev, examGenerated: true }));
      }

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

      // Now complete the loader - exam is ready (or we tried our best)
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