import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, TrendingUp, CheckCircle, XCircle, Sparkles, TrendingDown, Target, MapPin, Clock, Brain, Zap, Eye, ChevronDown, ChevronUp, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MathText from "../math/MathText";

const formatTime = (seconds) => {
  if (!seconds) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

export default function FeedbackDisplay({ exam, lesson, allExams = [] }) {
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState({
    strengths: true,
    weaknesses: true,
    insights: false,
    breakdown: true
  });
  const [expandedQuestions, setExpandedQuestions] = useState({});

  const toggleSection = (section) => {
    setSectionsExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleQuestion = (index) => {
    setExpandedQuestions(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const getQuestionTime = (questionIndex) => {
    if (!exam.question_time_laps) return 0;
    const lap = exam.question_time_laps.find(l => l.question_index === questionIndex);
    return lap ? lap.total_seconds : 0;
  };

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

  const getPredictedScore = () => {
    const scoreValue = exam.ai_feedback?.predicted_exam_score_percentage || exam.total_score.toString();
    return scoreValue.toString().includes('%') ? scoreValue : `${scoreValue}%`;
  };

  const getPatternIcon = (type) => {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('guess') || typeLower.includes('pressure')) return '🎲';
    if (typeLower.includes('overconfiden')) return '🎯';
    if (typeLower.includes('underconfiden')) return '💭';
    if (typeLower.includes('reason') || typeLower.includes('method')) return '🧠';
    if (typeLower.includes('time') || typeLower.includes('rush')) return '⏱️';
    return '💡';
  };

  const strengths = exam.ai_feedback?.identified_strengths_list || [];
  const weaknesses = exam.ai_feedback?.key_areas_for_improvement_list || [];
  const futureWorksheets = exam.ai_feedback?.suggested_future_sessions_plan || [];
  const totalWorksheets = allExams.length || 6;

  return (
    <div className="space-y-4 px-2">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-lg mb-4">
          <Award className="w-4 h-4 text-purple-600" />
          <span className="text-xs font-medium text-slate-700">Exam {exam.exam_number} Complete</span>
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Your Predicted Grade
        </h1>
        
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-block"
        >
          <div className={`px-10 py-6 rounded-2xl bg-gradient-to-r ${getGradeColor(exam.predicted_grade)} shadow-xl mb-3`}>
            <div className="text-5xl font-bold text-white mb-1">
              {exam.predicted_grade} {getGradeEmoji(exam.predicted_grade)}
            </div>
            <div className="text-lg text-white font-semibold">
              {getPredictedScore()}
            </div>
          </div>
        </motion.div>

        {exam.ai_feedback?.overall_performance_summary_text && (
          <p className="text-sm text-slate-700 mx-auto mt-4 leading-relaxed px-2">
            {exam.ai_feedback.overall_performance_summary_text}
          </p>
        )}

        {exam.ai_feedback?.prediction_calculation_rationale && (
          <div className="mt-4">
            <details className="bg-white rounded-lg p-3 shadow text-left">
              <summary className="cursor-pointer font-semibold text-purple-700 hover:text-purple-900 text-sm">
                How was this grade calculated?
              </summary>
              <p className="mt-2 text-xs text-slate-600">
                {exam.ai_feedback.prediction_calculation_rationale}
              </p>
            </details>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-slate-600 text-xs mt-4">
          <div className="flex items-center justify-center gap-1.5 bg-white rounded-lg py-2 shadow-sm">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span className="font-semibold">{Math.round(exam.total_score)}%</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 bg-white rounded-lg py-2 shadow-sm">
            <Clock className="w-4 h-4 text-purple-700" />
            <span className="font-semibold">{formatTime(exam.time_taken_seconds || 0)}</span>
          </div>
          <div className="flex items-center justify-center bg-white rounded-lg py-2 shadow-sm">
            <span>Exam {exam.exam_number}/{totalWorksheets}</span>
          </div>
          <div className="flex items-center justify-center bg-white rounded-lg py-2 shadow-sm">
            <span>{exam.feedback?.filter(f => f.is_correct).length || 0} Correct</span>
          </div>
        </div>
      </motion.div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="shadow-lg border-0 bg-gradient-to-br from-emerald-50 to-teal-50/50 overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-emerald-100/50 transition-colors py-3 px-4"
              onClick={() => toggleSection('strengths')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-emerald-700 text-base">
                  <TrendingUp className="w-4 h-4" />
                  Your Strengths
                </CardTitle>
                {sectionsExpanded.strengths ? (
                  <ChevronUp className="w-4 h-4 text-emerald-700" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-emerald-700" />
                )}
              </div>
            </CardHeader>
            <AnimatePresence>
              {sectionsExpanded.strengths && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-2">
                      {strengths.length > 0 ? strengths.map((strength, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700 text-xs">{strength}</span>
                        </li>
                      )) : (
                        <li className="text-slate-500 italic text-xs">Complete more questions to identify strengths</li>
                      )}
                    </ul>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="shadow-lg border-0 bg-gradient-to-br from-amber-50 to-orange-50/50 overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-amber-100/50 transition-colors py-3 px-4"
              onClick={() => toggleSection('weaknesses')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-amber-700 text-base">
                  <TrendingDown className="w-4 h-4" />
                  Areas for Improvement
                </CardTitle>
                {sectionsExpanded.weaknesses ? (
                  <ChevronUp className="w-4 h-4 text-amber-700" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-amber-700" />
                )}
              </div>
            </CardHeader>
            <AnimatePresence>
              {sectionsExpanded.weaknesses && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-2">
                      {weaknesses.length > 0 ? weaknesses.map((weakness, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Target className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700 text-xs">{weakness}</span>
                        </li>
                      )) : (
                        <li className="text-slate-500 italic text-xs">Great job! Keep up the excellent work</li>
                      )}
                    </ul>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </div>

      {/* Learning Insights */}
      {exam.ai_feedback?.learning_patterns && exam.ai_feedback.learning_patterns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="shadow-lg border-0 overflow-hidden">
            <CardHeader 
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white cursor-pointer hover:brightness-110 transition-all py-3 px-4"
              onClick={() => toggleSection('insights')}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="w-4 h-4" />
                    Learning Insights
                  </CardTitle>
                  <p className="text-purple-100 text-xs mt-0.5">How you learn</p>
                </div>
                {sectionsExpanded.insights ? (
                  <ChevronUp className="w-4 h-4 text-white flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white flex-shrink-0" />
                )}
              </div>
            </CardHeader>
            <AnimatePresence>
              {sectionsExpanded.insights && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <CardContent className="p-3">
                    <div className="space-y-3">
                      {exam.ai_feedback.learning_patterns.map((pattern, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{getPatternIcon(pattern.pattern_type)}</span>
                            <span className="font-semibold text-slate-900 text-xs">{pattern.pattern_type}</span>
                          </div>
                          <p className="text-xs text-slate-700 mb-2">{pattern.what_it_means}</p>
                          <div className="bg-purple-50 px-2 py-1.5 rounded-lg border border-purple-200">
                            <p className="text-xs text-slate-700">{pattern.how_to_improve}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      )}



      {/* Question Breakdown */}
      {exam.questions && exam.feedback && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="shadow-lg border-0 overflow-hidden">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Question Breakdown</CardTitle>
              <p className="text-slate-600 text-xs mt-0.5">Review your answers</p>
            </CardHeader>
            
            <CardContent className="px-3 pb-3">
              <div className="space-y-2">
                {exam.feedback.map((feedback, idx) => {
                  const question = exam.questions[feedback.question_index];
                  const questionTime = getQuestionTime(feedback.question_index);
                  const isExpanded = expandedQuestions[idx];
                  
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`rounded-lg border overflow-hidden transition-all ${
                        feedback.is_correct 
                          ? 'border-emerald-200 bg-white' 
                          : 'border-amber-200 bg-white'
                      }`}
                    >
                      <div 
                        className={`p-3 cursor-pointer flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                          isExpanded ? 'border-b border-slate-100' : ''
                        }`}
                        onClick={() => toggleQuestion(idx)}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
                          feedback.is_correct 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-amber-500 text-white'
                        }`}>
                          {feedback.is_correct ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 text-xs mb-1">
                            Q{question.question_number}
                          </h4>
                          <p className="text-[10px] text-slate-600 mb-1.5 truncate">
                            {question.question_text}
                          </p>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                              {question.question_type}
                            </Badge>
                            <Badge className={`text-[9px] px-1.5 py-0 ${feedback.is_correct ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              {feedback.points_earned}/10
                            </Badge>
                            {questionTime > 0 && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-purple-50 text-purple-700">
                                <Clock className="w-2.5 h-2.5 mr-0.5" />
                                {formatTime(questionTime)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="text-slate-400 flex-shrink-0">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="p-3 bg-slate-50/30 space-y-2">
                              <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
                                <MathText className="text-slate-800 font-medium text-xs mb-2">
                                  {question.question_text}
                                </MathText>
                                {question.options && question.options.length > 0 && (
                                  <div className="mt-2 space-y-1 bg-slate-50 p-2 rounded-lg">
                                    {question.options.map((opt, i) => (
                                      <MathText key={i} className="text-xs text-slate-600 block py-0.5" inline>
                                        <span className="font-semibold w-5 inline-block">{String.fromCharCode(65 + i)}.</span> {opt}
                                      </MathText>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <div className="bg-blue-50 p-2 rounded-lg">
                                    <p className="text-[9px] font-bold text-blue-700 uppercase mb-0.5">Your Answer</p>
                                    <MathText className="text-xs text-slate-700 font-medium">
                                      {question.user_answer || "No answer"}
                                    </MathText>
                                  </div>
                                  <div className="bg-emerald-50 p-2 rounded-lg">
                                    <p className="text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Correct</p>
                                    <MathText className="text-xs text-slate-700 font-medium">
                                      {question.correct_answer}
                                    </MathText>
                                  </div>
                                </div>
                              </div>

                              <div className={`p-2 rounded-lg ${
                                feedback.is_correct ? 'bg-emerald-50' : 'bg-amber-50'
                              }`}>
                                <div className="flex items-start gap-2">
                                  {feedback.is_correct ? <Sparkles className="w-3.5 h-3.5 text-emerald-600 mt-0.5" /> : <Zap className="w-3.5 h-3.5 text-amber-600 mt-0.5" />}
                                  <div>
                                    <p className={`text-[10px] font-bold mb-0.5 ${feedback.is_correct ? 'text-emerald-800' : 'text-amber-800'}`}>
                                      {feedback.is_correct ? 'Excellent!' : 'Learning Opportunity'}
                                    </p>
                                    <MathText className="text-xs text-slate-700">
                                      {feedback.feedback}
                                    </MathText>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-purple-50 p-2 rounded-lg">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Brain className="w-3 h-3 text-purple-600" />
                                  <p className="text-[9px] font-bold text-purple-700 uppercase">Explanation</p>
                                </div>
                                <MathText className="text-xs text-slate-700 mb-2">
                                  {question.explanation}
                                </MathText>
                                <div className="flex flex-wrap gap-1">
                                  {question.assessed_competencies?.map((comp, i) => (
                                    <Badge key={i} variant="outline" className="bg-white text-purple-700 text-[9px] px-1.5 py-0">
                                      {comp}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}