import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

export default function PredictedGradeTab({ lessonId, quizCompleted, hasWorksheet }) {
  const navigate = useNavigate();

  if (!quizCompleted) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-slate-700 mb-3">Please complete the diagnostic quiz first to unlock your predicted grade and personalized worksheet.</p>
          <Button onClick={() => navigate(createPageUrl("DiagnosticQuiz") + `?lessonId=${lessonId}`)} className="bg-purple-600 hover:bg-purple-700">Start Diagnostic Quiz</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-700">Open your worksheet to see predicted grade and feedback.</p>
        </div>
        <Button onClick={() => navigate(createPageUrl("Worksheet") + `?lessonId=${lessonId}`)} className="bg-purple-600 hover:bg-purple-700">Open Worksheet</Button>
      </CardContent>
    </Card>
  );
}