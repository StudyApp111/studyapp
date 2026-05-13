import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookMarked, Zap, Brain, ChevronRight, ChevronDown, 
  Target, Headphones, FlameKindling, Sparkles, ArrowLeft
} from "lucide-react";
import AITutorPanel from "./AITutorPanel";
import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * PracticeSidebar — right-hand pane that consolidates AI chat + practice activities.
 * Two view modes:
 *  - "hub" (default): AI chat on top + practice cards below
 *  - "activity": full-pane view of a specific practice activity (flashcards, exam, etc.)
 */
export default function PracticeSidebar({
  lesson,
  exams,
  messages,
  setMessages,
  aiInput,
  setAiInput,
  aiLoading,
  setAiLoading,
  activeActivity,
  onSelectActivity,
  onBackToHub,
  children,
  showStudyPlanDot,
  showFlashcardsDot,
  showTeachItDot,
  showExamDot,
  isCramActive,
  showCramTab,
  isDark: isDarkProp,
}) {
  const themeCtx = useTheme();
  const isDark = isDarkProp !== undefined ? isDarkProp : themeCtx.isDark;
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Primary practice activities — always visible
  const primaryActivities = [
    {
      id: 'flashcards',
      label: 'Flashcards',
      sublabel: 'Study with active recall',
      icon: BookMarked,
      gradient: 'from-purple-500 to-pink-500',
      bg: isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200',
      iconColor: isDark ? 'text-purple-400' : 'text-purple-600',
      dot: showFlashcardsDot,
    },
    {
      id: 'exam',
      label: 'Quizzes',
      sublabel: 'Test your knowledge',
      icon: Zap,
      gradient: 'from-blue-500 to-cyan-500',
      bg: isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200',
      iconColor: isDark ? 'text-blue-400' : 'text-blue-600',
      dot: showExamDot,
      popular: true,
    },
    {
      id: 'teachit',
      label: 'Teach It',
      sublabel: 'Explain it in your own words',
      icon: Brain,
      gradient: 'from-amber-500 to-orange-500',
      bg: isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200',
      iconColor: isDark ? 'text-amber-400' : 'text-amber-600',
      dot: showTeachItDot,
    },
  ];

  // Secondary activities — collapsible
  const advancedActivities = [
    {
      id: 'studyplan',
      label: 'Study Plan',
      sublabel: 'Personalized roadmap',
      icon: Target,
      iconColor: isDark ? 'text-amber-400' : 'text-amber-600',
      dot: showStudyPlanDot,
    },
    {
      id: 'learn',
      label: 'Audio Lectures',
      sublabel: 'Learn by listening',
      icon: Headphones,
      iconColor: isDark ? 'text-slate-400' : 'text-slate-600',
    },
    ...(showCramTab ? [{
      id: 'cram',
      label: 'Cram Mode',
      sublabel: 'Last-minute exam prep',
      icon: FlameKindling,
      iconColor: isDark ? 'text-orange-400' : 'text-orange-600',
      activePulse: isCramActive,
    }] : []),
  ];

  // ACTIVITY VIEW — when a practice activity is selected
  if (activeActivity && activeActivity !== 'hub') {
    return (
      <div className={`flex-1 rounded-xl shadow-xl border flex flex-col overflow-hidden ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-purple-200'}`} style={{ height: '100%' }}>
        {/* Activity header with back button */}
        <div className={`px-3 py-2.5 flex items-center gap-2 border-b flex-shrink-0 ${isDark ? 'bg-[#1a1a2e] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToHub}
            className={`h-8 px-2 ${isDark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200'}`}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {[...primaryActivities, ...advancedActivities].find(a => a.id === activeActivity)?.label || 'Practice'}
            </h3>
          </div>
        </div>

        {/* Activity content — rendered by parent */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    );
  }

  // HUB VIEW — AI chat + practice cards
  return (
    <div className="flex-1 flex flex-col gap-2 overflow-hidden" style={{ height: '100%' }}>
      {/* AI Chat — takes ~55% of height */}
      <div className="flex-shrink-0" style={{ height: '55%', minHeight: '300px' }}>
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

      {/* Practice activities — scrollable bottom section */}
      <div className={`flex-1 rounded-xl shadow-xl border overflow-y-auto ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-purple-200'}`}>
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <h3 className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Practice
            </h3>
          </div>

          {/* Primary activities — large cards (Turbo-style) */}
          <div className="grid grid-cols-1 gap-2">
            {primaryActivities.map((activity) => {
              const Icon = activity.icon;
              return (
                <button
                  key={activity.id}
                  onClick={() => onSelectActivity(activity.id)}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all hover:scale-[1.01] hover:shadow-md text-left ${activity.bg}`}
                >
                  {activity.dot && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${activity.gradient} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {activity.label}
                      </span>
                      {activity.popular && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                          Popular
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {activity.sublabel}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </button>
              );
            })}
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`mt-3 w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-50 text-slate-500'}`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide">More tools</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 gap-1.5 mt-1.5">
                  {advancedActivities.map((activity) => {
                    const Icon = activity.icon;
                    return (
                      <button
                        key={activity.id}
                        onClick={() => onSelectActivity(activity.id)}
                        className={`relative flex items-center gap-2.5 p-2 rounded-lg border transition-all hover:bg-opacity-80 text-left ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'} ${activity.activePulse ? 'ring-1 ring-orange-500/40' : ''}`}
                      >
                        {activity.dot && (
                          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
                        )}
                        {activity.activePulse && (
                          <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                        )}
                        <Icon className={`w-4 h-4 flex-shrink-0 ${activity.iconColor}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {activity.label}
                          </p>
                          <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            {activity.sublabel}
                          </p>
                        </div>
                        <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}