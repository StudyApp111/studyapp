import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Trophy, TrendingUp, AlertCircle, CheckCircle, Lightbulb, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PredictedGradeTab({ lesson, quiz, exams }) {
  const latestExamWithGrade = exams
    ?.filter(e => e.completed && e.predicted_grade)
    .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];

  if (!quiz?.completed || !latestExamWithGrade) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl">
        <CardContent className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-100 to-yellow-100 rounded-full flex items-center justify-center">
              <Lock className="w-10 h-10 text-purple-600" />
            </div>
            
            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-slate-900">Predicted Grade Locked</h3>
              <p className="text-slate-600">
                Complete at least one exam to unlock your predicted grade and performance insights.
              </p>
            </div>

            <Button 
              onClick={() => window.dispatchEvent(new CustomEvent('switchToExamTab'))}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
            >
              Go to Exams
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const feedback = latestExamWithGrade.ai_feedback || {};
  const gradeColors = {
    'A+': 'from-emerald-500 to-green-600',
    'A': 'from-emerald-500 to-green-600',
    'A-': 'from-emerald-500 to-green-600',
    'B+': 'from-blue-500 to-indigo-600',
    'B': 'from-blue-500 to-indigo-600',
    'B-': 'from-blue-500 to-indigo-600',
    'C+': 'from-yellow-500 to-orange-600',
    'C': 'from-yellow-500 to-orange-600',
    'C-': 'from-yellow-500 to-orange-600',
    'D': 'from-orange-500 to-red-600',
    'F': 'from-red-500 to-red-700'
  };

  const gradientClass = gradeColors[latestExamWithGrade.predicted_grade] || 'from-purple-500 to-purple-700';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Grade Hero */}
      <Card className={`bg-gradient-to-r ${gradientClass} text-white shadow-2xl border-0`}>
        <CardContent className="p-8 text-center">
          <Trophy className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2 opacity-90">Predicted Final Grade</h2>
          <div className="text-7xl font-bold mb-2">{latestExamWithGrade.predicted_grade}</div>
          <p className="text-xl opacity-90">{Math.round(latestExamWithGrade.total_score)}%</p>
          {feedback.prediction_calculation_rationale && (
            <p className="text-sm opacity-75 mt-4 max-w-2xl mx-auto">{feedback.prediction_calculation_rationale}</p>
          )}
        </CardContent>
      </Card>

      {/* Performance Summary */}
      {feedback.overall_performance_summary_text && (
        <Card className="shadow-xl border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">Overall Performance</h3>
                <p className="text-slate-700 leading-relaxed">{feedback.overall_performance_summary_text}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Strengths */}
        {feedback.identified_strengths_list?.length > 0 && (
          <Card className="shadow-xl border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
                <h3 className="font-bold text-lg text-slate-900">Your Strengths</h3>
              </div>
              <ul className="space-y-2">
                {feedback.identified_strengths_list.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Areas for Improvement */}
        {feedback.key_areas_for_improvement_list?.length > 0 && (
          <Card className="shadow-xl border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-6 h-6 text-amber-600" />
                <h3 className="font-bold text-lg text-slate-900">Areas to Improve</h3>
              </div>
              <ul className="space-y-2">
                {feedback.key_areas_for_improvement_list.map((area, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-amber-600 font-bold mt-0.5">→</span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Learning Patterns */}
      {feedback.learning_patterns?.length > 0 && (
        <Card className="shadow-xl border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-6 h-6 text-blue-600" />
              <h3 className="font-bold text-lg text-slate-900">Learning Insights</h3>
            </div>
            <div className="space-y-4">
              {feedback.learning_patterns.map((pattern, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 border border-blue-200">
                  <Badge className="mb-2 bg-blue-600">{pattern.pattern_type}</Badge>
                  <p className="text-sm text-slate-700 mb-2">
                    <strong>What it means:</strong> {pattern.what_it_means}
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>How to improve:</strong> {pattern.how_to_improve}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Future Sessions */}
      {feedback.suggested_future_sessions_plan?.length > 0 && (
        <Card className="shadow-xl border-purple-200">
          <CardContent className="p-6">
            <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-purple-600" />
              Suggested Study Plan
            </h3>
            <div className="space-y-3">
              {feedback.suggested_future_sessions_plan.map((session, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                    {session.session_number}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{session.session_name}</h4>
                    <p className="text-sm text-slate-600 mt-1">{session.session_focus_description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}