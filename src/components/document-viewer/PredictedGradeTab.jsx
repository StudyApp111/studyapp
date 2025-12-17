import React from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Lock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PredictedGradeTab({ lesson, quiz }) {
  const navigate = useNavigate();

  if (!quiz || !quiz.completed) {
    return (
      <div className="flex flex-col h-[600px]">
        <CardHeader className="border-b border-purple-200">
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Predicted Grade & Practice
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-20 h-20 rounded-full bg-purple-100 border border-purple-300 flex items-center justify-center mx-auto">
              <Lock className="w-10 h-10 text-purple-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Complete Quiz to Unlock</h3>
              <p className="text-slate-600 text-sm">
                Finish the diagnostic quiz first to unlock your predicted grade and personalized practice worksheets.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-purple-200 text-slate-400"
              disabled
            >
              <Lock className="w-4 h-4 mr-2" />
              Locked
            </Button>
          </div>
        </CardContent>
      </div>
    );
  }

  const handleStartWorksheet = () => {
    navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}&worksheetNumber=1`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <CardHeader className="border-b border-purple-200">
        <CardTitle className="text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Predicted Grade & Practice
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-6">
        {/* Predicted Grade Display */}
        <div className="bg-gradient-to-br from-purple-50 to-yellow-50 border border-yellow-300 rounded-xl p-6 mb-6">
          <div className="text-center">
            <p className="text-slate-600 text-sm mb-2">Your Predicted Exam Grade</p>
            <div className="text-5xl font-bold text-yellow-600 mb-2">
              {quiz.score}%
            </div>
            <p className="text-slate-600 text-xs">
              Based on your diagnostic quiz performance
            </p>
          </div>
        </div>

        {/* Practice Section */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-slate-900">Continue Learning</h4>
          <p className="text-slate-600 text-sm">
            Now that you've completed the diagnostic, it's time to improve! Work through personalized practice worksheets designed to target your weak areas.
          </p>
          
          <Button
            onClick={handleStartWorksheet}
            className="w-full bg-gradient-to-r from-purple-600 to-yellow-500 hover:from-purple-700 hover:to-yellow-600 text-white"
          >
            Start Practice Worksheet
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <div className="grid grid-cols-1 gap-3 mt-6">
            <div className="bg-white border border-purple-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Worksheet 1</p>
                  <p className="text-xs text-slate-600">Foundation Building</p>
                </div>
                <Button size="sm" variant="outline" className="border-purple-200 text-slate-700">
                  Start
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}