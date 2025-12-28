import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import FeedbackDisplay from "../feedback/FeedbackDisplay";

export default function PredictedGradeTab({ lesson, exams }) {
  // Find any completed exam with AI feedback
  const completedExamsWithFeedback = (exams || []).filter(e => 
    e.completed === true && 
    e.ai_feedback && 
    Object.keys(e.ai_feedback).length > 0
  );
  
  const latestExamWithGrade = completedExamsWithFeedback.sort((a, b) => 
    new Date(b.updated_date) - new Date(a.updated_date)
  )[0];

  if (!latestExamWithGrade) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl mx-2">
        <CardContent className="p-6 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-100 to-yellow-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-purple-600" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Predicted Grade Locked</h3>
              <p className="text-sm text-slate-600">
                Complete at least one exam to unlock your predicted grade.
              </p>
            </div>

            <Button 
              onClick={() => window.dispatchEvent(new CustomEvent('switchToExamTab'))}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 w-full"
            >
              Go to Exams
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="pb-4">
      <FeedbackDisplay 
        exam={latestExamWithGrade} 
        lesson={lesson} 
        allExams={exams} 
      />
    </div>
  );
}