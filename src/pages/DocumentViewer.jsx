import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Trophy, ChevronLeft, Loader2, Clock, BookMarked, Flame, Zap, Users } from "lucide-react";
import DocumentViewerTabs from "@/components/document-viewer/DocumentViewerTabs";
import ExamTab from "@/components/document-viewer/ExamTab";
import PredictedGradeTab from "@/components/document-viewer/PredictedGradeTab";
import FlashcardsTab from "@/components/document-viewer/FlashcardsTab";
import PomodoroTimer from "@/components/document-viewer/PomodoroTimer";
import AITutorPanel from "@/components/document-viewer/AITutorPanel";
import StudySessionTracker from "@/components/gamification/StudySessionTracker";
import XPGainToast from "@/components/gamification/XPGainToast";
import StudyBuddiesTab from "@/components/document-viewer/StudyBuddiesTab";
import { handleDailyReset, awardDailyXP, recordDailyActivity } from "@/components/utils/dailyReset";

// Track study minutes every minute
      
export default function DocumentViewer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("exam");
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState([]);
  const [extractedContent, setExtractedContent] = useState("");
  const [studyTime, setStudyTime] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [timerInterval, setTimerInterval] = useState(null);
  const saveProgressRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [predictedGrade, setPredictedGrade] = useState(null);
  const [xpToast, setXpToast] = useState({ show: false, xp: 0, reason: '' });
  const [userStreak, setUserStreak] = useState(0);
  const [userDailyXP, setUserDailyXP] = useState(0);
  
  // Check if lesson has a document
  const hasDocument = lesson?.file_url || lesson?.file_urls?.length > 0;
  
  // Check exam completion status for red dot logic
  const completedExamCount = exams.filter(e => e.completed).length;
  
  // Red dot logic (simplified without quiz):
  // - Exam tab: show dot if no exam completed or not all 6 completed
  // - Grade tab: no red dot
  // - Flashcards tab: always show dot until user views it
  const showExamDot = completedExamCount < 6;
  const showGradeDot = false;
  const showFlashcardsDot = true;

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
    
    window.addEventListener('switchToGradeTab', handleSwitchToGrade);
    window.addEventListener('switchToExamTab', handleSwitchToExam);
    
    return () => {
      window.removeEventListener('switchToGradeTab', handleSwitchToGrade);
      window.removeEventListener('switchToExamTab', handleSwitchToExam);
    };
  }, []);



  useEffect(() => {
    loadLesson();
    loadUserStats();
  }, []); // Only load once on mount - window.location.search as dependency causes infinite loops

  const loadUserStats = async () => {
    try {
      // Use centralized daily reset
      const resetResult = await handleDailyReset();
      const user = resetResult.user || await base44.auth.me();
      
      setUserStreak(resetResult.streak ?? user.current_streak ?? 0);
      setUserDailyXP(resetResult.dailyXP ?? user.daily_xp ?? 0);
    } catch (error) {
      console.error("Error loading user stats:", error);
    }
  };

  const awardXP = async (amount, reason) => {
    try {
      const result = await awardDailyXP(amount, reason);
      if (result.success) {
        setUserDailyXP(result.dailyXP);
        setXpToast({ show: true, xp: amount, reason });
      }
    } catch (error) {
      console.error("Error awarding XP:", error);
    }
  };

  const handleMilestoneReached = (milestone) => {
    awardXP(milestone.xp, `${milestone.minutes} min milestone!`);
  };

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
  // Also track study_minutes_today every minute for daily challenges
  useEffect(() => {
    if (saveProgressRef.current) {
      clearInterval(saveProgressRef.current);
    }

    let minuteCounter = 0;
    
    saveProgressRef.current = setInterval(async () => {
      try {
        const user = await base44.auth.me();
        await base44.auth.updateMe({
          time_spent_seconds: (user.time_spent_seconds || 0) + 30
        });
        
        // Track study minutes for daily challenges (every 60 seconds)
        minuteCounter += 30;
        if (minuteCounter >= 60) {
          await recordDailyActivity('study_minutes', 1);
          minuteCounter = 0;
        }
        
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
      // Use useSearchParams hook for most reliable param reading
      const lessonId = searchParams.get('id') || searchParams.get('lessonId');

      console.log("DocumentViewer: Full URL:", window.location.href);
      console.log("DocumentViewer: Search params from hook:", lessonId);
      console.log("DocumentViewer: All search params:", Object.fromEntries(searchParams.entries()));

      if (!lessonId || lessonId === 'null' || lessonId === 'undefined') {
        console.error("DocumentViewer: Invalid or missing lessonId");
        console.error("DocumentViewer: URL:", window.location.href);
        setLoading(false);
        // Don't show alert in iframe to prevent crashes
        navigate(createPageUrl("Home"), { replace: true });
        return;
      }

      const lessons = await base44.entities.Lesson.filter({ id: lessonId });
      console.log("DocumentViewer: Fetched lessons:", lessons);
      
      if (!lessons || lessons.length === 0) {
        console.error("DocumentViewer: No lesson found with ID:", lessonId);
        setLoading(false);
        navigate(createPageUrl("Home"), { replace: true });
        return;
      }

      const lessonData = lessons[0];
      if (!lessonData || !lessonData.id) {
        console.error("DocumentViewer: Invalid lesson data");
        setLoading(false);
        navigate(createPageUrl("Home"), { replace: true });
        return;
      }
      
      console.log("DocumentViewer: Lesson loaded successfully:", lessonData.course_name);
      setLesson(lessonData);
      
      // Initialize study time from saved lesson data
      setStudyTime(lessonData.total_study_time_seconds || 0);
      
      // Use uncompressed content for document viewer - compressed is for prompts only
      if (lessonData.extracted_content) {
        setExtractedContent(lessonData.extracted_content);
      }

      // Load exams and worksheets (no longer dependent on quiz)
      let examsData = [];
      let worksheetsData = [];
      
      try {
        [examsData, worksheetsData] = await Promise.all([
          base44.entities.Exam.filter({ lesson_id: lessonId }),
          base44.entities.Worksheet.filter({ lesson_id: lessonId })
        ]);
        console.log("DocumentViewer: Loaded exams:", examsData.length, "worksheets:", worksheetsData.length);
      } catch (loadError) {
        console.error("DocumentViewer: Error loading exams/worksheets (non-critical):", loadError);
        // Continue with empty arrays if loading fails
      }
      
      // Filter out any null/undefined items
      const validExams = (examsData || []).filter(e => e && e.id);
      const validWorksheets = (worksheetsData || []).filter(w => w && w.id);
      
      setExams([...validExams, ...validWorksheets]);
      
      // Get the latest predicted grade from completed exams/worksheets
      const examWithGrade = [...examsData, ...worksheetsData]
        .filter(e => e.completed && e.predicted_grade)
        .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];
      
      if (examWithGrade) {
        setPredictedGrade(examWithGrade.predicted_grade);
      }

      console.log("DocumentViewer: Lesson loaded completely, setting loading=false");
      setLoading(false);
    } catch (error) {
      console.error("DocumentViewer: CRITICAL ERROR loading lesson:", error);
      console.error("DocumentViewer: Error details:", error.message, error.stack);
      setLoading(false);
      // Redirect without alert to prevent crashes in iframe
      navigate(createPageUrl("Home"), { replace: true });
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

  const handleExamComplete = async () => {
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
      {/* Mobile Header */}
      <div className="md:hidden border-b border-purple-200/60 bg-white/90 backdrop-blur-xl sticky top-0 z-10 w-full">
        <div className="px-2 py-2">
          <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-yellow-500 text-white px-2.5 py-2 rounded-xl shadow-lg">
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs font-bold truncate flex-1 min-w-0">{lesson?.course_name}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1 bg-white/20 rounded-lg px-2 py-0.5">
                  <Clock className="w-3 h-3 opacity-80" />
                  <span className="text-[10px] font-mono font-medium">{formatStudyTime(studyTime)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Desktop Header - Unified Purple Banner */}
      <div className="hidden md:block sticky top-0 z-10 w-full">
        <div className="bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 px-4 py-2.5 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back + Course Name */}
            <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
              <button
                onClick={() => navigate(createPageUrl("Home"))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="bg-white/10 backdrop-blur-sm px-4 py-1 rounded-full border border-white/20">
                <span className="text-white font-semibold text-sm truncate block max-w-[280px]">
                  {lesson?.course_name}
                </span>
              </div>
            </div>
            
            {/* Right: Grade + XP + Timer */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Predicted Grade */}
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-xs font-medium">StudyApp Predicted Grade:</span>
                <span className="text-white text-xl font-bold tracking-tight">{predictedGrade || '—'}</span>
              </div>
              
              {/* Subtle Divider */}
              <div className="h-6 w-px bg-white/20" />
              
              {/* Daily XP */}
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-400/20 to-amber-400/20 border border-yellow-400/30 rounded-full px-3 py-1.5">
                <Zap className="w-4 h-4 text-yellow-300" />
                <span className="text-white text-xs font-bold">{userDailyXP}/50 XP</span>
              </div>
              
              {/* Timer */}
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5">
                <Clock className="w-4 h-4 text-white/80" />
                <span className="text-white text-xs font-mono font-semibold min-w-[45px]">
                  {formatStudyTime(studyTime)}
                </span>
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                >
                  {isTimerRunning ? (
                    <div className="flex gap-0.5">
                      <div className="w-[3px] h-3 bg-white rounded-full" />
                      <div className="w-[3px] h-3 bg-white rounded-full" />
                    </div>
                  ) : (
                    <div className="w-0 h-0 border-l-[6px] border-l-white border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-0.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-full px-2 py-2 relative md:h-[calc(100vh-120px)] h-[calc(100vh-70px)]">
        {/* Desktop: Flex container for AI tutor + tabs */}
        <div className="hidden md:flex gap-3 h-full w-full max-w-full">
          {/* AI Tutor Panel - Left side */}
          <div className="w-[320px] flex-shrink-0">
            <AITutorPanel 
              messages={messages}
              setMessages={setMessages}
              input={aiInput}
              setInput={setAiInput}
              isLoading={aiLoading}
              setIsLoading={setAiLoading}
              lesson={lesson}
            />
          </div>
          
          {/* Tabs - Right side (fills remaining space) */}
          <div className="flex-1 min-w-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2 h-full flex flex-col">
              <div className="flex-shrink-0">
                <TabsList className="flex w-full bg-white border border-purple-200 p-1 gap-1 h-auto rounded-lg">
                  {hasDocument && (
                    <TabsTrigger 
                      value="doc"
                      className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap rounded-md"
                    >
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="text-xs font-medium">Document</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger 
                    value="exam"
                    className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative rounded-md"
                  >
                    {showExamDot && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Exam</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="grade"
                    className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative rounded-md"
                  >
                    {showGradeDot && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                    <Trophy className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Grade</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="flashcards"
                    className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative rounded-md"
                  >
                    {showFlashcardsDot && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                    <BookMarked className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Flashcards</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="collaborate"
                    className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1.5 px-4 py-2 h-auto whitespace-nowrap relative rounded-md"
                  >
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Collaborate</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="w-full flex-1 overflow-auto">
                {hasDocument && (
                  <TabsContent value="doc" className="mt-0 p-0 h-full">
                    <DocumentViewerTabs lesson={lesson} />
                  </TabsContent>
                )}

                <TabsContent value="exam" className="mt-0 p-0 h-full">
                  <ExamTab lesson={lesson} exams={exams} onExamComplete={handleExamComplete} />
                </TabsContent>

                <TabsContent value="grade" className="mt-0 p-0 h-full">
                  <PredictedGradeTab lesson={lesson} exams={exams} />
                </TabsContent>

                <TabsContent value="flashcards" className="mt-0 p-0 h-full">
                  <FlashcardsTab lesson={lesson} extractedContent={extractedContent} />
                </TabsContent>

                <TabsContent value="collaborate" className="mt-0 p-0 h-full">
                  <StudyBuddiesTab lessonId={lesson?.id} lessonName={lesson?.course_name} />
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
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1 px-1.5 py-2 h-auto whitespace-nowrap flex-1 relative"
                  >
                    {showFlashcardsDot && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                    <BookMarked className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[10px] font-medium">Flashcards</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="collaborate"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white flex items-center justify-center gap-1 px-1.5 py-2 h-auto whitespace-nowrap flex-1 relative"
                  >
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[10px] font-medium">Collab</span>
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

              <TabsContent value="exam" className="mt-0 p-0 w-full max-w-full">
                <ExamTab lesson={lesson} exams={exams} onExamComplete={handleExamComplete} />
              </TabsContent>

              <TabsContent value="grade" className="mt-0 p-0 w-full max-w-full">
                <PredictedGradeTab lesson={lesson} exams={exams} />
              </TabsContent>

              <TabsContent value="flashcards" className="mt-0 p-0 w-full max-w-full">
                <FlashcardsTab lesson={lesson} extractedContent={extractedContent} />
              </TabsContent>

              <TabsContent value="collaborate" className="mt-0 p-0 w-full max-w-full">
                <StudyBuddiesTab lessonId={lesson?.id} lessonName={lesson?.course_name} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Pomodoro Timer - Mobile only */}
      <div className="md:hidden">
        {isTimerRunning && (
          <PomodoroTimer 
            elapsedSeconds={studyTime} 
            onBreakComplete={() => {}} 
          />
        )}
      </div>

      {/* XP Gain Toast */}
      <XPGainToast 
        xpGained={xpToast.xp}
        reason={xpToast.reason}
        show={xpToast.show}
        onComplete={() => setXpToast({ show: false, xp: 0, reason: '' })}
      />
    </div>
  );
}