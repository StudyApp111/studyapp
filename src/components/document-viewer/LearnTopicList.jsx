import React from "react";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, Loader2, Headphones, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className={`px-4 md:px-8 py-6 pb-12 w-full max-w-3xl mx-auto ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className={`text-xl md:text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              AI Voice Lectures
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {topics.length} topics from your material
            </p>
          </div>
        </div>
      </div>

      {/* Helpful tip */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-5 ${isDark ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-100'}`}>
        <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
        <p className={`text-xs ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
          Tap a topic to generate a detailed AI lecture. You can read along or listen with text-to-speech.
        </p>
      </div>

      {/* Topic List */}
      <div className="space-y-3">
        {topics.map((topic, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06, duration: 0.3 }}
          >
            <button
              onClick={() => onSelectTopic(idx)}
              className={`w-full text-left rounded-2xl border transition-all duration-200 group overflow-hidden ${
                currentTopicIndex === idx
                  ? (isDark ? 'bg-purple-600/15 border-purple-500/40 shadow-lg shadow-purple-500/10' : 'bg-white border-purple-300 shadow-lg shadow-purple-100')
                  : (isDark ? 'bg-[#12121a] border-white/5 hover:border-purple-500/25 hover:bg-[#16162a]' : 'bg-white border-slate-100 hover:border-purple-200 hover:shadow-md')
              }`}
            >
              <div className="flex items-start gap-4 p-4 md:p-5">
                {/* Topic Number */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-base transition-all ${
                  currentTopicIndex === idx
                    ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30'
                    : (isDark ? 'bg-white/8 text-purple-400 group-hover:bg-purple-500/20' : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100')
                }`}>
                  {idx + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold text-sm md:text-base leading-snug mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {topic.title}
                  </h3>
                  {topic.description && (
                    <p className={`text-xs md:text-sm leading-relaxed line-clamp-2 mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {topic.description}
                    </p>
                  )}
                  
                  {/* CTA */}
                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-all ${
                    isDark ? 'text-purple-400 group-hover:text-purple-300' : 'text-purple-600 group-hover:text-purple-700'
                  }`}>
                    <Headphones className="w-3.5 h-3.5" />
                    Listen to Lecture
                    <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}