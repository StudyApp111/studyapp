import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, Upload, FileCheck, AlertCircle, Sparkles, X } from "lucide-react";
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
  const [showHints, setShowHints] = useState(false);

  useEffect(() => {
    if (open) {
      loadUserProfile();
      // Reset form when modal opens
      setCourseName("");
      setInputType("file");
      setDescription("");
      setFiles([]);
      setError("");
      setShowHints(false);
      setIsProcessing(false);
      setProcessingStep("");
    }
  }, [open]);

  const loadUserProfile = async () => {
    try {
      const user = await base44.auth.me();
      if (user.learning_profile_id) {
        const profile = await base44.entities.LearningProfile.filter({ id: user.learning_profile_id });
        if (profile.length > 0) {
          setUserGrade(profile[0].grade);
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
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

Objective: You are an expert curriculum and pedagogical analyst. Your mission is to meticulously analyze the provided inputs to construct the most accurate and comprehensive curriculum profile possible. This profile is foundational for generating personalized learning materials.

Input Context:
Student Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${courseName}
School Context: ${learningProfile.school || "N/A"}
Location Context: ${learningProfile.city || "N/A"}
Content Source: ${extractedContent}

Task: Generate a detailed curriculum profile that includes:

Information Sourcing & Synthesis Strategy (Prioritized):

1. Primary Analysis – Student-Provided Content:
Thoroughly analyze ${extractedContent} to identify core topics, concepts, learning objectives, specific terminology, areas of emphasis (e.g., recurring themes, depth of coverage), any stated needs or questions — and also identify relevant major authors, theorists, books or seminal works referenced or implied.
2. Secondary Analysis – Direct Institutional Information (Validation & Supplementation):
Search for official curriculum documents, course outlines or syllabi directly from ${learningProfile.school} for ${courseName}. Use this information to validate, supplement and provide the official framework for the course, corroborating findings from the student-provided content. Also locate recommended textbooks, key readings, or resource lists associated with the syllabus.
3. Tertiary Analysis – Broader Context & Standards:
For K-12 courses, if necessary, consult official regional curriculum standards for ${learningProfile.grade} and ${courseName} using ${learningProfile.city} to ensure alignment with broader educational requirements. For post-secondary/professional courses, use ${learningProfile.city} to identify related professional accreditation standards or common resources; locate canonical works, major figures, landmark studies or seminal concepts to further contextualize the information.

Required Curriculum Profile Output:

Based on the most authoritative source(s) identified, provide the following in the structured JSON format below. The content should strongly reflect insights from ${extractedContent}, using other official sources for validation and completion.
A. Core Competencies / Learning Outcomes:
Identify and list 6-10 major, clearly defined core competencies or overarching learning outcomes. For each, provide a concise 1-2 sentence description. If the official source provides a significantly different number of outcomes, reflect that. Synthesize granular outcomes into broader competency statements where appropriate.
B. Competency Weightings / Emphasis:
Infer or calculate estimated percentage weightings for each core competency, ensuring a sum of 100%. Prioritize evidence of emphasis from ${extractedContent}, then official documents. If percentages cannot be reliably determined, indicate relative importance (High, Medium, Low).
C. Typical Assessment Question Formats & Patterns:
List common assessment formats (e.g., Multiple Choice, Short Answer, Essay). For the 3-4 most significant formats, estimate their frequency distribution and provide one illustrative example for each, reflecting typical style and difficulty. Also include one example resource or reading or figure that might appear in such an assessment (e.g., a theorist, textbook chapter, mathematical concept, scientific principle).
D. High-Yield Focal Points (Key Topics/Skills):
Identify and briefly describe 3-5 critical concepts, topics or skills that are frequently tested, fundamental for future success, or known to be challenging. Where relevant, mention major authors, key books, or historical/political figures or scientific/mathematical concepts linked to those focal points.
E. Common Student Misconceptions & Difficulties:
Describe at least 3-4 specific and common student misconceptions or difficulties related to the core competencies or high-yield focal points.

CRITICAL FORMATTING:

- weight_percentage MUST be a STRING with % symbol (e.g., "20%", "15%")
- frequency MUST be a STRING (e.g., "30%", "Common", "Rare")
- Do NOT use numeric values, always use strings

Requirements:

- Base your analysis on standard educational practices for ${learningProfile.grade || "this grade level"}
- Align with typical ${courseName} curriculum standards
- Ensure competency weightings sum to 100%
- Make question format examples realistic and grade-appropriate
- Focus on exam-relevant material

Expand your search scope so that your response may include specific books, authors/therorists, concepts or figures relevant to the course domain.
Output Format: JSON object matching the specified schema`;

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
      if (!mapData?.core_competencies) {
        // Check common wrapper keys
        const wrapperKeys = ['course_profile', 'curriculum_profile', 'profile', 'data', 'result'];
        for (const key of wrapperKeys) {
          const innerObj = mapData?.[key];
          if (innerObj && typeof innerObj === 'object') {
            // Check for core_competencies or variations
            const hasCompetencies = innerObj.core_competencies || 
              Object.keys(innerObj).some(k => k.toLowerCase().includes('core competencies'));
            if (hasCompetencies) {
              mapData = innerObj;
              console.log(`Unwrapped curriculum data from "${key}"`);
              break;
            }
          }
        }
        
        // Normalize keys if they have prefixes like "A. Core Competencies..."
        if (!mapData?.core_competencies && mapData) {
          const keyMapping = {
            'core_competencies': ['core competencies', 'learning outcomes'],
            'competency_weightings': ['competency weightings', 'emphasis'],
            'question_formats': ['question formats', 'assessment'],
            'high_yield_focal_points': ['high-yield', 'focal points', 'key topics'],
            'common_misconceptions': ['misconceptions', 'difficulties']
          };
          
          for (const [targetKey, searchTerms] of Object.entries(keyMapping)) {
            for (const originalKey of Object.keys(mapData)) {
              const lowerKey = originalKey.toLowerCase();
              if (searchTerms.some(term => lowerKey.includes(term))) {
                mapData[targetKey] = mapData[originalKey];
                break;
              }
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

      await base44.entities.CurriculumMap.create({
        course_name: courseName.trim(),
        school: learningProfile.school || "",
        grade: learningProfile.grade || "",
        city: learningProfile.city || "",
        source: "create_lesson",
        curriculum_data: curriculumMap
      });

      setProcessingStep("Creating lesson...");

      const lessonData = {
        course_name: courseName,
        input_type: inputType,
        curriculum_map: curriculumMap,
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

      onOpenChange(false);
      navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}&worksheet=1`);
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
                    onChange={(e) => setCourseName(e.target.value)}
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
                      placeholder="Describe your course content, paste lecture notes, or list topics..."
                      disabled={isProcessing}
                      className="min-h-[100px] resize-none"
                    />
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

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25"
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