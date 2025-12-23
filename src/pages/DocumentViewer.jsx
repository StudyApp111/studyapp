import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Brain, Trophy, ChevronLeft, Loader2, Clock, BookMarked } from "lucide-react";
import DocumentViewerTabs from "@/components/document-viewer/DocumentViewerTabs";
import QuizTab from "@/components/document-viewer/QuizTab";
import ExamTab from "@/components/document-viewer/ExamTab";
import PredictedGradeTab from "@/components/document-viewer/PredictedGradeTab";
import FlashcardsTab from "@/components/document-viewer/FlashcardsTab";
import PomodoroTimer from "@/components/document-viewer/PomodoroTimer";
import AITutorPanel from "@/components/document-viewer/AITutorPanel";
      
export default function DocumentViewer() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("quiz");
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [exams, setExams] = useState([]);
  const [extractedContent, setExtractedContent] = useState("");
  const [studyTime, setStudyTime] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [timerInterval, setTimerInterval] = useState(null);
  const saveProgressRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  
  // Check if lesson has a document
  const hasDocument = lesson?.file_url || lesson?.file_urls?.length > 0;
  
  // Check exam completion status for red dot logic
  const completedExamCount = exams.filter(e => e.completed).length;
  const hasCompletedExam = completedExamCount > 0;
  const hasViewedFirstGrade = completedExamCount >= 1;
  
  // Red dot logic:
  // - Quiz tab: show dot if quiz not completed
  // - Exam tab: show dot if quiz completed but no exam completed, OR if user has completed exams but not all 6
  // - Grade tab: show dot only after completing first exam until user views it (we'll hide after first view)
  // - Flashcards tab: always show dot until user views it
  const showQuizDot = !quiz?.completed;
  const showExamDot = quiz?.completed && completedExamCount < 6;
  const showGradeDot = false; // No red dot on grade after first exam is done
  const showFlashcardsDot = true; // Always show to encourage usage

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, []);

  useEffect(() => {
    const handleSwitchToGrade = () => setActiveTab('grade');
    const handleSwitchToExam = () => setActiveTab('exam');
    const handleSwitchToQuiz = () => setActiveTab('quiz');
    
    window.addEventListener('switchToGradeTab', handleSwitchToGrade);
    window.addEventListener('switchToExamTab', handleSwitchToExam);
    window.addEventListener('switchToQuizTab', handleSwitchToQuiz);
    
    return () => {
      window.removeEventListener('switchToGradeTab', handleSwitchToGrade);
      window.removeEventListener('switchToExamTab', handleSwitchToExam);
      window.removeEventListener('switchToQuizTab', handleSwitchToQuiz);
    };
  }, []);



  useEffect(() => {
    loadLesson();
  }, []);

  useEffect(() => {
    if (isTimerRunning && studyTime !== null) {
      const interval = setInterval(() => {
        setStudyTime(prev => prev + 1);
      }, 1000);
      setTimerInterval(interval);
      return () => clearInterval(interval);
    } else if (timerInterval) {
      clearInterval(timerInterval);
    }
  }, [isTimerRunning, studyTime !== null]);

  // Save progress every 30 seconds (both user total and lesson-specific time)
  useEffect(() => {
    if (saveProgressRef.current) {
      clearInterval(saveProgressRef.current);
    }

    saveProgressRef.current = setInterval(async () => {
      try {
        const user = await base44.auth.me();
        await base44.auth.updateMe({
          time_spent_seconds: (user.time_spent_seconds || 0) + 30
        });
        
        // Also update lesson-specific study time
        if (lesson?.id) {
          await base44.entities.Lesson.update(lesson.id, {
            total_study_time_seconds: (lesson.total_study_time_seconds || 0) + 30
          });
          // Update local state to reflect saved time
          setLesson(prev => prev ? {
            ...prev,
            total_study_time_seconds: (prev.total_study_time_seconds || 0) + 30
          } : prev);
        }
      } catch (error) {
        console.error("Error saving progress:", error);
      }
    }, 30000);

    return () => {
      if (saveProgressRef.current) {
        clearInterval(saveProgressRef.current);
      }
    };
  }, [lesson?.id]);

  const formatStudyTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      
      // Initialize study time from saved lesson data
      setStudyTime(lessonData.total_study_time_seconds || 0);
      
      if (lessonData.extracted_content) {
        setExtractedContent(lessonData.extracted_content);
      }

      const quizzes = await base44.entities.DiagnosticQuiz.filter({ lesson_id: lessonId });
      if (quizzes.length > 0) {
        const quizData = quizzes[0];
        setQuiz(quizData);
        
        if (quizData.completed) {
          // Check both Exam entity and legacy Worksheet entity
          const [examsData, worksheetsData] = await Promise.all([
            base44.entities.Exam.filter({ lesson_id: lessonId }),
            base44.entities.Worksheet.filter({ lesson_id: lessonId })
          ]);
          
          setExams([...examsData, ...worksheetsData]);
          
          const examWithGrade = [...examsData, ...worksheetsData]
            .filter(e => e.completed && e.predicted_grade)
            .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];
          
          if (examWithGrade) {
            setQuiz({ ...quizData, predicted_grade: examWithGrade.predicted_grade });
          }
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading lesson:", error);
      navigate(createPageUrl("CreateLesson"));
    }
  };

  useEffect(() => {
    const handleReloadLesson = () => {
      loadLesson();
    };
    
    window.addEventListener('reloadLesson', handleReloadLesson);
    
    return () => {
      window.removeEventListener('reloadLesson', handleReloadLesson);
    };
  }, []);

  const handleQuizComplete = async (completedQuiz) => {
    setQuiz(completedQuiz);
    // Reload lesson data to refresh exams list
    await loadLesson();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 overflow-x-hidden w-full max-w-full">
      <div className="border-b border-purple-200/60 bg-white/90 backdrop-blur-xl sticky top-0 z-10 w-full max-w-full overflow-hidden">
        <div className="w-full max-w-full px-2 md:px-3 py-2 md:py-3 overflow-hidden">
          <div className="flex items-center gap-1.5 md:gap-2 w-full max-w-full overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl("Home"))}
              className="hidden md:flex text-slate-700 hover:text-slate-900 hover:bg-purple-100 flex-shrink-0 h-10 w-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            {/* Mobile Header - Two rows */}
            <div className="flex-1 min-w-0 max-w-full bg-gradient-to-br from-purple-600 via-purple-700 to-yellow-500 text-white px-2.5 md:px-4 py-2 md:py-3 rounded-xl shadow-lg md:hidden">
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-xs font-bold truncate flex-1 min-w-0">{lesson?.course_name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1 bg-white/20 rounded-lg px-2 py-0.5">
                    <span className="text-[10px] opacity-80">Grade:</span>
                    {quiz?.predicted_grade ? (
                      <span className="text-sm font-bold">{quiz.predicted_grade}</span>
                    ) : (
                      <span className="text-[10px] opacity-70">—</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 bg-white/20 rounded-lg px-2 py-0.5">
                    <Clock className="w-3 h-3 opacity-80" />
                    <span className="text-[10px] font-mono font-medium">{formatStudyTime(studyTime)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Desktop Header */}
            <div className="hidden md:flex flex-1 min-w-0 max-w-full bg-gradient-to-br from-purple-600 via-purple-700 to-yellow-500 text-white px-4 py-3 rounded-xl shadow-lg">
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-base font-bold truncate flex-1 min-w-0">{lesson?.course_name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                  <span className="text-base font-normal">Predicted Grade:</span>
                  {quiz?.predicted_grade ? (
                    <span className="text-xl font-bold">{quiz.predicted_grade}</span>
                  ) : quiz?.completed ? (
                    <span className="text-xs font-semibold">Exam</span>
                  ) : (
                    <span className="text-xs opacity-70">-</span>
                  )}
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-purple-200 flex-shrink-0">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-mono font-semibold text-slate-900 min-w-[50px]">
                {formatStudyTime(studyTime)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="h-6 w-6 p-0 hover:bg-purple-50"
              >
                {isTimerRunning ? (
                  <div className="flex gap-0.5">
                    <div className="w-0.5 h-2.5 bg-purple-600 rounded-full" />
                    <div className="w-0.5 h-2.5 bg-purple-600 rounded-full" />
                  </div>
                ) : (
                  <div className="w-0 h-0 border-l-[6px] border-l-purple-600 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-0.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-full px-2 py-2 relative md:h-[calc(100vh-120px)] h-[calc(100vh-70px)]">
        {/* Desktop: Flex container for AI tutor + tabs */}
        <div className="hidden md:flex gap-2 h-full w-full max-w-full">{/* AI Tutor Panel - Left 1/3 */}
          <AITutorPanel 
            messages={messages}
            setMessages={setMessages}
            input={aiInput}
            setInput={setAiInput}
            isLoading={aiLoading}
            setIsLoading={setAiLoading}
            lesson={lesson}
          />
          
          {/* Tabs - Right 2/3 */}
          <div className="flex-[2]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2 h-full flex flex-col">
              <div className="flex-shrink-0">
                <div className="w-full overflow-x-auto scrollbar-hide">
                  <TabsList className="inline-flex bg-white border border-purple-200 p-1 gap-1 h-auto w-max">
                    {hasDocument && (
                      <TabsTrigger 
                        value="doc"
                        className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap"
                      >
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span className="text-[11px] font-medium">Doc</span>
                      </TabsTrigger>
                    )}
                    <TabsTrigger 
                      value="quiz"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative"
                    >
                      {showQuizDot && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                      <Brain className="w-4 h-4 flex-shrink-0" />
                      <span className="text-[11px] font-medium">Quiz</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="exam"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative"
                    >
                      {showExamDot && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="text-[11px] font-medium">Exam</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="grade"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative"
                    >
                      {showGradeDot && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                      <Trophy className="w-4 h-4 flex-shrink-0" />
                      <span className="text-[11px] font-medium">Grade</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="flashcards"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative"
                    >
                      {showFlashcardsDot && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                      <BookMarked className="w-4 h-4 flex-shrink-0" />
                      <span className="text-[11px] font-medium">Flashcards</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              <div className="w-full flex-1 overflow-auto">
                {hasDocument && (
                  <TabsContent value="doc" className="mt-0 p-0 h-full">
                    <DocumentViewerTabs lesson={lesson} />
                  </TabsContent>
                )}

                <TabsContent value="quiz" className="mt-0 p-0 h-full">
                  <QuizTab lesson={lesson} quiz={quiz} onQuizComplete={handleQuizComplete} />
                </TabsContent>

                <TabsContent value="exam" className="mt-0 p-0 h-full">
                  <ExamTab lesson={lesson} quiz={quiz} exams={exams} />
                </TabsContent>

                <TabsContent value="grade" className="mt-0 p-0 h-full">
                  <PredictedGradeTab lesson={lesson} quiz={quiz} exams={exams} />
                </TabsContent>

                <TabsContent value="flashcards" className="mt-0 p-0 h-full">
                  <FlashcardsTab lesson={lesson} extractedContent={extractedContent} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
          </div>
        
        {/* Mobile: Original layout without AI tutor panel */}
        <div className="md:hidden h-full flex flex-col w-full max-w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col w-full max-w-full overflow-hidden">
            <div className="flex-shrink-0 pb-2 w-full max-w-full">
              <div className="w-full max-w-full overflow-x-auto scrollbar-hide">
                <TabsList className="flex w-full bg-white border border-purple-200 p-1 gap-1 h-auto">
                  {hasDocument && (
                    <TabsTrigger 
                      value="doc"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1 px-2 py-2 h-auto whitespace-nowrap flex-1"
                    >
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="text-[10px] font-medium">Doc</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger 
                    value="quiz"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1 px-2 py-2 h-auto whitespace-nowrap flex-1 relative"
                  >
                    {showQuizDot && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                    <Brain className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[10px] font-medium">Quiz</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="exam"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1 px-2 py-2 h-auto whitespace-nowrap flex-1 relative"
                  >
                    {showExamDot && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[10px] font-medium">Exam</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="grade"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1 px-2 py-2 h-auto whitespace-nowrap flex-1 relative"
                  >
                    {showGradeDot && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                    <Trophy className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[10px] font-medium">Grade</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="flashcards"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1 px-2 py-2 h-auto whitespace-nowrap flex-1 relative"
                  >
                    {showFlashcardsDot && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                    <BookMarked className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[10px] font-medium">Cards</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto w-full max-w-full">
              {hasDocument && (
                <TabsContent value="doc" className="mt-0 p-0 w-full max-w-full h-full">
                  <DocumentViewerTabs lesson={lesson} />
                </TabsContent>
              )}

              <TabsContent value="quiz" className="mt-0 p-0 w-full max-w-full">
                <QuizTab lesson={lesson} quiz={quiz} onQuizComplete={handleQuizComplete} />
              </TabsContent>

              <TabsContent value="exam" className="mt-0 p-0 w-full max-w-full">
                <ExamTab lesson={lesson} quiz={quiz} exams={exams} />
              </TabsContent>

              <TabsContent value="grade" className="mt-0 p-0 w-full max-w-full">
                <PredictedGradeTab lesson={lesson} quiz={quiz} exams={exams} />
              </TabsContent>

              <TabsContent value="flashcards" className="mt-0 p-0 w-full max-w-full">
                <FlashcardsTab lesson={lesson} extractedContent={extractedContent} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {isTimerRunning && (
        <PomodoroTimer 
          elapsedSeconds={studyTime} 
          onBreakComplete={() => {}} 
        />
      )}

    </div>
  );
}