import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2 } from "lucide-react";
import MaterialUploader from "@/components/onboarding/MaterialUploader";
import CreateLessonLoader from "@/components/create-lesson/CreateLessonLoader";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/ea1c6b1a9_StudyAppAI1024x1024px.png";

export default function CreateLesson() {
  const navigate = useNavigate();
  const [courseName, setCourseName] = useState("");
  const [materialData, setMaterialData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [loaderComplete, setLoaderComplete] = useState(false);
  const [createdLessonId, setCreatedLessonId] = useState(null);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [learningProfile, setLearningProfile] = useState(null);

  useEffect(() => {
    loadUserData();
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
    setShowLoader(true);

    try {
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

      const lesson = await base44.entities.Lesson.create(lessonData);
      setCreatedLessonId(lesson.id);
      console.log("✅ Lesson created:", lesson.id);

      // CRITICAL: Wait for exam generation to complete before proceeding
      console.log("🎯 Generating diagnostic exam (must complete)...");
      try {
        const examResult = await base44.functions.invoke('autoGenerateExam1', { lesson_id: lesson.id });
        if (examResult?.data?.success) {
          console.log("✅ Exam 1 generated:", examResult.data.exam_id);
        } else {
          console.warn("⚠️ Exam generation returned:", examResult?.data);
        }
      } catch (examErr) {
        console.error("❌ Exam generation failed:", examErr.message);
        // Continue anyway - user can retry from the exam tab
      }

      // Fire-and-forget: Curriculum mapping in background (non-blocking)
      const curriculumPrompt = `Educational Curriculum Analysis Request
Role: Expert curriculum analyst. Generate concise curriculum profile for ${courseName}.
Student Grade: ${learningProfile?.grade || "N/A"}
School: ${learningProfile?.school || "N/A"}
Content: ${compressedContent || extractedContent || "N/A"}

Output JSON with: core_competencies, competency_weightings, question_formats, high_yield_focal_points, common_misconceptions.`;

      base44.functions.invoke('curriculumMapping', { prompt: curriculumPrompt })
        .then(async (result) => {
          if (result?.data) {
            await base44.entities.Lesson.update(lesson.id, { curriculum_map: result.data });
            console.log("✅ Curriculum map saved");
          }
        })
        .catch(err => console.warn("Curriculum mapping error:", err));

      // Mark complete - exam is ready
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
    const fileName = materialData?.type === "file" && materialData.files?.[0]?.name;
    return (
      <CreateLessonLoader 
        fileName={fileName}
        isComplete={loaderComplete}
        onAnimationComplete={handleLoaderComplete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 via-violet-600 to-indigo-600 flex items-center justify-center p-4 pb-28 md:pb-4">
      <div className="w-full max-w-lg md:max-w-2xl relative z-10">
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
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1">
            StudyApp will predict your grade and help you study.
          </h1>
          <p className="text-white/70 text-xs md:text-sm">Upload your materials to get started</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-4 md:p-5 border border-white/20">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Course Name Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Course Name
            </label>
            <Input
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g., Biology 101, Calculus II, etc."
              className="h-12 text-base border-2 border-slate-200 focus:border-purple-400 rounded-xl"
            />
          </div>

          {/* Material Uploader */}
          <MaterialUploader
            courseName={courseName}
            school={learningProfile?.school}
            onMaterialReady={handleMaterialReady}
          />

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="w-full h-12 bg-gradient-to-r from-amber-400 to-orange-500 hover:opacity-90 text-white font-bold gap-2 shadow-lg rounded-xl text-base"
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
          <p className="text-white/50 text-xs">Powered by StudyApp.AI</p>
        </div>
      </div>
    </div>
  );
}