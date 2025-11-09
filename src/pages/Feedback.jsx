
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Award, TrendingUp, CheckCircle, XCircle, Sparkles, Home, TrendingDown, Target, BookOpen, MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Feedback() {
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [worksheet, setWorksheet] = useState(null);
  const [allWorksheets, setAllWorksheets] = useState([]); // New state for all worksheets
  const [isLoading, setIsLoading] = useState(true);
  const [strengths, setStrengths] = useState([]);
  const [weaknesses, setWeaknesses] = useState([]);
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');
    const worksheetNum = parseInt(urlParams.get('worksheet')) || 1; // New: Get worksheet number
    
    if (!lessonId) {
      navigate(createPageUrl("Home"));
      return;
    }

    loadFeedback(lessonId, worksheetNum); // Pass worksheetNum to loadFeedback
  }, [navigate]);

  const loadFeedback = async (lessonId, worksheetNum) => { // Accept worksheetNum
    setIsLoading(true);
    try {
      const lessonData = await base44.entities.Lesson.filter({ id: lessonId });
      if (lessonData.length === 0) {
        navigate(createPageUrl("Home"));
        return;
      }
      setLesson(lessonData[0]);

      const worksheetData = await base44.entities.Worksheet.filter({ 
        lesson_id: lessonId,
        worksheet_number: worksheetNum, // Filter by worksheet number
        completed: true
      });
      
      if (worksheetData.length === 0) {
        // If the specific worksheet isn't completed, redirect to the worksheet page
        navigate(createPageUrl("Worksheet") + `?lessonId=${lessonId}&worksheet=${worksheetNum}`);
        return;
      }
      setWorksheet(worksheetData[0]);

      // Load all worksheets for this lesson
      const allWorksheetsData = await base44.entities.Worksheet.filter({ 
        lesson_id: lessonId 
      });
      setAllWorksheets(allWorksheetsData.sort((a, b) => a.worksheet_number - b.worksheet_number));

      // Analyze strengths and weaknesses from AI feedback
      analyzePerformance(worksheetData[0]);

      // Update total lessons completed only if it's the first worksheet of the lesson
      const user = await base44.auth.me();
      if (worksheetNum === 1) { // Only increment if it's the first worksheet of a lesson
        await base44.auth.updateMe({
          total_lessons_completed: (user.total_lessons_completed || 0) + 1
        });
      }
    } catch (error) {
      console.error("Error loading feedback:", error);
    }
    setIsLoading(false);
  };

  const analyzePerformance = (worksheetData) => {
    // Use AI feedback if available
    if (worksheetData.ai_feedback) {
      setStrengths(worksheetData.ai_feedback.identified_strengths_list || []);
      setWeaknesses(worksheetData.ai_feedback.key_areas_for_improvement_list || []);
    } else {
      // Fallback to basic analysis
      const correctAnswers = worksheetData.feedback.filter(f => f.is_correct);
      const incorrectAnswers = worksheetData.feedback.filter(f => !f.is_correct);

      const strengthList = correctAnswers.slice(0, 3).map((f) => {
        const question = worksheetData.questions[f.question_index];
        return question.assessed_competencies?.[0] || `Mastered ${question.question_type}`;
      });

      const weaknessList = incorrectAnswers.slice(0, 3).map((f) => {
        const question = worksheetData.questions[f.question_index];
        return question.targeted_misconception || 
               question.assessed_competencies?.[0] || 
               `Need improvement in ${question.question_type}`;
      });

      setStrengths([...new Set(strengthList)]);
      setWeaknesses([...new Set(weaknessList)]);
    }
  };

  const handleNextWorksheet = () => {
    const nextWorksheet = allWorksheets.find(w => w.worksheet_number === worksheet.worksheet_number + 1);
    if (nextWorksheet) {
      if (nextWorksheet.status === "not_started") {
        navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}&worksheet=${nextWorksheet.worksheet_number}`);
      } else if (nextWorksheet.completed) {
        navigate(createPageUrl("Feedback") + `?lessonId=${lesson.id}&worksheet=${nextWorksheet.worksheet_number}`);
      }
    } else {
      // If no next worksheet, navigate to home or a lesson complete page
      navigate(createPageUrl("Home")); // Or a more specific "Lesson Completed" page
    }
  };

  if (isLoading || !worksheet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    );
  }

  const getGradeColor = (grade) => {
    if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
    if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
    if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-pink-600';
  };

  const getGradeEmoji = (grade) => {
    if (grade.startsWith('A')) return '🎉';
    if (grade.startsWith('B')) return '👍';
    if (grade.startsWith('C')) return '📚';
    if (grade.startsWith('D')) return '📈';
    return '🎯';
  };

  // Parse predicted score - handle both "85%" and "85" formats
  const getPredictedScore = () => {
    const scoreValue = worksheet.ai_feedback?.predicted_exam_score_percentage || worksheet.total_score.toString();
    // If it already has %, return as is, otherwise add %
    return scoreValue.toString().includes('%') ? scoreValue : `${scoreValue}%`;
  };

  // Format time spent
  const formatTimeSpent = (seconds) => {
    if (seconds === undefined || seconds === null || seconds < 0) return '0m 0s';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  // nextWorksheet variable from original code is still useful for dialog logic
  const nextWorksheet = allWorksheets.find(w => w.worksheet_number === worksheet.worksheet_number + 1);
  const totalWorksheets = allWorksheets.length;
  const futureWorksheets = worksheet.ai_feedback?.suggested_future_sessions_plan || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section - Predicted Grade */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg mb-6">
            <Award className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-slate-700">Worksheet {worksheet.worksheet_number} Complete</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 md:mb-6">
            Your Predicted Grade
          </h1>
          
          {/* Mobile: 75% scale, Desktop: 100% scale */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-block scale-75 md:scale-100 origin-top"
          >
            <div className={`px-12 md:px-16 py-6 md:py-8 rounded-3xl bg-gradient-to-r ${getGradeColor(worksheet.predicted_grade)} shadow-2xl mb-4`}>
              <div className="text-6xl md:text-8xl font-bold text-white mb-2">
                {worksheet.predicted_grade} {getGradeEmoji(worksheet.predicted_grade)}
              </div>
              <div className="text-xl md:text-2xl text-white font-semibold">
                {getPredictedScore()}
              </div>
            </div>
          </motion.div>

          {worksheet.ai_feedback?.overall_performance_summary_text && (
            <p className="text-base md:text-lg text-slate-700 max-w-3xl mx-auto mt-6">
              {worksheet.ai_feedback.overall_performance_summary_text}
            </p>
          )}

          {worksheet.ai_feedback?.prediction_calculation_rationale && (
            <div className="mt-6 max-w-3xl mx-auto">
              <details className="bg-white rounded-lg p-4 shadow">
                <summary className="cursor-pointer font-semibold text-purple-700 hover:text-purple-900">
                  How was this grade calculated?
                </summary>
                <p className="mt-3 text-sm text-slate-600 text-left">
                  {worksheet.ai_feedback.prediction_calculation_rationale}
                </p>
              </details>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 md:gap-6 text-slate-600 text-sm md:text-lg mt-6 flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
              <span className="font-semibold">{Math.round(worksheet.total_score)}%</span>
            </div>
            <div className="w-1 h-4 md:h-6 bg-slate-300 rounded-full" />
            <span>Worksheet {worksheet.worksheet_number} of {totalWorksheets}</span>
            <div className="w-1 h-4 md:h-6 bg-slate-300 rounded-full" />
            <span>{worksheet.feedback.filter(f => f.is_correct).length} Correct</span>
            {worksheet.time_spent_seconds > 0 && (
              <>
                <div className="w-1 h-4 md:h-6 bg-slate-300 rounded-full" />
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
                  <span className="font-semibold">{formatTimeSpent(worksheet.time_spent_seconds)}</span>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Strengths & Weaknesses */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="shadow-xl border-0 h-full bg-gradient-to-br from-emerald-50 to-teal-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-700">
                  <TrendingUp className="w-5 h-5" />
                  Your Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {strengths.length > 0 ? strengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">{strength}</span>
                    </li>
                  )) : (
                    <li className="text-slate-500 italic">Complete more questions to identify strengths</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="shadow-xl border-0 h-full bg-gradient-to-br from-amber-50 to-orange-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <TrendingDown className="w-5 h-5" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {weaknesses.length > 0 ? weaknesses.map((weakness, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Target className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">{weakness}</span>
                    </li>
                  )) : (
                    <li className="text-slate-500 italic">Great job! Keep up the excellent work</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Roadmap to 90% CTA - Replaces the old "Continue Your Learning Journey" */}
        {futureWorksheets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <Card className="shadow-xl border-0 bg-gradient-to-br from-purple-600 to-indigo-700 text-white overflow-hidden relative">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-6 h-6" />
                      <h3 className="text-2xl md:text-3xl font-bold">Your Roadmap to 90%+</h3>
                    </div>
                    <p className="text-purple-100 text-base md:text-lg mb-2">
                      We've created {futureWorksheets.length} personalized worksheet{futureWorksheets.length > 1 ? 's' : ''} to help you master this subject
                    </p>
                    <p className="text-purple-200 text-sm">
                      Progress: {worksheet.worksheet_number} of {totalWorksheets} worksheets completed
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowRoadmapModal(true)}
                    size="lg"
                    className="bg-white text-purple-700 hover:bg-purple-50 shadow-xl font-semibold w-full md:w-auto"
                  >
                    <MapPin className="w-5 h-5 mr-2" />
                    View Your Learning Path
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Roadmap Modal - Improved Styling */}
        <Dialog open={showRoadmapModal} onOpenChange={setShowRoadmapModal}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0 border-2 border-purple-300 shadow-2xl">
            <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-slate-200">
              <DialogHeader>
                <DialogTitle className="text-xl md:text-2xl flex items-center gap-2">
                  <MapPin className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                  Your Personalized Learning Roadmap
                </DialogTitle>
                <DialogDescription className="text-sm md:text-base">
                  Complete these {futureWorksheets.length} worksheet{futureWorksheets.length > 1 ? 's' : ''} to reach 90%+ mastery and ace your exam
                </DialogDescription>
              </DialogHeader>
            </div>
            
            <div className="px-4 md:px-6 py-6 space-y-4">
              {futureWorksheets.map((session, idx) => {
                const worksheetNum = session.session_number;
                const existingWorksheet = allWorksheets.find(w => w.worksheet_number === worksheetNum);
                const isCompleted = existingWorksheet?.completed;
                const isCurrent = (nextWorksheet && worksheetNum === nextWorksheet.worksheet_number && !isCompleted);
                
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative"
                  >
                    {/* Connector Line */}
                    {idx < futureWorksheets.length - 1 && (
                      <div className="absolute left-6 top-20 w-0.5 h-16 bg-gradient-to-b from-purple-300 to-purple-100 hidden md:block" />
                    )}
                    
                    <Card className={`border-2 transition-all ${
                      isCompleted 
                        ? 'border-emerald-400 bg-emerald-50 shadow-md' 
                        : isCurrent 
                        ? 'border-purple-500 bg-purple-50 shadow-xl ring-2 ring-purple-200' 
                        : 'border-slate-300 bg-white shadow-sm'
                    }`}>
                      <CardContent className="p-4 md:p-6">
                        <div className="flex items-start gap-3 md:gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white shadow-lg ${
                            isCompleted 
                              ? 'bg-emerald-500' 
                              : isCurrent 
                              ? 'bg-purple-600 ring-4 ring-purple-200 scale-110' 
                              : 'bg-slate-400'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle className="w-6 h-6" />
                            ) : (
                              <span>{worksheetNum}</span>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="text-base md:text-lg font-bold text-slate-900 mb-1 leading-tight">
                                  {session.session_name}
                                </h4>
                                <Badge className={`${
                                  isCompleted 
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300' 
                                    : isCurrent 
                                    ? 'bg-purple-100 text-purple-700 border-purple-300' 
                                    : 'bg-slate-100 text-slate-600 border-slate-300'
                                } border`}>
                                  {isCompleted ? 'Completed' : isCurrent ? 'Up Next' : `Worksheet ${worksheetNum}`}
                                </Badge>
                              </div>
                            </div>
                            
                            <p className="text-slate-600 text-sm leading-relaxed mb-4">
                              {session.session_focus_description}
                            </p>
                            
                            {isCurrent && existingWorksheet && (
                              <Button
                                onClick={() => {
                                  setShowRoadmapModal(false);
                                  handleNextWorksheet();
                                }}
                                className="bg-purple-600 hover:bg-purple-700 w-full shadow-md"
                              >
                                <BookOpen className="w-4 h-4 mr-2" />
                                Start Worksheet {worksheetNum}
                              </Button>
                            )}
                            
                            {isCompleted && existingWorksheet && (
                              <div className="flex items-center justify-between p-3 bg-white rounded-lg border-2 border-emerald-300 shadow-sm">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                                  <span className="text-sm font-medium text-slate-700">Score: {Math.round(existingWorksheet.total_score)}%</span>
                                </div>
                                <span className="text-sm font-bold text-emerald-600">{existingWorksheet.predicted_grade}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
              
              {/* Goal Achievement Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: futureWorksheets.length * 0.1 }}
              >
                <Card className="border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-lg">
                  <CardContent className="p-4 md:p-6 text-center">
                    <Award className="w-10 h-10 md:w-12 md:h-12 mx-auto text-yellow-600 mb-3" />
                    <h4 className="text-lg md:text-xl font-bold text-slate-900 mb-2">
                      90%+ Mastery Goal
                    </h4>
                    <p className="text-slate-600 text-sm">
                      Complete all worksheets with focused practice to achieve exam excellence
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Detailed Question Feedback */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="shadow-2xl border-0 mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">Question-by-Question Breakdown</CardTitle>
              <p className="text-slate-600">Review your answers and learn from detailed feedback</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {worksheet.feedback.map((feedback, idx) => {
                  const question = worksheet.questions[feedback.question_index];
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + (idx * 0.05) }}
                      className={`p-6 rounded-xl border-2 ${
                        feedback.is_correct 
                          ? 'border-emerald-200 bg-emerald-50/50' 
                          : 'border-amber-200 bg-amber-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          feedback.is_correct 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-amber-500 text-white'
                        }`}>
                          {feedback.is_correct ? (
                            <CheckCircle className="w-6 h-6" />
                          ) : (
                            <XCircle className="w-6 h-6" />
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-slate-900 text-lg mb-1">
                                Question {question.question_number}
                              </h4>
                              <div className="flex gap-2 flex-wrap">
                                <Badge variant="outline">
                                  {question.question_type}
                                </Badge>
                                <Badge variant="outline">
                                  {question.difficulty_index}
                                </Badge>
                                <Badge variant="outline">
                                  {feedback.points_earned}/10 pts
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-white rounded-lg p-4 border border-slate-200 mb-3">
                            <p className="text-slate-800 font-medium mb-3">{question.question_text}</p>
                            {question.options && question.options.length > 0 && (
                              <div className="mt-3 space-y-1 bg-slate-50 p-3 rounded">
                                <p className="text-xs font-semibold text-slate-600 mb-2">Options:</p>
                                {question.options.map((opt, i) => (
                                  <div key={i} className="text-sm text-slate-600">
                                    {String.fromCharCode(65 + i)}. {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <div className="bg-blue-50 p-3 rounded">
                                <p className="text-xs font-semibold text-blue-700 mb-1">Your Answer:</p>
                                <p className="text-sm text-slate-700">{question.user_answer || "No answer"}</p>
                              </div>
                              <div className="bg-emerald-50 p-3 rounded">
                                <p className="text-xs font-semibold text-emerald-700 mb-1">Correct Answer:</p>
                                <p className="text-sm text-slate-700">{question.correct_answer}</p>
                              </div>
                            </div>
                          </div>

                          <div className={`p-4 rounded-lg mb-3 ${
                            feedback.is_correct ? 'bg-emerald-100 border border-emerald-300' : 'bg-amber-100 border border-amber-300'
                          }`}>
                            <p className="text-sm font-semibold mb-2 text-slate-800">
                              {feedback.is_correct ? '✓ Excellent work!' : 'Learning Opportunity:'}
                            </p>
                            <p className="text-sm text-slate-700 leading-relaxed">{feedback.feedback}</p>
                          </div>

                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <p className="text-xs font-semibold text-purple-700 mb-2">📚 Explanation & Key Concepts:</p>
                            <p className="text-sm text-slate-700 mb-3">{question.explanation}</p>
                            <div className="flex flex-wrap gap-2">
                              {question.assessed_competencies?.map((comp, i) => (
                                <Badge key={i} className="bg-purple-100 text-purple-800 border-purple-200">
                                  {comp}
                                </Badge>
                              ))}
                            </div>
                            {question.targeted_misconception && question.targeted_misconception !== "N/A" && (
                              <p className="text-xs text-amber-700 mt-3 italic">
                                💡 Common misconception: {question.targeted_misconception}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer Actions */}
        <div className="text-center">
          <Button
            onClick={() => navigate(createPageUrl("Home"))}
            size="lg"
            className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black shadow-xl"
          >
            <Home className="w-5 h-5 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
