import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, Upload, FileCheck, AlertCircle, Sparkles, X, Lightbulb, Zap, Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import EducationalLoader from "@/components/ui/EducationalLoader";

export default function CreateLessonModal({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [courseName, setCourseName] = useState("");
  const [inputType, setInputType] = useState("file");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [userGrade, setUserGrade] = useState("");
  const [userSchool, setUserSchool] = useState("");
  const [showTips, setShowTips] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    if (open) {
      loadUserProfile();
      // Reset form when modal opens
      setCourseName("");
      setInputType("file");
      setDescription("");
      setFiles([]);
      setError("");
      setShowTips(false);
      setIsProcessing(false);
      setProcessingStep("");
      setSuggestions([]);
    }
  }, [open]);

  const loadUserProfile = async () => {
    try {
      const user = await base44.auth.me();
      if (user.learning_profile_id) {
        const profile = await base44.entities.LearningProfile.filter({ id: user.learning_profile_id });
        if (profile.length > 0) {
          setUserGrade(profile[0].grade);
          setUserSchool(profile[0].school || "");
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const generateSuggestions = async () => {
    if (!courseName.trim() || loadingSuggestions) return;
    
    setLoadingSuggestions(true);
    try {
      const result = await base44.functions.invoke('generateSuggestions', {
        courseName: courseName.trim(),
        school: userSchool || '',
        grade: userGrade || ''
      });
      
      const topics = result?.data?.topics || [];
      setSuggestions(topics.slice(0, 4));
    } catch (err) {
      console.error("Error generating suggestions:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const maxSize = 15 * 1024 * 1024; // 15MB per file
    
    const oversizedFiles = selectedFiles.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      setError(`Files must be less than 15MB each. ${oversizedFiles.length} file(s) too large.`);
      e.target.value = '';
      return;
    }
    
    setFiles(selectedFiles);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsProcessing(true);
    setProcessingStep("");

    try {
      if (!courseName.trim()) {
        throw new Error("Please enter a course name");
      }

      let extractedContent = "";
      let fullExtractedContent = "";
      let fileUrls = [];
      let compressedForPrompts = "";

      if (inputType === "file") {
        if (files.length === 0) {
          throw new Error("Please select at least one file");
        }

        try {
          setProcessingStep(`Uploading ${files.length} file(s)...`);
          
          // PARALLEL: Upload all files simultaneously
          const uploadPromises = files.map(file => 
            base44.integrations.Core.UploadFile({ file })
          );
          const uploadResults = await Promise.all(uploadPromises);
          fileUrls = uploadResults.map(result => result.file_url);

          // Extract content - wait for completion (OCR can take 15-20s for large PDFs)
          setProcessingStep("Analyzing document...");
          
          const extractionResults = await Promise.allSettled(
            fileUrls.map(fileUrl =>
              base44.functions.invoke('extractDocumentContent', { file_url: fileUrl })
            )
          );
          
          const extractedParts = extractionResults
            .filter(r => r.status === 'fulfilled' && r.value?.data?.extracted_content)
            .map(r => r.value.data.extracted_content);
          
          fullExtractedContent = extractedParts.join("\n\n--- NEXT DOCUMENT ---\n\n").trim();
          extractedContent = fullExtractedContent;
          
          console.log("📄 Extracted content length:", fullExtractedContent.length, "chars");
          
          // Compress only if content exceeds 2500 characters
          if (fullExtractedContent.length > 2500) {
            setProcessingStep("Optimizing content...");
            try {
              const compResult = await base44.functions.invoke('compressDocument', { content: fullExtractedContent });
              compressedForPrompts = compResult?.data?.compressed_content || fullExtractedContent;
            } catch {
              compressedForPrompts = fullExtractedContent;
            }
          } else {
            compressedForPrompts = fullExtractedContent;
          }
          
        } catch (fileError) {
          console.error("Error processing files:", fileError);
          throw new Error(fileError.message || "Failed to process files. Please try again.");
        }
      }

      if (inputType === "description") {
        if (!description.trim()) {
          throw new Error("Please enter a description");
        }
        extractedContent = description.trim();
        fullExtractedContent = extractedContent;
        compressedForPrompts = extractedContent;
      }

      // Navigate immediately after lesson creation - max 5s total loading time
      const loadingStartTime = Date.now();
      const MAX_LOADING_MS = 5000;

      // Create lesson immediately after OCR/compression
      const learningProfile = {
        grade: userGrade,
        school: userSchool,
        city: ""
      };
      setProcessingStep("Preparing your lesson...");

      const lessonData = {
        course_name: courseName,
        input_type: inputType,
        status: "created"
      };

      if (inputType === "description") {
        lessonData.description = description.trim();
        lessonData.extracted_content = description.trim();
        lessonData.compressed_content = compressedForPrompts;
      } else if (inputType === "file") {
        lessonData.file_url = fileUrls.length > 0 ? fileUrls[0] : "";
        lessonData.file_urls = fileUrls;
        lessonData.extracted_content = fullExtractedContent;
        lessonData.compressed_content = compressedForPrompts;
      }

      setProcessingStep("Creating lesson...");
      const lesson = await base44.entities.Lesson.create(lessonData);
      console.log("✅ Lesson created with content - extracted:", fullExtractedContent.length, "chars, compressed:", compressedForPrompts.length, "chars");
      sessionStorage.setItem('currentLessonId', lesson.id);

      if (!lesson || !lesson.id) {
        throw new Error("Failed to create lesson");
      }

      console.log("✅ Lesson created:", lesson.id);

      // Fire-and-forget exam generation AND curriculum mapping in parallel - don't block navigation
      console.log("🎯 Starting Exam 1 auto-generation and curriculum mapping (background)...");
      
      // Start both in parallel
      Promise.all([
        base44.functions.invoke('autoGenerateExam1', { lesson_id: lesson.id })
          .then(result => {
            if (result?.data?.success) {
              console.log("✅ Exam 1 auto-generated:", result.data.exam_id);
              window.dispatchEvent(new Event('reloadLesson'));
            }
          })
          .catch(err => console.warn("⚠️ Background exam generation:", err.message)),
        
        base44.functions.invoke('curriculumMapping', {
          courseName: courseName.trim(),
          learningProfile: learningProfile,
          extractedContent: compressedForPrompts,
          lessonId: lesson.id
        })
          .then(() => {
            console.log("✅ Curriculum map saved");
            window.dispatchEvent(new Event('reloadLesson'));
          })
          .catch(err => console.warn("⚠️ Background curriculum mapping:", err.message))
      ]);

      // Ensure minimum 2s loading for UX, but cap at 5s total
      const elapsedMs = Date.now() - loadingStartTime;
      const minWait = Math.max(0, 2000 - elapsedMs);
      const maxWait = Math.max(0, MAX_LOADING_MS - elapsedMs);
      const waitTime = Math.min(minWait, maxWait);
      
      if (waitTime > 0) {
        setProcessingStep("Almost ready...");
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Close modal and navigate (client-side to avoid white flash)
      onOpenChange(false);
      navigate(`${createPageUrl("DocumentViewer")}?id=${lesson.id}&tab=studyplan`);
    } catch (err) {
      setError(err.message || "Failed to create lesson. Please try again.");
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[85vh] p-0 gap-0 rounded-2xl border-0 overflow-hidden flex flex-col">
        {isProcessing ? (
          <EducationalLoader />
        ) : (
          <>
            {/* Compact Header */}
            <div className="relative bg-gradient-to-r from-purple-600 to-indigo-700 px-4 py-3">
              <div className="flex items-center justify-center gap-2">
                <div className="w-7 h-7 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-base font-bold text-white">New Lesson</h2>
              </div>
            </div>

            {/* Form */}
            <div className="p-4 overflow-y-auto flex-1">
              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                {/* Course Name */}
                <div className="space-y-1">
                  <Label htmlFor="courseName" className="text-xs font-medium">Course Name</Label>
                  <Input
                    id="courseName"
                    value={courseName}
                    onChange={(e) => {
                      setCourseName(e.target.value);
                      setSuggestions([]);
                    }}
                    placeholder="e.g., MATH 101, Biology 12"
                    disabled={isProcessing}
                    className="h-10"
                  />
                </div>

                {/* Content Type Toggle */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Content Source</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInputType("file")}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all ${
                        inputType === "file"
                          ? "border-purple-500 bg-purple-50 text-purple-700"
                          : "border-slate-200 hover:border-slate-300 text-slate-600"
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      <span className="text-xs font-medium">Upload</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInputType("description");
                        // Auto-generate suggestions when switching to describe mode
                        if (courseName.trim() && suggestions.length === 0 && !loadingSuggestions) {
                          setTimeout(() => generateSuggestions(), 100);
                        }
                      }}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all ${
                        inputType === "description"
                          ? "border-purple-500 bg-purple-50 text-purple-700"
                          : "border-slate-200 hover:border-slate-300 text-slate-600"
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span className="text-xs font-medium">Describe</span>
                    </button>
                  </div>
                </div>

                {/* Description Input */}
                {inputType === "description" && (
                  <div className="space-y-2">
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what you want to study: e.g., 'Chapter 5 - Photosynthesis, chloroplasts, light reactions...'"
                      disabled={isProcessing}
                      className="min-h-[70px] resize-none text-sm"
                    />

                    {description.length > 0 && description.length < 30 && (
                      <p className="text-[10px] text-amber-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Add more detail (min 30 characters)
                      </p>
                    )}

                    {description.length >= 30 && description.length < 100 && (
                      <p className="text-[10px] text-yellow-700 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Add more detail for better results
                      </p>
                    )}

                    {description.length >= 100 && (
                      <p className="text-[10px] text-emerald-700 flex items-center gap-1">
                        <FileCheck className="w-3 h-3" /> Ready to generate
                      </p>
                    )}

                    {/* Suggestions Panel - Below textarea */}
                    {courseName.trim() && (
                      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-semibold text-purple-800">Topic Ideas</span>
                          </div>
                          {loadingSuggestions && <Loader2 className="w-3 h-3 animate-spin text-purple-600" />}
                        </div>
                        
                        {loadingSuggestions && suggestions.length === 0 && (
                          <p className="text-[11px] text-purple-600">Finding topics...</p>
                        )}
                        
                        {suggestions.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                            {suggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setDescription(suggestion)}
                                className="flex-shrink-0 text-[11px] text-slate-700 bg-white hover:bg-purple-100 border border-purple-100 rounded-full px-3 py-1.5 transition-all shadow-sm hover:shadow whitespace-nowrap"
                              >
                                {suggestion.length > 40 ? suggestion.substring(0, 40) + '...' : suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {!loadingSuggestions && suggestions.length === 0 && (
                          <button
                            type="button"
                            onClick={generateSuggestions}
                            className="w-full text-[11px] bg-purple-600 hover:bg-purple-700 text-white font-medium px-3 py-2 rounded-lg transition-colors"
                          >
                            Generate Topic Ideas
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* File Upload */}
                {inputType === "file" && (
                  <div className="space-y-2">
                    <div 
                      className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center hover:border-purple-400 transition-colors cursor-pointer"
                      onClick={() => document.getElementById('modal-file-input').click()}
                    >
                      <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-600 font-medium">Tap to upload</p>
                      <p className="text-[10px] text-slate-400">PDF, Word, PPT, Images • Max 15MB</p>
                      <Input
                        id="modal-file-input"
                        type="file"
                        onChange={handleFileChange}
                        disabled={isProcessing}
                        multiple
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff"
                        className="hidden"
                      />
                    </div>
                    {files.length > 0 && (
                      <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-lg">
                        <FileCheck className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="flex-1 truncate">{files.length === 1 ? files[0].name : `${files.length} files selected`}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isProcessing || (inputType === "description" && description.length < 30)}
                  className="w-full h-10 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg shadow-purple-500/25 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {processingStep || "Processing..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Create Lesson
                    </>
                  )}
                </Button>
              </form>
            </div>
          </>
        )}
      </DialogContent>
      </Dialog>
  );
}