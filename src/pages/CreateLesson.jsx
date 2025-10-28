
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, Link as LinkIcon, Upload, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CreateLesson() {
  const navigate = useNavigate();
  const [courseName, setCourseName] = useState("");
  const [inputType, setInputType] = useState("description");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!courseName.trim()) {
      setError("Please enter a course name");
      return;
    }

    if (inputType === "description" && !description.trim()) {
      setError("Please enter a lesson description");
      return;
    }

    if (inputType === "url" && !url.trim()) {
      setError("Please enter a URL");
      return;
    }

    if (inputType === "file" && !file) {
      setError("Please upload a file");
      return;
    }

    setIsProcessing(true);

    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        created_by: user.email 
      });

      const learningProfile = profile[0] || {};

      let lessonData = {
        course_name: courseName,
        input_type: inputType,
        status: "created"
      };

      let processedLessonContent = "N/A";
      let studentDescription = "N/A";

      if (inputType === "description") {
        lessonData.description = description;
        studentDescription = description;
      } else if (inputType === "url") {
        lessonData.url = url;
        processedLessonContent = `Content from URL: ${url} (To be parsed in future implementation)`;
      } else if (inputType === "file") {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        lessonData.file_url = file_url;
        processedLessonContent = `Uploaded file: ${file.name} (To be OCR'd in future implementation)`;
      }

      const aiPrompt = `Objective: You are an expert curriculum and pedagogical analyst. Your mission is to meticulously analyze the provided inputs (including any student-written description and/or uploaded materials) and scour the web to construct the most accurate and comprehensive curriculum profile. This profile is foundational for generating personalized learning materials. If student-provided inputs (StudentWrittenDescriptionText or StudentUploadedMaterialsText) are available, they are primary resources for understanding the specific focus, wording, emphasis, and perceived needs related to their course. All other sources should then be used to validate, supplement, and contextualize this primary information.

Input Educational Context:
Grade Level: ${learningProfile.grade || "N/A"} (e.g., Grade 9, 1st Year University. N/A if not applicable)
Course/Unit: ${courseName} (e.g., Mathematics, Introduction to Psychology, AP Calculus BC - Unit 3)
School: ${learningProfile.school || "N/A"} (e.g., FFCA High School, University of Calgary, specific professional body)
City/Region: ${learningProfile.city || "N/A"} (e.g., Calgary, Alberta; California; Ontario)
StudentWrittenDescriptionText (Optional): ${studentDescription} (Text directly written by the student describing their course, what they need help with, specific topics, or questions. If empty, "N/A", or not provided, proceed without it.)
StudentUploadedMaterialsText (Optional): ${processedLessonContent} (Text content from student's notes, PowerPoints, OCR'd documents. If empty, "N/A", or not provided, proceed without it.)

You are expected to actively use online search (Google Search) to find the most current and relevant official documents for the following steps, especially when student-provided materials are insufficient or unavailable.

Information Sourcing & Synthesis Strategy (Prioritized):

Primary Analysis - Student-Provided Inputs (If Available):
If StudentWrittenDescriptionText and/or StudentUploadedMaterialsText are available and contain relevant content:
- Thoroughly analyze these inputs first.
- From StudentWrittenDescriptionText, extract the student's stated needs, topics of focus, areas of confusion, specific questions, and the language they use.
- From StudentUploadedMaterialsText, identify core topics, concepts, learning objectives, specific terminology, wording, difficulty, question styles/examples, and areas of emphasis (e.g., recurring themes, depth of coverage).
- Insights from these student-provided inputs should form the foundational layer and heavily influence all sections of the "Required Curriculum Profile Output," especially regarding the nuances of the student's specific class experience and perceived needs.

Secondary Analysis - Direct Institutional Information (Validation & Supplementation):
Next, search for official curriculum documents, course outlines, syllabi, or learning objectives directly from the specified School for the Course/Unit (and Grade Level).
Use this information to:
- Validate and corroborate findings from the student-provided inputs (Step 1).
- Supplement areas where student inputs might be incomplete or less detailed.
- Provide the official framework and broader context for the course.
- If no student inputs (description or materials) were provided, this step becomes the primary information gathering phase.

Tertiary Analysis - Regional Standards (K-12 Fallback / Broader Context):
If sufficient detail is not available from Steps 1 and 2 (especially for K-12): Use City/Region to consult official regional (e.g., Ministry/Department of Education, District) curriculum standards for the Grade Level and Course/Unit.
Use this to ensure alignment with broader educational requirements and to fill any remaining gaps, always synthesizing with information from prior steps.

Post-Secondary & Professional Course Contextualization:
For post-secondary/professional courses, the official School syllabus/outline (from Step 2) is paramount. Student-provided inputs (description or materials like lecture notes) (Step 1) provide critical class-specific detail.
City/Region can help disambiguate the institution or identify related professional accreditation standards or common resources, used to further contextualize the information from Steps 1 and 2.

Required Curriculum Profile Output:
The content should strongly reflect insights from StudentUploadedMaterialsText if provided, using other official sources for validation, completion, and official terminology. Based on the most authoritative source(s) identified through the strategy above, provide the following:

A. Core Competencies / Learning Outcomes:
Identify and list 6-10 major, clearly defined core competencies or overarching learning outcomes for the Course/Unit.
For each, provide a concise 1-2 sentence description clarifying its scope.
Note: If the official source provides a significantly different number of core/major outcomes (e.g., only 4, or perhaps 12 essential ones), reflect that. If the source lists many granular outcomes, synthesize them into broader competency statements, perhaps noting that each encompasses several sub-skills.

B. Competency Weightings / Emphasis:
Provide estimated percentage weightings for each core competency as an array of objects with competency_name and weight_percentage fields. Ensure the total sums to 100%. Prioritize evidence of emphasis from student-provided inputs (StudentWrittenDescriptionText, StudentUploadedMaterialsText), then official document structures, or typical Course/Unit patterns.
If percentages cannot be reliably determined, indicate relative importance (High, Medium, Low focus). As a final resort, state "Weightings not specified or inferable."

C. Typical Assessment Question Formats & Patterns:
List the common question formats used in assessments (e.g., Multiple Choice Questions (MCQ), Short Answer Questions (SAQ), Extended Response/Essay, Problem-Solving Sets, Document-Based Questions (DBQ), Lab Reports, Practical Demonstrations, Oral Exams) for the Course/Unit.
For the 3-4 most significant formats, estimate their frequency distribution (e.g., MCQ: 40-50%, SAQ: 20-30%, Problem-Solving: 30-40%).
Provide one illustrative example for each of these key question formats, reflecting typical wording, style, and difficulty level.

D. High-Yield Focal Points (Key Topics/Skills):
Identify and briefly describe 3-5 critical concepts, topics, or skills that are:
- Frequently tested or heavily weighted.
- Fundamental for success in subsequent units or courses.
- Known to be particularly challenging for students.

E. Common Student Misconceptions & Difficulties:
Describe at least 3-4 specific and common student misconceptions, typical errors, or areas of difficulty directly related to the core competencies or high-yield focal points of the Course/Unit.
(Source these from curriculum support documents, teacher guides, educational research on the subject, or commonly acknowledged pedagogical knowledge for teaching this specific course/subject at the given level.)

Present the analysis precisely in the structured JSON format with the exact structure specified.
Ensure specificity, alignment with official regional curriculum standards, predictive relevance to actual exam outcomes, and avoid generic responses.`;

      console.log("Calling curriculumMapping function...");
      
      const response = await base44.functions.invoke('curriculumMapping', {
        prompt: aiPrompt,
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
                  weight_percentage: { type: "string" }
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
                  frequency: { type: "string" },
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
          required: ["core_competencies", "competency_weightings", "question_formats", "high_yield_focal_points", "common_misconceptions"]
        }
      });

      console.log("Function response:", response);

      if (!response || !response.data) {
        throw new Error("Invalid response from curriculumMapping function");
      }

      lessonData.curriculum_map = response.data;

      const lesson = await base44.entities.Lesson.create(lessonData);

      navigate(createPageUrl("DiagnosticQuiz") + `?lessonId=${lesson.id}`);
    } catch (error) {
      console.error("Error creating lesson:", error);
      setError(`Failed to create lesson: ${error.message || "Please try again."}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Home"))}
          className="mb-6 hover:bg-purple-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg mb-4">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-slate-700">AI-Powered Curriculum</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Create New Lesson</h1>
          <p className="text-slate-600 text-lg">Tell us about what you want to learn</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-2xl border-0">
          <CardHeader>
            <CardTitle>Lesson Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="courseName">Course Name *</Label>
                <Input
                  id="courseName"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g., Introduction to Python Programming"
                  className="text-base"
                />
              </div>

              <div className="space-y-4">
                <Label>How would you like to provide lesson content? *</Label>
                <RadioGroup value={inputType} onValueChange={setInputType}>
                  <div className="flex items-center space-x-3 p-4 rounded-xl border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer">
                    <RadioGroupItem value="description" id="description" />
                    <Label htmlFor="description" className="flex items-center gap-3 cursor-pointer flex-1">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium">Write Description</p>
                        <p className="text-sm text-slate-500">Describe what you want to learn</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 rounded-xl border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer">
                    <RadioGroupItem value="url" id="url" />
                    <Label htmlFor="url" className="flex items-center gap-3 cursor-pointer flex-1">
                      <LinkIcon className="w-5 h-5 text-purple-700" />
                      <div>
                        <p className="font-medium">Provide URL</p>
                        <p className="text-sm text-slate-500">Link to a course or article</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 rounded-xl border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer">
                    <RadioGroupItem value="file" id="file" />
                    <Label htmlFor="file" className="flex items-center gap-3 cursor-pointer flex-1">
                      <Upload className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="font-medium">Upload File</p>
                        <p className="text-sm text-slate-500">PDF, image, or document</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {inputType === "description" && (
                <div className="space-y-2">
                  <Label htmlFor="description">Lesson Description *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the topic you want to learn, what you hope to achieve, and any specific areas of focus..."
                    className="min-h-[150px] text-base"
                  />
                </div>
              )}

              {inputType === "url" && (
                <div className="space-y-2">
                  <Label htmlFor="url">Resource URL *</Label>
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/course"
                    className="text-base"
                  />
                </div>
              )}

              {inputType === "file" && (
                <div className="space-y-2">
                  <Label htmlFor="file">Upload File *</Label>
                  <div className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center hover:border-purple-400 transition-colors bg-purple-50/30">
                    <Upload className="w-12 h-12 mx-auto text-purple-500 mb-3" />
                    <Input
                      id="file"
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                    />
                    <Label htmlFor="file" className="cursor-pointer">
                      {file ? (
                        <p className="text-sm font-medium text-slate-700">{file.name}</p>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-slate-700 mb-1">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-slate-500">
                            PDF, DOC, TXT, or images (Max 10MB)
                          </p>
                        </>
                      )}
                    </Label>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 py-6 text-lg shadow-xl"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing Curriculum & Creating Lesson...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
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
