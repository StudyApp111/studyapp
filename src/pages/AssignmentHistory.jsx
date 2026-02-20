import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, ArrowLeft, GraduationCap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function AssignmentHistory() {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  // This page should never be the landing page — redirect to Home if accessed directly as root
  useEffect(() => {
    if (window.location.pathname === '/' || window.location.pathname === '') {
      navigate(createPageUrl("Home"), { replace: true });
    }
  }, [navigate]);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['graded-assignments'],
    queryFn: () => base44.entities.GradedAssignment.list('-created_date', 50),
    initialData: [],
  });

  const getGradeColor = (grade) => {
    if (!grade) return 'bg-slate-100 text-slate-700';
    if (grade.startsWith('A')) return 'bg-emerald-100 text-emerald-700';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-700';
    if (grade.startsWith('C')) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className={`min-h-screen p-4 md:p-10 pb-28 md:pb-10 ${isDark ? 'bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-purple-900/20' : 'bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40'}`}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Button
            onClick={() => navigate(createPageUrl("SmartGrader"))}
            variant="ghost"
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Smart Grader
          </Button>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl shadow-lg">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className={`text-3xl md:text-4xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Assignment History</h1>
              <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>View your previously graded assignments</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <Card className={`text-center py-16 border-dashed border-2 ${isDark ? 'bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-purple-500/30' : 'bg-gradient-to-br from-purple-50 to-yellow-50 border-purple-300'}`}>
            <CardContent>
              <FileText className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
              <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>No Graded Assignments Yet</h3>
              <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Upload your first assignment to get started</p>
              <Button
                onClick={() => navigate(createPageUrl("SmartGrader"))}
                className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
              >
                Grade an Assignment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment, idx) => (
              <motion.div
                key={assignment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
              >
                <Card 
                  className={`cursor-pointer hover:shadow-xl transition-all duration-300 border-0 shadow-lg ${isDark ? 'bg-[#12121a]' : ''}`}
                  onClick={() => navigate(createPageUrl("GradeResults") + `?assignmentId=${assignment.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className={`text-xl mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {assignment.assignment_title}
                        </CardTitle>
                        <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{assignment.course_name}</p>
                      </div>
                      {assignment.grading_result?.predicted_grade && (
                        <Badge className={`text-lg px-4 py-1 ${getGradeColor(assignment.grading_result.predicted_grade)}`}>
                          {assignment.grading_result.predicted_grade}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(assignment.created_date)}</span>
                      </div>
                      {assignment.grading_result?.total_score !== null && assignment.grading_result?.total_score !== undefined && (
                        <div className={`text-sm font-semibold ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                          Score: {assignment.grading_result.total_score}%
                        </div>
                      )}
                    </div>
                    {assignment.grading_result?.overall_performance_summary && (
                      <p className={`text-sm mt-3 line-clamp-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {assignment.grading_result.overall_performance_summary}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}