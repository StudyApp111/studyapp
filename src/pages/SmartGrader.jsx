import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, FileCheck, AlertCircle, History, FileText, X, Code2, Calculator, Microscope, FileEdit, CheckCircle2, Zap } from "lucide-react";

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

Curriculum: ${curriculumContext}

ASSIGNMENT CONTENT TO GRADE:
${extractedContent}

[Grounding (Internal Only)]
- Primary grounding: the student's uploaded assignment text above. Secondary grounding: the mapped/uploaded curriculum context in ${curriculumContext} (e.g., core_competencies, competency_weightings, question_formats, exemplar rubrics, high_yield_focal_points, common_misconceptions). Use curriculum to shape the rubric, weight emphasis, and ensure parity with in-class grading norms.
- Determine assignment type from the submission and/or metadata: Essay/Analysis; Short Answers; Problem Set (math/econ/accounting/finance/stats); Lab/Report (science); Case/Policy (business/econ/law); Code/Algorithmic (CS/engineering); Presentation/Slides; Mixed/Portfolio.
- If ${curriculumContext} includes a **rubric** or **criteria**, use it as the first choice. If not, build a rubric with 3–6 criteria appropriate to the type and **map each criterion** to relevant curriculum core_competencies; reflect **competency_weightings** by adjusting criterion weights.
- For quantitative/technical work: check method, stepwise reasoning, correctness, units, assumptions, edge cases, interpretation of results, and clarity of layout.
- For essays/humanities/social sciences: evaluate prompt adherence, thesis/claim, textual/primary-source use, depth of analysis and counter-argument, structure/organization, clarity/style, and citation integrity.
- For CS/engineering: problem understanding, algorithm/approach, correctness/complexity, code clarity and structure, testing/edge cases, documentation.
- For social sciences/policy/case: theoretical framework fit, evidence/reasoning quality, comparative or counterfactual analysis, policy/implications, clarity and citations.
- For languages: comprehension, vocabulary/grammar/syntax, task fulfillment, organization/coherence, register/style.
- Academic integrity: neutrally flag citation gaps or dubious references with specific evidence to review; do not accuse—just note concerns.
- Grade bands: if explicit in ${curriculumContext}, follow them; else A ≥ 90, B 80–89, C 70–79, D 60–69, F < 60.

[Curriculum/Rubric Utilization Rules (Internal Only)]
- **Competency alignment:** For each rubric criterion, list the most relevant curriculum core_competencies (from ${curriculumContext}) that the student's work demonstrates or lacks.
- **Weighting parity:** If competency_weightings exist, proportionally reflect them in rubric **weight_percentage** so the total rubric weight sums to 100%. If a high-weight competency is not evidenced in the work, evaluate the closest aligned criterion and explain the gap in comments.
- **Question format parity:** When relevant (e.g., short answers, document analysis), mirror ${curriculumContext}.question_formats in expectations for depth and style.
- **High-yield focal points:** Prefer assessing high_yield_focal_points when the submission touches them; give extra commentary there for authenticity with how the course is graded IRL.
- **Common misconceptions:** If the submission exhibits any listed misconceptions, reference them explicitly in comments and in "areas_for_improvement".

[Scoring Algorithm (Internal Only)]
- Build 3–6 rubric items with clear **weight_percentage** that total exactly **100%**.
- For each criterion, assign **score_percentage** (0–100%) with justification anchored to the student's actual content (quote/line/step/section).
- Compute **total_score** as the sum over all criteria: (score_percentage × weight_percentage/100). Round to nearest whole number.
- Map **total_score** to **predicted_grade** using the active grade bands.
- Keep numeric consistency: criterion **max_score** may be expressed as 100 for clarity, with **score** as the criterion's score_percentage; the detail in "rubric_breakdown" must match the weights/percentages used to compute **total_score**.

[Evidence Anchoring (Internal Only)]
- Always point comments to concrete evidence: paragraph/line/section, a quoted phrase, a step number, a figure/table, or a code block. If OCR is messy, approximate anchors (e.g., "para ~3, second stanza", "Step ~4").

[Type-Specific Nuances (Internal Only)]
- Problem sets: partial credit for correct setup with minor arithmetic slips; deduct more for conceptual errors. Require final units and sanity checks.
- Labs/reports: methods fidelity, data integrity, error analysis/limitations, linkage of results to theory.
- Essays: claim specificity, source integration and analysis (not just summary), counter-argument handling, paragraph cohesion, MLA/APA/Chicago consistency if required.
- Code: correctness and complexity, edge cases, readability (naming/modularity), test evidence.
- Policy/case: framework fidelity, empirical grounding, trade-off analysis, feasibility/implications.

[Style & Parity (Internal Only)]
- Tone: professional and constructive, like an experienced teacher marking real work.
- Avoid generic feedback; prefer precise, teachable corrections tied to the student's text.
- Never return null; if a list is thin, include at least the minimum items based on actual content; only use [] if the assignment is literally blank.

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
        {/* Hero Header */}
        <div className="mb-8">
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => navigate(createPageUrl("AssignmentHistory"))}
              variant="outline"
              className="gap-2"
            >
              <History className="w-4 h-4" />
              History
            </Button>
          </div>
          
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 md:p-8 shadow-xl">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-700/20 rounded-full blur-xl -ml-16 -mb-16" />
            
            <div className="relative text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Smart Grader</h1>
              </div>
              <p className="text-white/95 text-sm md:text-base mb-4">
                Get instant AI-powered feedback on any assignment
              </p>

              {/* What Can Be Graded */}
              <div className="flex items-center justify-center gap-3 md:gap-4 flex-wrap">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-full">
                  <FileEdit className="w-4 h-4 text-white" />
                  <span className="text-sm text-white font-medium">Essays</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-full">
                  <Calculator className="w-4 h-4 text-white" />
                  <span className="text-sm text-white font-medium">Math</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-full">
                  <Code2 className="w-4 h-4 text-white" />
                  <span className="text-sm text-white font-medium">Code</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-full">
                  <Microscope className="w-4 h-4 text-white" />
                  <span className="text-sm text-white font-medium">Labs</span>
                </div>
              </div>
            </div>
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
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {processingStep || "Processing..."}
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
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