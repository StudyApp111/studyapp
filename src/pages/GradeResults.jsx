import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, CheckCircle2, AlertCircle, TrendingUp, 
  FileText, ChevronDown, ChevronUp, Loader2, AlertTriangle
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
    if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
    if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
    if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  const getGradeBadgeColor = (grade) => {
    if (!grade) return 'bg-slate-100 text-slate-700';
    if (grade.startsWith('A')) return 'bg-emerald-100 text-emerald-700';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-700';
    if (grade.startsWith('C')) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-4 md:p-10 pb-28 md:pb-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            onClick={() => navigate(createPageUrl("AssignmentHistory"))}
            variant="ghost"
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to History
          </Button>

          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
            {assignment?.assignment_title}
          </h1>
          <p className="text-slate-600">{assignment?.course_name}</p>
        </div>

        {/* Missing References Warning */}
        {result?.missing_references_flag && result.missing_references_flag !== "None" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">{result.missing_references_flag}</p>
                <p className="text-amber-700 text-xs mt-1">
                  Some referenced materials (appendices, figures, etc.) were not included in the submission.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Grade Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getGradeColor(result?.predicted_grade)} p-6 shadow-xl`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
            
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider mb-1">Predicted Grade</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-black text-white">{result?.predicted_grade || '—'}</span>
                  {result?.total_score !== undefined && (
                    <span className="text-white/80 text-lg font-medium">{Math.round(result.total_score)}%</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs mb-1">AI Confidence</p>
                <p className="text-white text-sm font-semibold">High</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Summary */}
        {result?.overall_performance_summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="mb-6 shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  Performance Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 leading-relaxed">{result.overall_performance_summary}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Strengths & Improvements */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Strengths */}
          {result?.identified_strengths?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="h-full shadow-lg border-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-5 h-5" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.identified_strengths.map((strength, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                        <span className="text-sm text-slate-700">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Areas for Improvement */}
          {result?.areas_for_improvement?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="h-full shadow-lg border-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                    <TrendingUp className="w-5 h-5" />
                    Areas to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.areas_for_improvement.map((area, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                        <span className="text-sm text-slate-700">{area}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Rubric Breakdown */}
        {result?.rubric_breakdown?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="mb-6 shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Rubric Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.rubric_breakdown.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900 text-sm">{item.criterion}</span>
                      <span className="text-sm font-semibold text-purple-700">
                        {item.score}/{item.max_score}
                      </span>
                    </div>
                    <Progress value={(item.score / item.max_score) * 100} className="h-2" />
                    {item.comments && (
                      <p className="text-xs text-slate-600">{item.comments}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Detailed Feedback by Section */}
        {result?.detailed_feedback_by_section?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Detailed Section Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.detailed_feedback_by_section.map((section, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection(idx)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">{section.section_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {section.points_earned}/{section.points_possible}
                        </Badge>
                      </div>
                      {expandedSections[idx] ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                    <AnimatePresence>
                      {expandedSections[idx] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-200"
                        >
                          <div className="p-4 bg-slate-50">
                            <p className="text-sm text-slate-700 mb-3">{section.feedback}</p>
                            {section.competencies_assessed?.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {section.competencies_assessed.map((comp, cidx) => (
                                  <Badge key={cidx} variant="secondary" className="text-xs">
                                    {comp}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => navigate(createPageUrl("SmartGrader"))}
            className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
          >
            Grade Another Assignment
          </Button>
          <Button
            onClick={() => navigate(createPageUrl("AssignmentHistory"))}
            variant="outline"
            className="flex-1"
          >
            View All History
          </Button>
        </div>
      </div>
    </div>
  );
}