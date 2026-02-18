import React from "react";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function LearnTopicList({ topics, currentTopicIndex, onSelectTopic, loading }) {
  const { isDark } = useTheme();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h3 className={`font-bold text-lg mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Analyzing Your Material</h3>
        <p className={`text-sm text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Breaking content into topics...</p>
        <Loader2 className="w-5 h-5 animate-spin text-purple-500 mt-4" />
      </div>
    );
  }

  if (!topics || topics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <BookOpen className={`w-12 h-12 mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No topics available</p>
      </div>
    );
  }

  return (
    <div className={`px-3 md:px-6 py-4 pb-8 w-full max-w-2xl mx-auto ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="mb-4">
        <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>📚 Learn Your Material</h2>
        <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Select a topic to hear an AI lecture with key concepts explained
        </p>
      </div>

      {/* Topic progress */}
      <div className={`text-xs font-medium mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {topics.length} topics from your material
      </div>

      {/* Topic Cards */}
      <div className="space-y-2">
        {topics.map((topic, idx) => (
          <motion.button
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onSelectTopic(idx)}
            className={`w-full text-left p-4 rounded-xl border transition-all group ${
              currentTopicIndex === idx
                ? (isDark ? 'bg-purple-600/20 border-purple-500/50 ring-1 ring-purple-500/30' : 'bg-purple-50 border-purple-300 ring-1 ring-purple-200')
                : (isDark ? 'bg-white/5 border-white/10 hover:border-purple-500/30 hover:bg-white/8' : 'bg-white border-slate-200 hover:border-purple-200 hover:shadow-sm')
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                currentTopicIndex === idx
                  ? 'bg-gradient-to-br from-purple-600 to-indigo-600'
                  : (isDark ? 'bg-white/10' : 'bg-purple-100')
              }`}>
                <span className={`text-sm font-bold ${currentTopicIndex === idx ? 'text-white' : (isDark ? 'text-purple-400' : 'text-purple-600')}`}>
                  {idx + 1}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {topic.title}
                </p>
                {topic.description && (
                  <p className={`text-[11px] mt-0.5 line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {topic.description}
                  </p>
                )}
              </div>

              <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${
                currentTopicIndex === idx ? 'text-purple-400' : (isDark ? 'text-slate-600' : 'text-slate-400')
              }`} />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}