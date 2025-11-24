import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Award, TrendingUp, CheckCircle, Target, Home, TrendingDown, AlertTriangle, BookOpen, FileText, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MathText from "../components/math/MathText";

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

  // DEBUG: Log the missing_references_flag
  console.log('DEBUG missing_references_flag:', result?.missing_references_flag);
  console.log('DEBUG full result:', result);

  // DEBUG: Show if result is empty
  if (!result || Object.keys(result).length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Grading data missing.</strong> The assignment was uploaded but no grading feedback was generated. 
              <br/><br/>
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">Debug Info (Click to expand)</summary>
                <pre className="mt-2 text-xs bg-black/5 p-2 rounded overflow-auto">
                  {JSON.stringify({
                    assignment_id: assignment.id,
                    has_result: !!result,
                    result_keys: result ? Object.keys(result) : [],
                    result_content: result
                  }, null, 2)}
                </pre>
              </details>
            </AlertDescription>
          </Alert>
          <div className="mt-6 flex justify-center gap-4">
            <Button onClick={() => navigate(createPageUrl("SmartGrader"))} size="lg">
              Try Again
            </Button>
            <Button onClick={() => navigate(createPageUrl("Home"))} size="lg" variant="outline">
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Map to correct field names from AI response
  const gradeBand = result.predicted_grade || 'N/A';
  const gradePercentage = result.total_score ? `${result.total_score}%` : '0%';
  const gradeRationale = result.overall_performance_summary || 'Grade analysis in progress.';

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-4 md:p-10">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 md:mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg mb-4 md:mb-6">
            <Award className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-slate-700">Assignment Graded</span>
          </div>
          
          <h1 className="text-xl md:text-4xl font-bold text-slate-900 mb-2 px-4 break-words">
            {assignment.assignment_title}
          </h1>
          <p className="text-sm md:text-base text-slate-600 mb-4 px-4 break-words">{assignment.course_name}</p>
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-xs md:max-w-none mx-auto"
          >
            <div className={`px-8 md:px-16 py-6 md:py-8 rounded-2xl md:rounded-3xl bg-gradient-to-r ${getGradeColor(gradeBand)} shadow-2xl mb-4`}>
              <div className="text-5xl md:text-8xl font-bold text-white mb-2">
                {gradeBand} {getGradeEmoji(gradeBand)}
              </div>
              <div className="text-lg md:text-2xl text-white font-semibold">
                {gradePercentage}
              </div>
            </div>
            
            {result?.missing_references_flag && result.missing_references_flag !== "None" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 bg-amber-100 border-2 border-amber-400 px-4 py-2 rounded-xl shadow-md"
              >
                <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0" />
                <span className="text-sm font-medium text-amber-900">
                  {result.missing_references_flag}
                </span>
              </motion.div>
            )}
          </motion.div>

          {gradeRationale && gradeRationale !== 'Grade analysis in progress.' && (
            <p className="text-sm md:text-lg text-slate-700 max-w-3xl mx-auto mt-4 md:mt-6 leading-relaxed px-4 break-words">
              {gradeRationale}
            </p>
          )}
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Strengths - using identified_strengths */}
          {result?.identified_strengths && result.identified_strengths.length > 0 && (
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
                    {result.identified_strengths.map((strength, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm md:text-base text-slate-700 break-words">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Improvements - using areas_for_improvement */}
          {result?.areas_for_improvement && result.areas_for_improvement.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
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
                        <span className="text-sm md:text-base text-slate-700 break-words">{area}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Rubric Breakdown - using rubric_breakdown */}
        {result?.rubric_breakdown && result.rubric_breakdown.length > 0 && (
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
                  {result.rubric_breakdown.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + (idx * 0.05) }}
                      className="p-6 rounded-xl border-2 border-purple-200 bg-purple-50/50"
                    >
                      <div className="flex items-start justify-between mb-3 gap-3">
                        <h4 className="font-semibold text-slate-900 text-base md:text-lg break-words flex-1">
                          {item.criterion}
                        </h4>
                        <Badge className="bg-purple-600 text-white text-sm md:text-lg px-3 md:px-4 py-1 flex-shrink-0">
                          {item.score}/{item.max_score}
                        </Badge>
                      </div>
                      {item.comments && (
                        <div className="bg-white rounded-lg p-4 border border-purple-200">
                          <MathText className="text-sm text-slate-700 leading-relaxed">
                            {item.comments}
                          </MathText>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Section Feedback - using detailed_feedback_by_section */}
        {result?.detailed_feedback_by_section && result.detailed_feedback_by_section.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-8"
          >
            <Card className="shadow-2xl border-0">
              <CardHeader>
                <CardTitle className="text-2xl">Section-by-Section Feedback</CardTitle>
                <p className="text-slate-600">Detailed analysis of each part of your work</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.detailed_feedback_by_section.map((section, idx) => (
                    <div key={idx} className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50/50">
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <h4 className="font-semibold text-sm md:text-base text-slate-900 break-words flex-1">{section.section_name}</h4>
                        <Badge variant="outline" className="text-xs flex-shrink-0 whitespace-nowrap">
                          {section.points_earned}/{section.points_possible} pts
                        </Badge>
                      </div>
                      <MathText className="text-sm text-slate-700 mb-2">
                        {section.feedback}
                      </MathText>
                      {section.competencies_assessed && section.competencies_assessed.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {section.competencies_assessed.map((comp, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
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