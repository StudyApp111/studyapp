
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Award, TrendingUp, CheckCircle, XCircle, Sparkles, Home, TrendingDown, Target, BookOpen } from "lucide-react";
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
  const [suggestedLessons, setSuggestedLessons] = useState([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [strengths, setStrengths] = useState([]);
  const [weaknesses, setWeaknesses] = useState([]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');
    
    if (!lessonId) {
      navigate(createPageUrl("Home"));
      return;
    }

    loadFeedback(lessonId);
  }, [navigate]);

  const loadFeedback = async (lessonId) => {
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
        completed: true
      });
      
      if (worksheetData.length === 0) {
        navigate(createPageUrl("Worksheet") + `?lessonId=${lessonId}`);
        return;
      }
      setWorksheet(worksheetData[0]);

      // Analyze strengths and weaknesses
      analyzePerformance(worksheetData[0]);

      await base44.entities.Lesson.update(lessonId, {
        status: "completed"
      });

      const user = await base44.auth.me();
      await base44.auth.updateMe({
        total_lessons_completed: (user.total_lessons_completed || 0) + 1
      });
    } catch (error) {
      console.error("Error loading feedback:", error);
    }
    setIsLoading(false);
  };

  const analyzePerformance = (worksheetData) => {
    const correctAnswers = worksheetData.feedback.filter(f => f.is_correct);
    const incorrectAnswers = worksheetData.feedback.filter(f => !f.is_correct);

    // Identify strengths from assessed competencies of correct answers
    const strengthList = correctAnswers.slice(0, 3).map((f) => {
      const question = worksheetData.questions[f.question_index];
      return question.assessed_competencies?.[0] || `Mastered ${question.question_type}`;
    });

    // Identify weaknesses from misconceptions and assessed competencies
    const weaknessList = incorrectAnswers.slice(0, 3).map((f) => {
      const question = worksheetData.questions[f.question_index];
      return question.targeted_misconception || 
             question.assessed_competencies?.[0] || 
             `Need improvement in ${question.question_type}`;
    });

    setStrengths([...new Set(strengthList)]);
    setWeaknesses([...new Set(weaknessList)]);
  };

  const generateSuggestedLessons = async () => {
    setIsGeneratingSuggestions(true);
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });

      const aiPrompt = `
You are an expert learning path designer. Based on the student's performance, suggest 3 future lessons to help them achieve 90% or A+ grade.

Completed Course: ${lesson.course_name}
Curriculum: ${JSON.stringify(lesson.curriculum_map)}
Worksheet Score: ${worksheet.total_score}%
Predicted Grade: ${worksheet.predicted_grade}
Analysis Summary: ${JSON.stringify(worksheet.analysis_summary)}
Learner Profile: ${JSON.stringify(profile[0] || {})}

Suggest 3 lessons that will help this student reach 90%+ or A+ level. Focus on:
1. Addressing weaknesses identified in the analysis
2. Building on their current knowledge
3. Progressive difficulty that bridges gaps
4. Specific topics from the curriculum they struggled with

For each lesson, provide:
- Title (specific and actionable)
- Description (2-3 sentences explaining what they'll learn and why it matters)
- Difficulty level (Foundational Review, Intermediate Practice, or Advanced Mastery)
- Estimated duration (e.g., "45 minutes", "1 hour")
- 3-5 key topics it will cover
- Why it's suggested (personalized reasoning based on their weaknesses and the path to 90%)
`;

      const suggestions = await base44.integrations.Core.InvokeLLM({
        prompt: aiPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            lessons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  lesson_title: { type: "string" },
                  description: { type: "string" },
                  difficulty: { type: "string" },
                  estimated_duration: { type: "string" },
                  key_topics: { type: "array", items: { type: "string" } },
                  why_suggested: { type: "string" }
                }
              }
            }
          }
        }
      });

      const createdSuggestions = await Promise.all(
        suggestions.lessons.map(lesson =>
          base44.entities.SuggestedLesson.create({
            worksheet_id: worksheet.id,
            ...lesson
          })
        )
      );

      setSuggestedLessons(createdSuggestions);
    } catch (error) {
      console.error("Error generating suggestions:", error);
    }
    setIsGeneratingSuggestions(false);
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
    return '💪';
  };

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
            <span className="text-sm font-medium text-slate-700">Assessment Complete</span>
          </div>
          
          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            Your Predicted Grade
          </h1>
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`inline-block px-16 py-8 rounded-3xl bg-gradient-to-r ${getGradeColor(worksheet.predicted_grade)} shadow-2xl mb-4`}
          >
            <div className="text-8xl font-bold text-white mb-2">
              {worksheet.predicted_grade} {getGradeEmoji(worksheet.predicted_grade)}
            </div>
          </motion.div>

          <div className="flex items-center justify-center gap-6 text-slate-600 text-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <span className="font-semibold">{Math.round(worksheet.total_score)}%</span>
            </div>
            <div className="w-1 h-6 bg-slate-300 rounded-full" />
            <span>{worksheet.questions.length} Questions</span>
            <div className="w-1 h-6 bg-slate-300 rounded-full" />
            <span>{worksheet.feedback.filter(f => f.is_correct).length} Correct</span>
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

        {/* Suggested Next Lessons - Modal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <Card className="shadow-xl border-0 bg-gradient-to-r from-purple-500 to-purple-700 text-white">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <Sparkles className="w-6 h-6" />
                    Path to 90% & A+ Grade
                  </h3>
                  <p className="text-purple-100 text-lg">
                    Get personalized lesson recommendations to reach your target grade
                  </p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => suggestedLessons.length === 0 && generateSuggestedLessons()}
                      disabled={isGeneratingSuggestions}
                      size="lg"
                      className="bg-white text-purple-700 hover:bg-purple-50 shadow-xl"
                    >
                      {isGeneratingSuggestions ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-5 h-5 mr-2" />
                          View Roadmap
                        </>
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl flex items-center gap-2">
                        <Target className="w-6 h-6 text-purple-600" />
                        Your Learning Roadmap to A+
                      </DialogTitle>
                      <DialogDescription className="text-base">
                        Complete these lessons in order to strengthen your skills and achieve 90%+ mastery
                      </DialogDescription>
                    </DialogHeader>
                    
                    {suggestedLessons.length === 0 ? (
                      <div className="text-center py-12">
                        <Loader2 className="w-12 h-12 mx-auto animate-spin text-purple-600 mb-4" />
                        <p className="text-slate-600">Generating personalized learning path...</p>
                      </div>
                    ) : (
                      <div className="space-y-6 mt-6">
                        {suggestedLessons.map((suggestion, idx) => (
                          <motion.div
                            key={suggestion.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                          >
                            <Card className="border-2 border-purple-200 hover:border-purple-400 transition-colors">
                              <CardHeader>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white font-bold">
                                        {idx + 1}
                                      </div>
                                      <CardTitle className="text-xl">{suggestion.lesson_title}</CardTitle>
                                    </div>
                                    <div className="flex gap-2">
                                      <Badge variant="outline" className="bg-purple-50">
                                        {suggestion.difficulty}
                                      </Badge>
                                      <Badge variant="outline" className="bg-blue-50">
                                        {suggestion.estimated_duration}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <p className="text-slate-700 mb-4">{suggestion.description}</p>
                                
                                <div className="mb-4">
                                  <p className="text-sm font-semibold text-slate-600 mb-2">Key Topics:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {suggestion.key_topics?.map((topic, i) => (
                                      <Badge key={i} className="bg-purple-100 text-purple-800 border-purple-200">
                                        {topic}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>

                                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                                  <p className="text-sm text-amber-900">
                                    <strong className="flex items-center gap-2 mb-1">
                                      <Sparkles className="w-4 h-4" />
                                      Why this lesson?
                                    </strong>
                                    {suggestion.why_suggested}
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </motion.div>

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
