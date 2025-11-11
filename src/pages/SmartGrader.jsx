import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, FileCheck, AlertCircle, GraduationCap } from "lucide-react";

export default function SmartGrader() {
  const navigate = useNavigate();
  const [courseName, setCourseName] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError("File is too large. Please upload files smaller than 50MB.");
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

      if (!assignmentTitle.trim()) {
        throw new Error("Please enter an assignment title");
      }

      if (!file) {
        throw new Error("Please upload your assignment file");
      }

      setProcessingStep("Uploading your assignment...");
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setProcessingStep("Extracting content from your assignment...");
      const extractResponse = await base44.functions.invoke('extractDocumentContent', {
        file_url: file_url
      });

      if (extractResponse.data.error) {
        throw new Error(extractResponse.data.error);
      }

      const extractedContent = extractResponse.data.extracted_content;

      setProcessingStep("Analyzing curriculum standards...");

      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({
        id: user.learning_profile_id
      });

      const learningProfile = profile[0] || {};

      const curriculumPrompt = `Educational Curriculum Analysis Request

Objective: Analyze the provided course information to create a comprehensive curriculum profile for grading purposes.

Input Context:
Student Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${courseName}
School Context: ${learningProfile.school || "N/A"}
Assignment Content: ${extractedContent}

Task: Generate a detailed curriculum profile including:
- Core competencies and learning outcomes
- Competency weightings (must sum to 100%)
- Typical assessment question formats
- High-yield focal points
- Common student misconceptions

CRITICAL FORMATTING:
- weight_percentage MUST be a STRING with % symbol (e.g., "20%", "15%")
- frequency MUST be a STRING (e.g., "30%", "Common", "Rare")

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

      setProcessingStep("Grading your assignment...");

      const gradingPrompt = `You are an expert teacher grading a student's assignment.

Student Information:
Grade Level: ${learningProfile.grade || "N/A"}
Course: ${courseName}
Assignment: ${assignmentTitle}

Curriculum Standards:
${JSON.stringify(curriculumMap, null, 2)}

Student's Assignment Content:
${extractedContent}

Task: Provide comprehensive grading and feedback including:
1. Predicted letter grade (A+, A, A-, B+, B, B-, C+, C, C-, D, F)
2. Numerical score (0-100)
3. Overall performance summary (2-3 paragraphs)
4. 3-5 identified strengths with specific examples
5. 3-5 areas for improvement with specific recommendations
6. Detailed feedback by section/question
7. Rubric breakdown aligned with curriculum competencies

Be thorough, constructive, and specific in your feedback.`;

      const { data: gradingResult } = await base44.functions.invoke('gradeAssignment', {
        prompt: gradingPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            predicted_grade: { type: "string" },
            total_score: { type: "number" },
            overall_performance_summary: { type: "string" },
            identified_strengths: {
              type: "array",
              items: { type: "string" }
            },
            areas_for_improvement: {
              type: "array",
              items: { type: "string" }
            },
            detailed_feedback_by_section: {
              type: "array",
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
                required: ["section_name", "points_earned", "points_possible", "feedback"]
              }
            },
            rubric_breakdown: {
              type: "array",
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
          required: ["predicted_grade", "total_score", "overall_performance_summary", "identified_strengths", "areas_for_improvement"]
        }
      });

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
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl shadow-lg">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Smart Grader</h1>
              <p className="text-slate-600">Get instant AI-powered feedback on your assignments</p>
            </div>
          </div>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader>
            <CardTitle>Upload Your Assignment</CardTitle>
            <p className="text-sm text-slate-600">Our AI will analyze your work and provide detailed feedback</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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

              <div className="space-y-2">
                <Label htmlFor="assignmentTitle">Assignment Title *</Label>
                <Input
                  id="assignmentTitle"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  placeholder="e.g., Midterm Exam, Essay #3, Lab Report"
                  disabled={isProcessing}
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Upload Assignment File *</Label>
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
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <FileCheck className="w-4 h-4" />
                    <span>Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                )}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-xs text-purple-900 font-medium mb-1">
                    ✨ AI-Powered Document Analysis
                  </p>
                  <p className="text-xs text-slate-600">
                    Upload your completed assignment, test, or essay. Our AI will extract the content, analyze it against curriculum standards, and provide comprehensive feedback.
                  </p>
                </div>
              </div>

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
                    <Upload className="w-5 h-5 mr-2" />
                    Grade My Assignment
                  </>
                )}
              </Button>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">📋 What you'll get:</p>
                <ul className="text-xs text-slate-700 space-y-1 ml-4 list-disc">
                  <li>Predicted letter grade and percentage score</li>
                  <li>Detailed strengths and areas for improvement</li>
                  <li>Section-by-section feedback</li>
                  <li>Rubric breakdown aligned with curriculum standards</li>
                  <li>Specific recommendations to improve your grade</li>
                </ul>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}