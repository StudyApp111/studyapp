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
          
          // Compress if content is large
          if (fullExtractedContent.length > 5000) {
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

      // Create lesson immediately after OCR/compression
      const learningProfile = {
        grade: userGrade,
        school: userSchool,
        city: ""
      };
      setProcessingStep("Creating lesson...");

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

      // Auto-generate Exam 1 immediately (only needs compressed content, not curriculum)
      console.log("🎯 Starting Exam 1 auto-generation...");
      base44.functions.invoke('autoGenerateExam1', { lesson_id: lesson.id })
        .then(res => {
          if (res?.data?.success) console.log("✅ Exam 1 auto-generated");
        })
        .catch(err => console.warn("⚠️ Exam 1 generation:", err.message));

      // Close modal and navigate immediately (client-side to avoid white flash)
      onOpenChange(false);
      navigate(`${createPageUrl("DocumentViewer")}?id=${lesson.id}&tab=studyplan`);

      // === BACKGROUND TASKS (curriculum mapping only; extraction/compression handled above) ===
      (async () => {
        try {
          console.log("🔄 Starting background curriculum mapping...");
          const curriculumPrompt = `Educational Curriculum Analysis Request

Role:
You are an expert curriculum analyst. Generate a concise (<2000 characters), exam-relevant curriculum profile to support personalized content generation.

Input Context:
- Student Grade Level: ${learningProfile.grade || "N/A"}
- Course / Unit Name: ${courseName}
- School: ${learningProfile.school || "N/A"}
- Location: ${learningProfile.city || "N/A"}
- Student-Provided Content:
${compressedForPrompts || extractedContent}

Analysis Priority (STRICT ORDER):
1. Use the student-provided content as the PRIMARY source of truth.
2. Use official school or course information ONLY to validate or fill clear gaps.
3. Use regional or professional standards ONLY if essential and obvious.

DO NOT perform broad academic research or exhaustive searches.

────────────────────────────

Task:
Produce a compact curriculum profile focused ONLY on material that is likely to appear on assessments.

Strict Required Output (JSON):

A. core_competencies
- List 6–8 core competencies.
- Each: 1 concise sentence describing what the student must be able to do.
- Prefer synthesis over granularity.

B. competency_weightings
- Assign a weight_percentage to each competency.
- MUST sum to "100%".
- Use strings only (e.g., "20%").
- Base emphasis primarily on student content.

C. question_formats
- List the most common assessment formats (e.g., Multiple Choice, Short Answer, Essay).
- For the top 3–4 formats:
  - frequency (string, e.g., "Common", "30%")
  - one short illustrative example (exam-style, not verbose).

D. high_yield_focal_points
- Identify 3–5 topics or skills most likely to be tested.
- Focus on difficulty, recurrence, or conceptual importance.
- Mention key figures, formulas, concepts, or texts ONLY if clearly relevant.

E. common_misconceptions
- List 3–4 common misconceptions or failure points students encounter.
- Tie them directly to the competencies above.

────────────────────────────

Formatting Rules (STRICT):
- weight_percentage MUST be a string with "%"
- frequency MUST be a string
- Do NOT use numeric values anywhere
- Output ONLY valid JSON matching the expected schema

Constraints:
- Be concise, not exhaustive.
- Prioritize exam relevance over completeness.
- Do not introduce content not supported by the inputs.`;

                const curriculumResponseJsonSchema = {
        type: "object",
        properties: {
          core_competencies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" }
              },
              required: ["name", "description"]
            }
          },
          competency_weightings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                competency_name: { type: "string" },
                weight_percentage: { 
                  type: "string",
                  description: "Must be a string with % symbol, e.g., '20%' or '15%'"
                }
              },
              required: ["competency_name", "weight_percentage"]
            }
          },
          question_formats: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                frequency: { 
                  type: "string",
                  description: "Must be a string, e.g., '30%', 'Common', or 'Rare'"
                },
                examples: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["type", "frequency", "examples"]
            }
          },
          high_yield_focal_points: {
            type: "array",
            items: { type: "string" }
          },
          common_misconceptions: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: [
          "core_competencies",
          "competency_weightings",
          "question_formats",
          "high_yield_focal_points",
          "common_misconceptions"
        ]
        };

        const { data: generatedMap } = await base44.functions.invoke('curriculumMapping', {
          prompt: curriculumPrompt,
          response_json_schema: curriculumResponseJsonSchema
        });

      // Handle wrapped responses (e.g., { course_profile: {...} } or { curriculum_profile: {...} })
      let mapData = generatedMap;
      
      // First, try to unwrap from common wrapper keys
      if (!mapData?.core_competencies) {
        const wrapperKeys = ['course_profile', 'curriculum_profile', 'profile', 'data', 'result'];
        for (const key of wrapperKeys) {
          const innerObj = mapData?.[key];
          if (innerObj && typeof innerObj === 'object') {
            mapData = innerObj;
            console.log(`Unwrapped curriculum data from "${key}"`);
            break;
          }
        }
      }
      
      // Normalize keys if they have prefixes like "A. Core Competencies..."
      if (!mapData?.core_competencies && mapData && typeof mapData === 'object') {
        const keyMapping = {
          'core_competencies': ['core competencies', 'learning outcomes', 'a.'],
          'competency_weightings': ['competency weightings', 'emphasis', 'b.'],
          'question_formats': ['question formats', 'assessment', 'c.'],
          'high_yield_focal_points': ['high-yield', 'focal points', 'key topics', 'd.'],
          'common_misconceptions': ['misconceptions', 'difficulties', 'e.']
        };
        
        for (const [targetKey, searchTerms] of Object.entries(keyMapping)) {
          if (mapData[targetKey]) continue; // Already has correct key
          for (const originalKey of Object.keys(mapData)) {
            const lowerKey = originalKey.toLowerCase();
            if (searchTerms.some(term => lowerKey.includes(term))) {
              mapData[targetKey] = mapData[originalKey];
              console.log(`Mapped "${originalKey}" to "${targetKey}"`);
              break;
            }
          }
        }
      }

      // Ensure arrays exist
      const safeArray = (arr) => Array.isArray(arr) ? arr : [];

      const curriculumMap = {
        core_competencies: safeArray(mapData?.core_competencies).map(c => ({
          name: String(c?.name || ""),
          description: String(c?.description || "")
        })),
        competency_weightings: safeArray(mapData?.competency_weightings).map(w => ({
          competency_name: String(w?.competency_name || ""),
          weight_percentage: String(w?.weight_percentage || "0%")
        })),
        question_formats: safeArray(mapData?.question_formats).map(q => ({
          type: String(q?.type || ""),
          frequency: String(q?.frequency || ""),
          examples: safeArray(q?.examples).map(e => String(e || ""))
        })),
        high_yield_focal_points: safeArray(mapData?.high_yield_focal_points).map(p => 
          typeof p === 'object' ? String(p?.name || p?.topic || p?.description || JSON.stringify(p)) : String(p || "")
        ),
        common_misconceptions: safeArray(mapData?.common_misconceptions).map(m => 
          typeof m === 'object' ? String(m?.misconception || m?.description || m?.name || JSON.stringify(m)) : String(m || "")
        )
        };

        console.log("✅ Curriculum map generated");

        // Save curriculum map
        await base44.entities.CurriculumMap.create({
        course_name: courseName.trim(),
        school: learningProfile.school || "",
        grade: learningProfile.grade || "",
        city: learningProfile.city || "",
        source: "create_lesson",
        curriculum_data: curriculumMap
        });

        await base44.entities.Lesson.update(lesson.id, {
        curriculum_map: curriculumMap
        });

        console.log("✅ Curriculum map saved");
        } catch (err) {
        console.error("❌ Background curriculum mapping error:", err);
        }
        })();
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