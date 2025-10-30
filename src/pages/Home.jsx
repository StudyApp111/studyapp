import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, TrendingUp, Award, Clock, Zap, Sparkles } from "lucide-react";
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

  const { data: suggestedLessons = [] } = useQuery({
    queryKey: ['suggestedLessons'],
    queryFn: () => base44.entities.SuggestedLesson.list('-created_date', 10),
    initialData: [],
    enabled: !!user,
  });

  const completedLessons = lessons.filter(l => l.status === 'completed').length;
  const inProgressLessons = lessons.filter(l => l.status !== 'completed').length;
  const totalQuizzes = worksheets.length;
  const avgScore = worksheets.length > 0 
    ? Math.round(worksheets.reduce((sum, w) => sum + (w.total_score || 0), 0) / worksheets.length)
    : 0;

  // Group lessons by status for better organization
  const activeLessons = lessons.filter(l => l.status !== 'completed');
  const completedLessonsList = lessons.filter(l => l.status === 'completed');

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

      {/* Suggested Next Lessons Section */}
      {suggestedLessons.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-600" />
                Recommended for You
              </h2>
              <p className="text-slate-600 mt-1">AI-suggested lessons to reach 90%+ mastery</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suggestedLessons.slice(0, 3).map(suggestion => (
              <Card key={suggestion.id} className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <Sparkles className="w-8 h-8 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                      Recommended
                    </span>
                  </div>
                  <CardTitle className="text-xl text-slate-900">{suggestion.lesson_title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600 line-clamp-3">{suggestion.description}</p>
                  
                  <div className="flex gap-2 text-xs text-slate-500">
                    <span className="px-2 py-1 bg-slate-100 rounded">{suggestion.difficulty}</span>
                    <span className="px-2 py-1 bg-slate-100 rounded">{suggestion.estimated_duration}</span>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs text-amber-900">
                      <strong>Why?</strong> {suggestion.why_suggested}
                    </p>
                  </div>

                  <Button
                    onClick={() => navigate(createPageUrl("CreateLesson") + `?suggested=${suggestion.id}`)}
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
                  >
                    Start This Lesson
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active/In-Progress Lessons */}
      {activeLessons.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Continue Learning</h2>
              <p className="text-slate-600 mt-1">Pick up where you left off</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeLessons.map(lesson => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        </div>
      )}

      {/* All Lessons Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            {completedLessonsList.length > 0 ? 'Completed Lessons' : 'Your Lessons'}
          </h2>
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
        ) : completedLessonsList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedLessonsList.map(lesson => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-8">Complete a lesson to see it here!</p>
        )}
      </div>
    </div>
  );
}