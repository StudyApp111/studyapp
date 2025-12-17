import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, FileText, Upload, FileCheck, AlertCircle, History, Lightbulb, ChevronDown, ChevronUp, Calculator, Beaker, Globe, BookText, Languages, Code, Briefcase } from "lucide-react";
import EducationalLoader from "@/components/ui/EducationalLoader";

export default function CreateLesson() {
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
    loadUserProfile();
    const urlParams = new URLSearchParams(window.location.search);
    const suggestedId = urlParams.get('suggestedId');
    
    if (suggestedId) {
      loadSuggestedLesson(suggestedId);
    }
  }, []);

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

  const loadSuggestedLesson = async (suggestedId) => {
    try {
      const suggested = await base44.entities.SuggestedLesson.filter({ id: suggestedId });
      if (suggested.length > 0) {
        setCourseName(suggested[0].lesson_title);
        setDescription(suggested[0].description || "");
        setInputType("description");
      }
    } catch (error) {
      console.error("Error loading suggested lesson:", error);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Check file size (10MB limit)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File is too large. Please upload files smaller than 10MB.");
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

      // Handle file upload - Using Mistral
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

          // Store full content for later reference
          const fullExtractedContent = extractedContent;

          // Compress if content is too long
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

      // Handle description input
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

      // Always generate a fresh curriculum map
      setProcessingStep("Analyzing curriculum...");

      const { data: generatedMap } = await base44.functions.invoke('curriculumMapping', {
        prompt: curriculumPrompt,
        response_json_schema: curriculumResponseJsonSchema
      });

      // Normalize the response to ensure all fields are correct types
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

      // Save the new curriculum map
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

      navigate(createPageUrl("DocumentViewer") + `?lessonId=${lesson.id}`);
    } catch (err) {
      setError(err.message || "Failed to create lesson. Please try again.");
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  if (isProcessing) {
    return <EducationalLoader grade={userGrade} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-4 md:p-10 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <Card className="shadow-2xl border-0 overflow-hidden">
          {/* Compact Hero Header Inside Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-yellow-500 p-6 md:p-8">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -mr-24 -mt-24" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-400/20 rounded-full blur-xl -ml-16 -mb-16" />
            
            <div className="relative flex items-start md:items-center justify-between">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg flex-shrink-0">
                  <Plus className="w-8 h-8 text-white" />
                </div>
                <div className="min-w-0 max-w-2xl">
                  <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Start a Lesson for Any Course</h1>
                  <p className="text-white/90 text-sm md:text-base leading-relaxed">Works with any subject — STEM, Humanities, Languages, Business. Upload notes or describe your course to get a tailored diagnostic, practice, and a grade prediction.</p>
                </div>
              </div>
              <Button
                onClick={() => navigate(createPageUrl("LessonHistory"))}
                variant="outline"
                className="gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 flex-shrink-0 hidden md:flex"
              >
                <History className="w-4 h-4" />
                History
              </Button>
            </div>

            {/* Subject chips to make it obvious this works for any course */}
            <div className="relative mt-6 md:ml-14 max-w-3xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              <Badge className="w-full justify-center py-2 rounded-xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-sm flex items-center gap-1.5"><Calculator className="w-3.5 h-3.5" /> Math</Badge>
              <Badge className="w-full justify-center py-2 rounded-xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-sm flex items-center gap-1.5"><Beaker className="w-3.5 h-3.5" /> Biology</Badge>
              <Badge className="w-full justify-center py-2 rounded-xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-sm flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Geography</Badge>
              <Badge className="w-full justify-center py-2 rounded-xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-sm flex items-center gap-1.5"><BookText className="w-3.5 h-3.5" /> History</Badge>
              <Badge className="w-full justify-center py-2 rounded-xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-sm flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Economics</Badge>
              <Badge className="w-full justify-center py-2 rounded-xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-sm flex items-center gap-1.5"><Code className="w-3.5 h-3.5" /> CompSci</Badge>
              <Badge className="w-full justify-center py-2 rounded-xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-sm flex items-center gap-1.5"><Languages className="w-3.5 h-3.5" /> Languages</Badge>
            </div>
          </div>

          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Tell us about your course</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  placeholder="e.g., MATH 101, Biology 12, POLI 418, ECON 2152, AP US History"
                  disabled={isProcessing}
                  className="text-base"
                />
              </div>

              <div className="space-y-3">
                <Label>How would you like to provide the course content? *</Label>
                <RadioGroup value={inputType} onValueChange={setInputType} disabled={isProcessing}>
                  <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-purple-400 transition-colors">
                    <RadioGroupItem value="file" id="file" />
                    <Label htmlFor="file" className="flex items-center gap-2 flex-1 cursor-pointer">
                      <Upload className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium">Upload a File</p>
                        <p className="text-xs text-slate-500">PDF, PPT, Word, Images - Max 10MB</p>
                      </div>
                    </Label>
                  </div>

<div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-purple-400 transition-colors">
                    <RadioGroupItem value="description" id="description" />
                    <Label htmlFor="description" className="flex items-center gap-2 flex-1 cursor-pointer">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium">Write a Description</p>
                        <p className="text-xs text-slate-500">Describe the course content in your own words</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {inputType === "description" && (
                <div className="space-y-3">
                  <Label htmlFor="description">Describe what you want to study</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your course content, paste lecture notes, or list exam topics..."
                    disabled={isProcessing}
                    className="min-h-[120px] text-base"
                  />
                  
                  {/* Expandable Hints Section */}
                  <div className="border border-purple-200 rounded-lg overflow-hidden bg-gradient-to-r from-purple-50 to-yellow-50">
                    <button
                      type="button"
                      onClick={() => setShowHints(!showHints)}
                      className="w-full flex items-center justify-between p-4 hover:bg-purple-100/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-purple-600" />
                        <span className="font-semibold text-purple-900">Need inspiration? See example prompts</span>
                      </div>
                      {showHints ? (
                        <ChevronUp className="w-5 h-5 text-purple-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-purple-600" />
                      )}
                    </button>
                    
                    {showHints && (
                      <div className="px-4 pb-4 space-y-3 border-t border-purple-200 pt-4">
                        <div className="bg-white rounded-lg p-3 border border-purple-200 hover:border-purple-400 transition-colors cursor-pointer"
                             onClick={() => setDescription("I need help on my final exam that's primarily reading comprehension")}>
                          <p className="text-sm text-slate-700 italic">"I need help on my final exam that's primarily reading comprehension"</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-purple-200 hover:border-purple-400 transition-colors cursor-pointer"
                             onClick={() => setDescription("I have a test on the following news article")}>
                          <p className="text-sm text-slate-700 italic">"I have a test on the following news article"</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-purple-200 hover:border-purple-400 transition-colors cursor-pointer"
                             onClick={() => setDescription("I would like to learn about chapter 5 (cell respiration) in my biology textbook")}>
                          <p className="text-sm text-slate-700 italic">"I would like to learn about chapter 5 (cell respiration) in my biology textbook"</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}



               {inputType === "file" && (
                <div className="space-y-2">
                  <Label htmlFor="file">Upload Course Material *</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="file"
                      type="file"
                      onChange={handleFileChange}
                      disabled={isProcessing}
                      className="text-base"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff"
                    />
                  </div>
                  {file && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600">
                      <FileCheck className="w-4 h-4" />
                      <span>Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    Upload course syllabi, notes, or study materials for AI-powered curriculum analysis.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {processingStep || "Processing..."}
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 mr-2" />
                    Start Now
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}