import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Award, TrendingUp, CheckCircle, Target, Home, TrendingDown, AlertTriangle, BookOpen, FileText } from "lucide-react";
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

  // Safe access to predicted_grade with fallbacks
  const predictedGrade = result?.predicted_grade || {};
  const gradeBand = predictedGrade.band || 'N/A';
  const gradePercentage = predictedGrade.percentage || '0%';
  const gradeRationale = predictedGrade.rationale || 'Grade analysis in progress.';

  const getGradeColor = (band) => {
    if (!band || band === 'N/A') return 'from-slate-500 to-slate-600';
    if (band.startsWith('A')) return 'from-emerald-500 to-teal-600';
    if (band.startsWith('B')) return 'from-blue-500 to-indigo-600';
    if (band.startsWith('C')) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-pink-600';
  };

  const getGradeEmoji = (band) => {
    if (!band || band === 'N/A') return '📊';
    if (band.startsWith('A')) return '🎉';
    if (band.startsWith('B')) return '👍';
    if (band.startsWith('C')) return '📚';
    if (band.startsWith('D')) return '📈';
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
            <div className={`px-12 md:px-16 py-6 md:py-8 rounded-3xl bg-gradient-to-r ${getGradeColor(gradeBand)} shadow-2xl mb-4`}>
              <div className="text-6xl md:text-8xl font-bold text-white mb-2">
                {gradeBand} {getGradeEmoji(gradeBand)}
              </div>
              <div className="text-xl md:text-2xl text-white font-semibold">
                {gradePercentage}
              </div>
            </div>
          </motion.div>

          {gradeRationale && (
            <p className="text-base md:text-lg text-slate-700 max-w-3xl mx-auto mt-6 leading-relaxed">
              {gradeRationale}
            </p>
          )}
        </motion.div>

        {/* Assignment Overview */}
        {result?.assignment_overview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <Card className="shadow-xl border-0 bg-gradient-to-br from-purple-50 to-indigo-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <FileText className="w-5 h-5" />
                  Assignment Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 leading-relaxed">{result.assignment_overview}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Strengths */}
          {result?.strengths && result.strengths.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
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
                    {result.strengths.map((strength, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-700">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Priority Improvements */}
          {result?.priority_improvements && result.priority_improvements.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="shadow-xl border-0 h-full bg-gradient-to-br from-amber-50 to-orange-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-700">
                    <TrendingDown className="w-5 h-5" />
                    Priority Improvements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {result.priority_improvements.map((area, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Target className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-700">{area}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Rubric Breakdown */}
        {result?.rubric && result.rubric.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <Card className="shadow-2xl border-0">
              <CardHeader>
                <CardTitle className="text-2xl">Rubric Breakdown</CardTitle>
                <p className="text-slate-600">Detailed scoring across assessment criteria</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.rubric.map((criterion, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + (idx * 0.05) }}
                      className="p-6 rounded-xl border-2 border-purple-200 bg-purple-50/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-slate-900 text-lg">
                              {criterion.criterion}
                            </h4>
                            <Badge variant="outline" className="bg-white ml-2">
                              Weight: {criterion.weight_percentage}
                            </Badge>
                          </div>
                          {criterion.description && (
                            <p className="text-sm text-slate-600 mb-2">{criterion.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <Badge className="bg-purple-600 text-white text-lg px-4 py-1">
                          Score: {criterion.score_percentage}
                        </Badge>
                      </div>
                      {criterion.justification && (
                        <div className="bg-white rounded-lg p-4 border border-purple-200">
                          <p className="text-sm font-medium text-slate-600 mb-1">Justification:</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{criterion.justification}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Inline Comments */}
        {result?.inline_comments && result.inline_comments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-8"
          >
            <Card className="shadow-2xl border-0">
              <CardHeader>
                <CardTitle className="text-2xl">Inline Comments</CardTitle>
                <p className="text-slate-600">Specific feedback on sections of your work</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.inline_comments.map((comment, idx) => (
                    <div key={idx} className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50/50">
                      {comment.anchor && (
                        <p className="text-xs font-semibold text-blue-700 mb-1">📍 {comment.anchor}</p>
                      )}
                      <p className="text-sm text-slate-700">{comment.comment}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Academic Integrity Flags */}
        {result?.academic_integrity_flags && result.academic_integrity_flags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mb-8"
          >
            <Card className="shadow-xl border-0 border-amber-300 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="w-5 h-5" />
                  Academic Integrity Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.academic_integrity_flags.map((flag, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-amber-700">•</span>
                      <span className="text-slate-700">{flag}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Competency Mapping & Next Focus */}
        {((result?.competency_mapping && result.competency_mapping.length > 0) || 
          (result?.recommended_next_focus && result.recommended_next_focus.length > 0)) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mb-8"
          >
            <Card className="shadow-xl border-0 bg-gradient-to-br from-indigo-50 to-purple-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <BookOpen className="w-5 h-5" />
                  Learning Path Forward
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result?.competency_mapping && result.competency_mapping.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-slate-900 mb-3">Focus Competencies:</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.competency_mapping.map((comp, idx) => (
                        <Badge key={idx} className="bg-indigo-100 text-indigo-800 border-indigo-200 px-3 py-1">
                          {comp}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {result?.recommended_next_focus && result.recommended_next_focus.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3">Recommended Next Steps:</h4>
                    <ul className="space-y-2">
                      {result.recommended_next_focus.map((focus, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700">{focus}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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