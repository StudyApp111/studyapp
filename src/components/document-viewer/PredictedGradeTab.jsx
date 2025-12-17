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
        <CardHeader className="border-b border-purple-800/30">
          <CardTitle className="text-purple-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Predicted Grade & Practice
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-20 h-20 rounded-full bg-slate-800 border border-purple-700/30 flex items-center justify-center mx-auto">
              <Lock className="w-10 h-10 text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-purple-100 mb-2">Complete Quiz to Unlock</h3>
              <p className="text-purple-300 text-sm">
                Finish the diagnostic quiz first to unlock your predicted grade and personalized practice worksheets.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-purple-700/30 text-purple-300 hover:bg-purple-900/30"
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
    <div className="flex flex-col h-[600px]">
      <CardHeader className="border-b border-purple-800/30">
        <CardTitle className="text-purple-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Predicted Grade & Practice
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-6">
        {/* Predicted Grade Display */}
        <div className="bg-gradient-to-br from-purple-900/30 to-yellow-900/20 border border-purple-700/30 rounded-xl p-6 mb-6">
          <div className="text-center">
            <p className="text-purple-300 text-sm mb-2">Your Predicted Exam Grade</p>
            <div className="text-5xl font-bold text-yellow-400 mb-2">
              {quiz.score}%
            </div>
            <p className="text-purple-300 text-xs">
              Based on your diagnostic quiz performance
            </p>
          </div>
        </div>

        {/* Practice Section */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-purple-100">Continue Learning</h4>
          <p className="text-purple-300 text-sm">
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
            <div className="bg-slate-800/50 border border-purple-700/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-purple-100">Worksheet 1</p>
                  <p className="text-xs text-purple-300">Foundation Building</p>
                </div>
                <Button size="sm" variant="outline" className="border-purple-700/30 text-purple-300">
                  Start
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </div>
  );
}