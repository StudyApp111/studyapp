import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Award, TrendingUp, CheckCircle, Target, Home, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

export default function GradeResults() {
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('assignmentId');
    
    if (!assignmentId) {
      navigate(createPageUrl("SmartGrader"));
      return;
    }

    loadResults(assignmentId);
  }, [navigate]);

  const loadResults = async (assignmentId) => {
    setIsLoading(true);
    try {
      const assignmentData = await base44.entities.GradedAssignment.filter({ id: assignmentId });
      if (assignmentData.length === 0) {
        navigate(createPageUrl("SmartGrader"));
        return;
      }
      setAssignment(assignmentData[0]);
    } catch (error) {
      console.error("Error loading results:", error);
      navigate(createPageUrl("SmartGrader"));
    }
    setIsLoading(false);
  };

  if (isLoading || !assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    );
  }

  const result = assignment.grading_result;

  const getGradeColor = (grade) => {
    if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
    if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
    if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-pink-600';
  };

  const getGradeEmoji = (grade) => {
    if (grade.startsWith('A')) return '🎉';
    if (grade.startsWith('B')) return '👍';
    if (grade.startsWith('C')) return '📚';
    if (grade.startsWith('D')) return '📈';
    return '🎯';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg mb-6">
            <Award className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-slate-700">Assignment Graded</span>
          </div>
          
          <h1 className="text-2xl md:text-4xl font-bold text-slate-900 mb-2">
            {assignment.assignment_title}
          </h1>
          <p className="text-slate-600 mb-4">{assignment.course_name}</p>
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-block scale-75 md:scale-100 origin-top"
          >
            <div className={`px-12 md:px-16 py-6 md:py-8 rounded-3xl bg-gradient-to-r ${getGradeColor(result.predicted_grade)} shadow-2xl mb-4`}>
              <div className="text-6xl md:text-8xl font-bold text-white mb-2">
                {result.predicted_grade} {getGradeEmoji(result.predicted_grade)}
              </div>
              <div className="text-xl md:text-2xl text-white font-semibold">
                {Math.round(result.total_score)}%
              </div>
            </div>
          </motion.div>

          {result.overall_performance_summary && (
            <p className="text-base md:text-lg text-slate-700 max-w-3xl mx-auto mt-6 leading-relaxed">
              {result.overall_performance_summary}
            </p>
          )}
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="shadow-xl border-0 h-full bg-gradient-to-br from-emerald-50 to-teal-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-700">
                  <TrendingUp className="w-5 h-5" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {result.identified_strengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="shadow-xl border-0 h-full bg-gradient-to-br from-amber-50 to-orange-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <TrendingDown className="w-5 h-5" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {result.areas_for_improvement.map((area, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Target className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">{area}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {result.rubric_breakdown && result.rubric_breakdown.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <Card className="shadow-2xl border-0">
              <CardHeader>
                <CardTitle className="text-2xl">Rubric Breakdown</CardTitle>
                <p className="text-slate-600">Detailed scoring across assessment criteria</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.rubric_breakdown.map((criterion, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + (idx * 0.05) }}
                      className="p-6 rounded-xl border-2 border-purple-200 bg-purple-50/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-900 text-lg mb-1">
                            {criterion.criterion}
                          </h4>
                          <Badge variant="outline" className="bg-white">
                            {criterion.score}/{criterion.max_score} points
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-600">
                            {Math.round((criterion.score / criterion.max_score) * 100)}%
                          </div>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-purple-200">
                        <p className="text-sm text-slate-700 leading-relaxed">{criterion.comments}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {result.detailed_feedback_by_section && result.detailed_feedback_by_section.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <Card className="shadow-2xl border-0">
              <CardHeader>
                <CardTitle className="text-2xl">Section-by-Section Feedback</CardTitle>
                <p className="text-slate-600">Detailed analysis of each part of your assignment</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.detailed_feedback_by_section.map((section, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + (idx * 0.05) }}
                      className="p-6 rounded-xl border-2 border-blue-200 bg-blue-50/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-900 text-lg mb-2">
                            {section.section_name}
                          </h4>
                          {section.competencies_assessed && section.competencies_assessed.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {section.competencies_assessed.map((comp, i) => (
                                <Badge key={i} className="bg-blue-100 text-blue-800 border-blue-200">
                                  {comp}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="bg-white text-lg px-3 py-1">
                          {section.points_earned}/{section.points_possible}
                        </Badge>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <p className="text-sm text-slate-700 leading-relaxed">{section.feedback}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="flex justify-center gap-4">
          <Button
            onClick={() => navigate(createPageUrl("SmartGrader"))}
            size="lg"
            variant="outline"
            className="shadow-lg"
          >
            Grade Another Assignment
          </Button>
          <Button
            onClick={() => navigate(createPageUrl("Home"))}
            size="lg"
            className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black shadow-xl"
          >
            <Home className="w-5 h-5 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}