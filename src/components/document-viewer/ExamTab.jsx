import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, Clock, Sparkles, Play, Pause, CheckCircle2, Trophy, Zap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import ExamQuestion from "@/components/exam/ExamQuestion.jsx";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";
import EducationalLoader from "@/components/ui/EducationalLoader";
import { logError } from "@/components/utils/errorLogger";
import XPGainToast from "@/components/gamification/XPGainToast";
import { recordDailyActivity, awardDailyXP } from "@/components/utils/dailyReset";

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};



export default function ExamTab({ lesson, exams, onExamComplete }) {
  const [exam, setExam] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [newBadges, setNewBadges] = useState([]);
  const gradingTimeoutRef = useRef(null);
  const [gradingInProgress, setGradingInProgress] = useState({});
  const [selectedExamNumber, setSelectedExamNumber] = useState(null);
  const [xpToast, setXpToast] = useState({ show: false, xp: 0, reason: '' });
  const [correctStreak, setCorrectStreak] = useState(0);
  
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const questionTimesRef = useRef({});
  const currentQuestionStartTimeRef = useRef(null);
  const examIdRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const lastSavedQuestionsRef = useRef(null);
  const generationStartedRef = useRef(false);

  // Auto-generate Exam 1 when tab loads (or URL has generating=true)
  useEffect(() => {
    if (lesson && !selectedExamNumber && !isGenerating) {
      const allExamsForLesson = exams || [];
      const exam1 = allExamsForLesson.find(e => e.exam_number === 1);
      
      // Check if this is a fresh lesson upload (generating=true in URL)
      const urlParams = new URLSearchParams(window.location.search);
      const isGeneratingNew = urlParams.get('generating') === 'true';
      
      // If no Exam 1 exists or it's not completed, auto-start it
      if (!exam1 || !exam1.completed || isGeneratingNew) {
        setSelectedExamNumber(1);
      }
    }
  }, [lesson?.id]);

  useEffect(() => {
    if (lesson && selectedExamNumber && !isGenerating && !exam && !generationStartedRef.current) {
      generationStartedRef.current = true;
      loadOrGenerateExam(selectedExamNumber);
    }
  }, [lesson?.id, selectedExamNumber]);

  useEffect(() => {
    if (exam && !exam.completed && exam.id !== examIdRef.current) {
      examIdRef.current = exam.id;
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Restore elapsed time from saved exam data
      const savedElapsed = exam.time_taken_seconds || 0;
      setElapsedSeconds(savedElapsed);
      startTimeRef.current = Date.now() - (savedElapsed * 1000);
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

  // Auto-save progress every 10 seconds and on answer changes
  const saveExamProgress = async () => {
    if (!exam || exam.completed) return;
    
    const questionsJson = JSON.stringify(exam.questions);
    if (lastSavedQuestionsRef.current === questionsJson) return; // No changes
    
    try {
      const questionTimeLaps = Object.keys(questionTimesRef.current).map(key => ({
        question_index: parseInt(key),
        total_seconds: questionTimesRef.current[key]
      }));
      
      await base44.entities.Exam.update(exam.id, {
        questions: exam.questions,
        time_taken_seconds: elapsedSeconds,
        question_time_laps: questionTimeLaps
      });
      lastSavedQuestionsRef.current = questionsJson;
    } catch (error) {
      console.error("Auto-save error:", error);
    }
  };

  // Auto-save every 1 second
  useEffect(() => {
    if (!exam || exam.completed) return;
    
    const intervalId = setInterval(saveExamProgress, 1000);
    return () => clearInterval(intervalId);
  }, [exam?.id, exam?.completed, elapsedSeconds]);

  // Save on page unload/visibility change
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (exam && !exam.completed) {
        saveExamProgress();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && exam && !exam.completed) {
        saveExamProgress();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [exam?.id, exam?.completed, elapsedSeconds]);

  const recordQuestionTime = (questionIndex) => {
    if (currentQuestionStartTimeRef.current) {
      const now = Date.now();
      const timeSpentOnQuestion = Math.floor((now - currentQuestionStartTimeRef.current) / 1000);
      questionTimesRef.current[questionIndex] = (questionTimesRef.current[questionIndex] || 0) + timeSpentOnQuestion;
    }
  };

  const loadOrGenerateExam = async (examNumber) => {
    try {
      const existingExams = await base44.entities.Exam.filter({ 
        lesson_id: lesson.id,
        exam_number: examNumber
      });

      if (existingExams.length > 0) {
        const loadedExam = existingExams[0];
        
        if (loadedExam.completed) {
          setExam(loadedExam);
          generationStartedRef.current = false;
          return;
        }
        
        if (!loadedExam.questions || loadedExam.questions.length === 0) {
          setIsGenerating(true);
          await generateExam(loadedExam.id, examNumber);
          setIsGenerating(false);
        } else {
          // Load existing in-progress exam and restore question position
          setExam(loadedExam);
          // Find the first unanswered question to resume from
          const firstUnanswered = loadedExam.questions.findIndex(q => !q.user_answer || q.user_answer.trim() === "");
          if (firstUnanswered >= 0) {
            setCurrentQuestion(firstUnanswered);
          } else {
            // All answered, go to last question
            setCurrentQuestion(loadedExam.questions.length - 1);
          }
        }
        generationStartedRef.current = false;
      } else {
        setIsGenerating(true);
        await generateExam(null, examNumber);
        setIsGenerating(false);
        generationStartedRef.current = false;
      }
    } catch (error) {
      console.error("Error loading exam:", error);
      setIsGenerating(false);
      generationStartedRef.current = false;
    }
  };

  const generateExam = async (existingExamId = null, examNumber = 1) => {
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });
      const learningProfile = profile[0] || {};

      // For exam 1, use full content. For subsequent exams, use focused approach
      let contentDescription = "";
      
      if (examNumber === 1) {
        // First exam needs full context
        if (lesson.input_type === "description" && lesson.description) {
          contentDescription = lesson.description;
        } else if (lesson.extracted_content) {
          // Use compressed extracted_content (already compressed in CreateLessonModal)
          contentDescription = lesson.extracted_content;
        } else {
          contentDescription = lesson.description || "N/A";
        }
      } else {
        // Subsequent exams: use compressed content
        contentDescription = lesson.extracted_content || lesson.description || "N/A";
      }
      
      console.log(`📊 Exam ${examNumber} - Content length:`, contentDescription.length);

      // Get suggested future sessions from exam 1 for subsequent exams
      const existingExam1 = exams.find(e => e.exam_number === 1);
      const suggestedFutureSessions = examNumber > 1 
        ? (existingExam1?.ai_feedback?.suggested_future_sessions_plan || [])
        : [];

      const { data: examData } = await base44.functions.invoke('generateWorksheet', {
        examNumber,
        lessonData: { course_name: lesson.course_name },
        learningProfile,
        contentDescription,
        curriculumMap: lesson.curriculum_map,
        suggestedFutureSessions,
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
      });

      // Guard against missing or invalid worksheet_questions
      const worksheetQuestions = examData?.worksheet_questions || [];
      if (!Array.isArray(worksheetQuestions) || worksheetQuestions.length === 0) {
        throw new Error("Failed to generate exam questions. Please try again.");
      }
      
      const questionsWithPlaceholder = worksheetQuestions.map(q => ({
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
          exam_number: examNumber,
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

  const awardXP = async (amount, reason) => {
    try {
      // Use centralized XP tracking
      const result = await awardDailyXP(amount, reason);
      if (result.success) {
        // Also record question activity
        await recordDailyActivity('questions', 1);
        
        // Update questions_completed count
        const user = await base44.auth.me();
        await base44.auth.updateMe({
          questions_completed: (user.questions_completed || 0) + 1
        });
        
        setXpToast({ show: true, xp: amount, reason });
      }
    } catch (error) {
      console.error("Error awarding XP:", error);
    }
  };

  const handleAnswer = (answer) => {
    const updatedQuestions = [...exam.questions];
    updatedQuestions[currentQuestion].user_answer = answer;

    setExam(prev => ({
      ...prev,
      questions: updatedQuestions
    }));

    // Debounce auto-save on answer change
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveExamProgress();
    }, 2000);

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
    recordQuestionTime(currentQuestion);

    // Award XP for answering a question
    const currentQ = exam.questions[currentQuestion];
    if (currentQ.user_answer) {
      awardXP(3, 'Question answered!');
    }

    // Save progress when navigating
    saveExamProgress();

    if (currentQuestion < exam.questions.length - 1) {
      if (gradingTimeoutRef.current) {
        clearTimeout(gradingTimeoutRef.current);
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
      saveExamProgress();
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

      // Call feedbackGrade function with data
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

      const { data: feedbackData } = await base44.functions.invoke('feedbackGrade', {
        examNumber: exam.exam_number,
        examPerformanceData,
        curriculumMap: lesson.curriculum_map,
        learningProfile,
        courseName: lesson.course_name,
        response_json_schema: {
          type: "object",
          properties: {
            feedback_session_title: { type: "string" },
            predicted_exam_score_percentage: { type: "string" },
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
              },
              minItems: 3,
              maxItems: 5
            }
          }
        }
      });

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

      await base44.entities.Exam.update(exam.id, {
          questions: questionsWithGrading,
          feedback: questionFeedback,
          total_score: isNaN(scoreNum) ? 0 : scoreNum,
          predicted_grade: letterGrade,
          ai_feedback: feedbackData,
          time_taken_seconds: elapsedSeconds,
          question_time_laps: questionTimeLaps,
          status: "completed",
          completed: true
        });

      // Create all 6 exams after completing exam 1
      if (exam.exam_number === 1 && feedbackData.suggested_future_sessions_plan) {
        const existingExams = await base44.entities.Exam.filter({ lesson_id: lesson.id });
        const existingNumbers = existingExams.map(e => e.exam_number);
        
        await Promise.all(
          feedbackData.suggested_future_sessions_plan.map(async (session) => {
            if (!existingNumbers.includes(session.session_number)) {
              await base44.entities.Exam.create({
                lesson_id: lesson.id,
                exam_number: session.session_number,
                focus_description: session.session_focus_description,
                status: "not_started",
                completed: false,
                questions: [],
                feedback: [],
                time_taken_seconds: 0,
                question_time_laps: []
              });
            }
          })
        );
      }

      const correctCount = questionsWithGrading.filter(q => q.is_correct).length;

      // Award XP for exam completion using centralized tracking
      let examXP = 25; // Base XP for completing exam
      if (correctCount >= 8) examXP += 25; // Bonus for high score
      if (correctCount === questionsWithGrading.length) examXP += 50; // Perfect score bonus

      try {
        // Use centralized XP tracking
        const xpResult = await awardDailyXP(examXP, 'Exam completed!');
        
        // Update exam-specific stats
        const currentUserXP = await base44.auth.me();
        await base44.auth.updateMe({
          total_exams_completed: (currentUserXP.total_exams_completed || 0) + 1
        });

        let xpReason = 'Exam completed!';
        if (correctCount === questionsWithGrading.length) xpReason = 'Perfect exam! 🌟';
        else if (correctCount >= 8) xpReason = 'Great score! 🎯';

        if (xpResult.success) {
          setXpToast({ show: true, xp: examXP, reason: xpReason });
        }
      } catch (xpError) {
        console.error("Error awarding exam XP:", xpError);
      }

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

      await base44.auth.updateMe({
          questions_completed: (user.questions_completed || 0) + questionsWithGrading.length,
          time_spent_seconds: (user.time_spent_seconds || 0) + elapsedSeconds,
          total_points: newTotalPoints,
          level: newLevel,
          badges: earnedBadges
        });

      if (earnedNow.length > 0 || correctCount >= 8) {
        setShowConfetti(true);
        setNewBadges(earnedNow);
      }

      // Reload lesson data to refresh exams list
      window.dispatchEvent(new Event('reloadLesson'));
      if (onExamComplete) onExamComplete();
      setTimeout(() => {
        window.dispatchEvent(new Event('switchToGradeTab'));
      }, 1000);
    } catch (error) {
      console.error("Error submitting exam:", error);
      await logError('exam_submission', error, { lesson_id: lesson?.id, exam_id: exam?.id });
      alert("Failed to submit exam. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Show exam selection if no exam in progress
  if (!exam && !isGenerating && !selectedExamNumber) {
    const allExamsForLesson = exams || [];
    // Deduplicate by exam_number, keeping the most recent or completed one
    const examsByNumber = {};
    allExamsForLesson.forEach(e => {
      const existing = examsByNumber[e.exam_number];
      if (!existing || e.completed || (!existing.completed && e.updated_date > existing.updated_date)) {
        examsByNumber[e.exam_number] = e;
      }
    });
    const sortedExams = Object.values(examsByNumber).sort((a, b) => a.exam_number - b.exam_number);
    
    return (
      <div className="pb-4">
        <Card className="bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl p-3 md:p-6 m-1 md:m-2">
        <div className="mb-3 md:mb-6">
          <h3 className="text-base md:text-2xl font-bold text-slate-900 mb-1 md:mb-2 flex items-center gap-1.5 md:gap-2">
            <Trophy className="w-5 h-5 md:w-7 md:h-7 text-yellow-500" />
            Your Roadmap to 90%+
          </h3>
          <p className="text-xs md:text-base text-slate-600">Complete exams to track your progress and improve your predicted grade</p>
        </div>
        
        <div className="grid gap-2 md:gap-3">
          {sortedExams.length > 0 ? sortedExams.map((e) => {
            const isCompleted = e.completed;
            const canStart = e.exam_number === 1 || sortedExams.find(ex => ex.exam_number === e.exam_number - 1)?.completed;
            
            return (
              <button
                key={e.id}
                onClick={() => {
                  if (isCompleted) {
                    // Navigate to grade tab to view feedback
                    window.dispatchEvent(new Event('switchToGradeTab'));
                  } else if (canStart) {
                    setSelectedExamNumber(e.exam_number);
                  }
                }}
                disabled={!canStart && !isCompleted}
                className={`p-3 md:p-5 rounded-xl border-2 transition-all text-left ${
                  isCompleted
                    ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300 hover:shadow-lg'
                    : canStart
                    ? 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300 hover:shadow-lg hover:scale-[1.02]'
                    : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1 md:mb-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    {isCompleted ? (
                      <div className="w-9 h-9 md:w-12 md:h-12 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 md:w-6 md:h-6 text-white" />
                      </div>
                    ) : canStart ? (
                      <div className="w-9 h-9 md:w-12 md:h-12 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Play className="w-4 h-4 md:w-6 md:h-6 text-white" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 md:w-12 md:h-12 bg-slate-300 rounded-full flex items-center justify-center flex-shrink-0">
                        <Lock className="w-4 h-4 md:w-6 md:h-6 text-white" />
                      </div>
                    )}
                    <div>
                      <h5 className="font-bold text-slate-900 text-sm md:text-lg">
                        Exam {e.exam_number}
                      </h5>
                      <p className="text-xs md:text-sm text-slate-600 line-clamp-1">
                        {e.focus_description || (e.exam_number === 1 ? 'Diagnostic Assessment' : 'Practice Exam')}
                      </p>
                    </div>
                  </div>
                  {isCompleted && e.predicted_grade && (
                    <Badge className="bg-emerald-600 text-white font-bold text-sm md:text-lg px-2 py-1 md:px-4 md:py-2">
                      {e.predicted_grade}
                    </Badge>
                  )}
                </div>
                {isCompleted && (
                  <p className="text-xs md:text-sm text-emerald-700 font-medium ml-11 md:ml-12">
                    Click to view feedback →
                  </p>
                )}
                {canStart && !isCompleted && (
                  <p className="text-xs md:text-sm text-purple-700 font-medium ml-11 md:ml-12">
                    Click to start exam →
                  </p>
                )}
              </button>
            );
          }) : (
            <button
              onClick={() => setSelectedExamNumber(1)}
              className="p-3 md:p-5 rounded-xl border-2 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300 hover:shadow-lg hover:scale-[1.02] transition-all text-left"
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-9 h-9 md:w-12 md:h-12 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Play className="w-4 h-4 md:w-6 md:h-6 text-white" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 text-sm md:text-lg">Exam 1</h5>
                  <p className="text-xs md:text-sm text-slate-600">Diagnostic Assessment</p>
                </div>
              </div>
              <p className="text-xs md:text-sm text-purple-700 font-medium ml-11 md:ml-12 mt-1 md:mt-2">
                Click to start your first exam →
              </p>
            </button>
          )}
        </div>
        </Card>
      </div>
    );
  }

  if (isGenerating) {
    return <EducationalLoader 
      title="Creating Your Exam" 
      description="Generating personalized exam questions based on your diagnostic results..."
    />;
  }

  if (!exam) return null;

  if (exam.completed) {
    // Go back to selection view after completion
    setExam(null);
    setSelectedExamNumber(null);
    window.dispatchEvent(new Event('reloadLesson'));
    return null;
  }

  // Guard against missing questions array
  if (!exam.questions || exam.questions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-2 text-slate-600">Loading questions...</span>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / exam.questions.length) * 100;
  const isLastQuestion = currentQuestion === exam.questions.length - 1;
  const currentQ = exam.questions[currentQuestion];
  
  // Guard against invalid current question
  if (!currentQ) {
    setCurrentQuestion(0);
    return null;
  }
  
  const canProceed = currentQ.user_answer?.trim() !== "";

  return (
    <>
      <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
      <XPGainToast show={xpToast.show} xpGained={xpToast.xp} reason={xpToast.reason} onComplete={() => setXpToast({ show: false, xp: 0, reason: '' })} />
      
      {newBadges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl p-4 max-w-sm mx-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            <h3 className="text-base font-bold text-slate-900">New Badge Earned!</h3>
          </div>
          <div className="space-y-2">
            {newBadges.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                <span className="text-xl">{badge.badge_icon}</span>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{badge.badge_name}</p>
                  <p className="text-xs text-slate-600">{badge.badge_description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Mobile-optimized full-height layout */}
      <div className="flex flex-col h-full md:h-auto md:pb-4">
        <div className="flex-1 flex flex-col bg-white/95 backdrop-blur-xl md:rounded-2xl border-0 md:border border-purple-200/80 shadow-none md:shadow-sm md:mx-0 overflow-hidden">
          {/* Sticky compact header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-purple-100 bg-white/95 backdrop-blur-sm sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                {currentQuestion + 1}/{exam.questions.length}
              </span>
              <Progress value={progress} className="h-1.5 w-20" />
            </div>
            <div className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
              <Clock className="w-3 h-3" />
              <span className="text-xs font-semibold tabular-nums">{formatTime(elapsedSeconds)}</span>
            </div>
          </div>

          {/* Scrollable question content */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3 md:p-5">
            <AnimatePresence mode="wait">
              <ExamQuestion
                key={currentQuestion}
                question={currentQ}
                answer={currentQ.user_answer}
                onAnswer={handleAnswer}
                showFeedback={true}
                lesson={lesson}
              />
            </AnimatePresence>
          </div>

          {/* Fixed bottom navigation */}
          <div className="flex gap-2 px-3 py-3 md:px-5 md:pb-4 border-t border-purple-100 bg-white/95 backdrop-blur-sm shrink-0">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              className="flex-1 text-xs h-10 rounded-xl font-medium"
            >
              Previous
            </Button>
            {isLastQuestion ? (
              <Button
                onClick={submitExam}
                disabled={!canProceed || isSubmitting}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-xs h-10 rounded-xl font-medium"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
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
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-xs h-10 rounded-xl font-medium"
              >
                Next Question
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}