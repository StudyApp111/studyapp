import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import FeedbackDisplay from "../feedback/FeedbackDisplay";

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

  return (
    <div className="max-w-6xl mx-auto">
      <FeedbackDisplay 
        exam={latestExamWithGrade} 
        lesson={lesson} 
        allExams={exams} 
      />
    </div>
  );
}