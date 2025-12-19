import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, FileText, Upload, FileCheck, AlertCircle, Lightbulb, ChevronDown, ChevronUp, Calculator, Beaker, Globe, BookText, Code, Briefcase, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EducationalLoader from "@/components/ui/EducationalLoader";

export default function CreateLessonModal({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [courseName, setCourseName] = useState("");
  const [inputType, setInputType] = useState("file");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
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
      setFile(null);
      setError("");
      setShowHints(false);
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
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File is too large. Please upload files smaller than 5MB.");
        setFile(null);
        e.target.value = '';
        return;
      }
      
      setFile(selectedFile);
      setError("");
    }
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
      let fileUrl = "";

      if (inputType === "file") {
        if (!file) {
          throw new Error("Please select a file");
        }

        try {
          setProcessingStep("Uploading file...");
          
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          fileUrl = file_url;

          setProcessingStep("Extracting content from your document...");
          
          const extractResult = await base44.functions.invoke('extractDocumentContent', {
            file_url: file_url
          });

          if (!extractResult?.data?.extracted_content) {
            throw new Error("Failed to extract content from document");
          }

          extractedContent = extractResult.data.extracted_content;

          if (extractedContent.length < 50) {
            throw new Error("Extracted content is too short. Please ensure your file contains readable text.");
          }

          const fullExtractedContent = extractedContent;

          if (extractedContent.length > 1500) {
            setProcessingStep("Compressing document for optimal processing...");
            
            const compressionResult = await base44.functions.invoke('compressDocument', {
              content: extractedContent
            });

            if (compressionResult?.data?.compressed_content) {
              extractedContent = compressionResult.data.compressed_content;
            }
          }
          
        } catch (fileError) {
          console.error("Error processing file:", fileError);
          throw new Error(fileError.message || "Failed to process file. Please try again.");
        }
      }

      if (inputType === "description") {
        if (!description.trim()) {
          throw new Error("Please enter a description");
        }
        extractedContent = description;
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

      const curriculumMap = {
        core_competencies: (generatedMap.core_competencies || []).map(c => ({
          name: String(c?.name || ""),
          description: String(c?.description || "")
        })),
        competency_weightings: (generatedMap.competency_weightings || []).map(w => ({
          competency_name: String(w?.competency_name || ""),
          weight_percentage: String(w?.weight_percentage || "0%")
        })),
        question_formats: (generatedMap.question_formats || []).map(q => ({
          type: String(q?.type || ""),
          frequency: String(q?.frequency || ""),
          examples: (q?.examples || []).map(e => String(e || ""))
        })),
        high_yield_focal_points: (generatedMap.high_yield_focal_points || []).map(p => 
          typeof p === 'object' ? String(p?.name || p?.topic || p?.description || JSON.stringify(p)) : String(p || "")
        ),
        common_misconceptions: (generatedMap.common_misconceptions || []).map(m => 
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
        lessonData.description = description;
      } else if (inputType === "file") {
        lessonData.file_url = fileUrl;
        lessonData.extracted_content = fullExtractedContent || extractedContent;
      }

      const lesson = await base44.entities.Lesson.create(lessonData);

      onOpenChange(false);
      navigate(createPageUrl("DocumentViewer") + `?lessonId=${lesson.id}`);
    } catch (err) {
      setError(err.message || "Failed to create lesson. Please try again.");
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {isProcessing ? (
          <div className="p-8">
            <EducationalLoader grade={userGrade} />
          </div>
        ) : (
          <>
            <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-yellow-500 p-6">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl -ml-16 -mb-16" />
              
              <div className="relative text-center space-y-4">
                <div className="flex justify-center mb-2">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-xl">
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                </div>
                
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Start a New Lesson</h2>
                  <p className="text-white/90 text-sm">Upload notes or describe your course to get started</p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Badge className="bg-white/15 text-white border-white/30 backdrop-blur-sm flex items-center gap-1 px-2 py-1 text-xs">
                    <Calculator className="w-3 h-3" /> Math
                  </Badge>
                  <Badge className="bg-white/15 text-white border-white/30 backdrop-blur-sm flex items-center gap-1 px-2 py-1 text-xs">
                    <Beaker className="w-3 h-3" /> Biology
                  </Badge>
                  <Badge className="bg-white/15 text-white border-white/30 backdrop-blur-sm flex items-center gap-1 px-2 py-1 text-xs">
                    <Globe className="w-3 h-3" /> Geography
                  </Badge>
                  <Badge className="bg-white/15 text-white border-white/30 backdrop-blur-sm flex items-center gap-1 px-2 py-1 text-xs">
                    <BookText className="w-3 h-3" /> History
                  </Badge>
                  <Badge className="bg-white/15 text-white border-white/30 backdrop-blur-sm flex items-center gap-1 px-2 py-1 text-xs">
                    <Code className="w-3 h-3" /> CompSci
                  </Badge>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="courseName">Course Name *</Label>
                  <Input
                    id="courseName"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="e.g., MATH 101, Biology 12, AP US History"
                    disabled={isProcessing}
                  />
                </div>

                <div className="space-y-2">
                  <Label>How would you like to provide content? *</Label>
                  <RadioGroup value={inputType} onValueChange={setInputType} disabled={isProcessing}>
                    <div className="flex items-center space-x-2 p-3 rounded-lg border-2 border-slate-200 hover:border-purple-400 transition-colors">
                      <RadioGroupItem value="file" id="modal-file" />
                      <Label htmlFor="modal-file" className="flex items-center gap-2 flex-1 cursor-pointer">
                        <Upload className="w-4 h-4 text-purple-600" />
                        <div>
                          <p className="font-medium text-sm">Upload a File</p>
                          <p className="text-xs text-slate-500">PDF, PPT, Word, Images - Max 5MB</p>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2 p-3 rounded-lg border-2 border-slate-200 hover:border-purple-400 transition-colors">
                      <RadioGroupItem value="description" id="modal-description" />
                      <Label htmlFor="modal-description" className="flex items-center gap-2 flex-1 cursor-pointer">
                        <FileText className="w-4 h-4 text-purple-600" />
                        <div>
                          <p className="font-medium text-sm">Write a Description</p>
                          <p className="text-xs text-slate-500">Describe the course content</p>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {inputType === "description" && (
                  <div className="space-y-2">
                    <Label htmlFor="modal-description-text">Describe what you want to study</Label>
                    <Textarea
                      id="modal-description-text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your course content, paste lecture notes, or list exam topics..."
                      disabled={isProcessing}
                      className="min-h-[100px]"
                    />
                  </div>
                )}

                {inputType === "file" && (
                  <div className="space-y-2">
                    <Label htmlFor="modal-file-input">Upload Course Material *</Label>
                    <Input
                      id="modal-file-input"
                      type="file"
                      onChange={handleFileChange}
                      disabled={isProcessing}
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff"
                    />
                    {file && (
                      <div className="flex items-center gap-2 text-sm text-emerald-600">
                        <FileCheck className="w-4 h-4" />
                        <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {processingStep || "Processing..."}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
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