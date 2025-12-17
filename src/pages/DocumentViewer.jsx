import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, FileText, Brain, TrendingUp, Layers, BookOpen, ChevronLeft, Loader2 } from "lucide-react";
import AITutorTab from "@/components/document-viewer/AITutorTab";
import NotesTab from "@/components/document-viewer/NotesTab";
import QuizTab from "@/components/document-viewer/QuizTab";
import PredictedGradeTab from "@/components/document-viewer/PredictedGradeTab";
import FlashcardsTab from "@/components/document-viewer/FlashcardsTab";
import CurriculumTab from "@/components/document-viewer/CurriculumTab";
import DocumentDisplay from "@/components/document-viewer/DocumentDisplay";

export default function DocumentViewer() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("tutor");
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [extractedContent, setExtractedContent] = useState("");

  useEffect(() => {
    loadLesson();
  }, []);

  const loadLesson = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const lessonId = urlParams.get('lessonId');

      if (!lessonId) {
        navigate(createPageUrl("CreateLesson"));
        return;
      }

      const lessons = await base44.entities.Lesson.filter({ id: lessonId });
      if (lessons.length === 0) {
        navigate(createPageUrl("CreateLesson"));
        return;
      }

      const lessonData = lessons[0];
      setLesson(lessonData);
      
      // Load extracted content
      if (lessonData.extracted_content) {
        setExtractedContent(lessonData.extracted_content);
      }

      // Check if quiz exists
      const quizzes = await base44.entities.DiagnosticQuiz.filter({ lesson_id: lessonId });
      if (quizzes.length > 0) {
        setQuiz(quizzes[0]);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading lesson:", error);
      navigate(createPageUrl("CreateLesson"));
    }
  };

  const handleQuizComplete = (completedQuiz) => {
    setQuiz(completedQuiz);
    setActiveTab("grade");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40">
      {/* Header */}
      <div className="border-b border-purple-200/60 bg-white/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(createPageUrl("Home"))}
                className="text-slate-700 hover:text-slate-900 hover:bg-purple-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">{lesson?.course_name}</h1>
                <p className="text-sm text-slate-600">Interactive Learning Document</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tab Navigation - Responsive */}
          <TabsList className="w-full bg-white border border-purple-200 p-1 grid grid-cols-3 md:grid-cols-6 gap-1">
            <TabsTrigger 
              value="tutor" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center gap-2 text-xs md:text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">AI Tutor</span>
              <span className="sm:hidden">Tutor</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notes"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center gap-2 text-xs md:text-sm"
            >
              <FileText className="w-4 h-4" />
              <span>Notes</span>
            </TabsTrigger>
            <TabsTrigger 
              value="quiz"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center gap-2 text-xs md:text-sm"
            >
              <Brain className="w-4 h-4" />
              <span>Quiz</span>
            </TabsTrigger>
            <TabsTrigger 
              value="grade"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center gap-2 text-xs md:text-sm"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Predicted Grade</span>
              <span className="sm:hidden">Grade</span>
            </TabsTrigger>
            <TabsTrigger 
              value="flashcards"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center gap-2 text-xs md:text-sm"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Flashcards</span>
              <span className="sm:hidden">Cards</span>
            </TabsTrigger>
            <TabsTrigger 
              value="curriculum"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center gap-2 text-xs md:text-sm"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Curriculum</span>
              <span className="sm:hidden">Map</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Interactive Content */}
            <div className="lg:col-span-2">
              <Card className="bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl">
                <TabsContent value="tutor" className="m-0">
                  <AITutorTab lesson={lesson} extractedContent={extractedContent} />
                </TabsContent>

                <TabsContent value="notes" className="m-0">
                  <NotesTab lesson={lesson} extractedContent={extractedContent} />
                </TabsContent>

                <TabsContent value="quiz" className="m-0">
                  <QuizTab lesson={lesson} quiz={quiz} onQuizComplete={handleQuizComplete} />
                </TabsContent>

                <TabsContent value="grade" className="m-0">
                  <PredictedGradeTab lesson={lesson} quiz={quiz} />
                </TabsContent>

                <TabsContent value="flashcards" className="m-0">
                  <FlashcardsTab lesson={lesson} extractedContent={extractedContent} />
                </TabsContent>

                <TabsContent value="curriculum" className="m-0">
                  <CurriculumTab lesson={lesson} />
                </TabsContent>
              </Card>
            </div>

            {/* Right Panel - Document Display (hidden on mobile when in certain tabs) */}
            <div className="hidden lg:block lg:col-span-1">
              <DocumentDisplay lesson={lesson} />
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}