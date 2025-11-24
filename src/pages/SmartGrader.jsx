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

      if (!curriculumFile) {
        throw new Error("Please upload your grading rubric");
      }

      // Fetch learning profile
      const profiles = await base44.entities.LearningProfile.filter({});
      const learningProfile = profiles[0] || {};

      setProcessingStep("Uploading files...");
      
      // Upload both files in parallel
      const [assignmentUpload, rubricUpload] = await Promise.all([
        base44.integrations.Core.UploadFile({ file: assignmentFile }),
        base44.integrations.Core.UploadFile({ file: curriculumFile })
      ]);

      setProcessingStep("Extracting content from both files...");
      
      // Extract content from both files in parallel
      const [assignmentExtract, rubricExtract] = await Promise.all([
        base44.functions.invoke('extractDocumentContent', { file_url: assignmentUpload.file_url }),
        base44.functions.invoke('extractDocumentContent', { file_url: rubricUpload.file_url })
      ]);

      if (!assignmentExtract?.data?.extracted_content) {
        throw new Error("Failed to extract content from assignment");
      }

      if (!rubricExtract?.data?.extracted_content) {
        throw new Error("Failed to extract content from rubric");
      }

      const extractedContent = assignmentExtract.data.extracted_content;
      const customRubricText = rubricExtract.data.extracted_content;

      if (extractedContent.length < 50) {
        throw new Error("Extracted content is too short. Please ensure your file contains readable text.");
      }
      
      const rubric = {
        custom_rubric: customRubricText,
        is_custom: true
      };

      setProcessingStep("Grading your assignment (this takes 30-60 seconds)...");

      const rubricContext = rubric.is_custom 
        ? `Custom Rubric Provided by Instructor:\n${rubric.custom_rubric}`
        : `Assignment-Specific Rubric:\n${JSON.stringify(rubric, null, 2)}`;

      const gradingPrompt = `Grade this ${courseName} assignment for a ${learningProfile.grade || "N/A"} student 
as if you were a veteran instructor for ${courseName} at ${learningProfile.school || "the school"}.

CRITICAL: You MUST read the ENTIRE assignment content below from beginning to end, 
including ALL sections, paragraphs, figures, tables, diagrams, appendices, code blocks, and especially the CONCLUSION. 
Do NOT stop reading partway through. 
The complete student work is provided below—analyze ALL of it.

Grading Rubric:
${rubricContext}

ASSIGNMENT CONTENT TO GRADE (READ COMPLETELY FROM START TO FINISH):
${extractedContent}

END OF ASSIGNMENT CONTENT — you must have read every part above including any conclusion or final sections.

[Grounding (Internal Only)]
- Primary grounding: the student's uploaded assignment text above. 
- Co-primary grounding: the assignment-specific rubric provided above in the "Grading Rubric" section. 
- You MUST evaluate exclusively against the rubric criteria and their defined performance standards.

- Determine assignment type from the submission (essay, lab report, problem set, coding assignment, etc.) 
  only to correctly interpret rubric expectations. Do NOT change or invent criteria.

- For quantitative/technical work (math, physics, chemistry, engineering):
  • Evaluate correctness of method and final answers.
  • Check stepwise reasoning, logical progression, unit consistency, symbolic manipulation accuracy.
  • Verify definitions, assumptions, diagrams, edge-case handling, and clarity of layout.
  • Give credit for correct approaches even if arithmetic errors occur (partial credit justified explicitly).

- For coding/computer science/software engineering assignments:
  • Evaluate algorithmic correctness, logical flow, efficiency (when relevant), modularity, documentation clarity.
  • Check for correct syntax, correct use of data structures, correct function behavior, edge-case handling,
    input/output correctness, clarity of pseudocode, and reasoning behind implementation choices.
  • Treat described code behavior as provisional evidence if the actual file or snippet is missing (see Missing Materials Rule).

- For essays/humanities/social sciences:
  • Evaluate prompt adherence, thesis clarity, argumentation, citation integrity, use of primary sources,
    textual engagement, structure, coherence, analytical depth, and conceptual accuracy.
  • Evidence must be tied explicitly to the assignment and rubric.

- Academic integrity: neutrally flag citation gaps or dubious references with specific evidence. 
  Do NOT accuse—simply note concerns.

- Grade bands: if specified in the rubric, follow them. Otherwise:
  A ≥ 90, B 80–89, C 70–79, D 60–69, F < 60.

[Missing Referenced Materials Handling (Internal Only)]
- If the assignment references external materials not included in the submitted text 
  (e.g., "Appendix A", datasets, diagrams, lab tables, code files, screenshots, proofs, figures), you MUST:
  • Evaluate the submission solely based on what is actually present.
  • Apply at most a minor deduction ONLY IF the missing material meaningfully limits evaluation for a criterion.
  • NEVER impose a severe penalty or collapse the score solely because referenced materials are missing.
  • Treat paraphrased descriptions of missing artifacts as provisional evidence when applicable.
  • Set "missing_references_flag" to:
      "Missing Referenced Materials – Grade May Be Less Accurate"
    Otherwise set it to "None".

[Rubric Application Rules (Internal Only)]
- Iterate over ALL rubric criteria exactly as provided. 
  Do NOT add, remove, rename, or reweight criteria.

- For each criterion:
  • Match the student’s work to a performance level ("Excellent", "Good", "Developing", "Needs Improvement").
  • Use explicit evidence from the assignment.
  • Assign a score_percentage (0–100%) consistent with the performance-level description.

- Apply weight_percentage exactly as stated. 
  If weight has a "%" symbol, strip it. 
  Ensure total weights sum to 100%.

- If a criterion is poorly evidenced, give an appropriate lower score and explain precisely why.

[Scoring Algorithm (Internal Only)]
- total_score = Σ_over_all_criteria( score_percentage × (weight / 100) ). 
  Round to nearest whole number.

- Map total_score to predicted_grade using rubric-defined bands, or default bands if none exist.

- Numeric consistency requirement:
  In "rubric_breakdown", each criterion must use:
    max_score = 100
    score = criterion_score_percentage
  Weighted calculations must match total_score exactly.

[Evidence Anchoring (Internal Only)]
- Justify every score using concrete anchors:
  paragraph reference, quoted phrase, line number, step number, equation, figure/table, code block, or approximate location.

[Style & Parity (Internal Only)]
- Tone: professional, constructive, and aligned with real academic grading.
- Avoid generic comments. Make corrections specific and teachable.
- NEVER return null values.
- Only output [] if the assignment is literally blank.

REQUIRED OUTPUT (You MUST fill ALL fields):
1. predicted_grade: A letter grade (A+, A, A-, B+, B, B-, C+, C, C-, D, F) 
2. total_score: A number from 0-100 representing percentage 
3. overall_performance_summary: Write at least 2 sentences analyzing what the student submitted 
4. identified_strengths: List 3-5 specific things done well (must reference actual content) 
5. areas_for_improvement: List 4-6 specific weaknesses (must reference actual content) 
6. detailed_feedback_by_section: Create 3-6 sections analyzing different parts. Each needs section_name, points_earned (number), points_possible (number), feedback (text), competencies_assessed (array) 
7. rubric_breakdown: Create exactly one item per rubric criterion. Each needs criterion (name), score (number earned), max_score (number possible, use 100), comments (text explaining the score)
8. missing_references_flag:
     Either "None" OR 
     "Missing Referenced Materials – Grade May Be Less Accurate"

You MUST fill all 8 fields. Do not return null. Do not return empty arrays unless the assignment is literally blank.

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
            missing_references: {
              type: "boolean",
              description: "True if the assignment references external materials (diagrams, graphs, appendices) that weren't in the uploaded file"
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
          required: ["predicted_grade", "total_score", "missing_references", "overall_performance_summary", "identified_strengths", "areas_for_improvement", "detailed_feedback_by_section", "rubric_breakdown"]
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
        file_url: assignmentUpload.file_url,
        extracted_content: extractedContent,
        assignment_rubric: rubric,
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
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-purple-100 text-center">
            <p className="text-sm font-semibold text-slate-700 mb-3">StudyApp can grade:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 justify-items-center">
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
                  Grading Rubric *
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
                  Upload the official grading rubric for this assignment
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