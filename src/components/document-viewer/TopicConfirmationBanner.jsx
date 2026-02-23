import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown, ChevronUp, Play, Sparkles, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function TopicConfirmationBanner({ lesson, onGoToDiagnostic, diagnosticReady, diagnosticCompleted }) {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const topics = lesson?.topics || [];

  // Don't show if no topics, already dismissed, or diagnostic already completed
  if (topics.length === 0 || dismissed || diagnosticCompleted) return null;

  // Check localStorage for dismissal
  const dismissKey = `topic_banner_dismissed_${lesson?.id}`;
  useEffect(() => {
    if (localStorage.getItem(dismissKey)) setDismissed(true);
  }, [lesson?.id]);

  const handleDismiss = () => {
    localStorage.setItem(dismissKey, 'true');
    setDismissed(true);
  };

  const topLevelTopics = topics.filter(t => t.title);
  const displayCount = expanded ? topLevelTopics.length : Math.min(topLevelTopics.length, 4);
  const hasMore = topLevelTopics.length > 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-2 md:mx-0 mb-3"
    >
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gradient-to-br from-emerald-950/40 to-teal-950/40 border-emerald-500/20' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'}`}>
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
              <BookOpen className={`w-4.5 h-4.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-sm font-bold mb-0.5 ${isDark ? 'text-emerald-200' : 'text-emerald-900'}`}>
                Your material is organized!
              </h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-emerald-300/70' : 'text-emerald-700/80'}`}>
                We've identified <span className="font-bold">{topLevelTopics.length} section{topLevelTopics.length !== 1 ? 's' : ''}</span> in your {lesson?.course_name || 'lesson'}
              </p>
            </div>
          </div>
        </div>

        {/* Topic pills */}
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5 mt-2">
            {topLevelTopics.slice(0, displayCount).map((topic, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium ${isDark ? 'bg-white/10 text-emerald-200' : 'bg-white text-emerald-800 shadow-sm border border-emerald-100'}`}
              >
                <CheckCircle2 className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                <span className="truncate max-w-[200px]">{topic.title}</span>
                {topic.subtopics?.length > 0 && (
                  <span className={`text-[9px] px-1 py-0.5 rounded ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-600'}`}>
                    {topic.subtopics.length}
                  </span>
                )}
              </motion.div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`flex items-center gap-1 mt-2 text-[10px] font-semibold ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Show less' : `+${topLevelTopics.length - 4} more sections`}
            </button>
          )}
        </div>

        {/* CTA */}
        <div className={`px-4 py-3 border-t ${isDark ? 'border-emerald-500/10 bg-emerald-950/20' : 'border-emerald-100 bg-emerald-50/50'}`}>
          <div className="flex items-center gap-2">
            <Button
              onClick={onGoToDiagnostic}
              disabled={!diagnosticReady}
              className={`flex-1 font-bold text-xs h-9 rounded-xl shadow-md ${diagnosticReady ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/20' : 'bg-slate-400 text-white/70 cursor-not-allowed'}`}
            >
              {diagnosticReady ? (
                <><Play className="w-3.5 h-3.5 mr-1.5" /> Take Diagnostic Quiz</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" /> Preparing Quiz...</>
              )}
            </Button>
            <button
              onClick={handleDismiss}
              className={`text-[10px] px-2 py-1.5 rounded-lg font-medium ${isDark ? 'text-emerald-400/60 hover:text-emerald-300' : 'text-emerald-500/60 hover:text-emerald-600'}`}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}