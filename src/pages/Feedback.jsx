
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Award, TrendingUp, CheckCircle, XCircle, Sparkles, Home } from "lucide-react";
import { motion } from "framer-motion";

export default function Feedback() {
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [worksheet, setWorksheet] = useState(null);
  const [suggestedLessons, setSuggestedLessons] = useState([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  const generateSuggestedLessons = async () => {
    setIsGeneratingSuggestions(true);
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });

      const aiPrompt = `
You are an expert learning path designer. Based on the student's performance, suggest 3 future lessons.

Completed Course: ${lesson.course_name}
Curriculum: ${JSON.stringify(lesson.curriculum_map)}
Worksheet Score: ${worksheet.total_score}%
Predicted Grade: ${worksheet.predicted_grade}
Learner Profile: ${JSON.stringify(profile[0] || {})}

Suggest 3 lessons that:
1. Build on what they've learned
2. Address areas where they struggled (if score < 80%)
3. Match their interests and learning style
4. Are appropriate for their skill level

For each lesson, provide:
- Title
- Description (2-3 sentences)
- Difficulty level
- Estimated duration
- 3-5 key topics it will cover
- Why it's suggested (personalized reasoning)
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  const getGradeColor = (grade) => {
    if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
    if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
    if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-pink-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center shadow-2xl">
            <Award className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Worksheet Complete! 🎉</h1>
          <p className="text-slate-600 text-lg">Here's your detailed feedback and results</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-2xl border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Your Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <div className="text-6xl font-bold text-purple-600 mb-2">
                  {Math.round(worksheet.total_score)}%
                </div>
                <div className={`inline-block px-6 py-3 rounded-full bg-gradient-to-r ${getGradeColor(worksheet.predicted_grade)} shadow-xl mb-4`}>
                  <span className="text-3xl font-bold text-white">{worksheet.predicted_grade}</span>
                </div>
                <p className="text-slate-600">Predicted Grade</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xl border-0">
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Total Questions</span>
                  <span className="font-bold text-slate-900">{worksheet.questions.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Correct Answers</span>
                  <span className="font-bold text-emerald-600">
                    {worksheet.feedback.filter(f => f.is_correct).length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Points Earned</span>
                  <span className="font-bold text-indigo-600">
                    {worksheet.feedback.reduce((sum, f) => sum + f.points_earned, 0)} / {worksheet.questions.reduce((sum, q) => sum + q.points, 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-2xl border-0 mb-8">
          <CardHeader>
            <CardTitle>Detailed Feedback</CardTitle>
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
                    transition={{ delay: idx * 0.1 }}
                    className={`p-5 rounded-xl border-2 ${
                      feedback.is_correct 
                        ? 'border-emerald-200 bg-emerald-50/50' 
                        : 'border-amber-200 bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {feedback.is_correct ? (
                        <CheckCircle className="w-6 h-6 text-emerald-600 mt-0.5" />
                      ) : (
                        <XCircle className="w-6 h-6 text-amber-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-slate-900">Question {feedback.question_index + 1}</h4>
                          <Badge variant="outline">
                            {feedback.points_earned}/{question.points} pts
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700 mb-2">{question.question}</p>
                        <div className="bg-white rounded-lg p-3 border">
                          <p className="text-sm text-slate-600">{feedback.feedback}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Suggested Next Steps
              </CardTitle>
              {suggestedLessons.length === 0 && (
                <Button
                  onClick={generateSuggestedLessons}
                  disabled={isGeneratingSuggestions}
                  className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
                >
                  {isGeneratingSuggestions ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Suggestions
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {suggestedLessons.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                Click "Generate Suggestions" to get personalized lesson recommendations based on your performance
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {suggestedLessons.map((suggestion, idx) => (
                  <motion.div
                    key={suggestion.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <Card className="h-full hover:shadow-xl transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg">{suggestion.lesson_title}</CardTitle>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">{suggestion.difficulty}</Badge>
                          <Badge variant="outline">{suggestion.estimated_duration}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-600 mb-4">{suggestion.description}</p>
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-slate-500 mb-2">Key Topics:</p>
                          <div className="flex flex-wrap gap-1">
                            {suggestion.key_topics?.slice(0, 3).map((topic, i) => (
                              <Badge key={i} className="text-xs bg-indigo-100 text-indigo-700">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-600">
                            <strong>Why?</strong> {suggestion.why_suggested}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <Button
            onClick={() => navigate(createPageUrl("Home"))}
            size="lg"
            className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black"
          >
            <Home className="w-5 h-5 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
