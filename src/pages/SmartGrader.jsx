import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, FileCheck, AlertCircle, GraduationCap, History, FileText, X } from "lucide-react";

export default function SmartGrader() {
  const navigate = useNavigate();
  const [courseName, setCourseName] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentFile, setAssignmentFile] = useState(null);
  const [curriculumFile, setCurriculumFile] = useState(null);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");

  const handleAssignmentFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError("File is too large. Please upload files smaller than 50MB.");
        setAssignmentFile(null);
        e.target.value = '';
        return;
      }
      setAssignmentFile(selectedFile);
      setError("");
    }
  };

  const handleCurriculumFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("Curriculum file is too large. Please upload files smaller than 10MB.");
        setCurriculumFile(null);
        e.target.value = '';
        return;
      }
      setCurriculumFile(selectedFile);
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

      if (!assignmentTitle.trim()) {
        throw new Error("Please enter an assignment title");
      }

      if (!assignmentFile) {
        throw new Error("Please upload your assignment file");
      }

      setProcessingStep("Uploading your assignment...");
      const { file_url } = await base44.integrations.Core.UploadFile({ file: assignmentFile });

      setProcessingStep("Extracting content from your assignment...");
      const extractResponse = await base44.functions.invoke('extractDocumentContent', {
        file_url: file_url
      });

      if (extractResponse.data.error) {
        throw new Error(extractResponse.data.error);
      }

      const extractedContent = extractResponse.data.extracted_content;

      if (!extractedContent || extractedContent.length === 0) {
        throw new Error("Failed to extract content from document. The file might be empty or corrupted.");
      }

      if (extractedContent.length < 50) {
        throw new Error("Extracted content is too short. Please ensure your file contains readable text.");
      }

      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({
        id: user.learning_profile_id
      });

      const learningProfile = profile[0] || {};

      let curriculumMap;

      // Handle custom curriculum file if provided
      if (curriculumFile) {
        console.log("Processing custom curriculum file");
        setProcessingStep("Processing your curriculum file...");
        
        const { file_url: curriculumUrl } = await base44.integrations.Core.UploadFile({ file: curriculumFile });
        
        const curriculumExtractResponse = await base44.functions.invoke('extractDocumentContent', {
          file_url: curriculumUrl
        });

        if (curriculumExtractResponse.data.error) {
          throw new Error("Failed to extract curriculum file: " + curriculumExtractResponse.data.error);
        }

        const customCurriculumText = curriculumExtractResponse.data.extracted_content;
        
        curriculumMap = {
          custom_curriculum: customCurriculumText,
          is_custom: true
        };
      } else {
        setProcessingStep("Analyzing curriculum standards...");
        const existingCurriculumMaps = await base44.entities.CurriculumMap.filter({
          course_name: courseName.trim(),
          school: learningProfile.school || "",
          grade: learningProfile.grade || ""
        });

        if (existingCurriculumMaps.length > 0) {
          curriculumMap = existingCurriculumMaps[0].curriculum_data;
        } else {
          const curriculumPrompt = `Educational Curriculum Analysis Request

Objective: Analyze the provided course information to create a comprehensive curriculum profile for grading purposes.

Input Context:
Student Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${courseName}
School Context: ${learningProfile.school || "N/A"}
Assignment Content (first 3000 chars): ${extractedContent.substring(0, 3000)}

Task: Generate a detailed curriculum profile including:
- Core competencies and learning outcomes (6-10)
- Competency weightings (must sum to 100%)
- Typical assessment question formats (3-4 most common)
- High-yield focal points (3-5 critical concepts)
- Common student misconceptions (3-4 specific ones)

CRITICAL FORMATTING:
- weight_percentage MUST be a STRING with % symbol (e.g., "20%", "15%")
- frequency MUST be a STRING (e.g., "30%", "Common", "Rare")

Base your analysis on standard educational practices for ${learningProfile.grade || "this grade level"}.
Align with typical ${courseName} curriculum standards.
Ensure competency weightings sum to 100%.

Output Format: JSON object matching the specified schema`;

          const { data: generatedMap } = await base44.functions.invoke('curriculumMapping', {
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

          curriculumMap = generatedMap;

          await base44.entities.CurriculumMap.create({
            course_name: courseName.trim(),
            school: learningProfile.school || "",
            grade: learningProfile.grade || "",
            city: learningProfile.city || "",
            curriculum_data: curriculumMap
          });
        }
      }

      setProcessingStep("Grading your assignment (this takes 30-60 seconds)...");

      const curriculumContext = curriculumMap.is_custom 
        ? `Custom Curriculum/Rubric Provided by Instructor:\n${curriculumMap.custom_curriculum}`
        : `Curriculum Profile:\n${JSON.stringify(curriculumMap, null, 2)}`;

      const gradingPrompt = `Grade this ${courseName} assignment for a ${learningProfile.grade || "N/A"} student as if you were a veteran teacher for ${courseName} at ${learningProfile.school || "the school"} (grade level: ${learningProfile.grade || "N/A"}. Read the ENTIRE assignment content below carefully and produce a COMPLETE grading report. Do NOT skip any fields. Do NOT return null or empty arrays.

${curriculumContext}

ASSIGNMENT CONTENT TO GRADE:
${extractedContent}

[Grounding (Internal Only)]
- Ground content and examples primarily in the uploaded assignment text; use the curriculum profile to align competencies, emphasis, and assessment style.
- Infer assignment type from the text (Essay/Analysis; Short Answers; Problem Set—math/econ/accounting; Lab/Report; Case/Policy; Code/Algorithmic; Presentation; Mixed).
- Build a rubric with 3–6 criteria appropriate to that type, mapped where relevant to curriculum_map.core_competencies and reflecting curriculum_map.competency_weightings emphasis if applicable.
- Quant/technical work: check method/steps/correctness/units/assumptions/edge cases/interpretation.  
  Essays/humanities/social sciences: thesis, evidence/sources, depth of analysis/counter-argument, structure, style, citations.  
  CS/engineering: problem understanding, algorithm/approach, correctness/complexity, code clarity, testing, documentation.  
  Social sciences/policy: framework selection, evidence/reasoning, comparative/counterfactual, implications, clarity, citations.  
  Languages: comprehension, vocabulary/grammar/syntax, task fulfilment, organization, register/style.
- Integrity: neutrally flag citation gaps or dubious references if present. Do not accuse; just note concerns to review.
- Grade bands: use school norms if present; else A ≥ 90, B 80–89, C 70–79, D 60–69, F < 60.

REQUIRED OUTPUT - Fill EVERY field with actual analysis based on the content above:

1. predicted_grade: A letter grade (A+, A, A-, B+, B, B-, C+, C, C-, D, F)
2. total_score: A number from 0-100 representing percentage
3. overall_performance_summary: Write at least 3 sentences analyzing what the student submitted
4. identified_strengths: List 3-5 specific things done well (must reference actual content)
5. areas_for_improvement: List 4-6 specific weaknesses (must reference actual content)
6. detailed_feedback_by_section: Create 3-6 sections analyzing different parts. Each needs section_name, points_earned (number), points_possible (number), feedback (text), competencies_assessed (array)
7. rubric_breakdown: Create 3-6 rubric items. Each needs criterion (name), score (number earned), max_score (number possible), comments (text explaining the score)

You MUST fill all 7 fields. Do not return null. Do not return empty arrays unless the assignment is literally blank.

Output valid JSON matching this exact schema.`;

      const gradingResponse = await base44.functions.invoke('gradeAssignment', {
        prompt: gradingPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            predicted_grade: {
              type: "string",
              description: "Letter grade: A+, A, A-, B+, B, B-, C+, C, C-, D, F"
            },
            total_score: {
              type: "number",
              description: "Numeric percentage score 0-100"
            },
            overall_performance_summary: {
              type: "string",
              description: "At least 3 sentences analyzing the work"
            },
            identified_strengths: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              description: "3-5 specific strengths from the content"
            },
            areas_for_improvement: {
              type: "array",
              items: { type: "string" },
              minItems: 4,
              description: "4-6 specific improvements needed"
            },
            detailed_feedback_by_section: {
              type: "array",
              minItems: 3,
              items: {
                type: "object",
                properties: {
                  section_name: { type: "string" },
                  points_earned: { type: "number" },
                  points_possible: { type: "number" },
                  feedback: { type: "string" },
                  competencies_assessed: {
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["section_name", "points_earned", "points_possible", "feedback", "competencies_assessed"]
              }
            },
            rubric_breakdown: {
              type: "array",
              minItems: 3,
              items: {
                type: "object",
                properties: {
                  criterion: { type: "string" },
                  score: { type: "number" },
                  max_score: { type: "number" },
                  comments: { type: "string" }
                },
                required: ["criterion", "score", "max_score", "comments"]
              }
            }
          },
          required: ["predicted_grade", "total_score", "overall_performance_summary", "identified_strengths", "areas_for_improvement", "detailed_feedback_by_section", "rubric_breakdown"]
        }
      });

      if (!gradingResponse || !gradingResponse.data) {
        throw new Error("Invalid response from grading service");
      }

      if (gradingResponse.data.error) {
        throw new Error(gradingResponse.data.error || "Failed to grade assignment");
      }

      const gradingResult = gradingResponse.data;

      if (!gradingResult.overall_performance_summary || 
          !gradingResult.identified_strengths || 
          gradingResult.identified_strengths.length === 0) {
        throw new Error("AI did not provide complete feedback. Please try again.");
      }

      setProcessingStep("Saving results...");

      const gradedAssignment = await base44.entities.GradedAssignment.create({
        course_name: courseName,
        assignment_title: assignmentTitle,
        file_url: file_url,
        extracted_content: extractedContent,
        curriculum_map: curriculumMap,
        grading_result: gradingResult,
        completed: true
      });

      navigate(createPageUrl("GradeResults") + `?assignmentId=${gradedAssignment.id}`);
    } catch (err) {
      console.error("Error grading assignment:", err);
      setError(err.message || "Failed to grade assignment. Please try again.");
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-4 md:p-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl shadow-lg">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Smart Grader</h1>
                <p className="text-slate-600">Get instant AI-powered feedback</p>
              </div>
            </div>
            <Button
              onClick={() => navigate(createPageUrl("AssignmentHistory"))}
              variant="outline"
              className="hidden md:flex gap-2"
            >
              <History className="w-4 h-4" />
              History
            </Button>
          </div>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader className="pb-4">
            <CardTitle>Upload Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {processingStep && (
                <Alert className="bg-purple-50 border-purple-200">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <AlertDescription className="text-purple-900 ml-2">
                    {processingStep}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="courseName">Course Name *</Label>
                  <Input
                    id="courseName"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="e.g., AP Calculus"
                    disabled={isProcessing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignmentTitle">Assignment Title *</Label>
                  <Input
                    id="assignmentTitle"
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    placeholder="e.g., Midterm Exam"
                    disabled={isProcessing}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignmentFile">Assignment File *</Label>
                <Input
                  id="assignmentFile"
                  type="file"
                  onChange={handleAssignmentFileChange}
                  disabled={isProcessing}
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                />
                {assignmentFile && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <FileCheck className="w-4 h-4" />
                    <span>{assignmentFile.name}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="curriculumFile" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Custom Rubric/Curriculum (Optional)
                </Label>
                <Input
                  id="curriculumFile"
                  type="file"
                  onChange={handleCurriculumFileChange}
                  disabled={isProcessing}
                  accept=".pdf,.doc,.docx,.txt"
                />
                {curriculumFile && (
                  <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-sm text-purple-700">
                      <FileCheck className="w-4 h-4" />
                      <span>{curriculumFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCurriculumFile(null);
                        document.getElementById('curriculumFile').value = '';
                      }}
                      className="text-purple-600 hover:text-purple-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Upload your grading rubric or curriculum to override automatic standards
                </p>
              </div>

              <Button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {processingStep || "Processing..."}
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Grade Assignment
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