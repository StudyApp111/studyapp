import React, { useState } from "react";
import { ChevronRight, ChevronDown, FolderOpen, BookOpen, Copy, Brain, Zap, FileText, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

const FORMAT_CONFIG = {
  "Review Notes": { icon: FileText, gradient: "from-emerald-500 to-teal-600", label: "Review Notes" },
  "Flashcards": { icon: Copy, gradient: "from-amber-500 to-orange-600", label: "Flashcards" },
  "Practice Test": { icon: Zap, gradient: "from-blue-500 to-indigo-600", label: "Practice Test" },
  "Feynman Technique": { icon: Brain, gradient: "from-violet-500 to-purple-600", label: "Feynman" },
};

export default function SectionCard({ section, index, defaultExpanded, onTopicClick, onAllTopicsClick }) {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const topics = section.suggested_topics || [];

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
            <p className={`font-bold text-sm leading-tight truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {section.section_title}
            </p>
            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {topics.length} suggested topics
            </p>
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
                  {/* Topic suggestions */}
                  {topics.map((topic, tIdx) => {
                    const formatCfg = FORMAT_CONFIG[topic.format] || FORMAT_CONFIG["Review Notes"];
                    const Icon = formatCfg.icon;

                    return (
                      <button
                        key={tIdx}
                        onClick={() => onTopicClick(section, topic)}
                        className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all group ${
                          isDark 
                            ? 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-white/15'
                            : 'bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${formatCfg.gradient} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold leading-tight truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {topic.topic_title}
                          </p>
                          <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {formatCfg.label}
                          </p>
                        </div>
                        <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
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
                      <p className={`text-xs font-semibold leading-tight ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                        All topics: Pick Your Format
                      </p>
                      <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
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