import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Brain, FileText, CheckCircle, Lock, TrendingUp, Award, Trash2, MoreVertical } from "lucide-react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function LessonDetail() {
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [worksheets, setWorksheets] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');
    
    if (!lessonId) {
      navigate(createPageUrl("Home"));
      return;
    }

    loadLessonDetails(lessonId);
  }, [navigate]);

  const loadLessonDetails = async (lessonId) => {
    setIsLoading(true);
    try {
      const lessonData = await base44.entities.Lesson.filter({ id: lessonId });
      if (lessonData.length === 0) {
        navigate(createPageUrl("Home"));
        return;
      }
      setLesson(lessonData[0]);

      const quizData = await base44.entities.DiagnosticQuiz.filter({ lesson_id: lessonId });
      setQuiz(quizData[0]);

      const worksheetData = await base44.entities.Worksheet.filter({ lesson_id: lessonId });
      setWorksheets(worksheetData.sort((a, b) => a.worksheet_number - b.worksheet_number));
    } catch (error) {
      console.error("Error loading lesson details:", error);
    }
    setIsLoading(false);
  };

  const handleDeleteLesson = async () => {
    setIsDeleting(true);
    try {
      // Delete all worksheets for this lesson
      await Promise.all(
        worksheets.map(worksheet => base44.entities.Worksheet.delete(worksheet.id))
      );

      // Delete diagnostic quiz if exists
      if (quiz) {
        await base44.entities.DiagnosticQuiz.delete(quiz.id);
      }

      // Delete the lesson
      await base44.entities.Lesson.delete(lesson.id);

      // Navigate back to home
      navigate(createPageUrl("Home"));
    } catch (error) {
      console.error("Error deleting lesson:", error);
      alert("Failed to delete lesson. Please try again.");
    }
    setIsDeleting(false);
  };

  if (isLoading || !lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  const completedWorksheets = worksheets.filter(w => w.completed);
  const latestCompleted = completedWorksheets[completedWorksheets.length - 1];
  const completedCount = completedWorksheets.length;
  const totalWorksheets = 6;
  const progress = (completedCount / totalWorksheets) * 100;

  const getGradeColor = (grade) => {
    if (!grade) return 'from-slate-500 to-slate-700';
    if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
    if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
    if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-pink-600';
  };

  const handleWorksheetClick = (worksheet) => {
    if (worksheet.completed) {
      navigate(createPageUrl("Feedback") + `?lessonId=${lesson.id}&worksheet=${worksheet.worksheet_number}`);
    } else if (worksheet.status === "in_progress") {
      navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}&worksheet=${worksheet.worksheet_number}`);
    } else if (worksheet.status === "not_started") {
      navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}&worksheet=${worksheet.worksheet_number}`);
    }
  };

  const handleStartDiagnostic = () => {
    navigate(createPageUrl("DiagnosticQuiz") + `?lessonId=${lesson.id}`);
  };

  const WorksheetCard = ({ worksheet, isLocked }) => {
    const isCompleted = worksheet.completed;
    const isInProgress = worksheet.status === "in_progress";
    const isNotStarted = worksheet.status === "not_started";

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card 
          onClick={() => !isLocked && handleWorksheetClick(worksheet)}
          className={`${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-xl'} transition-all duration-300 border-0 shadow-lg`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isLocked ? (
                  <Lock className="w-6 h-6 text-slate-400" />
                ) : isCompleted ? (
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                ) : isInProgress ? (
                  <FileText className="w-6 h-6 text-amber-600" />
                ) : (
                  <FileText className="w-6 h-6 text-purple-600" />
                )}
                <CardTitle className="text-lg">Worksheet {worksheet.worksheet_number}</CardTitle>
              </div>
              {isCompleted && (
                <Badge className="bg-emerald-100 text-emerald-700">
                  {worksheet.predicted_grade}
                </Badge>
              )}
              {isInProgress && (
                <Badge className="bg-amber-100 text-amber-700">
                  In Progress
                </Badge>
              )}
              {isNotStarted && !isLocked && (
                <Badge className="bg-purple-100 text-purple-700">
                  Not Started
                </Badge>
              )}
              {isLocked && (
                <Badge className="bg-slate-100 text-slate-500">
                  Locked
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {worksheet.focus_description && (
              <p className="text-sm text-slate-600 mb-3 line-clamp-2">{worksheet.focus_description}</p>
            )}
            {isCompleted && (
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Score</p>
                  <p className="text-2xl font-bold text-slate-900">{Math.round(worksheet.total_score)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-600 mb-1">Grade</p>
                  <p className="text-2xl font-bold text-emerald-600">{worksheet.predicted_grade}</p>
                </div>
              </div>
            )}
            {isInProgress && (
              <Button className="w-full bg-amber-600 hover:bg-amber-700">
                Continue Worksheet
              </Button>
            )}
            {isNotStarted && !isLocked && (
              <Button className="w-full bg-purple-600 hover:bg-purple-700">
                Start Worksheet
              </Button>
            )}
            {isLocked && (
              <p className="text-xs text-slate-500 text-center">Complete previous worksheets to unlock</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Home"))}
            className="hover:bg-purple-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Lesson
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Lesson</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{lesson.course_name}"? This will permanently delete all worksheets, quizzes, and progress for this lesson. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteLesson}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Lesson"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Header Section */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">{lesson.course_name}</h1>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-slate-600 mb-1">Progress</p>
              <p className="text-2xl font-bold text-slate-900">{completedCount} / {totalWorksheets}</p>
            </div>
            <Progress value={progress} className="flex-1 h-3" />
            <div className="text-right">
              <p className="text-sm text-slate-600 mb-1">Completion</p>
              <p className="text-2xl font-bold text-purple-600">{Math.round(progress)}%</p>
            </div>
          </div>
        </div>

        {/* Current Grade Section */}
        {latestCompleted ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <Card className="border-0 shadow-2xl overflow-hidden">
              <div className={`bg-gradient-to-r ${getGradeColor(latestCompleted.predicted_grade)} p-8 text-white`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 mb-2">Current Predicted Exam Grade</p>
                    <div className="flex items-baseline gap-4">
                      <span className="text-6xl font-bold">{latestCompleted.predicted_grade}</span>
                      <span className="text-3xl font-semibold">{Math.round(latestCompleted.total_score)}%</span>
                    </div>
                    <p className="text-white/90 mt-2">From Worksheet {latestCompleted.worksheet_number}</p>
                  </div>
                  <Award className="w-24 h-24 text-white/20" />
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white">
              <CardContent className="p-8 text-center">
                <Brain className="w-16 h-16 mx-auto text-purple-600 mb-4" />
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Ready to Begin?</h3>
                <p className="text-slate-600 mb-6">
                  {quiz?.completed ? 'Start your first worksheet to get your predicted grade' : 'Take the diagnostic quiz to begin your personalized learning journey'}
                </p>
                {quiz?.completed ? (
                  <Button
                    onClick={() => handleWorksheetClick({ worksheet_number: 1, status: "not_started" })}
                    className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
                  >
                    Start Worksheet 1
                  </Button>
                ) : (
                  <Button
                    onClick={handleStartDiagnostic}
                    className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
                  >
                    <Brain className="w-5 h-5 mr-2" />
                    Start Diagnostic Quiz
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* All Worksheets */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">All Worksheets</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(num => {
              const worksheet = worksheets.find(w => w.worksheet_number === num);
              const isLocked = num > 1 && (!worksheets.find(w => w.worksheet_number === num - 1)?.completed);
              
              if (worksheet) {
                return <WorksheetCard key={num} worksheet={worksheet} isLocked={isLocked} />;
              } else {
                return (
                  <motion.div
                    key={num}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="opacity-40 cursor-not-allowed border-0 shadow-lg">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Lock className="w-6 h-6 text-slate-400" />
                            <CardTitle className="text-lg">Worksheet {num}</CardTitle>
                          </div>
                          <Badge className="bg-slate-100 text-slate-500">Locked</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-500">Complete Worksheet 1 to unlock</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              }
            })}
          </div>
        </div>
      </div>
    </div>
  );
}