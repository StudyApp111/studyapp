import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, FileCheck, AlertCircle, History, FileText, X, CheckCircle2, Code2, Calculator, Microscope, FileEdit } from "lucide-react";

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
      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_url,
        json_schema: {
          type: "object",
          properties: {
            full_text_content: {
              type: "string",
              description: "Complete extracted text from the document"
            }
          },
          required: ["full_text_content"]
        }
      });

      if (extractResult.status === "error") {
        throw new Error(extractResult.details || "Failed to extract content from document");
      }

      const extractedContent = extractResult.output?.full_text_content || "";

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

      let rubric;

      // Handle custom rubric file if provided
      if (curriculumFile) {

        setProcessingStep("Processing your rubric file...");
        
        const { file_url: curriculumUrl } = await base44.integrations.Core.UploadFile({ file: curriculumFile });
        
        const curriculumExtractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: curriculumUrl,
          json_schema: {
            type: "object",
            properties: {
              full_text_content: {
                type: "string",
                description: "Complete extracted text from the document"
              }
            },
            required: ["full_text_content"]
          }
        });

        if (curriculumExtractResult.status === "error") {
          throw new Error("Failed to extract curriculum file: " + (curriculumExtractResult.details || "Unknown error"));
        }

        const customRubricText = curriculumExtractResult.output?.full_text_content || "";
        
        rubric = {
          custom_rubric: customRubricText,
          is_custom: true
        };
      } else {
        setProcessingStep("Generating assignment rubric...");
        const existingCurriculumMaps = await base44.entities.CurriculumMap.filter({
          course_name: courseName.trim(),
          school: learningProfile.school || "",
          grade: learningProfile.grade || "",
          source: "smart_grader"
        });

        if (existingCurriculumMaps.length > 0) {
          rubric = existingCurriculumMaps[0].curriculum_data;
        } else {
          const rubricPrompt = `Objective:
You are an expert curriculum designer and academic assessor. Generate an accurate, assignment-specific grading rubric aligned to real teacher evaluation practices for ${courseName} at the ${learningProfile.grade || "N/A"} level.

Input Context:
Student Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${courseName}
School Context: ${learningProfile.school || "N/A"}
Assignment Title/Type: ${assignmentTitle}
Assignment Content (first 3000 chars): ${extractedContent.substring(0, 3000)}

Task:
Analyze the input to infer:
- The type of assignment (essay, response, lab, coding project, report, etc.).
- The core skills and competencies the assignment is intended to assess.
- The criteria that a qualified teacher at ${learningProfile.school || 'the school'} would realistically use to grade it.

Information Sourcing & Grounding Strategy (Internal – Do Not Output):
- Begin with the provided assignment content to infer intent, structure, and domain.
- Search and reference official or public curriculum guides, marking rubrics, and assignment exemplars related to ${courseName} for the given grade level.
- If unavailable, use regionally relevant standards (for K–12, consult the school board or provincial/state education standards in ${learningProfile.city || 'the region'}; 
  for university-level, use published course outlines or faculty rubrics for similar subjects).
- Synthesize this information to create a rubric that mirrors how real instructors would assess this task.
- Do not fabricate new grading criteria—ground them in verified or commonly used frameworks for this course type and level.

Output Requirements:
- Generate 3–6 grading criteria covering distinct, meaningful skill domains 
  (e.g., Thesis/Argumentation, Evidence/Reasoning, Technical Accuracy, Clarity/Structure, Creativity/Originality).
- For each criterion, include:
  • criterion: concise title of the skill or domain being assessed.
  • description: 1–2 sentences explaining what is evaluated.
  • weight_percentage: relative importance, summing to 100%.
  • performance_levels: four tiers labeled 'Excellent,' 'Good,' 'Developing,' and 'Needs Improvement,' 
    each with 1–2 sentences describing performance at that level.
- Ensure the rubric reflects grade-appropriate expectations and the authentic evaluation style of 
  ${learningProfile.school || 'the school'} or its regional equivalent.
- Use precise, readable, teacher-facing language.
- The rubric must be realistic, balanced, and clearly tied to the input content and course context.

Requirements:
- Base analysis on the assignment content to detect the nature and objectives of the task.
- Align all criteria with regional or institutional standards found online.
- Prioritize pedagogical accuracy and curriculum alignment over verbosity.
- Avoid filler criteria like 'effort' or 'participation.'
- The weights must total 100%.
- Produce a fully grounded, ready-to-use rubric.`;

          const { data: generatedRubric } = await base44.functions.invoke('curriculumMapping', {
            prompt: rubricPrompt,
            response_json_schema: {
              type: "object",
              properties: {
                rubric_criteria: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      criterion: { type: "string" },
                      description: { type: "string" },
                      weight_percentage: { type: "number" },
                      performance_levels: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            level: { 
                              type: "string",
                              enum: ["Excellent", "Good", "Developing", "Needs Improvement"]
                            },
                            description: { type: "string" }
                          },
                          required: ["level", "description"]
                        },
                        minItems: 4,
                        maxItems: 4
                      }
                    },
                    required: ["criterion", "description", "weight_percentage", "performance_levels"]
                  },
                  minItems: 3,
                  maxItems: 6
                }
              },
              required: ["rubric_criteria"]
            }
          });

          rubric = generatedRubric;

          await base44.entities.CurriculumMap.create({
            course_name: courseName.trim(),
            school: learningProfile.school || "",
            grade: learningProfile.grade || "",
            city: learningProfile.city || "",
            source: "smart_grader",
            curriculum_data: rubric
          });
        }
      }

      setProcessingStep("Grading your assignment (this takes 30-60 seconds)...");

      const rubricContext = rubric.is_custom 
        ? `Custom Rubric Provided by Instructor:\n${rubric.custom_rubric}`
        : `Assignment-Specific Rubric:\n${JSON.stringify(rubric, null, 2)}`;

      const gradingPrompt = `Grade this ${courseName} assignment for a ${learningProfile.grade || "N/A"} student as if you were a veteran teacher for ${courseName} at ${learningProfile.school || "the school"} (grade level: ${learningProfile.grade || "N/A"}. Read the ENTIRE assignment content below carefully and produce a COMPLETE grading report. Do NOT skip any fields. Do NOT return null or empty arrays.

Grading Rubric: ${rubricContext}

ASSIGNMENT CONTENT TO GRADE:
${extractedContent}

[Grounding (Internal Only)]
- Primary grounding: the student's uploaded assignment text above. Co-primary grounding: the assignment-specific rubric provided above in the "Grading Rubric" section. You MUST evaluate exclusively against the rubric criteria and their defined performance standards.
- Determine assignment type from the submission and/or metadata only to interpret rubric expectations (do NOT alter criteria).
- For quantitative/technical work: check method, stepwise reasoning, correctness, units, assumptions, edge cases, interpretation, and clarity of layout.
- For essays/humanities/social sciences: evaluate prompt adherence, thesis/claim, textual/primary-source use, depth of analysis and counter-argument, structure/organization, clarity/style, and citation integrity—strictly through the rubric’s criteria.
- Academic integrity: neutrally flag citation gaps or dubious references with specific evidence to review; do not accuse—just note concerns.
- Grade bands: if grade bands are specified in the rubric, follow them; else A ≥ 90, B 80–89, C 70–79, D 60–69, F < 60.

[Rubric Application Rules (Internal Only)]
- Iterate over all criteria in the rubric exactly as provided. Do NOT add, remove, rename, or reweight criteria.
- For each criterion, match the student’s work to one performance level ("Excellent", "Good", "Developing", "Needs Improvement") using explicit evidence from the assignment.
- Assign a criterion score_percentage (0–100%) consistent with the chosen level’s description.
- Apply the exact weight_percentage from the rubric. If weight_percentage is a string with "%", strip the symbol and use its numeric value; if it is numeric, use as-is. The total must sum to 100%.
- If a criterion is insufficiently evidenced, score accordingly (typically low) and explain precisely why.

[Scoring Algorithm (Internal Only)]
- total_score = Σ_over_all_rubric_criteria( criterion_score_percentage × (weight_percentage / 100) ). Round to nearest whole number.
- Map total_score to predicted_grade using the active grade bands (rubric-defined if available; otherwise default bands above).
- Numeric consistency: in rubric_breakdown, use max_score = 100 and score = criterion_score_percentage for each criterion; ensure the weighted sum equals total_score.

[Evidence Anchoring (Internal Only)]
- Justify every score with concrete anchors: paragraph/line/section, quoted phrase, step number, figure/table, or code block. If OCR is messy, use approximate anchors (e.g., "para ~3, second stanza", "Step ~4").

[Style & Parity (Internal Only)]
- Tone: professional and constructive, like an experienced teacher marking real work.
- Avoid generic feedback; give precise, teachable corrections tied to the student’s text.
- Never return null; if content is thin, still complete all fields based on available evidence. Only use [] if the assignment is literally blank.

REQUIRED OUTPUT - Fill EVERY field with actual analysis based on the content above:

1. predicted_grade: A letter grade (A+, A, A-, B+, B, B-, C+, C, C-, D, F)
2. total_score: A number from 0-100 representing percentage
3. overall_performance_summary: Write at least 3 sentences analyzing what the student submitted
4. identified_strengths: List 3-5 specific things done well (must reference actual content)
5. areas_for_improvement: List 4-6 specific weaknesses (must reference actual content)
6. detailed_feedback_by_section: Create 3-6 sections analyzing different parts. Each needs section_name, points_earned (number), points_possible (number), feedback (text), competencies_assessed (array)
7. rubric_breakdown: Create exactly one item per rubric criterion. Each needs criterion (name), score (number earned), max_score (number possible, use 100), comments (text explaining the score)

You MUST fill all 7 fields. Do not return null. Do not return empty arrays unless the assignment is literally blank.

Output valid JSON matching the expected schema.`;

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
        curriculum_map: rubric,
        grading_result: gradingResult,
        completed: true
      });

      navigate(createPageUrl("GradeResults") + `?assignmentId=${gradedAssignment.id}`);
    } catch (err) {
      setError(err.message || "Failed to grade assignment. Please try again.");
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-4 md:p-10">
      <div className="max-w-3xl mx-auto">
        {/* Hero Header Section */}
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

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-yellow-500 p-6 md:p-8 shadow-xl mb-6">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -mr-24 -mt-24" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-400/20 rounded-full blur-xl -ml-16 -mb-16" />
            
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Smart Grader</h1>
                <p className="text-white/90 text-sm md:text-base">Get instant AI-powered feedback on your work</p>
              </div>
            </div>
          </div>

          {/* What Can Be Graded */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-purple-100">
            <p className="text-sm font-semibold text-slate-700 mb-3">AI can grade:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileEdit className="w-4 h-4 text-purple-600" />
                <span>Essays</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calculator className="w-4 h-4 text-purple-600" />
                <span>Math Work</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Code2 className="w-4 h-4 text-purple-600" />
                <span>Coding</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Microscope className="w-4 h-4 text-purple-600" />
                <span>Lab Reports</span>
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