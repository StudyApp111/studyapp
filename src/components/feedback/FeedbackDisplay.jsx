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
    <div className="space-y-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg mb-6">
          <Award className="w-5 h-5 text-purple-600" />
          <span className="text-sm font-medium text-slate-700">Exam {exam.exam_number} Complete</span>
        </div>
        
        <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
          Your Predicted Grade
        </h1>
        
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-block"
        >
          <div className={`px-16 py-8 rounded-3xl bg-gradient-to-r ${getGradeColor(exam.predicted_grade)} shadow-2xl mb-4`}>
            <div className="text-8xl font-bold text-white mb-2">
              {exam.predicted_grade} {getGradeEmoji(exam.predicted_grade)}
            </div>
            <div className="text-2xl text-white font-semibold">
              {getPredictedScore()}
            </div>
          </div>
        </motion.div>

        {exam.ai_feedback?.overall_performance_summary_text && (
          <p className="text-lg text-slate-700 max-w-3xl mx-auto mt-6 leading-relaxed">
            {exam.ai_feedback.overall_performance_summary_text}
          </p>
        )}

        {exam.ai_feedback?.prediction_calculation_rationale && (
          <div className="mt-6 max-w-3xl mx-auto">
            <details className="bg-white rounded-lg p-4 shadow">
              <summary className="cursor-pointer font-semibold text-purple-700 hover:text-purple-900">
                How was this grade calculated?
              </summary>
              <p className="mt-3 text-sm text-slate-600 text-left">
                {exam.ai_feedback.prediction_calculation_rationale}
              </p>
            </details>
          </div>
        )}

        <div className="flex items-center justify-center gap-6 text-slate-600 text-lg mt-6 flex-wrap">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <span className="font-semibold">{Math.round(exam.total_score)}%</span>
          </div>
          <div className="w-1 h-6 bg-slate-300 rounded-full" />
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-700" />
            <span className="font-semibold">{formatTime(exam.time_taken_seconds || 0)}</span>
          </div>
          <div className="w-1 h-6 bg-slate-300 rounded-full" />
          <span>Exam {exam.exam_number} of {totalWorksheets}</span>
          <div className="w-1 h-6 bg-slate-300 rounded-full" />
          <span>{exam.feedback?.filter(f => f.is_correct).length || 0} Correct</span>
        </div>
      </motion.div>

      {/* Strengths & Weaknesses */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="shadow-xl border-0 h-full bg-gradient-to-br from-emerald-50 to-teal-50/50 overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-emerald-100/50 transition-colors"
              onClick={() => toggleSection('strengths')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-emerald-700 text-lg">
                  <TrendingUp className="w-5 h-5" />
                  Your Strengths
                </CardTitle>
                {sectionsExpanded.strengths ? (
                  <ChevronUp className="w-5 h-5 text-emerald-700" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-emerald-700" />
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
                  <CardContent>
                    <ul className="space-y-3">
                      {strengths.length > 0 ? strengths.map((strength, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700 text-sm">{strength}</span>
                        </li>
                      )) : (
                        <li className="text-slate-500 italic text-sm">Complete more questions to identify strengths</li>
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
          <Card className="shadow-xl border-0 h-full bg-gradient-to-br from-amber-50 to-orange-50/50 overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-amber-100/50 transition-colors"
              onClick={() => toggleSection('weaknesses')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-amber-700 text-lg">
                  <TrendingDown className="w-5 h-5" />
                  Areas for Improvement
                </CardTitle>
                {sectionsExpanded.weaknesses ? (
                  <ChevronUp className="w-5 h-5 text-amber-700" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-amber-700" />
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
                  <CardContent>
                    <ul className="space-y-3">
                      {weaknesses.length > 0 ? weaknesses.map((weakness, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <Target className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700 text-sm">{weakness}</span>
                        </li>
                      )) : (
                        <li className="text-slate-500 italic text-sm">Great job! Keep up the excellent work</li>
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
          <Card className="shadow-xl border-0 overflow-hidden">
            <CardHeader 
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white cursor-pointer hover:brightness-110 transition-all"
              onClick={() => toggleSection('insights')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Brain className="w-6 h-6" />
                    Learning Insights
                  </CardTitle>
                  <p className="text-purple-100 text-sm mt-1">Understanding how you learn helps you improve faster</p>
                </div>
                {sectionsExpanded.insights ? (
                  <ChevronUp className="w-6 h-6 text-white" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-white" />
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
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-6 py-4 font-semibold text-slate-700">Pattern Type</th>
                            <th className="text-left px-6 py-4 font-semibold text-slate-700">What It Means</th>
                            <th className="text-left px-6 py-4 font-semibold text-slate-700">How to Improve</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exam.ai_feedback.learning_patterns.map((pattern, idx) => (
                            <tr 
                              key={idx} 
                              className={`border-b border-slate-100 hover:bg-purple-50/30 transition-colors ${
                                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                              }`}
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">{getPatternIcon(pattern.pattern_type)}</span>
                                  <span className="font-semibold text-slate-900">{pattern.pattern_type}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-700">{pattern.what_it_means}</td>
                              <td className="px-6 py-4 text-slate-700">
                                <div className="bg-purple-50 px-3 py-2 rounded-lg border border-purple-200">
                                  {pattern.how_to_improve}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      )}

      {/* Roadmap CTA */}
      {futureWorksheets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="shadow-xl border-0 bg-gradient-to-br from-purple-600 to-indigo-700 text-white overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-6 h-6" />
                    <h3 className="text-3xl font-bold">Your Roadmap to 90%+</h3>
                  </div>
                  <p className="text-purple-100 text-lg">
                    {futureWorksheets.length} personalized session{futureWorksheets.length > 1 ? 's' : ''} to master this subject
                  </p>
                </div>
                <Button
                  onClick={() => setShowRoadmapModal(true)}
                  size="lg"
                  className="bg-white text-purple-700 hover:bg-purple-50 shadow-xl font-semibold"
                >
                  <MapPin className="w-5 h-5 mr-2" />
                  View Learning Path
                </Button>
              </div>
            </CardContent>
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
          <Card className="shadow-2xl border-0 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-2xl">Question-by-Question Breakdown</CardTitle>
              <p className="text-slate-600 text-sm mt-1">Review your answers and learn from detailed feedback</p>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-3">
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
                          ? 'border-emerald-100 bg-white' 
                          : 'border-amber-100 bg-white'
                      }`}
                    >
                      <div 
                        className={`p-4 cursor-pointer flex items-center gap-4 hover:bg-slate-50 transition-colors ${
                          isExpanded ? 'border-b border-slate-100' : ''
                        }`}
                        onClick={() => toggleQuestion(idx)}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
                          feedback.is_correct 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-amber-500 text-white'
                        }`}>
                          {feedback.is_correct ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <XCircle className="w-5 h-5" />
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-slate-900">
                              Question {question.question_number}
                            </h4>
                            
                            <div className="flex gap-1.5 flex-wrap">
                              <Badge variant="secondary" className="text-xs">{question.question_type}</Badge>
                              <Badge variant="secondary" className="text-xs">{question.difficulty_index}</Badge>
                              <Badge className={`text-xs ${feedback.is_correct ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                {feedback.points_earned}/10 pts
                              </Badge>
                              {questionTime > 0 && (
                                <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {formatTime(questionTime)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-slate-400">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
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
                            <div className="p-6 bg-slate-50/30 space-y-4">
                              <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                                <MathText className="text-slate-800 font-medium mb-3">
                                  {question.question_text}
                                </MathText>
                                {question.options && question.options.length > 0 && (
                                  <div className="mt-3 space-y-1 bg-slate-50 p-3 rounded-lg">
                                    {question.options.map((opt, i) => (
                                      <MathText key={i} className="text-sm text-slate-600 block py-1" inline>
                                        <span className="font-semibold w-6 inline-block">{String.fromCharCode(65 + i)}.</span> {opt}
                                      </MathText>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                  <div className="bg-blue-50 p-3 rounded-lg">
                                    <p className="text-xs font-bold text-blue-700 uppercase mb-1">Your Answer</p>
                                    <MathText className="text-sm text-slate-700 font-medium">
                                      {question.user_answer || "No answer"}
                                    </MathText>
                                  </div>
                                  <div className="bg-emerald-50 p-3 rounded-lg">
                                    <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Correct Answer</p>
                                    <MathText className="text-sm text-slate-700 font-medium">
                                      {question.correct_answer}
                                    </MathText>
                                  </div>
                                </div>
                              </div>

                              <div className={`p-4 rounded-lg ${
                                feedback.is_correct ? 'bg-emerald-50' : 'bg-amber-50'
                              }`}>
                                <div className="flex items-start gap-3">
                                  {feedback.is_correct ? <Sparkles className="w-5 h-5 text-emerald-600 mt-0.5" /> : <Zap className="w-5 h-5 text-amber-600 mt-0.5" />}
                                  <div>
                                    <p className={`text-sm font-bold mb-1 ${feedback.is_correct ? 'text-emerald-800' : 'text-amber-800'}`}>
                                      {feedback.is_correct ? 'Excellent work!' : 'Learning Opportunity'}
                                    </p>
                                    <MathText className="text-sm text-slate-700">
                                      {feedback.feedback}
                                    </MathText>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-purple-50 p-4 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <Brain className="w-4 h-4 text-purple-600" />
                                  <p className="text-xs font-bold text-purple-700 uppercase">Explanation & Key Concepts</p>
                                </div>
                                <MathText className="text-sm text-slate-700 mb-3">
                                  {question.explanation}
                                </MathText>
                                <div className="flex flex-wrap gap-2">
                                  {question.assessed_competencies?.map((comp, i) => (
                                    <Badge key={i} variant="outline" className="bg-white text-purple-700">
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