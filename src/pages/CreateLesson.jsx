
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
import { Loader2, Plus, FileText, Link as LinkIcon, Upload } from "lucide-react";

export default function CreateLesson() {
  const navigate = useNavigate();
  const [courseName, setCourseName] = useState("");
  const [inputType, setInputType] = useState("description");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const suggestedId = urlParams.get('suggestedId');
    
    if (suggestedId) {
      loadSuggestedLesson(suggestedId);
    }
  }, []);

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
      setFile(selectedFile);
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsProcessing(true);

    try {
      if (!courseName.trim()) {
        throw new Error("Please enter a course name");
      }

      let extractedContent = "";
      let fileUrl = "";

      // Handle URL input
      if (inputType === "url") {
        if (!url.trim()) {
          throw new Error("Please enter a URL");
        }

        try {
          const { data: urlContent } = await base44.integrations.Core.InvokeLLM({
            prompt: `Extract and summarize all educational content from the following URL in detail. Provide a comprehensive transcript or summary of the content that captures all key concepts, topics, and learning materials. URL: ${url}`,
            add_context_from_internet: true
          });
          
          extractedContent = urlContent;
        } catch (urlError) {
          console.error("Error extracting URL content:", urlError);
          throw new Error("Failed to extract content from URL. Please check the URL and try again.");
        }
      }

      // Handle file upload
      if (inputType === "file") {
        if (!file) {
          throw new Error("Please select a file");
        }

        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          fileUrl = file_url;

          // Extract content from file using LLM
          const { data: fileContent } = await base44.integrations.Core.InvokeLLM({
            prompt: "Extract and provide a detailed, comprehensive transcript or summary of all educational content from this file. Capture all key concepts, topics, formulas, definitions, and learning materials in detail.",
            file_urls: [file_url]
          });

          extractedContent = fileContent;
        } catch (fileError) {
          console.error("Error processing file:", fileError);
          throw new Error("Failed to process file. Please try a different file.");
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

- weight_percentage MUST be a STRING with % symbol (e.g., “20%”, “15%”)
- frequency MUST be a STRING (e.g., “30%”, “Common”, “Rare”)
- Do NOT use numeric values, always use strings

Requirements:

- Base your analysis on standard educational practices for ${learningProfile.grade || "this grade level"}
- Align with typical ${courseName} curriculum standards
- Ensure competency weightings sum to 100%
- Make question format examples realistic and grade-appropriate
- Focus on exam-relevant material

Expand your search scope so that your response may include specific books, authors/theorists, concepts or figures relevant to the course domain.
Output Format: JSON object matching the specified schema`;

      const { data: curriculumMap } = await base44.functions.invoke('curriculumMapping', {
        prompt: curriculumPrompt,
        response_json_schema: {
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
        }
      });

      const lessonData = {
        course_name: courseName,
        input_type: inputType,
        curriculum_map: curriculumMap,
        status: "created"
      };

      if (inputType === "description") {
        lessonData.description = description;
      } else if (inputType === "url") {
        lessonData.url = url;
        lessonData.extracted_content = extractedContent;
      } else if (inputType === "file") {
        lessonData.file_url = fileUrl;
        lessonData.extracted_content = extractedContent;
      }

      const lesson = await base44.entities.Lesson.create(lessonData);

      navigate(createPageUrl("DiagnosticQuiz") + `?lessonId=${lesson.id}`);
    } catch (err) {
      console.error("Error creating lesson:", err);
      setError(err.message || "Failed to create lesson. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-4 md:p-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Create New Lesson</h1>
          <p className="text-slate-600">Set up a personalized learning experience</p>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader>
            <CardTitle>Lesson Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="courseName">Course Name *</Label>
                <Input
                  id="courseName"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g., AP Calculus, World History, Biology 101"
                  disabled={isProcessing}
                  className="text-base"
                />
              </div>

              <div className="space-y-3">
                <Label>How would you like to provide the course content? *</Label>
                <RadioGroup value={inputType} onValueChange={setInputType} disabled={isProcessing}>
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

                  <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-purple-400 transition-colors">
                    <RadioGroupItem value="url" id="url" />
                    <Label htmlFor="url" className="flex items-center gap-2 flex-1 cursor-pointer">
                      <LinkIcon className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium">Provide a URL</p>
                        <p className="text-xs text-slate-500">Link to course materials, syllabus, or educational content</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-purple-400 transition-colors">
                    <RadioGroupItem value="file" id="file" />
                    <Label htmlFor="file" className="flex items-center gap-2 flex-1 cursor-pointer">
                      <Upload className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium">Upload a File</p>
                        <p className="text-xs text-slate-500">Upload a syllabus, PDF, or document with course info</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {inputType === "description" && (
                <div className="space-y-2">
                  <Label htmlFor="description">Course Description *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this course covers, key topics, learning objectives..."
                    disabled={isProcessing}
                    className="min-h-[150px] text-base"
                  />
                  <p className="text-xs text-slate-500">
                    Provide as much detail as possible for better personalization
                  </p>
                </div>
              )}

              {inputType === "url" && (
                <div className="space-y-2">
                  <Label htmlFor="url">Content URL *</Label>
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/course-syllabus"
                    disabled={isProcessing}
                    className="text-base"
                  />
                  <p className="text-xs text-slate-500">
                    Provide a link to your course materials, syllabus, or any educational content
                  </p>
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
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                    />
                  </div>
                  {file && (
                    <p className="text-sm text-green-600">
                      Selected: {file.name}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    Supported formats: PDF, Word, Text, Images (PNG, JPG)
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
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 mr-2" />
                    Create Lesson & Start Diagnostic
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
