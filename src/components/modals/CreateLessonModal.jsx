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

      if (inputType === "file") {
        if (files.length === 0) {
          throw new Error("Please select at least one file");
        }

        try {
          setProcessingStep(`Uploading ${files.length} file(s)...`);
          
          // Upload all files
          for (const file of files) {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            fileUrls.push(file_url);
          }

          setProcessingStep("Extracting content from your documents...");
          
          // Extract content from all files
          const allExtractedContent = [];
          for (const fileUrl of fileUrls) {
            const extractResult = await base44.functions.invoke('extractDocumentContent', {
              file_url: fileUrl
            });

            if (!extractResult?.data?.extracted_content) {
              throw new Error("Failed to extract content from one or more documents");
            }

            allExtractedContent.push(extractResult.data.extracted_content);
          }

          // Combine all content
          extractedContent = allExtractedContent.join("\n\n--- NEXT DOCUMENT ---\n\n");
          fullExtractedContent = extractedContent;

          if (extractedContent.length < 50) {
            throw new Error("Extracted content is too short. Please ensure your files contain readable text.");
          }

          // Compress if needed
          if (extractedContent.length > 8000) {
            setProcessingStep("Compressing documents for optimal processing...");
            
            const compressionResult = await base44.functions.invoke('compressDocument', {
              content: extractedContent
            });

            if (compressionResult?.data?.compressed_content) {
              extractedContent = compressionResult.data.compressed_content;
            }
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
      }

      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({
        id: user.learning_profile_id
      });

      const learningProfile = profile[0] || {};

      const curriculumPrompt = `Educational Curriculum Analysis Request

Role:
You are an expert curriculum analyst. Generate a concise, exam-relevant curriculum profile to support personalized worksheet generation.

Input Context:
- Student Grade Level: ${learningProfile.grade || "N/A"}
- Course / Unit Name: ${courseName}
- School: ${learningProfile.school || "N/A"}
- Location: ${learningProfile.city || "N/A"}
- Student-Provided Content:
${extractedContent}

Analysis Priority (STRICT ORDER):
1. Use the student-provided content as the PRIMARY source of truth.
2. Use official school or course information ONLY to validate or fill clear gaps.
3. Use regional or professional standards ONLY if essential and obvious.

DO NOT perform broad academic research or exhaustive searches.

────────────────────────────

Task:
Produce a compact curriculum profile focused ONLY on material that is likely to appear on assessments.

Required Output (JSON):

A. Core Competencies / Learning Outcomes
- List 6–8 core competencies.
- Each: 1 concise sentence describing what the student must be able to do.
- Prefer synthesis over granularity.

B. Competency Emphasis
- Assign a weight_percentage to each competency.
- MUST sum to "100%".
- Use strings only (e.g., "20%").
- Base emphasis primarily on student content.

C. Assessment Formats & Patterns
- List the most common assessment formats (e.g., Multiple Choice, Short Answer, Essay).
- For the top 3–4 formats:
  - frequency (string, e.g., "Common", "30%")
  - one short illustrative example (exam-style, not verbose).

D. High-Yield Focal Points
- Identify 3–5 topics or skills most likely to be tested.
- Focus on difficulty, recurrence, or conceptual importance.
- Mention key figures, formulas, concepts, or texts ONLY if clearly relevant.

E. Common Student Difficulties
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

      setProcessingStep("Analyzing curriculum...");

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

      // Create lesson immediately after OCR - navigate user to DocumentViewer ASAP
      setProcessingStep("Creating lesson...");

      const lessonData = {
        course_name: courseName,
        input_type: inputType,
        status: "created"
      };

      if (inputType === "description") {
        lessonData.description = description.trim();
        lessonData.extracted_content = description.trim();
      } else if (inputType === "file") {
        lessonData.file_url = fileUrls.length > 0 ? fileUrls[0] : "";
        lessonData.file_urls = fileUrls;
        lessonData.extracted_content = fullExtractedContent || extractedContent;
      }

      const lesson = await base44.entities.Lesson.create(lessonData);

      // Navigate immediately - curriculum mapping and exam generation happen in background
      onOpenChange(false);
      navigate(createPageUrl("DocumentViewer") + `?id=${lesson.id}&generating=true`);

      // Background: Save curriculum map and update lesson (non-blocking)
      base44.entities.CurriculumMap.create({
        course_name: courseName.trim(),
        school: learningProfile.school || "",
        grade: learningProfile.grade || "",
        city: learningProfile.city || "",
        source: "create_lesson",
        curriculum_data: curriculumMap
      }).catch(err => console.error("CurriculumMap save error:", err));

      base44.entities.Lesson.update(lesson.id, {
        curriculum_map: curriculumMap
      }).catch(err => console.error("Lesson curriculum update error:", err));
    } catch (err) {
      setError(err.message || "Failed to create lesson. Please try again.");
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto p-0 gap-0 rounded-2xl">
        {isProcessing ? (
          <EducationalLoader />
        ) : (
          <>
            {/* Compact Header */}
            <div className="relative bg-gradient-to-r from-purple-600 to-indigo-700 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">New Lesson</h2>
                  <p className="text-white/80 text-xs">Upload notes to get started</p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                {/* Course Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="courseName" className="text-sm font-medium">Course Name</Label>
                  <Input
                    id="courseName"
                    value={courseName}
                    onChange={(e) => {
                      setCourseName(e.target.value);
                      setSuggestions([]);
                    }}
                    placeholder="e.g., MATH 101, Biology 12"
                    disabled={isProcessing}
                    className="h-11"
                  />
                </div>

                {/* Content Type Toggle */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Content Source</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInputType("file")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        inputType === "file"
                          ? "border-purple-500 bg-purple-50 text-purple-700"
                          : "border-slate-200 hover:border-slate-300 text-slate-600"
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      <span className="text-sm font-medium">Upload</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputType("description")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        inputType === "description"
                          ? "border-purple-500 bg-purple-50 text-purple-700"
                          : "border-slate-200 hover:border-slate-300 text-slate-600"
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span className="text-sm font-medium">Describe</span>
                    </button>
                  </div>
                </div>

                {/* Description Input */}
                {inputType === "description" && (
                  <div className="space-y-1.5">
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g., 'Chapter 5 - Photosynthesis, chloroplasts, light reactions...'"
                      disabled={isProcessing}
                      className="min-h-[80px] resize-none text-sm"
                    />

                    {/* Expandable tips */}
                    <button
                      type="button"
                      onClick={() => setShowTips(!showTips)}
                      className="flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 font-medium"
                    >
                      <Lightbulb className="w-3 h-3" />
                      {showTips ? "Hide tips" : "What works best?"}
                    </button>

                    {showTips && (
                      <div className="bg-slate-50 rounded-lg p-2 space-y-1 text-[11px]">
                        <div className="text-emerald-700">
                          <span className="font-medium">✓</span> "Chapter 5 - Photosynthesis", "French Revolution notes"
                        </div>
                        <div className="text-red-600">
                          <span className="font-medium">✗</span> "Math", "Help with quiz"
                        </div>
                      </div>
                    )}

                    {/* Smart suggestions for short descriptions */}
                    {description.length > 0 && description.length < 50 && (
                      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200/60 rounded-xl p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-purple-700 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                            <span className="font-medium">Add more detail or try a suggestion</span>
                          </p>
                          {!loadingSuggestions && suggestions.length === 0 && courseName.trim() && (
                            <button
                              type="button"
                              onClick={generateSuggestions}
                              className="text-[11px] bg-purple-600 hover:bg-purple-700 text-white font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                            >
                              <Sparkles className="w-3 h-3" />
                              Suggest
                            </button>
                          )}
                        </div>
                        
                        {loadingSuggestions && (
                          <div className="flex items-center justify-center gap-2 text-xs text-purple-600 mt-3 py-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Finding topics for {courseName}...
                          </div>
                        )}
                        
                        {suggestions.length > 0 && (
                          <div className="grid grid-cols-1 gap-2 mt-3">
                            {suggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setDescription(suggestion);
                                  setSuggestions([]);
                                }}
                                className="w-full text-left text-xs text-slate-700 bg-white hover:bg-purple-100 border border-purple-100 hover:border-purple-300 rounded-lg p-2.5 transition-all hover:shadow-sm"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {!loadingSuggestions && suggestions.length === 0 && !courseName.trim() && (
                          <p className="text-[11px] text-purple-600/70 mt-1">Enter a course name first to get suggestions</p>
                        )}
                      </div>
                    )}

                    {description.length >= 50 && description.length < 100 && (
                      <div className="flex items-center gap-1.5 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <Lightbulb className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />
                        <p className="text-[11px] text-yellow-800">
                          <span className="font-medium">Getting better!</span> Add more details.
                        </p>
                      </div>
                    )}

                    {description.length >= 100 && (
                      <div className="flex items-center gap-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <FileCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <p className="text-[11px] text-emerald-800">
                          <span className="font-medium">Great!</span> Ready to generate.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* File Upload */}
                {inputType === "file" && (
                  <div className="space-y-2">
                    <div 
                      className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-purple-400 transition-colors cursor-pointer"
                      onClick={() => document.getElementById('modal-file-input').click()}
                    >
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600 font-medium">Click to upload files</p>
                      <p className="text-xs text-slate-400 mt-1">PDF, Word, PPT, Images • Max 15MB</p>
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
                      <div className="space-y-1.5 max-h-24 overflow-y-auto">
                        {files.map((f, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg">
                            <FileCheck className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate flex-1">{f.name}</span>
                            <span className="text-xs text-emerald-500">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* XP Reward Preview */}
                <div className="flex items-center justify-center gap-1.5 py-1.5 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
                  <Zap className="w-3.5 h-3.5 text-yellow-600" />
                  <span className="text-[11px] font-medium text-yellow-800">Earn up to <span className="font-bold">+150 XP</span></span>
                  <Trophy className="w-3.5 h-3.5 text-yellow-600" />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isProcessing || (inputType === "description" && description.length < 30)}
                  className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 disabled:opacity-50"
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