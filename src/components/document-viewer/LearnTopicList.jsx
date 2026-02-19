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
    <div className={`px-4 md:px-8 py-6 pb-12 w-full max-w-4xl mx-auto ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
            <span className="text-3xl">📚</span> Course Topics
          </h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Master your material one topic at a time
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-white/10 text-slate-300' : 'bg-white shadow-sm text-slate-600'}`}>
          {topics.length} Modules
        </div>
      </div>

      {/* Topic Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topics.map((topic, idx) => (
          <motion.button
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onSelectTopic(idx)}
            className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 group relative overflow-hidden ${
              currentTopicIndex === idx
                ? (isDark ? 'bg-purple-600/20 border-purple-500/50 ring-1 ring-purple-500/30' : 'bg-white border-purple-300 shadow-lg shadow-purple-100')
                : (isDark ? 'bg-[#12121a] border-white/5 hover:border-purple-500/30 hover:bg-white/5' : 'bg-white border-slate-100 hover:border-purple-200 hover:shadow-md')
            }`}
          >
            {/* Hover Gradient */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${
              isDark ? 'from-purple-500/5 to-transparent' : 'from-purple-50 to-transparent'
            }`} />

            <div className="relative flex gap-4 items-start">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                currentTopicIndex === idx
                  ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white'
                  : (isDark ? 'bg-white/10 text-purple-400' : 'bg-purple-50 text-purple-600')
              }`}>
                <span className="text-lg font-bold">{idx + 1}</span>
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className={`font-bold text-base mb-1.5 leading-tight ${isDark ? 'text-slate-100' : 'text-slate-900 group-hover:text-purple-700 transition-colors'}`}>
                  {topic.title}
                </h3>
                {topic.description && (
                  <p className={`text-sm leading-relaxed line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {topic.description}
                  </p>
                )}
                
                <div className={`mt-3 flex items-center text-xs font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'} opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0`}>
                  Start Lecture <ChevronRight className="w-3 h-3 ml-0.5" />
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}