
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, TrendingUp, Award, Clock, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
// StatCard import removed as it's no longer used
import { motion } from "framer-motion";

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        if (!currentUser.onboarding_completed) {
          navigate(createPageUrl("Onboarding"));
        }
      } catch (error) {
        console.error("Error checking user:", error);
      }
    };
    
    checkOnboarding();
  }, [navigate]);

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: () => base44.entities.Lesson.list('-created_date'),
    initialData: [],
  });

  const { data: allWorksheets = [] } = useQuery({
    queryKey: ['worksheets'],
    queryFn: () => base44.entities.Worksheet.list('-created_date'),
    initialData: [],
  });

  // Group worksheets by lesson
  const lessonWorksheets = {};
  allWorksheets.forEach(w => {
    if (!lessonWorksheets[w.lesson_id]) {
      lessonWorksheets[w.lesson_id] = [];
    }
    lessonWorksheets[w.lesson_id].push(w);
  });

  // Calculate stats
  const completedWorksheets = allWorksheets.filter(w => w.completed).length;
  const inProgressWorksheets = allWorksheets.filter(w => w.status === "in_progress").length;
  const totalQuizzes = allWorksheets.filter(w => w.completed).length;
  const avgScore = totalQuizzes > 0
    ? Math.round(allWorksheets.filter(w => w.completed).reduce((sum, w) => sum + (w.total_score || 0), 0) / totalQuizzes)
    : 0;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  const SimpleLessonCard = ({ lesson }) => {
    const worksheets = (lessonWorksheets[lesson.id] || []).sort((a, b) => a.worksheet_number - b.worksheet_number);
    const completedCount = worksheets.filter(w => w.completed).length;
    const totalWorksheets = 6;
    const latestCompletedWorksheet = worksheets.filter(w => w.completed).pop();
    const progress = (completedCount / totalWorksheets) * 100;

    const handleClick = () => {
      navigate(createPageUrl("LessonDetail") + `?lessonId=${lesson.id}`);
    };

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        onClick={handleClick}
        className="cursor-pointer"
      >
        <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-lg relative overflow-hidden hover:scale-105">
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200">
            <div 
              className={`h-full transition-all duration-500 ${
                completedCount === totalWorksheets ? 'bg-emerald-500' : 
                completedCount > 0 ? 'bg-amber-500' :
                'bg-purple-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <CardHeader className="pb-4 pt-6">
            <div className="flex items-start justify-between mb-3">
              <BookOpen className={`w-8 h-8 ${
                completedCount === totalWorksheets ? 'text-emerald-600' :
                completedCount > 0 ? 'text-amber-600' :
                'text-purple-600'
              }`} />
              <Badge className={`${
                completedCount === totalWorksheets ? 'bg-emerald-100 text-emerald-700' :
                completedCount > 0 ? 'bg-amber-100 text-amber-700' :
                'bg-purple-100 text-purple-700'
              } border`}>
                {completedCount}/{totalWorksheets}
              </Badge>
            </div>
            <CardTitle className="text-xl text-slate-900">{lesson.course_name}</CardTitle>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Progress</span>
                  <span className="font-semibold text-slate-900">{completedCount} / {totalWorksheets} worksheets</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {latestCompletedWorksheet ? (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-yellow-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1">Current Predicted Grade</p>
                      <p className="text-3xl font-bold text-slate-900">{latestCompletedWorksheet.predicted_grade}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-600">Score</p>
                      <p className="text-xl font-bold text-purple-600">{Math.round(latestCompletedWorksheet.total_score)}%</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <p className="text-sm text-slate-500">No grade yet - start your first worksheet</p>
                </div>
              )}

              <div className="pt-2 text-center">
                <p className="text-xs text-slate-500">Click to view details →</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto">
      <div className="mb-6 md:mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
          Welcome back, {user.full_name?.split(' ')[0] || 'Learner'}! 👋
        </h1>
        <p className="text-slate-600 text-base md:text-lg">Ready to continue your learning journey?</p>
      </div>

      {/* Mobile-Optimized Stats - 2x2 Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-700 opacity-10" />
            <CardContent className="p-4 md:p-6 relative">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="p-2 md:p-3 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 shadow-lg">
                    <Award className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-xs md:text-sm font-medium text-slate-600 mb-1">Completed</p>
                  <p className="text-2xl md:text-3xl font-bold text-slate-900">{completedWorksheets}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-yellow-600 opacity-10" />
            <CardContent className="p-4 md:p-6 relative">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="p-2 md:p-3 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg">
                    <Clock className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-xs md:text-sm font-medium text-slate-600 mb-1">In Progress</p>
                  <p className="text-2xl md:text-3xl font-bold text-slate-900">{inProgressWorksheets}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-purple-800 opacity-10" />
            <CardContent className="p-4 md:p-6 relative">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="p-2 md:p-3 rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 shadow-lg">
                    <Zap className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-xs md:text-sm font-medium text-slate-600 mb-1">Total Tests</p>
                  <p className="text-2xl md:text-3xl font-bold text-slate-900">{totalQuizzes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-amber-600 opacity-10" />
            <CardContent className="p-4 md:p-6 relative">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="p-2 md:p-3 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 shadow-lg">
                    <TrendingUp className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-xs md:text-sm font-medium text-slate-600 mb-1">Avg Score</p>
                  <p className="text-2xl md:text-3xl font-bold text-slate-900">{avgScore}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Active Lessons</h2>
          <Button
            onClick={() => navigate(createPageUrl("CreateLesson"))}
            className="hidden md:flex bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 shadow-lg shadow-purple-500/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Lesson
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : lessons.length === 0 ? (
          <Card className="text-center py-12 md:py-16 bg-gradient-to-br from-purple-50 to-yellow-50 border-dashed border-2 border-purple-300">
            <CardContent>
              <BookOpen className="w-12 h-12 md:w-16 md:h-16 mx-auto text-purple-500 mb-4" />
              <h3 className="text-lg md:text-xl font-semibold text-slate-700 mb-2">No lessons yet</h3>
              <p className="text-sm md:text-base text-slate-500 mb-6">Create your first lesson to begin your learning journey</p>
              <Button
                onClick={() => navigate(createPageUrl("CreateLesson"))}
                className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Lesson
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {lessons.map(lesson => (
              <SimpleLessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
