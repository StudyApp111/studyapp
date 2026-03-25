import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Lightbulb, RotateCcw, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import MathText from "@/components/math/MathText";
import CramSection from "./CramSection";
import { Calendar } from "lucide-react";

function CramUrgencyBanner({ daysUntilExam, isDark }) {
  if (daysUntilExam == null || daysUntilExam < 0) return null;
  const urgencyText = daysUntilExam === 0 ? "Your exam is TODAY!" 
    : daysUntilExam === 1 ? "Your exam is TOMORROW!" 
    : `${daysUntilExam} days until your exam`;
  const isVeryUrgent = daysUntilExam <= 2;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${
        isVeryUrgent 
          ? 'bg-red-500/15 border-red-500/30' 
          : 'bg-orange-500/15 border-orange-500/30'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isVeryUrgent ? 'bg-red-500/20' : 'bg-orange-500/20'}`}>
        <Calendar className={`w-4 h-4 ${isVeryUrgent ? 'text-red-400' : 'text-orange-400'}`} />
      </div>
      <div>
        <p className={`text-sm font-bold ${isVeryUrgent ? (isDark ? 'text-red-300' : 'text-red-700') : (isDark ? 'text-orange-300' : 'text-orange-700')}`}>
          {urgencyText}
        </p>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Focus on your weak spots below
        </p>
      </div>
    </motion.div>
  );
}

export default function CramModeTab({ lesson, isCramActive, daysUntilExam }) {
  const { isDark } = useTheme();
  const [review, setReview] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateReview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await base44.functions.invoke('generateCramReview', {
        lesson_id: lesson.id
      });
      if (data?.success) {
        setReview(data.review);
        setMeta({
          weak_areas: data.weak_areas,
          total_missed: data.total_missed,
          total_exams: data.total_exams_analyzed,
        });
      } else {
        setError(data?.error || 'Failed to generate review');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to generate review');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mb-6"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center shadow-2xl">
            <Zap className="w-10 h-10 text-white" />
          </div>
        </motion.div>
        <h3 className={`font-bold text-lg mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Analyzing Your Weak Spots...</h3>
        <p className={`text-sm text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Reviewing your exam history to build a focused review
        </p>
        <div className="flex gap-1.5 mt-4">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-orange-500"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Initial state — not generated yet
  if (!review) {
    return (
      <div className={`flex flex-col items-center p-4 pb-8 w-full gap-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
        {isCramActive && <div className="w-full max-w-md"><CramUrgencyBanner daysUntilExam={daysUntilExam} isDark={isDark} /></div>}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className={`border-2 shadow-2xl overflow-hidden ${isDark ? 'bg-[#12121a]/95 border-orange-500/30' : 'bg-white/95 border-orange-200'}`}>
            <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 px-5 py-6 text-center">
              <motion.div animate={{ rotate: [0, -8, 8, -8, 0] }} transition={{ duration: 0.6, delay: 0.2 }}>
                <Zap className="w-16 h-16 text-yellow-200 mx-auto mb-3 drop-shadow-lg" />
              </motion.div>
              <h3 className="text-xl font-black text-white mb-1">Cram Mode</h3>
              <p className="text-white/80 text-xs">AI-focused review of your weakest areas</p>
            </div>
            <div className="p-5 text-center">
              <p className={`mb-4 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Analyzes your exam results to identify exactly where you're struggling, then generates a targeted review with explanations, common mistakes, and quick self-tests.
              </p>

              <div className={`rounded-xl p-3 border mb-5 ${isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'}`}>
                <div className="flex items-center justify-center gap-2">
                  <Brain className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                  <span className={`text-xs font-medium ${isDark ? 'text-orange-300' : 'text-orange-800'}`}>
                    Built from your <span className="font-bold">actual mistakes</span>
                  </span>
                </div>
              </div>

              {error && (
                <div className={`rounded-xl p-3 border mb-4 text-left ${isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-xs ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
                </div>
              )}

              <Button
                onClick={generateReview}
                className="w-full h-14 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 hover:from-orange-600 hover:via-red-600 hover:to-pink-700 text-white font-bold text-lg rounded-xl shadow-xl"
              >
                <Zap className="w-5 h-5 mr-2" />
                Generate Cram Review
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Review generated — display it
  return (
    <div className={`px-3 py-4 pb-8 w-full max-w-2xl mx-auto space-y-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 rounded-2xl px-5 py-4 text-center shadow-lg">
          <h2 className="text-lg font-black text-white mb-1">{review.title || 'Cram Review'}</h2>
          <div className="flex items-center justify-center gap-3 text-xs text-white/80">
            <span>{meta?.total_exams} exam{meta?.total_exams !== 1 ? 's' : ''} analyzed</span>
            <span>•</span>
            <span>{meta?.total_missed} missed questions</span>
            <span>•</span>
            <span>{review.sections?.length} focus areas</span>
          </div>
        </div>
      </motion.div>

      {/* Weak Areas Pills */}
      {meta?.weak_areas?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {meta.weak_areas.map((w, i) => (
            <Badge key={i} className={`text-[10px] ${isDark ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200'}`}>
              <AlertTriangle className="w-3 h-3 mr-1" />
              {w.competency} ({w.missed_count}x)
            </Badge>
          ))}
        </div>
      )}

      {/* Sections */}
      {review.sections?.map((section, idx) => (
        <CramSection key={idx} section={section} index={idx} isDark={isDark} />
      ))}

      {/* Summary */}
      {review.summary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className={`rounded-2xl p-4 border text-center ${isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}
        >
          <CheckCircle2 className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
          <p className={`text-sm leading-relaxed ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>{review.summary}</p>
        </motion.div>
      )}

      {/* Regenerate */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={generateReview} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Regenerate Review
        </Button>
      </div>
    </div>
  );
}