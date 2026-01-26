import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, TrendingUp, CheckCircle, XCircle, Sparkles, Target, Clock, Brain, Zap, Eye, ChevronDown, ChevronUp, Rocket, Star, AlertCircle, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MathText from "../math/MathText";
import { useAITutor } from "../ai-tutor/AITutorContext";
import { useTheme } from "@/components/theme/ThemeProvider";

const formatTime = (seconds) => {
  if (!seconds) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

export default function FeedbackDisplay({ exam, lesson, allExams = [], courseName }) {
  const isPracticeExam = exam?.exam_type === 'practice';
  const { openWithContext } = useAITutor();
  const { isDark } = useTheme();
  
  const handleAskAI = (question, userAnswer, correctAnswer, isCorrect) => {
    const prompt = `I need help understanding this question from my exam:

**Question:** ${question.question_text}
${question.options?.length > 0 ? `\n**Options:**\n${question.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${typeof o === 'string' ? o : o?.text || o?.label || ''}`).join('\n')}` : ''}

**My Answer:** ${userAnswer || 'No answer provided'}
**Correct Answer:** ${correctAnswer}
**Result:** ${isCorrect ? 'Correct ✓' : 'Incorrect ✗'}

Please explain why ${isCorrect ? 'this answer is correct and what concept it tests' : 'my answer was wrong and help me understand the correct answer'}. Break it down step by step.`;
    
    // Dispatch event to AI panel (desktop) instead of modal
    window.dispatchEvent(new CustomEvent('askAIFromContext', { detail: { initialPrompt: prompt } }));
  };

  // Helper to get score color based on value
  const getScoreColor = (score) => {
    if (score >= 8) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 4.5) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  // Helper to get border color based on score
  const getBorderByScore = (score) => {
    if (score >= 8) return 'border-emerald-400 shadow-emerald-100';
    if (score >= 4.5) return 'border-amber-400 shadow-amber-100';
    return 'border-red-400 shadow-red-100';
  };

  const [sectionsExpanded, setSectionsExpanded] = useState({
    strengths: false,
    weaknesses: false,
    insights: false,
    breakdown: true
  });
  // Default all questions to expanded
  const [expandedQuestions, setExpandedQuestions] = useState(() => {
    const expanded = {};
    if (exam?.questions) {
      exam.questions.forEach((_, idx) => { expanded[idx] = true; });
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

  const strengths = exam.ai_feedback?.identified_strengths_list || [];
  const weaknesses = exam.ai_feedback?.key_areas_for_improvement_list || [];
  const futureWorksheets = exam.ai_feedback?.suggested_future_sessions_plan || [];
  const totalWorksheets = allExams.length || 6;

  // For practice exams, calculate correct count from questions
  // Note: is_correct is set during submission based on proper answer comparison
  const correctCount = isPracticeExam 
    ? (exam.correct_count ?? exam.questions?.filter(q => q.is_correct === true).length ?? 0)
    : (exam.feedback?.filter(f => f.is_correct).length || 0);
  const totalQuestions = exam.questions?.length || 0;

  // Practice Exam Results UI
  if (isPracticeExam) {
    return (
      <div className={`space-y-5 px-3 md:px-6 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto pb-8 ${isDark ? 'bg-[#0a0a12]' : ''}`}>
        {/* Compact Header Row */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('switchToStudyPlanTab'))}
            className={isDark ? "text-purple-400 hover:text-purple-300 hover:bg-purple-600/20 h-8 px-3" : "text-purple-600 hover:text-purple-700 hover:bg-purple-50 h-8 px-3"}
          >
            <Target className="w-3.5 h-3.5 mr-1.5" />
            <span className="text-xs">Study Plan</span>
          </Button>
          
          <Badge className={isDark ? "bg-blue-600/20 text-blue-300 text-[10px] px-2 py-0.5 border-blue-500/30" : "bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5"}>Practice Quiz</Badge>
        </div>

        {/* Practice Exam Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h2 className={`text-xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {exam.title || 'Practice Quiz Results'}
          </h2>

          {/* Score Display */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
            className="relative inline-block"
          >
            <div className="px-12 py-6 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-xl">
              <div className="text-5xl font-black text-white mb-1">
                {correctCount}/{totalQuestions}
              </div>
              <div className="text-sm text-white/80 font-medium">
                {Math.round((correctCount / totalQuestions) * 100)}% correct
              </div>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isDark ? 'bg-blue-600/20' : 'bg-blue-50'}`}>
              <Clock className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{formatTime(exam.time_taken_seconds || 0)}</span>
            </div>
          </div>

          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Practice exams don't affect your predicted grade
          </p>
        </motion.div>

        {/* Question Breakdown for Practice */}
        {exam.questions && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className={`border-0 shadow-lg ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
              <CardHeader className="pb-3">
                <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  <Eye className="w-5 h-5 text-blue-600" />
                  <span className="text-base font-bold">Question Review</span>
                </CardTitle>
              </CardHeader>
              
              <CardContent className="px-3 md:px-4 pb-3">
                <div className="space-y-3">
                  {exam.questions.map((question, idx) => {
                    // Use the stored is_correct value from submission grading
                    const isCorrect = question.is_correct === true;
                    const isExpanded = expandedQuestions[idx];
                    const aiScore = question.ai_score_out_of_10;
                    const hasAIScore = typeof aiScore === 'number';
                    
                    // Determine border color - use AI score if available, otherwise is_correct
                    const borderClass = hasAIScore 
                      ? getBorderByScore(aiScore)
                      : (isCorrect ? 'border-emerald-400 shadow-emerald-100' : 'border-red-400 shadow-red-100');
                    
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`rounded-xl border-[3px] overflow-hidden transition-all shadow-md ${borderClass}`}
                      >
                        <div 
                          className={`px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'border-b border-slate-100' : ''}`}
                          onClick={() => toggleQuestion(idx)}
                        >
                          <div className="flex items-center gap-2">
                            {/* Score/Status Icon - always show score if available */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              hasAIScore 
                                ? (aiScore >= 7 ? 'bg-emerald-500' : aiScore >= 4 ? 'bg-amber-500' : 'bg-red-500')
                                : (isCorrect ? 'bg-emerald-500' : 'bg-red-500')
                            } text-white`}>
                              {hasAIScore 
                                ? <span className="text-xs font-bold">{Math.round(aiScore)}</span>
                                : (isCorrect ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />)
                              }
                            </div>
                            
                            {/* Question Number */}
                            <span className="font-bold text-slate-900 text-sm">Q{idx + 1}</span>
                            
                            {/* Score Badge - always show for practice exams */}
                            <Badge className={`text-[10px] px-1.5 py-0 border ${hasAIScore ? getScoreColor(aiScore) : (isCorrect ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200')}`}>
                              {hasAIScore ? `${Math.round(aiScore)}/10` : (isCorrect ? '10/10' : '0/10')}
                            </Badge>
                            
                            {/* Difficulty Badge */}
                            {question.difficulty_index && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-purple-600 border-purple-200 bg-purple-50">
                                {question.difficulty_index}
                              </Badge>
                            )}
                            
                            {/* Spacer */}
                            <div className="flex-1" />
                            
                            {/* Ask AI Button - inline, same style as questions */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const ca = question.correct_answer;
                                let correctAnswerDisplay = ca;
                                if (/^[A-Da-d]$/i.test(ca?.trim())) {
                                  const letter = ca.trim().toUpperCase();
                                  const optIdx = letter.charCodeAt(0) - 65;
                                  const opt = question.options?.[optIdx];
                                  const optText = typeof opt === 'string' ? opt : (opt?.text || opt?.label || '');
                                  correctAnswerDisplay = `${letter}. ${optText.replace(/^[A-Da-d][\).\s]+\s*/g, '').trim()}`;
                                }
                                handleAskAI(question, question.user_answer, correctAnswerDisplay, isCorrect);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-full shadow-md hover:shadow-lg transition-all active:scale-95"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span className="hidden sm:inline">Ask AI</span>
                            </button>
                            
                            {/* Expand/Collapse */}
                            <div className={isDark ? "text-slate-500" : "text-slate-400"}>
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
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
                              <div className="p-3 bg-slate-50/50 space-y-3">
                                <div className="bg-white rounded-xl p-3 border border-slate-200">
                                  <MathText className="text-slate-800 font-medium text-xs leading-relaxed">
                                    {question.question_text}
                                  </MathText>
                                  {question.options && question.options.length > 0 && (
                                    <div className={`mt-2 space-y-1 p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                                      {question.options.map((opt, i) => {
                                        let optionText = '';
                                        if (typeof opt === 'string') {
                                          optionText = opt;
                                        } else if (opt && typeof opt === 'object') {
                                          optionText = opt.text || opt.label || opt.value || opt.content || JSON.stringify(opt);
                                        } else {
                                          optionText = String(opt);
                                        }
                                        return (
                                          <MathText key={i} className={`text-xs block py-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} inline>
                                            <span className={`font-bold w-5 inline-block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{String.fromCharCode(65 + i)}.</span> {optionText}
                                          </MathText>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-blue-50 p-2 rounded-xl border border-blue-100">
                                    <p className="text-[10px] font-bold text-blue-700 uppercase mb-1">Your Answer</p>
                                    <MathText className="text-xs text-slate-800 font-medium">
                                      {(() => {
                                        const ua = question.user_answer;
                                        if (!ua) return "No answer";
                                        // If user answer is an object, extract meaningful text
                                        if (typeof ua === 'object') {
                                          return ua.text || ua.label || ua.value || JSON.stringify(ua);
                                        }
                                        return ua;
                                      })()}
                                    </MathText>
                                  </div>
                                  <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                                    <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Answer</p>
                                    <MathText className="text-xs text-slate-800 font-medium">
                                      {(() => {
                                        const ca = question.correct_answer;
                                        if (!ca) return "N/A";
                                        if (/^[A-Da-d]$/i.test(String(ca).trim())) {
                                          const letter = String(ca).trim().toUpperCase();
                                          const idx = letter.charCodeAt(0) - 65;
                                          const opt = question.options?.[idx];
                                          let optText = '';
                                          if (typeof opt === 'string') {
                                            optText = opt;
                                          } else if (opt && typeof opt === 'object') {
                                            optText = opt.text || opt.label || opt.value || '';
                                          }
                                          const clean = optText.replace(/^[A-Da-d][\).\s]+\s*/g, '').trim();
                                          return `${letter}. ${clean}`;
                                        }
                                        return String(ca);
                                      })()}
                                    </MathText>
                                  </div>
                                </div>

                                {question.explanation && (
                                  <div className={`p-2.5 md:p-3 rounded-xl border ${isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-100'}`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <Brain className={`w-3 h-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                      <p className={`text-[10px] md:text-xs font-bold uppercase ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Explanation</p>
                                    </div>
                                    <MathText className={`text-xs md:text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                      {question.explanation}
                                    </MathText>
                                  </div>
                                )}

                                {/* AI Grading Details (rationale_short + misconception) */}
                                {(question.ai_rationale_short || question.ai_misconception_detected) && (
                                  <div className="flex flex-wrap gap-2">
                                    {question.ai_rationale_short && (
                                      <div className={`flex-1 min-w-[140px] px-2.5 py-2 rounded-lg border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                        <p className={`text-[9px] font-bold uppercase mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>AI Insight</p>
                                        <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{question.ai_rationale_short}</p>
                                      </div>
                                    )}
                                    {question.ai_misconception_detected && (
                                      <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                                        <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                                        <p className={`text-[11px] font-medium ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Misconception detected</p>
                                      </div>
                                    )}
                                  </div>
                                )}
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

  // Get confidence data
  const confidencePercent = exam.prediction_confidence || exam.ai_feedback?.prediction_confidence_percentage || 45;
  const confidenceLevel = exam.confidence_level || exam.ai_feedback?.confidence_level || 'Low';
  const masteryGap = exam.mastery_gap || exam.ai_feedback?.mastery_gap;

  // Official Exam Results UI (existing)
  return (
    <div className={`space-y-6 px-3 max-w-5xl mx-auto ${isDark ? 'bg-[#0a0a12]' : ''}`}>
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        {/* Intro Text */}
        <p className={`text-lg md:text-xl font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          If your <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{courseName || lesson?.course_name || 'course'}</span> exam was today, you would score:
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
          <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 shadow-sm ${isDark ? 'bg-gradient-to-br from-purple-600/20 to-purple-700/20' : 'bg-gradient-to-br from-purple-50 to-purple-100'}`}>
            <TrendingUp className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{Math.round(exam.total_score)}%</span>
          </div>
          <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 shadow-sm ${isDark ? 'bg-gradient-to-br from-blue-600/20 to-blue-700/20' : 'bg-gradient-to-br from-blue-50 to-blue-100'}`}>
            <Clock className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{formatTime(exam.time_taken_seconds || 0)}</span>
          </div>
          <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 shadow-sm ${isDark ? 'bg-gradient-to-br from-amber-600/20 to-amber-700/20' : 'bg-gradient-to-br from-amber-50 to-amber-100'}`}>
            <Award className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{exam.feedback?.filter(f => f.is_correct).length || 0}/{exam.questions?.length || 0}</span>
          </div>
        </div>

        {/* Confidence Meter Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-4 border border-slate-200 max-w-md mx-auto"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
              <span className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>AI Prediction Confidence</span>
            </div>
            <Badge className={`text-[10px] ${
              confidenceLevel === 'High' ? 'bg-emerald-100 text-emerald-700' :
              confidenceLevel === 'Medium' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {confidenceLevel} Data
            </Badge>
          </div>
          
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{confidencePercent}%</span>
            </div>
            <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
              <motion.div 
                className={`h-full rounded-full ${
                  confidenceLevel === 'High' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
                  confidenceLevel === 'Medium' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                  'bg-gradient-to-r from-red-500 to-rose-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${confidencePercent}%` }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
          </div>
          
          <div className={`flex items-start gap-2 rounded-xl p-2.5 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-slate-200'}`}>
            <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <p className={`text-xs leading-tight ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Complete study tasks to increase confidence to <span className={`font-bold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{Math.min(95, confidencePercent + 15)}%</span> and get a more accurate grade prediction.
            </p>
          </div>
        </motion.div>

        {/* Summary - max 1 sentence */}
        {exam.ai_feedback?.overall_performance_summary_text && (
          <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
            <Card className={`border-0 shadow-lg overflow-hidden group hover:shadow-xl transition-all ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
              <CardHeader className={`pb-3 ${isDark ? 'bg-gradient-to-br from-emerald-600/20 to-teal-600/20' : 'bg-gradient-to-br from-emerald-50 to-teal-50'}`}>
                <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  <Star className="w-5 h-5 fill-emerald-600" />
                  <span className="text-base font-bold">What You Nailed</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                {strengths.slice(0, 3).map((strength, idx) => (
                  <div key={idx} className={`flex items-start gap-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{strength}</span>
                  </div>
                ))}
                {strengths.length > 3 && (
                  <p className={`text-xs italic pt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>+{strengths.length - 3} more strengths</p>
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
            <Card className={`border-0 shadow-lg overflow-hidden group hover:shadow-xl transition-all ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
              <CardHeader className={`pb-3 ${isDark ? 'bg-gradient-to-br from-purple-600/20 to-indigo-600/20' : 'bg-gradient-to-br from-purple-50 to-indigo-50'}`}>
                <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                  <Rocket className="w-5 h-5" />
                  <span className="text-base font-bold">Focus On This</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                {weaknesses.slice(0, 3).map((weakness, idx) => (
                  <div key={idx} className={`flex items-start gap-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <Target className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <span>{weakness}</span>
                  </div>
                ))}
                {weaknesses.length > 3 && (
                  <p className={`text-xs italic pt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>+{weaknesses.length - 3} more areas</p>
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
          <Card className={`border-0 shadow-lg ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
            <CardHeader className="pb-3">
              <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                <Eye className="w-5 h-5 text-indigo-600" />
                <span className="text-lg font-bold">Review Questions</span>
              </CardTitle>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tap any question to see details</p>
            </CardHeader>
            
            <CardContent className="px-3 md:px-4 pb-3">
              <div className="space-y-3">
                {exam.feedback.map((feedback, idx) => {
                  const question = exam.questions[feedback.question_index];
                  const questionTime = getQuestionTime(feedback.question_index);
                  const isExpanded = expandedQuestions[idx];
                  const aiScore = question?.ai_score_out_of_10;
                  const hasAIScore = typeof aiScore === 'number';
                  
                  // Determine border color - use AI score if available, otherwise is_correct
                  const borderClass = hasAIScore 
                    ? getBorderByScore(aiScore)
                    : (feedback.is_correct ? 'border-emerald-400 shadow-emerald-100' : 'border-red-400 shadow-red-100');
                  
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`rounded-xl border-[3px] overflow-hidden transition-all shadow-md bg-white ${borderClass}`}
                    >
                      {/* Question Header - Compact single row */}
                      <div 
                        className={`px-3 py-2 cursor-pointer transition-colors ${
                          isExpanded ? (isDark ? 'border-b border-white/10' : 'border-b border-slate-100') : ''
                        } ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                        onClick={() => toggleQuestion(idx)}
                      >
                        <div className="flex items-center gap-2">
                          {/* Status Icon */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hasAIScore 
                              ? (aiScore >= 8 ? 'bg-emerald-500' : aiScore >= 4.5 ? 'bg-amber-500' : 'bg-red-500')
                              : (feedback.is_correct ? 'bg-emerald-500' : 'bg-red-500')
                          } text-white`}>
                            {hasAIScore ? (
                              <span className="text-xs font-bold">{aiScore}</span>
                            ) : feedback.is_correct ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </div>
                          
                          {/* Question Number */}
                          <span className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                            Q{question.question_number}
                          </span>
                          
                          {/* Score Badge */}
                          {hasAIScore ? (
                            <Badge className={`text-[10px] px-1.5 py-0 border ${getScoreColor(aiScore)}`}>
                              {aiScore}/10
                            </Badge>
                          ) : (
                            <Badge className={`text-[10px] px-1.5 py-0 border ${feedback.is_correct ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
                              {feedback.points_earned}/10
                            </Badge>
                          )}
                          
                          {/* Question Type */}
                          {question.question_type && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-600 border-slate-200 hidden sm:inline-flex">
                              {question.question_type}
                            </Badge>
                          )}
                          
                          {/* Difficulty */}
                          {question.difficulty_index && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-600 border-purple-200">
                              {question.difficulty_index}
                            </Badge>
                          )}
                          
                          {/* Time */}
                          {questionTime > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600 hidden sm:inline-flex">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatTime(questionTime)}
                            </Badge>
                          )}
                          
                          {/* Spacer */}
                          <div className="flex-1" />
                          
                          {/* Ask AI Button - same style as questions */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const ca = question.correct_answer;
                              let correctAnswerDisplay = ca;
                              if (/^[A-Da-d]$/i.test(ca?.trim())) {
                                const letter = ca.trim().toUpperCase();
                                const optIdx = letter.charCodeAt(0) - 65;
                                const opt = question.options?.[optIdx];
                                const optText = typeof opt === 'string' ? opt : (opt?.text || opt?.label || '');
                                correctAnswerDisplay = `${letter}. ${optText.replace(/^[A-Da-d][\).\s]+\s*/g, '').trim()}`;
                              }
                              handleAskAI(question, question.user_answer, correctAnswerDisplay, feedback.is_correct);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-full shadow-md hover:shadow-lg transition-all active:scale-95"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span className="hidden sm:inline">Ask AI</span>
                          </button>
                          
                          {/* Expand/Collapse */}
                          <div className={isDark ? "text-slate-500" : "text-slate-400"}>
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
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
                            <div className={`p-3 md:p-4 space-y-3 ${isDark ? 'bg-[#0a0a12]/50' : 'bg-slate-50/50'}`}>
                              {/* Question Text */}
                              <div className={`rounded-xl p-3 border shadow-sm ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                                <MathText className={`font-medium text-xs md:text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                  {question.question_text}
                                </MathText>
                                {question.options && question.options.length > 0 && (
                                  <div className={`mt-2 space-y-1 p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                                    {question.options.map((opt, i) => {
                                      let optionText = '';
                                      if (typeof opt === 'string') {
                                        optionText = opt;
                                      } else if (opt && typeof opt === 'object') {
                                        optionText = opt.text || opt.label || opt.value || opt.content || '';
                                      }
                                      if (!optionText) return null;
                                      return (
                                        <MathText key={i} className={`text-xs block py-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} inline>
                                          <span className={`font-bold w-5 inline-block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{String.fromCharCode(65 + i)}.</span> {optionText}
                                        </MathText>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Answers Comparison - Stacked on mobile */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className={`p-2 md:p-3 rounded-xl border ${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-100'}`}>
                                  <p className={`text-[10px] md:text-xs font-bold uppercase mb-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Your Answer</p>
                                  <MathText className={`text-xs md:text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {question.user_answer || "No answer"}
                                  </MathText>
                                </div>
                                <div className="bg-emerald-50 p-2 md:p-3 rounded-xl border border-emerald-100">
                                  <p className="text-[10px] md:text-xs font-bold text-emerald-700 uppercase mb-1">Correct</p>
                                  <MathText className="text-xs md:text-sm text-slate-800 font-medium">
                                    {(() => {
                                      const ca = question.correct_answer;
                                      if (/^[A-Da-d]$/i.test(ca?.trim())) {
                                        const letter = ca.trim().toUpperCase();
                                        const idx = letter.charCodeAt(0) - 65;
                                        const opt = question.options?.[idx];
                                        const optText = typeof opt === 'string' ? opt : (opt?.text || opt?.label || '');
                                        const clean = optText.replace(/^[A-Da-d][\).\s]+\s*/g, '').trim();
                                        return `${letter}. ${clean}`;
                                      }
                                      return ca;
                                    })()}
                                  </MathText>
                                </div>
                              </div>

                              {/* Feedback */}
                              <div className={`p-3 md:p-4 rounded-xl ${
                                feedback.is_correct ? (isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-100') : (isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-100')
                              }`}>
                                <div className="flex items-start gap-2">
                                  {feedback.is_correct ? <Sparkles className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} /> : <Zap className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-600'}`} />}
                                  <MathText className={`text-xs md:text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {feedback.feedback}
                                  </MathText>
                                </div>
                              </div>

                              {/* Explanation */}
                              <div className={`p-3 rounded-xl border ${isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-100'}`}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Brain className={`w-3.5 h-3.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                  <p className={`text-[10px] md:text-xs font-bold uppercase ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Explanation</p>
                                </div>
                                <MathText className={`text-xs md:text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                  {question.explanation}
                                </MathText>
                              </div>

                              {/* AI Grading Details (rationale_short + misconception) */}
                              {(question.ai_rationale_short || question.ai_misconception_detected) && (
                                <div className="flex flex-wrap gap-2">
                                  {question.ai_rationale_short && (
                                    <div className={`flex-1 min-w-[140px] px-2.5 py-2 rounded-lg border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                      <p className={`text-[9px] font-bold uppercase mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>AI Insight</p>
                                      <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{question.ai_rationale_short}</p>
                                    </div>
                                  )}
                                  {question.ai_misconception_detected && (
                                    <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                                      <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                                      <p className={`text-[11px] font-medium ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Misconception detected</p>
                                    </div>
                                  )}
                                </div>
                              )}
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