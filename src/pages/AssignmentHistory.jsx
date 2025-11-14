import React from "react";
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

export default function AssignmentHistory() {
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-4 md:p-10">
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
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Assignment History</h1>
              <p className="text-slate-600">View your previously graded assignments</p>
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
          <Card className="text-center py-16 bg-gradient-to-br from-purple-50 to-yellow-50 border-dashed border-2 border-purple-300">
            <CardContent>
              <FileText className="w-16 h-16 mx-auto text-purple-600 mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No Graded Assignments Yet</h3>
              <p className="text-slate-500 mb-6">Upload your first assignment to get started</p>
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
                  className="cursor-pointer hover:shadow-xl transition-all duration-300 border-0 shadow-lg"
                  onClick={() => navigate(createPageUrl("GradeResults") + `?assignmentId=${assignment.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl text-slate-900 mb-1">
                          {assignment.assignment_title}
                        </CardTitle>
                        <p className="text-sm text-slate-600">{assignment.course_name}</p>
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
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(assignment.created_date)}</span>
                      </div>
                      {assignment.grading_result?.total_score !== null && assignment.grading_result?.total_score !== undefined && (
                        <div className="text-sm font-semibold text-purple-700">
                          Score: {assignment.grading_result.total_score}%
                        </div>
                      )}
                    </div>
                    {assignment.grading_result?.overall_performance_summary && (
                      <p className="text-sm text-slate-600 mt-3 line-clamp-2">
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