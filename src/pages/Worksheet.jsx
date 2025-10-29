import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import WorksheetQuestion from "../components/worksheet/WorksheetQuestion";

export default function Worksheet() {
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [worksheet, setWorksheet] = useState(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');
    
    if (!lessonId) {
      navigate(createPageUrl("Home"));
      return;
    }

    loadOrGenerateWorksheet(lessonId);
  }, [navigate]);

  const loadOrGenerateWorksheet = async (lessonId) => {
    setIsGenerating(true);
    try {
      const lessonData = await base44.entities.Lesson.filter({ id: lessonId });
      if (lessonData.length === 0) {
        navigate(createPageUrl("Home"));
        return;
      }
      setLesson(lessonData[0]);

      const quizData = await base44.entities.DiagnosticQuiz.filter({ lesson_id: lessonId });
      if (quizData.length === 0) {
        navigate(createPageUrl("DiagnosticQuiz") + `?lessonId=${lessonId}`);
        return;
      }
      setQuiz(quizData[0]);

      // Check if worksheet already exists
      const existingWorksheet = await base44.entities.Worksheet.filter({ 
        lesson_id: lessonId 
      });

      if (existingWorksheet.length > 0) {
        // Load existing worksheet
        console.log("Loading existing worksheet");
        const loadedWorksheet = existingWorksheet[0];
        setWorksheet(loadedWorksheet);
        
        if (loadedWorksheet.completed) {
          navigate(createPageUrl("Feedback") + `?lessonId=${lessonId}`);
          return;
        } else {
          setUserAnswers(loadedWorksheet.user_answers || new Array(loadedWorksheet.questions.length).fill(""));
        }
      } else {
        // Generate new worksheet
        console.log("Generating new worksheet");
        await generateWorksheet(lessonId, lessonData[0], quizData[0]);
      }
    } catch (error) {
      console.error("Error loading worksheet:", error);
    }
    setIsGenerating(false);
  };

  const generateWorksheet = async (lessonId, lessonData, quizData) => {
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });

      const learningProfile = profile[0] || {};

      // Format diagnostic quiz results for the prompt
      const diagnosticResults = quizData.questions.map((q, index) => ({
        QuestionText: q.question_text,
        QuestionType: q.question_type,
        AssignedDifficultyIndex: q.difficulty_index,
        TargetedMisconception: q.targeted_misconception || "N/A",
        StudentAnswer: quizData.user_answers?.[index] || "No answer provided",
        IsCorrect: quizData.user_answers?.[index] === q.correct_answer
      }));

      const aiPrompt = `Context
You are a master assessment designer and expert tutor (simulated 180 IQ). Your primary function is to create a 10-question worksheet that is highly predictive of a student's performance on their actual exam for the specified course. This worksheet must be meticulously crafted by leveraging:
a. The detailed curriculum map (output from Step 1).
b. The student's performance on the diagnostic quiz (output from Step 2).
Your generated questions must mirror the exact style, type, wording nuances, and difficulty levels typically encountered in the student's school for this course, as detailed in the curriculum map.

Input Educational Context
Student's Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lessonData.course_name}
School (for context): ${learningProfile.school || "N/A"}
City/Region (for context): ${learningProfile.city || "N/A"}

Detailed Curriculum Profile (JSON object - output from Step 1):
${JSON.stringify(lessonData.curriculum_map, null, 2)}

Diagnostic Quiz Results:
${JSON.stringify(diagnosticResults, null, 2)}

Task 1: Analyze Student Performance & Curriculum Profile
Based on the provided curriculum map and diagnostic quiz results, perform the following analysis to strategically inform worksheet design:

Identify Weak Competencies:
- Pinpoint core competencies where the student answered diagnostic questions incorrectly.
- Pay special attention to errors on diagnostic questions that had an AssignedDifficultyIndex of "Conceptual" or "Applied/Multi-step," as these indicate deeper misunderstandings.

Note Gaps & Misconceptions:
- Identify if the student struggled with diagnostic questions specifically designed to test TargetedMisconception, especially where answers were incorrect.
- Correlate errors with common misconceptions from the curriculum map.

Prioritize Key & Differentiating Competencies for Assessment:
- From core competencies, select those that are heavily weighted AND/OR where the diagnostic results indicate weakness or uncertainty. These are critical for predicting overall exam success.

Task 2: Generate the 10-Question Predictive Worksheet
Create 10 unique questions. Adhere strictly to the following criteria:

Targeted Question Distribution:
- Focus the majority of questions (approx. 6-7) on the identified Weak Competencies and confirmed Gaps/Misconceptions.
- Include questions (approx. 2-3) on Key & Differentiating Competencies to gauge mastery of high-stakes material.
- Ensure comprehensive coverage of the facets of the curriculum most critical for exam prediction.

Exact Alignment with Exam Style, Wording, Type & Difficulty (Crucial):
- The distribution of question types (e.g., % MCQs, % Short Answer) in this 10-question worksheet must proportionally mirror the frequency specified for each format in the curriculum map's question formats.
- For each question generated, its specific question type, exact wording, overall style, and intrinsic difficulty must closely emulate the provided examples and descriptions within the curriculum map. This mimicry is paramount for the worksheet's predictive accuracy.
- For MCQs, provide at least 4 distinct and plausible options (A, B, C, D).

Subject-Specific Question Design & Content:
- The task required by each question must be appropriate for the subject matter implied by the course name.
- For humanities/social sciences subjects: Questions may require analysis of short provided texts/excerpts, construction of arguments, interpretation of sources/data, or concise written explanations.
- For STEM subjects: Questions will likely involve problem-solving, application of formulas/theories, data interpretation, calculations, or conceptual explanations of models.
- Always refer to the curriculum map's question format examples for definitive guidance on authentic tasks and styles.

Scaffolding & Assigned Worksheet Difficulty:
- While emulating overall exam difficulty as per the curriculum map, aim for a slight progression in cognitive demand or complexity across the worksheet.
- For each question you generate, assign it a Worksheet Difficulty Index from these categories: "Moderate Exam-Level," "Challenging Exam-Level," or "High Challenge Exam-Level."

Grade-Appropriate Language:
- Use clear, precise, and unambiguous language suitable for the student's grade level.

Task 3: Generate a Detailed Answer Key
For each of the 10 worksheet questions, provide the following:
- Correct Answer(s): The definitive, accurate solution. For MCQs, state the correct option letter (e.g., "C"). For open-ended or problem-solving questions, provide a model/ideal answer or the final numerical result with units.
- Detailed Explanation: A clear, step-by-step explanation of how to arrive at the correct answer. Emphasize the underlying concepts from the core competencies.
- Linked Competency Name(s): Explicitly list the name(s) of the primary core competencies that this question assesses.
- Targeted Misconception / Predicted Common Errors: If the question was specifically designed to address a common misconception, state it. Otherwise, briefly note potential common errors students might make on this specific question.

Output Format:
Provide your response as a single, valid JSON object with the structure specified.`;

      const { data: worksheetData } = await base44.functions.invoke('generateWorksheet', {
        prompt: aiPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            worksheet_title: { type: "string" },
            analysis_summary_for_worksheet_design: {
              type: "object",
              properties: {
                targeted_weak_competencies: {
                  type: "array",
                  items: { type: "string" }
                },
                key_gaps_or_misconceptions_addressed: {
                  type: "array",
                  items: { type: "string" }
                },
                focused_differentiating_competencies: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["targeted_weak_competencies", "key_gaps_or_misconceptions_addressed", "focused_differentiating_competencies"]
            },
            worksheet_questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question_number: { type: "integer" },
                  question_type: { type: "string" },
                  worksheet_difficulty_index: { type: "string" },
                  question_text: { type: "string" },
                  options: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: { type: "string" }
                    }
                  },
                  answer_key_details: {
                    type: "object",
                    properties: {
                      correct_answer: { type: "string" },
                      detailed_explanation: { type: "string" },
                      linked_competency_names: {
                        type: "array",
                        items: { type: "string" }
                      },
                      targeted_misconception_or_predicted_errors: { type: "string" }
                    },
                    required: ["correct_answer", "detailed_explanation", "linked_competency_names", "targeted_misconception_or_predicted_errors"]
                  }
                },
                required: ["question_number", "question_type", "worksheet_difficulty_index", "question_text", "answer_key_details"]
              }
            }
          },
          required: ["worksheet_title", "analysis_summary_for_worksheet_design", "worksheet_questions"]
        }
      });

      // Convert the AI-generated format to match our Worksheet entity schema
      const formattedQuestions = worksheetData.worksheet_questions.map(q => {
        // Determine question type based on the worksheet question type
        let questionType = "long_answer";
        if (q.question_type.toLowerCase().includes("multiple choice") || q.question_type.toLowerCase().includes("mcq")) {
          questionType = "multiple_choice";
        } else if (q.question_type.toLowerCase().includes("true") && q.question_type.toLowerCase().includes("false")) {
          questionType = "true_false";
        } else if (q.question_type.toLowerCase().includes("short")) {
          questionType = "short_answer";
        }

        // Extract options if it's MCQ
        let options = [];
        if (questionType === "multiple_choice" && q.options && q.options.length > 0) {
          options = q.options.map(opt => {
            // Handle both {"A": "text"} and direct string formats
            if (typeof opt === 'object') {
              return Object.values(opt)[0];
            }
            return opt;
          });
        }

        return {
          question: q.question_text,
          type: questionType,
          options: options,
          correct_answer: q.answer_key_details.correct_answer,
          points: questionType === "multiple_choice" ? 5 : questionType === "true_false" ? 3 : questionType === "short_answer" ? 8 : 15
        };
      });

      const createdWorksheet = await base44.entities.Worksheet.create({
        lesson_id: lessonId,
        diagnostic_quiz_id: quizData.id,
        questions: formattedQuestions,
        completed: false,
        analysis_summary: worksheetData.analysis_summary_for_worksheet_design,
        answer_key: worksheetData.worksheet_questions.map(q => q.answer_key_details)
      });

      setWorksheet(createdWorksheet);
      setUserAnswers(new Array(formattedQuestions.length).fill(""));
    } catch (error) {
      console.error("Error generating worksheet:", error);
    }
  };

  const handleAnswer = (answer) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestion] = answer;
    setUserAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < worksheet.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const submitWorksheet = async () => {
    setIsSubmitting(true);
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });

      const gradingPrompt = `
You are an expert educator. Grade this worksheet and provide detailed feedback.

Questions and Answers:
${worksheet.questions.map((q, idx) => `
Question ${idx + 1} (${q.type}, ${q.points} points):
${q.question}
Correct Answer: ${q.correct_answer}
Student Answer: ${userAnswers[idx] || "No answer"}
`).join('\n')}

For each question, provide:
1. Whether it's correct (for objective questions) or a partial score
2. Detailed, constructive feedback
3. Points earned

Also provide:
- Total score as a percentage
- Predicted grade (A+, A, B+, B, C+, C, D, F)
- Overall performance summary
`;

      const grading = await base44.integrations.Core.InvokeLLM({
        prompt: gradingPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            feedback: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question_index: { type: "integer" },
                  is_correct: { type: "boolean" },
                  feedback: { type: "string" },
                  points_earned: { type: "number" }
                }
              }
            },
            total_score: { type: "number" },
            predicted_grade: { type: "string" }
          }
        }
      });

      await base44.entities.Worksheet.update(worksheet.id, {
        user_answers: userAnswers,
        feedback: grading.feedback,
        total_score: grading.total_score,
        predicted_grade: grading.predicted_grade,
        completed: true
      });

      await base44.entities.Lesson.update(lesson.id, {
        status: "worksheet_completed"
      });

      const totalLessons = (user.total_lessons_completed || 0);
      const totalQuizzes = (user.total_quizzes_taken || 0) + 1;
      const currentAvg = user.average_score || 0;
      const newAvg = ((currentAvg * (totalQuizzes - 1)) + grading.total_score) / totalQuizzes;

      await base44.auth.updateMe({
        total_quizzes_taken: totalQuizzes,
        average_score: Math.round(newAvg)
      });

      navigate(createPageUrl("Feedback") + `?lessonId=${lesson.id}`);
    } catch (error) {
      console.error("Error submitting worksheet:", error);
    }
    setIsSubmitting(false);
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center p-8 shadow-2xl">
          <FileText className="w-16 h-16 mx-auto text-purple-600 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {worksheet ? "Loading Your Worksheet" : "Generating Your Worksheet"}
          </h2>
          <p className="text-slate-600 mb-6">
            {worksheet 
              ? "Retrieving your saved worksheet..."
              : "Creating a personalized exam based on your diagnostic results..."}
          </p>
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-600" />
        </Card>
      </div>
    );
  }

  if (!worksheet) return null;

  const progress = ((currentQuestion + 1) / worksheet.questions.length) * 100;
  const isLastQuestion = currentQuestion === worksheet.questions.length - 1;
  const canProceed = userAnswers[currentQuestion]?.trim() !== "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6 shadow-xl">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Mock Exam: {lesson.course_name}</h2>
            <p className="text-slate-600 mb-4">Answer all questions to the best of your ability</p>
            <div className="flex items-center gap-3">
              <Progress value={progress} className="flex-1 h-3" />
              <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                {currentQuestion + 1} / {worksheet.questions.length}
              </span>
            </div>
          </CardContent>
        </Card>

        <AnimatePresence mode="wait">
          <WorksheetQuestion
            key={currentQuestion}
            question={worksheet.questions[currentQuestion]}
            questionNumber={currentQuestion + 1}
            answer={userAnswers[currentQuestion]}
            onAnswer={handleAnswer}
          />
        </AnimatePresence>

        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
          >
            Previous
          </Button>
          {isLastQuestion ? (
            <Button
              onClick={submitWorksheet}
              disabled={!canProceed || isSubmitting}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting & Grading...
                </>
              ) : (
                "Submit Worksheet"
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
            >
              Next Question
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}