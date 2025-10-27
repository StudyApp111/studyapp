import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, TrendingUp, Award, Clock, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "../components/home/StatCard";
import LessonCard from "../components/home/LessonCard";

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

  const { data: worksheets = [] } = useQuery({
    queryKey: ['worksheets'],
    queryFn: () => base44.entities.Worksheet.list('-created_date'),
    initialData: [],
  });

  const completedLessons = lessons.filter(l => l.status === 'completed').length;
  const inProgressLessons = lessons.filter(l => l.status !== 'completed').length;
  const totalQuizzes = worksheets.length;
  const avgScore = worksheets.length > 0 
    ? Math.round(worksheets.reduce((sum, w) => sum + (w.total_score || 0), 0) / worksheets.length)
    : 0;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">
          Welcome back, {user.full_name?.split(' ')[0] || 'Learner'}! 👋
        </h1>
        <p className="text-slate-600 text-lg">Ready to continue your learning journey?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard
          title="Completed Lessons"
          value={completedLessons}
          icon={Award}
          gradient="from-purple-500 to-purple-700"
          trend="+12% this week"
        />
        <StatCard
          title="In Progress"
          value={inProgressLessons}
          icon={Clock}
          gradient="from-yellow-400 to-yellow-600"
        />
        <StatCard
          title="Quizzes Taken"
          value={totalQuizzes}
          icon={Zap}
          gradient="from-purple-600 to-purple-800"
        />
        <StatCard
          title="Average Score"
          value={`${avgScore}%`}
          icon={TrendingUp}
          gradient="from-yellow-500 to-amber-600"
          trend={avgScore >= 70 ? "Great job!" : "Keep practicing"}
        />
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Your Lessons</h2>
          <Button
            onClick={() => navigate(createPageUrl("CreateLesson"))}
            className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 shadow-lg shadow-purple-500/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Lesson
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <Card className="text-center py-16 bg-gradient-to-br from-purple-50 to-yellow-50 border-dashed border-2 border-purple-300">
            <CardContent>
              <BookOpen className="w-16 h-16 mx-auto text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No lessons yet</h3>
              <p className="text-slate-500 mb-6">Create your first lesson to begin your learning journey</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons.map(lesson => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}