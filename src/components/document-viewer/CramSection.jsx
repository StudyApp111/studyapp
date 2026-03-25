import React, { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Lightbulb, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import MathText from "@/components/math/MathText";

const DIFFICULTY_CONFIG = {
  high: { color: 'red', label: 'High Priority', icon: '🔴' },
  medium: { color: 'amber', label: 'Medium', icon: '🟡' },
  low: { color: 'emerald', label: 'Low', icon: '🟢' },
};

export default function CramSection({ section, index, isDark }) {
  const [expanded, setExpanded] = useState(index === 0);
  const [showAnswer, setShowAnswer] = useState(false);

  const diff = DIFFICULTY_CONFIG[section.difficulty] || DIFFICULTY_CONFIG.medium;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'}`}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
      >
        <span className="text-lg flex-shrink-0">{diff.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold text-sm truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{section.heading}</h3>
          <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{diff.label}</span>
        </div>
        {expanded ? (
          <ChevronUp className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        ) : (
          <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        )}
      </button>

      {/* Body — expandable */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="px-4 pb-4 space-y-3"
        >
          {/* Key Concept */}
          <div className={`rounded-xl p-3 border ${isDark ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50 border-purple-200'}`}>
            <div className={`flex items-center gap-1.5 mb-1.5 text-xs font-bold ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
              <Lightbulb className="w-3.5 h-3.5" /> Key Concept
            </div>
            <MathText className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {section.key_concept}
            </MathText>
          </div>

          {/* Common Mistake */}
          <div className={`rounded-xl p-3 border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
            <div className={`flex items-center gap-1.5 mb-1.5 text-xs font-bold ${isDark ? 'text-red-400' : 'text-red-700'}`}>
              <AlertTriangle className="w-3.5 h-3.5" /> Common Mistake
            </div>
            <MathText className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {section.common_mistake}
            </MathText>
          </div>

          {/* Correct Approach */}
          <div className={`rounded-xl p-3 border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className={`flex items-center gap-1.5 mb-1.5 text-xs font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Correct Approach
            </div>
            <MathText className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {section.correct_approach}
            </MathText>
          </div>

          {/* Quick Test */}
          {section.quick_test && (
            <div className={`rounded-xl p-3 border ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
              <div className={`flex items-center justify-between mb-1.5`}>
                <span className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>⚡ Quick Self-Test</span>
                <button
                  onClick={() => setShowAnswer(!showAnswer)}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${isDark ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                >
                  {showAnswer ? 'Hide Answer' : 'Show Answer'}
                </button>
              </div>
              <MathText className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'} ${!showAnswer ? 'blur-sm select-none' : ''}`}>
                {section.quick_test}
              </MathText>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}