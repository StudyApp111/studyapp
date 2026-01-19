import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, CheckCircle2, TrendingUp, 
  ChevronDown, Loader2, AlertTriangle, Sparkles, Award
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function GradeResults() {
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    loadAssignment();
  }, []);

  const loadAssignment = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const assignmentId = urlParams.get('assignmentId');
      
      if (!assignmentId) {
        navigate(createPageUrl("SmartGrader"));
        return;
      }

      const assignments = await base44.entities.GradedAssignment.filter({ id: assignmentId });
      if (assignments.length === 0) {
        navigate(createPageUrl("SmartGrader"));
        return;
      }

      setAssignment(assignments[0]);
      setLoading(false);
    } catch (error) {
      console.error("Error loading assignment:", error);
      navigate(createPageUrl("SmartGrader"));
    }
  };

  const getGradeColor = (grade) => {
    if (!grade) return 'from-slate-500 to-slate-600';
    if (grade.startsWith('A')) return 'from-emerald-500 via-teal-500 to-cyan-500';
    if (grade.startsWith('B')) return 'from-blue-500 via-indigo-500 to-purple-500';
    if (grade.startsWith('C')) return 'from-amber-500 via-orange-500 to-red-400';
    return 'from-red-500 via-rose-500 to-pink-500';
  };

  const toggleSection = (idx) => {
    setExpandedSections(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const result = assignment?.grading_result;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 pb-28 md:pb-10">
      {/* Back Button */}
      <div className="p-4">
        <Button
          onClick={() => navigate(createPageUrl("AssignmentHistory"))}
          variant="ghost"
          className="gap-2 text-white/70 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Hero Grade Section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="px-4 pb-8"
      >
        <div className="max-w-sm mx-auto text-center">
          {/* Glowing Grade Circle */}
          <div className="relative mb-6">
            <div className={`absolute inset-0 blur-3xl opacity-50 bg-gradient-to-br ${getGradeColor(result?.predicted_grade)} rounded-full scale-75`} />
            <div className={`relative w-40 h-40 mx-auto rounded-full bg-gradient-to-br ${getGradeColor(result?.predicted_grade)} flex items-center justify-center shadow-2xl`}>
              <div className="text-center">
                <span className="text-6xl font-black text-white drop-shadow-lg">{result?.predicted_grade || '—'}</span>
              </div>
            </div>
            {/* Sparkle decorations */}
            <Sparkles className="absolute top-2 right-1/4 w-6 h-6 text-yellow-300 animate-pulse" />
            <Award className="absolute bottom-4 left-1/4 w-5 h-5 text-yellow-300/70" />
          </div>

          {/* Score */}
          {result?.total_score !== undefined && (
            <div className="mb-3">
              <span className="text-4xl font-bold text-white">{Math.round(result.total_score)}%</span>
            </div>
          )}

          {/* Assignment Info */}
          <h1 className="text-xl font-bold text-white mb-1">{assignment?.assignment_title}</h1>
          <p className="text-purple-200 text-sm">{assignment?.course_name}</p>

          {/* Missing References Warning */}
          {result?.missing_references_flag && result.missing_references_flag !== "None" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <div className="bg-amber-500/20 border border-amber-400/30 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <p className="text-amber-200 text-xs text-left">Missing referenced materials may affect accuracy</p>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Content Section - White Background */}
      <div className="bg-white rounded-t-3xl min-h-[50vh] px-4 pt-6 pb-8">
        <div className="max-w-lg mx-auto space-y-6">
          
          {/* Summary */}
          {result?.overall_performance_summary && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <p className="text-slate-600 leading-relaxed text-sm">{result.overall_performance_summary}</p>
            </motion.div>
          )}

          {/* Strengths */}
          {result?.identified_strengths?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-emerald-800">Strengths</h3>
              </div>
              <ul className="space-y-2">
                {result.identified_strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                    <span className="text-sm text-emerald-700">{strength}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Areas for Improvement */}
          {result?.areas_for_improvement?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-amber-50 rounded-2xl p-4 border border-amber-100"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-amber-800">Areas to Improve</h3>
              </div>
              <ul className="space-y-2">
                {result.areas_for_improvement.map((area, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                    <span className="text-sm text-amber-700">{area}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Rubric Breakdown */}
          {result?.rubric_breakdown?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <Award className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-slate-900">Rubric Breakdown</h3>
              </div>
              <div className="space-y-3">
                {result.rubric_breakdown.map((item, idx) => {
                  const percentage = (item.score / item.max_score) * 100;
                  const getScoreColor = () => {
                    if (percentage >= 80) return 'from-emerald-500 to-teal-500';
                    if (percentage >= 60) return 'from-blue-500 to-indigo-500';
                    if (percentage >= 40) return 'from-amber-500 to-orange-500';
                    return 'from-red-500 to-rose-500';
                  };
                  
                  return (
                    <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 text-sm mb-1">{item.criterion}</h4>
                          {item.comments && (
                            <p className="text-xs text-slate-500 leading-relaxed">{item.comments}</p>
                          )}
                        </div>
                        <div className={`ml-3 px-3 py-1.5 rounded-xl bg-gradient-to-r ${getScoreColor()} flex-shrink-0`}>
                          <span className="text-sm font-black text-white">{item.score}/{item.max_score}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${getScoreColor()} rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Detailed Feedback */}
          {result?.detailed_feedback_by_section?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-slate-900">Section Feedback</h3>
              </div>
              <div className="space-y-3">
                {result.detailed_feedback_by_section.map((section, idx) => {
                  const isExpanded = expandedSections[idx];
                  const percentage = section.points_possible > 0 
                    ? (section.points_earned / section.points_possible) * 100 
                    : 0;
                  
                  return (
                    <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <button
                        onClick={() => toggleSection(idx)}
                        className="w-full p-4 text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              percentage >= 70 
                                ? 'bg-emerald-100 text-emerald-600' 
                                : percentage >= 50 
                                  ? 'bg-amber-100 text-amber-600'
                                  : 'bg-red-100 text-red-600'
                            }`}>
                              <span className="text-sm font-black">{Math.round(percentage)}%</span>
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-slate-900 text-sm truncate">{section.section_name}</h4>
                              <p className="text-[11px] text-slate-500">
                                {section.points_earned}/{section.points_possible} points
                              </p>
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${
                            isExpanded ? 'bg-purple-100 rotate-180' : 'bg-slate-100'
                          }`}>
                            <ChevronDown className={`w-4 h-4 ${isExpanded ? 'text-purple-600' : 'text-slate-400'}`} />
                          </div>
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-slate-100"
                          >
                            <div className="p-4 bg-gradient-to-b from-slate-50 to-white">
                              <p className="text-sm text-slate-700 leading-relaxed mb-3">{section.feedback}</p>
                              {section.competencies_assessed?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {section.competencies_assessed.map((comp, cidx) => (
                                    <span key={cidx} className="text-[10px] font-medium bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                      {comp}
                                    </span>
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
            </motion.div>
          )}

          {/* Actions */}
          <div className="pt-4 flex flex-col gap-3">
            <Button
              onClick={() => navigate(createPageUrl("SmartGrader"))}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 h-12 text-base font-semibold rounded-xl"
            >
              Grade Another Assignment
            </Button>
            <Button
              onClick={() => navigate(createPageUrl("AssignmentHistory"))}
              variant="outline"
              className="w-full h-12 rounded-xl"
            >
              View All History
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}