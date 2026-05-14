import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, Clock, BookMarked, Zap, Target, StickyNote, Brain, 
  Headphones, FlameKindling, Sparkles 
} from "lucide-react";
import DocumentViewerTabs from "./DocumentViewerTabs";
import ExamTab from "./ExamTab";
import PracticeHubTab from "./PracticeHubTab";
import FlashcardsTab from "./FlashcardsTab";
import TeachItTab from "./TeachItTab";
import LearnTab from "./LearnTab";
import NotesTab from "./NotesTab";
import StudyPlanTab from "@/components/study-plan/StudyPlanTab";
import StudyPlanBannerInline from "@/components/study-plan/StudyPlanBannerInline";
import ParsingLoader from "./ParsingLoader";
import DiagnosticLockOverlay from "./DiagnosticLockOverlay";
import CramModeTab from "./CramModeTab";

/**
 * Mobile-only tab navigation view. Preserves the existing mobile UX 
 * (sticky tabs at top + scrollable content) — no functional changes.
 */
export default function MobileTabsView({
  lesson,
  activeTab,
  setActiveTab,
  studyTime,
  formatStudyTime,
  hasDocument,
  contentLocked,
  isCramActive,
  daysUntilExam,
  showCramTab,
  showStudyPlanDot,
  showFlashcardsDot,
  showTeachItDot,
  showExamDot,
  exams,
  extractedContent,
  isGeneratingStudyPlan,
  handleStudyPlanNavigate,
  handleExamComplete,
  isDark,
}) {
  return (
    <div className="md:hidden flex flex-col w-full overflow-x-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col w-full overflow-x-hidden flex-1">
        {/* Fixed tabs + info bar */}
        <div 
          className="fixed left-0 right-0 z-40 bg-gradient-to-r from-purple-800 to-purple-700"
          style={{ top: '0px', paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          {/* Info strip */}
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-white font-bold text-base truncate">{lesson?.course_name || 'Loading...'}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="bg-white/15 rounded-full px-3 py-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/80" />
                <span className="text-white text-sm font-mono font-semibold">{formatStudyTime(studyTime)}</span>
              </div>
            </div>
          </div>
          
          {/* Tabs bar */}
          <div className={`backdrop-blur-sm px-2 py-1.5 border-b ${isDark ? 'bg-[#12121a]/95 border-white/10' : 'bg-white/95 border-purple-200'}`}>
            <div className="overflow-x-auto scrollbar-hide">
              <TabsList className={`flex w-max min-w-full border p-0.5 h-auto rounded-lg shadow-sm gap-0.5 ${isDark ? 'bg-[#1a1a2e] border-white/10' : 'bg-white border-purple-200'}`}>
                <TabsTrigger value="practice" className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-pink-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all ${isDark ? 'data-[state=inactive]:text-pink-400 data-[state=inactive]:bg-pink-500/10' : 'data-[state=inactive]:text-pink-700 data-[state=inactive]:bg-pink-50'}`}>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold">Practice</span>
                </TabsTrigger>
                <TabsTrigger value="studyplan" className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all relative ${isDark ? 'data-[state=inactive]:text-amber-400/80 data-[state=inactive]:bg-amber-500/10' : 'data-[state=inactive]:text-amber-700 data-[state=inactive]:bg-amber-50'}`}>
                  {showStudyPlanDot && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                  <Target className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold">Plan</span>
                </TabsTrigger>
                <TabsTrigger value="notes" className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}>
                  <StickyNote className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold">Notes</span>
                </TabsTrigger>
                <TabsTrigger value="teachit" className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all relative ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}>
                  {showTeachItDot && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                  <Brain className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold">Feynman</span>
                </TabsTrigger>
                <TabsTrigger value="flashcards" className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all relative ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}>
                  {showFlashcardsDot && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                  <BookMarked className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold">Flash</span>
                </TabsTrigger>
                <TabsTrigger value="exam" className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all relative ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}>
                  {showExamDot && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                  <Zap className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold">Quizzes</span>
                </TabsTrigger>
                <TabsTrigger value="learn" className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all ${isDark ? 'data-[state=inactive]:text-slate-400' : 'data-[state=inactive]:text-slate-600'}`}>
                  <Headphones className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold">Learn</span>
                </TabsTrigger>
                {showCramTab && (
                  <TabsTrigger value="cram" className={`flex-shrink-0 data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center justify-center gap-1 py-1.5 px-3 rounded-md transition-all relative ${isCramActive ? 'data-[state=inactive]:bg-orange-500/20 data-[state=inactive]:text-orange-400 ring-1 ring-orange-500/40' : isDark ? 'data-[state=inactive]:text-orange-400/80 data-[state=inactive]:bg-orange-500/10' : 'data-[state=inactive]:text-orange-700 data-[state=inactive]:bg-orange-50'}`}>
                    {isCramActive && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
                    <FlameKindling className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-semibold">Cram</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
          </div>
        </div>
        
        {/* Spacer */}
        <div style={{ height: 'calc(env(safe-area-inset-top, 0px) + 100px)' }} />

        {/* Scrollable content */}
        <div className="overflow-x-hidden w-full pb-28 scrollbar-hide" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 112px)' }}>
          <TabsContent value="practice" className="mt-0 p-0 w-full overflow-x-hidden">
            <PracticeHubTab lesson={lesson} exams={exams} onNavigateToTab={setActiveTab} />
          </TabsContent>
          {hasDocument && (
            <TabsContent value="doc" className="mt-0 p-0 w-full overflow-x-hidden">
              {!lesson ? <ParsingLoader /> : (
                <>
                  <div className="px-2 pt-2">
                    <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} onNavigateToTab={setActiveTab} currentTab={activeTab} />
                  </div>
                  <DocumentViewerTabs lesson={lesson} />
                </>
              )}
            </TabsContent>
          )}
          <TabsContent value="studyplan" className="mt-0 p-0 w-full overflow-x-hidden">
            <StudyPlanTab lesson={lesson} exams={exams} onNavigate={handleStudyPlanNavigate} isGeneratingPlan={isGeneratingStudyPlan} />
          </TabsContent>
          <TabsContent value="notes" className="mt-0 p-0 w-full overflow-x-hidden">
            <div className="px-2 pt-2">
              <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} onNavigateToTab={setActiveTab} currentTab={activeTab} />
            </div>
            <NotesTab lesson={lesson} onViewDocument={hasDocument ? () => setActiveTab('doc') : undefined} />
          </TabsContent>
          <TabsContent value="exam" forceMount className="mt-0 p-0 w-full overflow-x-hidden data-[state=inactive]:hidden">
            <div className="px-2 pt-2">
              <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} onNavigateToTab={setActiveTab} currentTab={activeTab} />
            </div>
            <ExamTab lesson={lesson} exams={exams} onExamComplete={handleExamComplete} extractedContent={extractedContent} />
          </TabsContent>
          <TabsContent value="flashcards" forceMount className="mt-0 p-0 w-full overflow-x-hidden data-[state=inactive]:hidden">
            <div className="px-2 pt-2">
              <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} onNavigateToTab={setActiveTab} currentTab={activeTab} />
            </div>
            <FlashcardsTab lesson={lesson} extractedContent={extractedContent} />
          </TabsContent>
          <TabsContent value="teachit" forceMount className="mt-0 p-0 w-full overflow-x-hidden data-[state=inactive]:hidden">
            <div className="px-2 pt-2">
              <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} onNavigateToTab={setActiveTab} currentTab={activeTab} />
            </div>
            <TeachItTab lesson={lesson} />
          </TabsContent>
          <TabsContent value="learn" forceMount className="mt-0 p-0 w-full overflow-x-hidden data-[state=inactive]:hidden">
            <div className="px-2 pt-2">
              <StudyPlanBannerInline lessonId={lesson?.id} onNavigateToStudyPlan={() => setActiveTab('studyplan')} onNavigateToTab={setActiveTab} currentTab={activeTab} />
            </div>
            <LearnTab lesson={lesson} extractedContent={extractedContent} onNavigateToExam={() => setActiveTab('exam')} />
          </TabsContent>
          {showCramTab && (
            <TabsContent value="cram" forceMount className="mt-0 p-0 w-full overflow-x-hidden data-[state=inactive]:hidden">
              {contentLocked ? <DiagnosticLockOverlay onGoToPractice={() => setActiveTab('exam')} /> : <CramModeTab lesson={lesson} isCramActive={isCramActive} daysUntilExam={daysUntilExam} />}
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}