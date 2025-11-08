
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

You are an expert curriculum analyst tasked with creating a comprehensive profile of educational content to support precise, high-fidelity assessment design. Your analysis will be used to generate diagnostic quizzes and worksheets that accurately mirror exam conditions and learning objectives.

Input Context:
Student Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${courseName}
School Context: ${learningProfile.school || "N/A"}
Location Context: ${learningProfile.city || "N/A"}
Content Source: ${extractedContent}

Task: Generate a detailed curriculum profile that includes:

1. Core Competencies (5-8 primary learning objectives)
   For each competency:
   - Name: Clear, concise label
   - Description: 2-3 sentence explanation of what mastery looks like

2. Competency Weightings (importance in assessments)
   For each core competency:
   - Competency name (matching above)
   - Weight percentage: MUST be a string like "15%" or "20%" (including the % symbol)
   - All weights must sum to 100%

3. Question Formats (types of questions students will encounter)
   For each format:
   - Type: (e.g., "Multiple Choice", "Short Answer", "Problem-Solving", "Essay")
   - Frequency: How often this appears as a STRING (e.g., "30%", "15%", "Rare", "Common")
   - Examples: 2-3 specific example questions in this format

4. High-Yield Focal Points (3-5 items)
   - List the most critical topics/concepts that frequently appear on assessments
   - These should represent the "must-know" material for exam success

5. Common Misconceptions (3-5 items)
   - Identify typical errors or misunderstandings students have with this material
   - Format: Brief description of the misconception

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
