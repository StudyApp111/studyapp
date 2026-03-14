import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, CheckCircle2, TrendingUp, AlertCircle,
  ChevronDown, Loader2, Sparkles, Award, ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

const getGradeColor = (percentage) => {
  if (percentage >= 90) return { gradient: 'from-emerald-500 to-teal-600' };
  if (percentage >= 80) return { gradient: 'from-blue-500 to-indigo-600' };
  if (percentage >= 70) return { gradient: 'from-purple-500 to-violet-600' };
  if (percentage >= 60) return { gradient: 'from-orange-500 to-amber-600' };
  return { gradient: 'from-red-500 to-rose-600' };
};

const getGradeFromScore = (score) => {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D+';
  if (score >= 45) return 'D';
  return 'F';
};

export default function GradeResults() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    loadAssignment();
  }, []);

  const loadAssignment = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('assignmentId');
    if (!assignmentId) { navigate(createPageUrl("SmartGrader")); return; }
    const assignments = await base44.entities.GradedAssignment.filter({ id: assignmentId });
    if (assignments.length === 0) { navigate(createPageUrl("SmartGrader")); return; }
    setAssignment(assignments[0]);
    setLoading(false);
  };

  const toggleSection = (idx) => {
    setExpandedSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-4">
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/e6f13a569_LogoOnly.png" alt="StudyApp Logo" className="w-10 h-10" />
            <h1 className="text-3xl font-black">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300">Study</span>
              <span className="text-white">App</span>
            </h1>
          </div>
          <Award className="h-16 w-16 text-purple-400 mx-auto animate-bounce" />
          <h2 className="text-xl font-bold text-white">Analyzing Your Assignment...</h2>
        </div>
      </div>
    );
  }

  const result = assignment?.grading_result;
  const grade = result?.predicted_grade || getGradeFromScore(result?.total_score || 0);
  const percentage = Math.round(result?.total_score || 0);
  const gradeColors = getGradeColor(percentage);

  return (
    <div className="min-h-screen bg-slate-950 overflow-y-auto pb-28 md:pb-10">
      {/* Gradient hero top */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-purple-900/60 via-indigo-950/40 to-transparent" />
        <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-br from-purple-600/20 via-pink-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg sm:max-w-xl md:max-w-2xl mx-auto px-4 sm:px-5 pt-6 space-y-6">
        {/* Back Button */}
        <Button
          onClick={() => navigate(createPageUrl("AssignmentHistory"))}
          variant="ghost"
          className="hidden md:flex gap-2 text-white/70 hover:text-white hover:bg-white/10 -ml-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/e6f13a569_LogoOnly.png" alt="StudyApp Logo" className="w-10 h-10 sm:w-12 sm:h-12" />
          <h1 className="text-3xl sm:text-4xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* ========== GRADE BANNER ========== */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradeColors.gradient} p-[2px] w-full shadow-lg`}>
          <div className="bg-slate-900 rounded-[14px] p-5 sm:p-6">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br ${gradeColors.gradient} flex flex-col items-center justify-center flex-shrink-0 shadow-lg`}>
                <span className="text-3xl sm:text-4xl font-black text-white leading-none">{grade}</span>
                <span className="text-white/70 text-xs sm:text-sm font-semibold">{percentage}%</span>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white truncate">{assignment?.assignment_title}</h2>
                <p className="text-slate-400 text-sm">{assignment?.course_name}</p>
                {result?.missing_references_flag && result.missing_references_flag !== "None" && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Missing references may affect accuracy
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========== SUMMARY ========== */}
        {result?.overall_performance_summary && (
          <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-700/50 w-full">
            <div className="border-l-4 border-purple-500 pl-4 py-1">
              <p className="text-white text-sm sm:text-base leading-relaxed">{result.overall_performance_summary}</p>
            </div>
          </div>
        )}

        {/* ========== STRENGTHS ========== */}
        {result?.identified_strengths?.length > 0 && (
          <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-emerald-500/30 w-full">
            <h4 className="text-base font-bold text-emerald-400 mb-4">Where you're already strong</h4>
            <div className="space-y-3">
              {result.identified_strengths.map((strength, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/90 text-sm">{strength}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== AREAS TO IMPROVE — styled like "WHERE YOU'RE LOSING POINTS" ========== */}
        {result?.areas_for_improvement?.length > 0 && (
          <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-red-500/40 w-full">
            <h4 className="text-base sm:text-lg font-bold text-red-400 mb-5 flex items-center gap-2 uppercase tracking-wide">
              <AlertCircle className="w-5 h-5" />
              WHERE TO IMPROVE
            </h4>
            <div className="space-y-4">
              {result.areas_for_improvement.map((area, idx) => {
                const borderColor = idx === 0 ? 'border-l-red-500' : idx === 1 ? 'border-l-orange-500' : 'border-l-yellow-500';
                return (
                  <div key={idx} className={`bg-slate-800 rounded-xl p-4 sm:p-5 border-l-4 ${borderColor} border border-slate-700 w-full`}>
                    <div className="flex items-start gap-3">
                      <span className={`text-xl font-black ${idx === 0 ? 'text-red-400' : idx === 1 ? 'text-orange-400' : 'text-yellow-400'}`}>#{idx + 1}</span>
                      <p className="font-medium text-white text-sm sm:text-base flex-1">{area}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========== RUBRIC BREAKDOWN ========== */}
        {result?.rubric_breakdown?.length > 0 && (
          <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-purple-500/30 w-full">
            <h4 className="text-lg sm:text-xl font-black text-white mb-5 flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-400" /> Rubric Breakdown
            </h4>
            <div className="space-y-3">
              {result.rubric_breakdown.map((item, idx) => {
                const pct = (item.score / item.max_score) * 100;
                const barColor = pct >= 80 ? 'from-emerald-500 to-teal-500' : pct >= 60 ? 'from-blue-500 to-indigo-500' : pct >= 40 ? 'from-amber-500 to-orange-500' : 'from-red-500 to-rose-500';
                return (
                  <div key={idx} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-semibold text-white text-sm flex-1">{item.criterion}</h5>
                      <span className={`ml-3 px-2.5 py-1 rounded-lg bg-gradient-to-r ${barColor} text-white text-xs font-black flex-shrink-0`}>
                        {item.score}/{item.max_score}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-white/10">
                      <div className={`h-full bg-gradient-to-r ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    {item.comments && <p className="text-slate-400 text-xs mt-2 leading-relaxed">{item.comments}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========== SECTION FEEDBACK ========== */}
        {result?.detailed_feedback_by_section?.length > 0 && (
          <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-700/50 w-full">
            <h4 className="text-lg sm:text-xl font-black text-white mb-5 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" /> Section Feedback
            </h4>
            <div className="space-y-3">
              {result.detailed_feedback_by_section.map((section, idx) => {
                const isExpanded = expandedSections[idx];
                const pct = section.points_possible > 0 ? (section.points_earned / section.points_possible) * 100 : 0;
                const pillColor = pct >= 70 ? 'bg-emerald-500/20 text-emerald-400' : pct >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400';

                return (
                  <div key={idx} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <button onClick={() => toggleSection(idx)} className="w-full p-4 text-left hover:bg-white/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${pillColor}`}>{Math.round(pct)}%</span>
                          <div className="min-w-0">
                            <h5 className="font-semibold text-white text-sm truncate">{section.section_name}</h5>
                            <p className="text-slate-500 text-[11px]">{section.points_earned}/{section.points_possible} points</p>
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-700"
                        >
                          <div className="p-4 bg-slate-800/50">
                            <p className="text-slate-300 text-sm leading-relaxed mb-3">{section.feedback}</p>
                            {section.competencies_assessed?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {section.competencies_assessed.map((comp, cidx) => (
                                  <span key={cidx} className="text-[10px] font-medium px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">{comp}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========== FINAL CTA ========== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 p-5 sm:p-7 shadow-2xl w-full">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="relative text-center space-y-4">
            <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">Ready to improve?</h3>
            <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}>
              <Button
                onClick={() => navigate(createPageUrl("SmartGrader"))}
                className="w-full bg-white hover:bg-slate-100 text-purple-700 font-black py-4 sm:py-5 text-base sm:text-lg rounded-xl shadow-xl shadow-black/20 transition-all hover:scale-[1.02] min-h-[52px]"
              >
                Grade Another Assignment <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </motion.div>
            <Button
              onClick={() => navigate(createPageUrl("AssignmentHistory"))}
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              View All History
            </Button>
          </div>
        </div>

        <div className="text-center pb-8">
          <p className="text-slate-600 text-xs">Powered by StudyApp.AI</p>
        </div>
      </div>
    </div>
  );
}