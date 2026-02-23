import React, { useState } from "react";
import { ChevronRight, ChevronDown, FolderOpen, Copy, Brain, Zap, FileText, Sparkles, Flame, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

const FORMAT_CONFIG = {
  "Review Notes": { icon: FileText, gradient: "from-emerald-500 to-teal-600", label: "Review Notes", actionLabel: "Review Notes" },
  "Flashcards": { icon: Copy, gradient: "from-amber-500 to-orange-600", label: "Flashcards", actionLabel: "Flashcards" },
  "Practice Test": { icon: Zap, gradient: "from-blue-500 to-indigo-600", label: "Practice Test", actionLabel: "Practice Test" },
  "Feynman Technique": { icon: Brain, gradient: "from-violet-500 to-purple-600", label: "Feynman (Concept Review)", actionLabel: "Feynman (Concept Review)" },
};

// Maps study plan task_type to topic format names for matching
const TASK_TYPE_TO_FORMAT = {
  review_notes: "Review Notes",
  flashcards: "Flashcards",
  practice_exam: "Practice Test",
  teach_it: "Feynman Technique"
};

export default function SectionCard({ section, index, defaultExpanded, onTopicClick, onAllTopicsClick, studyPlan }) {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const topics = section.suggested_topics || [];

  // Build a set of completed task types for cross-reference, SCOPED to this section
  const allTasks = studyPlan?.tasks || [];
  const sectionTitle = section.section_title || '';
  
  // Track completed tasks scoped by section AND topic
  const completedTaskKeys = new Set();
  const completedSectionFormatKeys = new Set();
  allTasks.forEach(task => {
    if (task.completed) {
      const format = TASK_TYPE_TO_FORMAT[task.task_type] || '';
      const taskTopics = task.focus_topics || [];
      const taskSection = task.section_title || '';
      
      // Track topic-level completion
      taskTopics.forEach(ft => {
        completedTaskKeys.add(`${ft}::${format}`);
      });
      
      // Track section-level completion (only if task belongs to THIS section)
      if (taskSection === sectionTitle) {
        completedSectionFormatKeys.add(format);
      }
    }
  });

  // Check if a topic is completed - match by focus_topics first, then section-scoped format
  const isTopicCompleted = (topic) => {
    // Direct match: task has this exact topic in focus_topics
    if (completedTaskKeys.has(`${topic.topic_title}::${topic.format}`)) return true;
    // Section-scoped fallback: task of this format completed FOR THIS SECTION
    return completedSectionFormatKeys.has(topic.format);
  };

  // Count completed
  const completedCount = topics.filter(t => isTopicCompleted(t)).length;
  const progressPercent = topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0;
  const allComplete = completedCount === topics.length && topics.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="w-full"
    >
      <div className={`rounded-2xl border overflow-hidden transition-all ${
        isDark 
          ? 'bg-white/[0.04] border-white/10 hover:border-purple-500/30' 
          : 'bg-white border-slate-200 hover:border-purple-300'
      } ${expanded ? (isDark ? 'border-purple-500/30' : 'border-purple-200') : ''}`}>
        
        {/* Section Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left px-4 py-3 flex items-center gap-3"
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isDark ? 'bg-purple-600/20' : 'bg-purple-100'
          }`}>
            <FolderOpen className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-base leading-tight truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {section.section_title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {completedCount > 0 ? (
                <>
                  <div className={`flex-1 h-1.5 rounded-full overflow-hidden max-w-[80px] ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${allComplete ? 'bg-emerald-500' : 'bg-purple-500'}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-bold ${allComplete ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-purple-400' : 'text-purple-600')}`}>
                    {progressPercent}%
                  </span>
                </>
              ) : (
                <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{topics.length} tasks</span>
              )}
              {topics.some(t => t.high_yield) && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  <Flame className="w-3 h-3" />{topics.filter(t => t.high_yield).length} high-yield
                </span>
              )}
            </div>
          </div>
          {expanded 
            ? <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            : <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          }
        </button>

        {/* Expanded Content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={`px-4 pb-3 space-y-2 ${isDark ? 'border-t border-white/5' : 'border-t border-slate-100'}`}>
                <div className="pt-2 space-y-2">
                  {/* Topic suggestions - numbered */}
                  {topics.map((topic, tIdx) => {
                    const formatCfg = FORMAT_CONFIG[topic.format] || FORMAT_CONFIG["Review Notes"];
                    const Icon = formatCfg.icon;
                    const completed = isTopicCompleted(topic);

                    return (
                      <button
                        key={tIdx}
                        onClick={() => !completed && onTopicClick(section, topic)}
                        disabled={completed}
                        className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all group ${
                          completed
                            ? isDark
                              ? 'bg-emerald-500/[0.08] border border-emerald-500/20 opacity-70'
                              : 'bg-emerald-50 border border-emerald-200 opacity-70'
                            : topic.high_yield
                              ? isDark 
                                ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.15] border border-amber-500/20 hover:border-amber-500/40'
                                : 'bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300'
                              : isDark 
                                ? 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-white/15'
                                : 'bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        {/* Number badge or checkmark */}
                        {completed ? (
                          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${formatCfg.gradient} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                            <span className="text-white text-xs font-black">{tIdx + 1}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-semibold leading-tight truncate ${
                              completed 
                                ? 'line-through ' + (isDark ? 'text-slate-500' : 'text-slate-400')
                                : isDark ? 'text-slate-200' : 'text-slate-800'
                            }`}>
                              {topic.topic_title}
                            </p>
                            {topic.high_yield && !completed && (
                              <span className={`flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                                <Flame className="w-2.5 h-2.5" />HIGH YIELD
                              </span>
                            )}
                          </div>
                          <p className={`text-[11px] mt-0.5 ${
                            completed
                              ? 'line-through ' + (isDark ? 'text-slate-600' : 'text-slate-300')
                              : isDark ? 'text-slate-500' : 'text-slate-400'
                          }`}>
                            {completed ? 'Completed ✓' : (
                              <>
                                <Icon className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                                {formatCfg.actionLabel}{topic.high_yield_reason ? ` · ${topic.high_yield_reason}` : ''}
                              </>
                            )}
                          </p>
                        </div>
                        {!completed && (
                          <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                        )}
                      </button>
                    );
                  })}

                  {/* All topics: Pick Your Format */}
                  <button
                    onClick={() => onAllTopicsClick(section)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all group border-2 border-dashed ${
                      isDark 
                        ? 'border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/10'
                        : 'border-purple-300 hover:border-purple-400 hover:bg-purple-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isDark ? 'bg-purple-600/20' : 'bg-purple-100'
                    }`}>
                      <Sparkles className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-tight ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                        All topics: Pick Your Format
                      </p>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Custom generation
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-purple-500' : 'text-purple-400'}`} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}