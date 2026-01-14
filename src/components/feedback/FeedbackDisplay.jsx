import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, TrendingUp, CheckCircle, XCircle, Sparkles, TrendingDown, Target, MapPin, Clock, Brain, Zap, Eye, ChevronDown, ChevronUp, X, Rocket, Star } from "lucide-react";
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

export default function FeedbackDisplay({ exam, lesson, allExams = [], courseName }) {
  const [sectionsExpanded, setSectionsExpanded] = useState({
    strengths: false,
    weaknesses: false,
    insights: false,
    breakdown: true
  });
  // Default all questions to expanded
  const [expandedQuestions, setExpandedQuestions] = useState(() => {
    const expanded = {};
    if (exam?.feedback) {
      exam.feedback.forEach((_, idx) => { expanded[idx] = true; });
    }
    return expanded;
  });

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
    <div className="space-y-6 px-3 max-w-4xl mx-auto">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        {/* Intro Text */}
        <p className="text-sm text-slate-600">
          If your <span className="font-semibold text-slate-800">{courseName || lesson?.course_name || 'course'}</span> exam was today, you would score:
        </p>

        {/* Grade Badge */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring" }}
          className="relative inline-block"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-indigo-400 blur-2xl opacity-40 rounded-full" />
          <div className={`relative px-16 py-8 rounded-3xl bg-gradient-to-br ${getGradeColor(exam.predicted_grade)} shadow-2xl`}>
            <div className="text-7xl font-black text-white mb-2 drop-shadow-lg">
              {exam.predicted_grade}
            </div>
            <div className="text-xl text-white/90 font-semibold">
              {getPredictedScore()}
            </div>
          </div>
          <div className="absolute -top-3 -right-3 text-4xl animate-bounce">
            {getGradeEmoji(exam.predicted_grade)}
          </div>
        </motion.div>

        {/* Stats Grid - moved directly below grade */}
        <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
          <div className="flex items-center gap-2 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl px-4 py-3 shadow-sm">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <span className="font-bold text-slate-900">{Math.round(exam.total_score)}%</span>
          </div>
          <div className="flex items-center gap-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl px-4 py-3 shadow-sm">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-slate-900">{formatTime(exam.time_taken_seconds || 0)}</span>
          </div>
          <div className="flex items-center gap-2 bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl px-4 py-3 shadow-sm">
            <Award className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-slate-900">{exam.feedback?.filter(f => f.is_correct).length || 0}/{exam.questions?.length || 0}</span>
          </div>
        </div>

        {/* Summary - max 1 sentence */}
        {exam.ai_feedback?.overall_performance_summary_text && (
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {exam.ai_feedback.overall_performance_summary_text.split('.')[0]}.
          </p>
        )}
      </motion.div>

      {/* Key Insights - Minimal Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Strengths */}
        {strengths.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-0 shadow-lg bg-white overflow-hidden group hover:shadow-xl transition-all">
              <CardHeader className="pb-3 bg-gradient-to-br from-emerald-50 to-teal-50">
                <CardTitle className="flex items-center gap-2 text-emerald-700">
                  <Star className="w-5 h-5 fill-emerald-600" />
                  <span className="text-base font-bold">What You Nailed</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                {strengths.slice(0, 3).map((strength, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{strength}</span>
                  </div>
                ))}
                {strengths.length > 3 && (
                  <p className="text-xs text-slate-500 italic pt-1">+{strengths.length - 3} more strengths</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Growth Areas */}
        {weaknesses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-0 shadow-lg bg-white overflow-hidden group hover:shadow-xl transition-all">
              <CardHeader className="pb-3 bg-gradient-to-br from-purple-50 to-indigo-50">
                <CardTitle className="flex items-center gap-2 text-purple-700">
                  <Rocket className="w-5 h-5" />
                  <span className="text-base font-bold">Focus On This</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                {weaknesses.slice(0, 3).map((weakness, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                    <Target className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <span>{weakness}</span>
                  </div>
                ))}
                {weaknesses.length > 3 && (
                  <p className="text-xs text-slate-500 italic pt-1">+{weaknesses.length - 3} more areas</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Question Breakdown */}
      {exam.questions && exam.feedback && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-0 shadow-lg bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Eye className="w-5 h-5 text-indigo-600" />
                <span className="text-lg font-bold">Review Questions</span>
              </CardTitle>
              <p className="text-slate-500 text-xs mt-1">Tap any question to see details</p>
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
                      className={`rounded-xl border-2 overflow-hidden transition-all ${
                        feedback.is_correct 
                          ? 'border-emerald-200 bg-white' 
                          : 'border-amber-200 bg-white'
                      }`}
                    >
                      {/* Question Header - Always visible */}
                      <div 
                        className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                          isExpanded ? 'border-b border-slate-100' : ''
                        }`}
                        onClick={() => toggleQuestion(idx)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Status Icon */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
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
                            {/* Question Number & Score Row */}
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-900 text-sm">
                                Question {question.question_number}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${feedback.is_correct ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  {feedback.points_earned}/10
                                </span>
                                <div className="text-slate-400">
                                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </div>
                              </div>
                            </div>
                            
                            {/* Meta Tags Row */}
                            <div className="flex flex-wrap items-center gap-2">
                              {question.question_type && (
                                <Badge variant="outline" className="text-xs px-2 py-0.5 bg-slate-50 text-slate-600 border-slate-200">
                                  {question.question_type}
                                </Badge>
                              )}
                              {question.difficulty_index && (
                                <Badge variant="outline" className={`text-xs px-2 py-0.5 ${
                                  question.difficulty_index.toLowerCase() === 'hard' ? 'bg-red-50 text-red-600 border-red-200' :
                                  question.difficulty_index.toLowerCase() === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                  'bg-green-50 text-green-600 border-green-200'
                                }`}>
                                  {question.difficulty_index}
                                </Badge>
                              )}
                              {questionTime > 0 && (
                                <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {formatTime(questionTime)}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Competencies - Separate row for better hierarchy */}
                            {question.assessed_competencies && question.assessed_competencies.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {question.assessed_competencies.map((comp, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] px-2 py-0.5 bg-purple-50/50 text-purple-600 border-purple-200">
                                    {comp}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
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
                            <div className="p-4 bg-slate-50/50 space-y-4">
                              {/* Question Text */}
                              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Question</p>
                                <MathText className="text-slate-800 font-medium text-sm leading-relaxed">
                                  {question.question_text}
                                </MathText>
                                {question.options && question.options.length > 0 && (
                                  <div className="mt-3 space-y-2 bg-slate-50 p-3 rounded-lg">
                                    {question.options.map((opt, i) => {
                                      const optionText = typeof opt === 'string' ? opt : (opt?.text || JSON.stringify(opt));
                                      return (
                                        <MathText key={i} className="text-sm text-slate-700 block py-1" inline>
                                          <span className="font-bold w-6 inline-block text-slate-500">{String.fromCharCode(65 + i)}.</span> {optionText}
                                        </MathText>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Answers Comparison */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                  <p className="text-xs font-bold text-blue-700 uppercase mb-2">Your Answer</p>
                                  <MathText className="text-sm text-slate-800 font-medium">
                                    {question.user_answer || "No answer"}
                                  </MathText>
                                </div>
                                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                  <p className="text-xs font-bold text-emerald-700 uppercase mb-2">Correct Answer</p>
                                  <MathText className="text-sm text-slate-800 font-medium">
                                    {question.correct_answer}
                                  </MathText>
                                </div>
                              </div>

                              {/* Feedback */}
                              <div className={`p-4 rounded-xl ${
                                feedback.is_correct ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'
                              }`}>
                                <div className="flex items-start gap-3">
                                  {feedback.is_correct ? <Sparkles className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" /> : <Zap className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />}
                                  <div>
                                    <p className={`text-sm font-bold mb-1 ${feedback.is_correct ? 'text-emerald-800' : 'text-amber-800'}`}>
                                      {feedback.is_correct ? 'Excellent!' : 'Learning Opportunity'}
                                    </p>
                                    <MathText className="text-sm text-slate-700 leading-relaxed">
                                      {feedback.feedback}
                                    </MathText>
                                  </div>
                                </div>
                              </div>

                              {/* Explanation */}
                              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                <div className="flex items-center gap-2 mb-2">
                                  <Brain className="w-4 h-4 text-purple-600" />
                                  <p className="text-xs font-bold text-purple-700 uppercase">Full Explanation</p>
                                </div>
                                <MathText className="text-sm text-slate-700 leading-relaxed">
                                  {question.explanation}
                                </MathText>
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

      {/* Learning Insights */}
      {exam.ai_feedback?.learning_patterns && exam.ai_feedback.learning_patterns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Brain className="w-5 h-5 text-purple-600" />
                <span className="text-lg font-bold">How You Learn</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {exam.ai_feedback.learning_patterns.map((pattern, idx) => (
                <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{getPatternIcon(pattern.pattern_type)}</span>
                    <div className="flex-1 space-y-2">
                      <h4 className="font-bold text-sm text-slate-900">{pattern.pattern_type}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{pattern.what_it_means}</p>
                      <div className="bg-purple-50 px-3 py-2 rounded-lg">
                        <p className="text-xs text-slate-700 font-medium">💡 {pattern.how_to_improve}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}