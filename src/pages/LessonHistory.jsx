import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Award, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function LessonHistory() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    
    fetchUser();
  }, []);

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['lessons-history'],
    queryFn: () => base44.entities.Lesson.list('-created_date'),
    initialData: [],
  });

  const { data: allWorksheets = [] } = useQuery({
    queryKey: ['worksheets-history'],
    queryFn: () => base44.entities.Worksheet.list('-created_date'),
    initialData: [],
  });

  const lessonWorksheets = {};
  allWorksheets.forEach(w => {
    if (!lessonWorksheets[w.lesson_id]) {
      lessonWorksheets[w.lesson_id] = [];
    }
    lessonWorksheets[w.lesson_id].push(w);
  });

  const HistoryLessonCard = ({ lesson }) => {
    const worksheets = (lessonWorksheets[lesson.id] || []).sort((a, b) => a.worksheet_number - b.worksheet_number);
    const completedCount = worksheets.filter(w => w.completed).length;
    const totalWorksheets = 6;
    const latestCompleted = worksheets.filter(w => w.completed).pop();
    const progress = (completedCount / totalWorksheets) * 100;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => navigate(createPageUrl("DocumentViewer") + `?lessonId=${lesson.id}`)}
        className="cursor-pointer"
      >
        <Card className="hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <BookOpen className={`w-8 h-8 ${
                  completedCount === totalWorksheets ? 'text-emerald-600' :
                  completedCount > 0 ? 'text-amber-600' :
                  'text-purple-600'
                }`} />
                <div>
                  <CardTitle className="text-xl">{lesson.course_name}</CardTitle>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Created {new Date(lesson.created_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Badge className={`${
                completedCount === totalWorksheets ? 'bg-emerald-100 text-emerald-700' :
                completedCount > 0 ? 'bg-amber-100 text-amber-700' :
                'bg-purple-100 text-purple-700'
              } border`}>
                {completedCount}/{totalWorksheets}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Progress</span>
                <span className="font-semibold text-slate-900">{completedCount} / {totalWorksheets} worksheets</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {latestCompleted && (
              <div className="p-3 bg-gradient-to-r from-purple-50 to-yellow-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1">Latest Grade</p>
                    <p className="text-2xl font-bold text-slate-900">{latestCompleted.predicted_grade}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-600">Score</p>
                    <p className="text-lg font-bold text-purple-600">{Math.round(latestCompleted.total_score)}%</p>
                  </div>
                </div>
              </div>
            )}

            {completedCount === totalWorksheets && (
              <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 font-medium p-2 bg-emerald-50 rounded">
                <Award className="w-4 h-4" />
                <span>All Worksheets Completed!</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

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
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Lesson History</h1>
        <p className="text-slate-600 text-lg">All your lessons and their progress</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-48 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <Card className="text-center py-16 bg-gradient-to-br from-purple-50 to-yellow-50">
          <CardContent>
            <BookOpen className="w-16 h-16 mx-auto text-purple-500 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No lessons yet</h3>
            <p className="text-slate-500 mb-6">Create your first lesson to begin tracking your progress</p>
            <Button
              onClick={() => navigate(createPageUrl("CreateLesson"))}
              className="bg-gradient-to-r from-purple-600 to-purple-800"
            >
              Create Lesson
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessons.map(lesson => (
            <HistoryLessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      )}
    </div>
  );
}