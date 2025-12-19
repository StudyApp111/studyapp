import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lock, Loader2, Clock, Sparkles, Play, Pause } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import WorksheetQuestion from "@/components/worksheet/WorksheetQuestion";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";
import EducationalLoader from "@/components/ui/EducationalLoader";
import { logError } from "@/components/utils/errorLogger";

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

export default function ExamTab({ lesson, quiz }) {
  const [exam, setExam] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [newBadges, setNewBadges] = useState([]);
  const gradingTimeoutRef = useRef(null);
  const [gradingInProgress, setGradingInProgress] = useState({});
  
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const questionTimesRef = useRef({});
  const currentQuestionStartTimeRef = useRef(null);
  const examIdRef = useRef(null);

  useEffect(() => {
    if (quiz && quiz.completed && lesson) {
      loadOrGenerateExam();
    }
  }, [quiz?.completed, lesson?.id]);

  useEffect(() => {
    if (exam && !exam.completed && exam.id !== examIdRef.current) {
      examIdRef.current = exam.id;
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      startTimeRef.current = Date.now();
      currentQuestionStartTimeRef.current = Date.now();
      
      if (exam.question_time_laps && exam.question_time_laps.length > 0) {
        const timesObj = {};
        exam.question_time_laps.forEach(lap => {
          timesObj[lap.question_index] = lap.total_seconds;
        });
        questionTimesRef.current = timesObj;
      } else {
        questionTimesRef.current = {};
        for (let i = 0; i < (exam.questions?.length || 10); i++) {
          questionTimesRef.current[i] = 0;
        }
      }
      
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const now = Date.now();
          const totalElapsed = Math.floor((now - startTimeRef.current) / 1000);
          setElapsedSeconds(totalElapsed);
        }
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [exam?.id, exam?.completed]);

  const recordQuestionTime = (questionIndex) => {
    if (currentQuestionStartTimeRef.current) {
      const now = Date.now();
      const timeSpentOnQuestion = Math.floor((now - currentQuestionStartTimeRef.current) / 1000);
      questionTimesRef.current[questionIndex] = (questionTimesRef.current[questionIndex] || 0) + timeSpentOnQuestion;
    }
  };

  const loadOrGenerateExam = async () => {
    setIsGenerating(true);
    try {
      const existingExams = await base44.entities.Exam.filter({ 
        lesson_id: lesson.id,
        exam_number: 1
      });

      if (existingExams.length > 0) {
        const loadedExam = existingExams[0];
        
        if (loadedExam.completed) {
          // Show completed state
          setExam(loadedExam);
          setIsGenerating(false);
          return;
        }
        
        if (!loadedExam.questions || loadedExam.questions.length === 0) {
          await generateExam(loadedExam.id);
        } else {
          setExam(loadedExam);
        }
      } else {
        await generateExam();
      }
    } catch (error) {
      console.error("Error loading exam:", error);
    }
    setIsGenerating(false);
  };

  const generateExam = async (existingExamId = null) => {
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });
      const learningProfile = profile[0] || {};

      let contentDescription = "";
      if (lesson.input_type === "description" && lesson.description) {
        contentDescription = lesson.description;
      } else if (lesson.extracted_content) {
        contentDescription = lesson.extracted_content;
      } else {
        contentDescription = lesson.description || "N/A";
      }

      const diagnosticResults = quiz.questions.map((q, index) => ({
        QuestionText: q.question_text,
        QuestionType: q.question_type,
        AssignedDifficultyIndex: q.difficulty_index,
        TargetedMisconception: q.targeted_misconception || "N/A",
        StudentAnswer: quiz.user_answers?.[index] || "No answer provided",
        IsCorrect: quiz.user_answers?.[index] === q.correct_answer
      }));

      const aiPrompt = `Context
You are an expert assessment designer. Generate a 10-question predictive exam for ${lesson.course_name}, optimized to forecast exam performance and target the student's weaknesses.

Input Context
Student Grade Level: ${learningProfile.grade || "N/A"}
Course/Unit Name: ${lesson.course_name}
School: ${learningProfile.school || "N/A"}

Curriculum Map:
${JSON.stringify(lesson.curriculum_map, null, 2)}

Lesson Content:
${contentDescription}

Diagnostic Quiz Results:
${JSON.stringify(diagnosticResults, null, 2)}

Generate exactly 10 adaptive, exam-authentic questions following the same format as worksheets.`;

      const { data: examData } = await retryOperation(
        () => base44.functions.invoke('generateWorksheet', {
          prompt: aiPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              worksheet_title: { type: "string" },
              analysis_summary_for_worksheet_design: {
                type: "object",
                properties: {
                  targeted_weak_competencies: { type: "array", items: { type: "string" } },
                  key_gaps_or_misconceptions_addressed: { type: "array", items: { type: "string" } },
                  focused_differentiating_competencies: { type: "array", items: { type: "string" } }
                }
              },
              worksheet_questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question_number: { type: "integer" },
                    question_type: { type: "string" },
                    difficulty_index: { type: "string" },
                    question_text: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                    correct_answer: { type: "string" },
                    explanation: { type: "string" },
                    assessed_competencies: { type: "array", items: { type: "string" } },
                    targeted_misconception: { type: "string" }
                  }
                }
              }
            }
          }
        }),
        3,
        2000
      );

      const questionsWithPlaceholder = examData.worksheet_questions.map(q => ({
        ...q,
        user_answer: ""
      }));

      let createdExam;
      
      if (existingExamId) {
        createdExam = await base44.entities.Exam.update(existingExamId, {
          questions: questionsWithPlaceholder,
          analysis_summary: examData.analysis_summary_for_worksheet_design,
          status: "in_progress"
        });
      } else {
        createdExam = await base44.entities.Exam.create({
          lesson_id: lesson.id,
          exam_number: 1,
          diagnostic_quiz_id: quiz.id,
          questions: questionsWithPlaceholder,
          analysis_summary: examData.analysis_summary_for_worksheet_design,
          status: "in_progress",
          completed: false,
          time_taken_seconds: 0,
          question_time_laps: []
        });
      }

      setExam(createdExam);
    } catch (error) {
      console.error("Error generating exam:", error);
      await logError('exam_generation', error, { lesson_id: lesson?.id });
    }
  };

  const isSubjectiveQuestion = (questionType) => {
    const type = questionType.toLowerCase();
    return type.includes("short answer") || 
           type.includes("long answer") || 
           type.includes("fill-in-the-blank") ||
           type.includes("structured response");
  };

  const gradeSubjectiveQuestion = async (question, questionIndex) => {
    if (!question.user_answer || question.user_answer.trim() === "") return;

    try {
      setGradingInProgress(prev => ({ ...prev, [questionIndex]: true }));

      const profile = await base44.entities.LearningProfile.filter({ 
        id: (await base44.auth.me()).learning_profile_id 
      });
      const learningProfile = profile[0] || {};

      const { data: gradingResult } = await base44.functions.invoke('gradeShortAnswer', {
        question_text: question.question_text,
        question_type: question.question_type,
        difficulty_index: question.difficulty_index,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
        assessed_competencies: question.assessed_competencies,
        targeted_misconception: question.targeted_misconception,
        student_answer: question.user_answer,
        student_grade_level: learningProfile.grade || "N/A",
        course_name: lesson.course_name
      });

      const updatedQuestions = [...exam.questions];
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        ai_score_out_of_10: gradingResult.score_out_of_10,
        ai_verdict: gradingResult.verdict,
        ai_rationale_short: gradingResult.rationale_short,
        ai_keypoints_hit: gradingResult.keypoints_hit,
        ai_keypoints_missed: gradingResult.keypoints_missed,
        ai_misconception_detected: gradingResult.misconception_detected,
        ai_grading_pending: false
      };
      
      await base44.entities.Exam.update(exam.id, {
        questions: updatedQuestions
      });

      setExam(prev => ({
        ...prev,
        questions: updatedQuestions
      }));

      setGradingInProgress(prev => ({ ...prev, [questionIndex]: false }));
    } catch (error) {
      console.error("Error grading question:", error);
      setGradingInProgress(prev => ({ ...prev, [questionIndex]: false }));
    }
  };

  const handleAnswer = (answer) => {
    const updatedQuestions = [...exam.questions];
    updatedQuestions[currentQuestion].user_answer = answer;
    
    setExam(prev => ({
      ...prev,
      questions: updatedQuestions
    }));

    if (gradingTimeoutRef.current) {
      clearTimeout(gradingTimeoutRef.current);
    }

    if (isSubjectiveQuestion(updatedQuestions[currentQuestion].question_type)) {
      updatedQuestions[currentQuestion].ai_grading_pending = true;
      setExam(prev => ({
        ...prev,
        questions: updatedQuestions
      }));
      
      gradingTimeoutRef.current = setTimeout(() => {
        gradeSubjectiveQuestion(updatedQuestions[currentQuestion], currentQuestion);
      }, 2000);
    }
  };

  const handleNext = () => {
    setShowConfetti(true);
    recordQuestionTime(currentQuestion);
    
    if (currentQuestion < exam.questions.length - 1) {
      if (gradingTimeoutRef.current) {
        clearTimeout(gradingTimeoutRef.current);
        const currentQ = exam.questions[currentQuestion];
        if (isSubjectiveQuestion(currentQ.question_type) && currentQ.user_answer) {
          gradeSubjectiveQuestion(currentQ, currentQuestion);
        }
      }
      
      currentQuestionStartTimeRef.current = Date.now();
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      recordQuestionTime(currentQuestion);
      currentQuestionStartTimeRef.current = Date.now();
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const submitExam = async () => {
    setIsSubmitting(true);
    recordQuestionTime(currentQuestion);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const questionTimeLaps = Object.keys(questionTimesRef.current).map(key => ({
      question_index: parseInt(key),
      total_seconds: questionTimesRef.current[key]
    }));

    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });
      const learningProfile = profile[0] || {};

      const questionsWithGrading = exam.questions.map((q) => {
        const questionType = q.question_type.toLowerCase();

        if (questionType.includes("multiple choice") || 
            questionType.includes("mcq") ||
            (questionType.includes("true") && questionType.includes("false"))) {
          return {
            ...q,
            is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
          };
        }

        if (isSubjectiveQuestion(q.question_type)) {
          if (q.ai_score_out_of_10 !== undefined) {
            return {
              ...q,
              is_correct: q.ai_score_out_of_10 >= 7.5 
            };
          }
        }

        return {
          ...q,
          is_correct: q.user_answer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()
        };
      });

      let contentDescription = lesson.extracted_content || lesson.description || "N/A";

      const examPerformanceData = questionsWithGrading.map((q) => ({
        question_number: q.question_number,
        question_type: q.question_type,
        difficulty_index: q.difficulty_index,
        question_text: q.question_text,
        options: q.options || [],
        student_answer: q.user_answer || "No answer provided",
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        assessed_competencies: q.assessed_competencies,
        targeted_misconception: q.targeted_misconception,
        is_correct: q.is_correct,
        ai_grading: q.ai_score_out_of_10 !== undefined ? {
          score_out_of_10: q.ai_score_out_of_10,
          verdict: q.ai_verdict,
          rationale: q.ai_rationale_short,
          keypoints_hit: q.ai_keypoints_hit,
          keypoints_missed: q.ai_keypoints_missed
        } : null
      }));

      const feedbackPrompt = `You are an expert educator for ${lesson.course_name}. Analyze the exam performance and provide predictions.

Student's Grade Level: ${learningProfile.grade || "N/A"}
Course: ${lesson.course_name}
Exam Number: 1 of 6

Curriculum Profile:
${JSON.stringify(lesson.curriculum_map, null, 2)}

Exam Performance:
${JSON.stringify(examPerformanceData, null, 2)}

Diagnostic Quiz:
${JSON.stringify({
  questions: quiz.questions,
  user_answers: quiz.user_answers,
  question_metadata: quiz.question_metadata || []
}, null, 2)}

Provide predicted grade, analysis, strengths, improvements, and learning patterns.`;

      const { data: feedbackData } = await retryOperation(() => 
        base44.functions.invoke('feedbackGrade', {
          prompt: feedbackPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              feedback_session_title: { type: "string" },
              predicted_exam_score_percentage: { type: "string" },
              prediction_calculation_rationale: { type: "string" },
              overall_performance_summary_text: { type: "string" },
              identified_strengths_list: { type: "array", items: { type: "string" } },
              key_areas_for_improvement_list: { type: "array", items: { type: "string" } },
              suggested_future_sessions_plan: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    session_number: { type: "integer" },
                    session_name: { type: "string" },
                    session_focus_description: { type: "string" }
                  }
                }
              },
              learning_patterns: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    pattern_type: { type: "string" },
                    what_it_means: { type: "string" },
                    how_to_improve: { type: "string" }
                  }
                },
                minItems: 3,
                maxItems: 5
              }
            }
          }
        })
      );

      const questionFeedback = questionsWithGrading.map((q, idx) => {
        let feedback = "";
        let pointsEarned = 0;
        
        if (isSubjectiveQuestion(q.question_type) && q.ai_score_out_of_10 !== undefined) {
          feedback = q.ai_rationale_short || "Your answer shows understanding.";
          pointsEarned = q.ai_score_out_of_10;
        } else {
          if (q.is_correct) {
            feedback = `Excellent! Your answer demonstrates strong understanding.`;
            pointsEarned = 10;
          } else {
            feedback = `Review the explanation to strengthen your understanding.`;
            pointsEarned = 0;
          }
        }
        
        return {
          question_index: idx,
          is_correct: q.is_correct,
          feedback,
          points_earned: pointsEarned
        };
      });

      const scoreNum = parseInt(feedbackData.predicted_exam_score_percentage);
      let letterGrade = "F";
      if (!isNaN(scoreNum)) {
        if (scoreNum >= 90) letterGrade = "A+";
        else if (scoreNum >= 85) letterGrade = "A";
        else if (scoreNum >= 80) letterGrade = "A-";
        else if (scoreNum >= 77) letterGrade = "B+";
        else if (scoreNum >= 73) letterGrade = "B";
        else if (scoreNum >= 70) letterGrade = "B-";
        else if (scoreNum >= 67) letterGrade = "C+";
        else if (scoreNum >= 63) letterGrade = "C";
        else if (scoreNum >= 60) letterGrade = "C-";
        else if (scoreNum >= 50) letterGrade = "D";
      }

      await retryOperation(() => 
        base44.entities.Exam.update(exam.id, {
          questions: questionsWithGrading,
          feedback: questionFeedback,
          total_score: isNaN(scoreNum) ? 0 : scoreNum,
          predicted_grade: letterGrade,
          ai_feedback: feedbackData,
          time_taken_seconds: elapsedSeconds,
          question_time_laps: questionTimeLaps,
          status: "completed",
          completed: true
        })
      );

      const correctCount = questionsWithGrading.filter(q => q.is_correct).length;
      let pointsEarned = 50;
      
      questionsWithGrading.forEach(q => {
        if (isSubjectiveQuestion(q.question_type) && q.ai_score_out_of_10 !== undefined) {
          pointsEarned += Math.round(q.ai_score_out_of_10 * 2.5);
        } else if (q.is_correct) {
          pointsEarned += 15;
        }
      });

      if (correctCount === questionsWithGrading.length) {
        pointsEarned += 100;
      }

      if (letterGrade.startsWith('A')) {
        pointsEarned += 50;
      }

      const earnedBadges = [...(user.badges || [])];
      const badgeIds = earnedBadges.map(b => b.badge_id);
      const earnedNow = [];

      if (!badgeIds.includes('first_exam')) {
        earnedBadges.push({
          badge_id: 'first_exam',
          badge_name: 'First Exam',
          badge_description: 'Completed your first exam!',
          badge_icon: '📝',
          earned_date: new Date().toISOString()
        });
        earnedNow.push(earnedBadges[earnedBadges.length - 1]);
      }

      const newTotalPoints = (user.total_points || 0) + pointsEarned;
      const newLevel = Math.floor(newTotalPoints / 100) + 1;

      await retryOperation(() => 
        base44.auth.updateMe({
          questions_completed: (user.questions_completed || 0) + questionsWithGrading.length,
          time_spent_seconds: (user.time_spent_seconds || 0) + elapsedSeconds,
          total_points: newTotalPoints,
          level: newLevel,
          badges: earnedBadges
        })
      );

      if (earnedNow.length > 0 || correctCount >= 8) {
        setShowConfetti(true);
        setNewBadges(earnedNow);
      }

      // Reload to show completed state
      setTimeout(() => {
        loadOrGenerateExam();
        window.dispatchEvent(new Event('switchToGradeTab'));
      }, 2000);
    } catch (error) {
      console.error("Error submitting exam:", error);
      await logError('exam_submission', error, { lesson_id: lesson?.id, exam_id: exam?.id });
      alert("Failed to submit exam. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (!quiz || !quiz.completed) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl min-h-[400px] shadow-xl flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Complete the Diagnostic Quiz First</h3>
            <p className="text-slate-600 mt-2">
              The exam is locked until you complete the diagnostic quiz.
            </p>
          </div>
          <Button
            onClick={() => window.dispatchEvent(new Event('switchToQuizTab'))}
            className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
          >
            Go to Diagnostic Quiz
          </Button>
        </div>
      </Card>
    );
  }

  if (isGenerating) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-6 max-w-2xl mx-auto">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto"
          >
            <Loader2 className="w-16 h-16 text-purple-600" />
          </motion.div>
          
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Creating Your Exam</h3>
            <p className="text-slate-600">
              Generating personalized exam questions based on your diagnostic results...
            </p>
          </div>

          <Card className="bg-gradient-to-r from-purple-50 to-yellow-50 border-purple-200 p-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⭐</span>
              <div className="text-left">
                <p className="font-semibold text-purple-900 mb-1">DID YOU KNOW? • {lesson?.course_name}</p>
                <p className="text-sm text-slate-700">
                  Practice testing is one of the most effective learning strategies, improving retention by up to 50% compared to passive review.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!exam) return null;

  if (exam.completed) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl min-h-[400px] shadow-xl flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto shadow-xl">
            <span className="text-4xl font-bold text-white">{exam.predicted_grade}</span>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Exam 1 Completed!</h3>
            <p className="text-slate-600 mt-2">Predicted Grade: {exam.predicted_grade} ({Math.round(exam.total_score)}%)</p>
            <p className="text-sm text-slate-500 mt-1">View your detailed feedback in the Grade tab</p>
          </div>
          <Button
            onClick={() => window.dispatchEvent(new Event('switchToGradeTab'))}
            className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
          >
            View Predicted Grade
          </Button>
        </div>
      </Card>
    );
  }

  const progress = ((currentQuestion + 1) / exam.questions.length) * 100;
  const isLastQuestion = currentQuestion === exam.questions.length - 1;
  const currentQ = exam.questions[currentQuestion];
  const canProceed = currentQ.user_answer?.trim() !== "";

  return (
    <>
      <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      {newBadges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl p-6 max-w-md"
        >
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-yellow-500" />
            <h3 className="text-xl font-bold text-slate-900">New Badge Earned!</h3>
          </div>
          <div className="space-y-2">
            {newBadges.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <span className="text-2xl">{badge.badge_icon}</span>
                <div>
                  <p className="font-semibold text-slate-900">{badge.badge_name}</p>
                  <p className="text-sm text-slate-600">{badge.badge_description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="border-b border-purple-200/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-900">Exam 1</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200">
                <Clock className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-700">{formatTime(elapsedSeconds)}</span>
              </div>
              <span className="text-sm font-medium text-slate-600">
                {currentQuestion + 1}/{exam.questions.length}
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            <WorksheetQuestion
              key={currentQuestion}
              question={currentQ}
              answer={currentQ.user_answer}
              onAnswer={handleAnswer}
            />
          </AnimatePresence>

          <div className="mt-6 flex gap-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              className="flex-1"
            >
              Previous
            </Button>
            {isLastQuestion ? (
              <Button
                onClick={submitExam}
                disabled={!canProceed || isSubmitting}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Exam"
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
              >
                Next Question
              </Button>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}