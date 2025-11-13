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
      console.log("File uploaded:", file_url);

      setProcessingStep("Extracting content from your assignment...");
      const extractResponse = await base44.functions.invoke('extractDocumentContent', {
        file_url: file_url
      });

      console.log("Extract response:", extractResponse);

      if (extractResponse.data.error) {
        throw new Error(extractResponse.data.error);
      }

      const extractedContent = extractResponse.data.extracted_content;
      console.log("Extracted content length:", extractedContent?.length);

      if (!extractedContent || extractedContent.length === 0) {
        throw new Error("Failed to extract content from document. The file might be empty or corrupted.");
      }

      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({
        id: user.learning_profile_id
      });

      const learningProfile = profile[0] || {};

      setProcessingStep("Analyzing curriculum standards...");
      const existingCurriculumMaps = await base44.entities.CurriculumMap.filter({
        course_name: courseName.trim(),
        school: learningProfile.school || "",
        grade: learningProfile.grade || ""
      });

      let curriculumMap;

      if (existingCurriculumMaps.length > 0) {
        console.log("Found existing curriculum map, reusing it");
        curriculumMap = existingCurriculumMaps[0].curriculum_data;
      } else {
        console.log("No existing curriculum map found, generating new one");

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

      console.log("Curriculum map ready");

      setProcessingStep("Grading your assignment...");

      const gradingPrompt = `You are a veteran teacher and expert grader for${learningProfile.grade || "N/A"} at ${learningProfile.school || "the school"} (grade level: ${learningProfile.grade || "N/A"}, region: ${learningProfile.city || "N/A"}). Your task is to mark the submitted assignment exactly as a skilled course instructor would: align to the curriculum map, apply an appropriate rubric for the assignment type, provide precise and constructive feedback, and output a predicted grade based on performance.

Input Data:
Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${courseName}
School: ${learningProfile.school || "N/A"}
City/Region: ${learningProfile.city || "N/A"}

Curriculum Profile:
${JSON.stringify(curriculumMap, null, 2)}

Assignment Metadata:
Assignment Name/Type: ${assignmentTitle}
Assignment Content:
${extractedContent}

[Grounding & Reasoning Policy (Internal Only, Do Not Output)]
- Ground factual content, topical coverage, and examples primarily in the uploaded assignment text (OCR) and any user-provided notes. Use lessonData.curriculum_map to maintain curricular alignment, competency mapping, and appropriate assessment style/rigor.
- Determine assignment type from the metadata and text: e.g., Essay (argument/analysis), Short Answers, Problem Set (math/econ/accounting), Lab/Report (science), Case/Policy Analysis (business/econ/law), Code/Algorithmic (CS), Presentation/Slides (if text provided), Mixed.
- Select or infer a rubric aligned to the course and assignment type. Weight criteria in line with curriculum_map.competency_weightings when relevant; otherwise use a standard, transparent breakdown for the assignment type.
- For quantitative/technical work (math/science/econ/accounting/CS): verify method, steps, correctness, units, assumptions, edge cases, and interpretation. For essays/humanities/social sciences: evaluate thesis clarity, text/primary-source use, argumentation, conceptual accuracy, structure, style, citation integrity, and originality of insight.
- If the assignment includes sources or citations, check relevance, accuracy of claims, and basic academic integrity signals (fabricated citations, mismatched quotes, impossible page numbers). Do not accuse plagiarism; flag “integrity concerns” with neutral phrasing and evidence to review.
- Calibrate predicted grade to the school/course norms when available; otherwise use a clear percentage scale with descriptors.
- Keep all chain-of-thought internal. Do not output hidden notes or the rubric selection logic—only final results per the output format.

[Rubric Construction (Internal Only, Do Not Output)]
Build an appropriate rubric with 3–6 criteria based on assignment type:
- Essay/Analysis: Thesis/Claim & Relevance; Evidence/Use of Sources; Depth of Analysis & Counter-argument; Organization & Coherence; Style, Grammar, Citations.
- Problem Set/Quantitative (Math/Econ/Accounting/Finance/Stats): Method/Setup; Correctness of Workings; Accuracy of Results; Assumptions/Units/Interpretation; Clarity/Organization.
- Science Lab/Report: Research Question/Hypothesis; Methods/Design; Data/Calculations; Analysis/Discussion; Conclusion/Limits; Formatting/Citations.
- CS/Engineering: Problem Understanding; Algorithm/Approach; Correctness/Complexity; Code Quality/Clarity; Testing/Edge Cases; Documentation.
- Social Sciences/Policy/Case: Framework Selection; Evidence/Reasoning; Comparative/Counterfactual Analysis; Policy/Implications; Clarity/Structure; Citations.
- Languages: Comprehension/Content; Vocabulary/Grammar/Syntax; Task Fulfillment; Organization/Coherence; Register/Style.

Map rubric criteria to curriculum_map.core_competencies where relevant; reflect emphasis using curriculum_map.competency_weightings when applicable.

[Task – Grading & Feedback Generation]
Produce a teacher-quality grade and feedback package:
1) Assignment Overview
   - One concise paragraph summarizing what the assignment attempted, its main task(s), and how well it aligned to ${lessonData.course_name} expectations.

2) Rubric & Scores
   - List 3–6 criteria with short descriptions.
   - Assign each criterion a percentage weight (sum = 100%).
   - Provide a score (0–100%) for each criterion with a 1–2 sentence justification tied to the student’s actual work.

3) Strengths & High-Value Feedback
   - 3–5 bullet points highlighting what was done well, anchored to passages, steps, or evidence from the submission.

4) Priority Improvements (Actionable Next Steps)
   - 4–6 bullet points with specific, teachable fixes (e.g., “Re-derive step 3 with the normal approximation; show continuity correction,” “Integrate direct quotation from primary text and analyze author’s term X,” “Balance sheet journal entry reversals—see item 2—should net to …”).

5) Inline or Section-Targeted Comments (Optional if feasible)
   - Up to 5 pinpoint comments referencing a line/paragraph/step (approximate anchors are fine for OCR), each with a brief correction or suggestion.

6) Academic Integrity & Source Checks (If Applicable)
   - Briefly note any issues to review (e.g., missing citations for quoted material, dubious references, numerical claims without source). Keep tone neutral; provide evidence-based pointers.

7) Predicted Grade
   - Provide a percentage grade (0–100%), a short descriptor (e.g., “B range; above average but uneven analysis”), and a 1–2 sentence rationale that ties together the rubric.
   - If the school/course has explicit grade bands in curriculum_map or notes, align to them; otherwise use common bands (A ≥ 90, B 80–89, C 70–79, D 60–69, F < 60).

8) Competency Mapping & Next Focus
   - List 2–4 curriculum_map.core_competencies most associated with weaknesses observed, in priority order.
   - Suggest 1–2 targeted next mini-lessons or practice activities aligned to curriculum_map.question_formats and high-yield focal points.

[Output Format]
Return a single JSON object with the fields below (strings unless otherwise noted). Do not include any other text.
`;

      console.log("Submitting to grading function...");

      const gradingResponse = await base44.functions.invoke('gradeAssignment', {
        prompt: gradingPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            assignment_overview: { 
              type: "string",
              description: "One paragraph summary"
            },
            rubric: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  criterion: { type: "string" },
                  description: { type: "string" },
                  weight_percentage: { type: "string" },
                  score_percentage: { type: "string" },
                  justification: { type: "string" }
                },
                required: ["criterion", "description", "weight_percentage", "score_percentage", "justification"]
              }
            },
            strengths: {
              type: "array",
              items: { type: "string" }
            },
            priority_improvements: {
              type: "array",
              items: { type: "string" }
            },
            inline_comments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  anchor: { type: "string" },
                  comment: { type: "string" }
                },
                required: ["anchor", "comment"]
              }
            },
            academic_integrity_flags: {
              type: "array",
              items: { type: "string" }
            },
            predicted_grade: {
              type: "string",
              description: "Letter grade: A+, A, A-, B+, B, B-, C+, C, C-, D, F"
            },
            predicted_grade_percentage: {
              type: "string",
              description: "Percentage with % like 85%"
            },
            predicted_grade_rationale: {
              type: "string"
            },
            competency_mapping: {
              type: "array",
              items: { type: "string" }
            },
            recommended_next_focus: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["assignment_overview", "rubric", "strengths", "priority_improvements", "predicted_grade", "predicted_grade_percentage", "predicted_grade_rationale", "competency_mapping", "recommended_next_focus"]
        }
      });

      console.log("Grading response received");

      if (!gradingResponse || !gradingResponse.data) {
        throw new Error("Invalid response from grading service");
      }

      if (gradingResponse.data.error) {
        console.error("Grading error:", gradingResponse.data);
        throw new Error(gradingResponse.data.error || "Failed to grade assignment");
      }

      const gradingResult = gradingResponse.data;
      console.log("Grading complete, keys:", Object.keys(gradingResult));

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
                  <li>Detailed rubric breakdown with justifications</li>
                  <li>Strengths and priority improvements</li>
                  <li>Inline comments on specific sections</li>
                  <li>Academic integrity checks</li>
                  <li>Competency mapping and recommended next focus areas</li>
                </ul>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}