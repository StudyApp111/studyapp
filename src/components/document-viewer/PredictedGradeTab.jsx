import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, TrendingUp } from "lucide-react";

export default function PredictedGradeTab({ lesson, quiz }) {
  if (!quiz || !quiz.completed) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl min-h-[400px] shadow-xl flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Complete Practice Exams First</h3>
            <p className="text-slate-600 mt-2">
              Your predicted grade will be available after completing at least one practice exam.
            </p>
          </div>
          <Button
            onClick={() => window.dispatchEvent(new Event('switchToExamTab'))}
            className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
          >
            Go to Exams
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white/90 border-purple-200 backdrop-blur-xl min-h-[400px] shadow-xl p-8">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-yellow-100 rounded-full flex items-center justify-center mx-auto">
          <TrendingUp className="w-10 h-10 text-purple-600" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Your Predicted Grade</h3>
          <p className="text-slate-600 mt-2 max-w-2xl mx-auto">
            Based on your diagnostic quiz and practice exam performance, here's your predicted grade and personalized feedback.
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-yellow-50 rounded-xl p-8 mt-8">
          <p className="text-sm text-slate-600 mb-4">Current Prediction</p>
          <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-yellow-500">
            A-
          </div>
          <p className="text-lg text-slate-700 mt-4">Based on {quiz.score}% diagnostic quiz score</p>
        </div>
      </div>
    </Card>
  );
}