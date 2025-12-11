import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { 
  TrendingUp, Clock, Target, Brain, Award, Download, 
  BookOpen, CheckCircle, Zap, Activity, Lightbulb, Eye
} from "lucide-react";
import { motion } from "framer-motion";

const COLORS = ['#8b5cf6', '#eab308', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'];

export default function LearningProgress() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const { data: worksheets = [] } = useQuery({
    queryKey: ['all-worksheets'],
    queryFn: () => base44.entities.Worksheet.list('-created_date'),
    initialData: [],
  });

  const { data: diagnosticQuizzes = [] } = useQuery({
    queryKey: ['all-diagnostics'],
    queryFn: () => base44.entities.DiagnosticQuiz.list('-created_date'),
    initialData: [],
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ['all-lessons'],
    queryFn: () => base44.entities.Lesson.list('-created_date'),
    initialData: [],
  });

  // Compute analytics
  const completedWorksheets = worksheets.filter(w => w.completed);
  const totalTimeSpent = completedWorksheets.reduce((sum, w) => sum + (w.time_taken_seconds || 0), 0);
  const avgScore = completedWorksheets.length > 0
    ? Math.round(completedWorksheets.reduce((sum, w) => sum + (w.total_score || 0), 0) / completedWorksheets.length)
    : 0;

  // Score progression over time
  const scoreProgression = completedWorksheets.map((w, idx) => ({
    name: `W${idx + 1}`,
    score: Math.round(w.total_score || 0),
    date: new Date(w.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  // Grade distribution
  const gradeDistribution = {};
  completedWorksheets.forEach(w => {
    const grade = w.predicted_grade || 'N/A';
    gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
  });
  const gradeData = Object.entries(gradeDistribution).map(([grade, count]) => ({
    name: grade,
    value: count
  }));

  // Competency mastery analysis
  const competencyMastery = {};
  completedWorksheets.forEach(w => {
    if (w.questions) {
      w.questions.forEach(q => {
        if (q.assessed_competencies) {
          q.assessed_competencies.forEach(comp => {
            if (!competencyMastery[comp]) {
              competencyMastery[comp] = { correct: 0, total: 0 };
            }
            competencyMastery[comp].total++;
            if (q.is_correct) competencyMastery[comp].correct++;
          });
        }
      });
    }
  });
  const competencyData = Object.entries(competencyMastery)
    .map(([name, data]) => ({
      subject: name.length > 30 ? name.substring(0, 30) + '...' : name,
      mastery: Math.round((data.correct / data.total) * 100)
    }))
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 8);

  // Reasoning method analysis from diagnostic quizzes
  const reasoningMethods = {};
  diagnosticQuizzes.forEach(quiz => {
    if (quiz.question_metadata) {
      quiz.question_metadata.forEach(meta => {
        const method = meta.reasoning_method || 'Unknown';
        if (!reasoningMethods[method]) {
          reasoningMethods[method] = { correct: 0, total: 0 };
        }
        reasoningMethods[method].total++;
        
        const qIndex = meta.question_index;
        if (quiz.user_answers && quiz.questions && quiz.questions[qIndex]) {
          if (quiz.user_answers[qIndex] === quiz.questions[qIndex].correct_answer) {
            reasoningMethods[method].correct++;
          }
        }
      });
    }
  });
  const reasoningData = Object.entries(reasoningMethods).map(([method, data]) => ({
    name: method,
    accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    count: data.total
  }));

  // Confidence vs accuracy analysis
  const confidenceAnalysis = { High: { correct: 0, total: 0 }, Medium: { correct: 0, total: 0 }, Low: { correct: 0, total: 0 } };
  diagnosticQuizzes.forEach(quiz => {
    if (quiz.question_metadata) {
      quiz.question_metadata.forEach(meta => {
        const conf = meta.confidence_level || 'Medium';
        const qIndex = meta.question_index;
        
        if (confidenceAnalysis[conf]) {
          confidenceAnalysis[conf].total++;
          if (quiz.user_answers && quiz.questions && quiz.questions[qIndex]) {
            if (quiz.user_answers[qIndex] === quiz.questions[qIndex].correct_answer) {
              confidenceAnalysis[conf].correct++;
            }
          }
        }
      });
    }
  });
  const confidenceData = Object.entries(confidenceAnalysis).map(([level, data]) => ({
    confidence: level,
    accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
  }));

  // Time per question analysis
  const avgTimePerQuestion = completedWorksheets.length > 0
    ? Math.round(totalTimeSpent / completedWorksheets.reduce((sum, w) => sum + (w.questions?.length || 0), 0))
    : 0;

  // Learning patterns insights
  const allLearningPatterns = [];
  completedWorksheets.forEach(w => {
    if (w.ai_feedback?.learning_patterns) {
      allLearningPatterns.push(...w.ai_feedback.learning_patterns);
    }
  });

  // Strengths and weaknesses
  const allStrengths = [];
  const allWeaknesses = [];
  completedWorksheets.forEach(w => {
    if (w.ai_feedback?.identified_strengths_list) {
      allStrengths.push(...w.ai_feedback.identified_strengths_list);
    }
    if (w.ai_feedback?.key_areas_for_improvement_list) {
      allWeaknesses.push(...w.ai_feedback.key_areas_for_improvement_list);
    }
  });

  const formatTime = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleExport = () => {
    const reportData = {
      student: user?.full_name || 'Student',
      email: user?.email,
      generatedDate: new Date().toLocaleDateString(),
      summary: {
        totalWorksheets: completedWorksheets.length,
        averageScore: avgScore,
        totalTimeSpent: formatTime(totalTimeSpent),
        currentLevel: user?.level || 1,
        totalPoints: user?.total_points || 0,
        currentStreak: user?.current_streak || 0
      },
      scoreProgression,
      competencyMastery: competencyData,
      reasoningMethods: reasoningData,
      confidenceAnalysis: confidenceData,
      recentStrengths: allStrengths.slice(-5),
      recentWeaknesses: allWeaknesses.slice(-5),
      learningPatterns: allLearningPatterns.slice(-3)
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `learning-progress-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Activity className="w-8 h-8 md:w-10 md:h-10 text-purple-600" />
            Learning Progress
          </h1>
          <p className="text-slate-600">Track your journey and understand how you learn best</p>
        </div>
        <Button
          onClick={handleExport}
          className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 gap-2"
        >
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Key Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-6 h-6 text-purple-600" />
                <Badge className="bg-purple-600 text-white">Total</Badge>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-slate-900">{completedWorksheets.length}</p>
              <p className="text-xs md:text-sm text-slate-600">Worksheets Completed</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-yellow-100">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-6 h-6 text-amber-600" />
                <Badge className="bg-amber-600 text-white">Average</Badge>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-slate-900">{avgScore}%</p>
              <p className="text-xs md:text-sm text-slate-600">Overall Score</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-6 h-6 text-blue-600" />
                <Badge className="bg-blue-600 text-white">Time</Badge>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-slate-900">{formatTime(totalTimeSpent)}</p>
              <p className="text-xs md:text-sm text-slate-600">Study Time</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-6 h-6 text-emerald-600" />
                <Badge className="bg-emerald-600 text-white">Level</Badge>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-slate-900">{user.level || 1}</p>
              <p className="text-xs md:text-sm text-slate-600">{user.total_points || 0} Points</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs for different analytics views */}
      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="mastery">Mastery</TabsTrigger>
          <TabsTrigger value="learning">Learning Style</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Score Progression Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scoreProgression.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={scoreProgression}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={3} name="Score %" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-500">
                  <p>Complete worksheets to see your progress</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" />
                  Grade Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gradeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={gradeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {gradeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    <p>No grades yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Time Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">Average per Question</p>
                    <p className="text-2xl font-bold text-blue-700">{avgTimePerQuestion}s</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">Total Study Sessions</p>
                    <p className="text-2xl font-bold text-purple-700">{completedWorksheets.length}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">Questions Answered</p>
                    <p className="text-2xl font-bold text-emerald-700">{user.questions_completed || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Mastery Tab */}
        <TabsContent value="mastery" className="space-y-6">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                Competency Mastery Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {competencyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={competencyData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="subject" type="category" width={150} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="mastery" fill="#8b5cf6" name="Mastery %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-96 flex items-center justify-center text-slate-500">
                  <p>Complete worksheets to see competency mastery</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Strengths and Weaknesses */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-emerald-50 to-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle className="w-5 h-5" />
                  Top Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allStrengths.length > 0 ? (
                  <ul className="space-y-2">
                    {allStrengths.slice(-5).reverse().map((strength, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-emerald-600 mt-0.5">✓</span>
                        <span className="text-slate-700">{strength}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 text-sm">Complete worksheets to identify strengths</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-gradient-to-br from-amber-50 to-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <Target className="w-5 h-5" />
                  Areas for Growth
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allWeaknesses.length > 0 ? (
                  <ul className="space-y-2">
                    {allWeaknesses.slice(-5).reverse().map((weakness, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-amber-600 mt-0.5">→</span>
                        <span className="text-slate-700">{weakness}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 text-sm">Complete worksheets to identify growth areas</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Learning Style Tab */}
        <TabsContent value="learning" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  Reasoning Method Effectiveness
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reasoningData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reasoningData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="accuracy" fill="#8b5cf6" name="Accuracy %" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-80 flex items-center justify-center text-slate-500">
                    <p>Complete diagnostic quizzes to see reasoning analysis</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-600" />
                  Confidence vs Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                {confidenceData.length > 0 && confidenceData.some(d => d.accuracy > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={confidenceData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="confidence" />
                      <PolarRadiusAxis domain={[0, 100]} />
                      <Radar name="Accuracy %" dataKey="accuracy" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-80 flex items-center justify-center text-slate-500">
                    <p>Complete diagnostic quizzes to see confidence analysis</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-purple-600" />
                AI-Identified Learning Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allLearningPatterns.length > 0 ? (
                <div className="space-y-4">
                  {allLearningPatterns.slice(-3).reverse().map((pattern, idx) => (
                    <div key={idx} className="p-4 bg-white rounded-lg border border-purple-200">
                      <h4 className="font-semibold text-purple-900 mb-2">{pattern.pattern_type}</h4>
                      <p className="text-sm text-slate-700 mb-2">{pattern.what_it_means}</p>
                      <div className="mt-2 p-3 bg-purple-50 rounded">
                        <p className="text-sm text-purple-800">
                          <strong>How to improve:</strong> {pattern.how_to_improve}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <Brain className="w-12 h-12 mb-4 text-slate-300" />
                  <p>Complete worksheets to unlock personalized learning insights</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional insights */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6 text-center">
                <BookOpen className="w-8 h-8 text-purple-600 mx-auto mb-3" />
                <p className="text-2xl font-bold text-slate-900">{lessons.length}</p>
                <p className="text-sm text-slate-600">Total Lessons</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6 text-center">
                <Award className="w-8 h-8 text-amber-600 mx-auto mb-3" />
                <p className="text-2xl font-bold text-slate-900">{user.badges?.length || 0}</p>
                <p className="text-sm text-slate-600">Badges Earned</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6 text-center">
                <Zap className="w-8 h-8 text-orange-600 mx-auto mb-3" />
                <p className="text-2xl font-bold text-slate-900">{user.current_streak || 0}</p>
                <p className="text-sm text-slate-600">Day Streak</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}