import React from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Play, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function QuizTab({ lesson, quiz, onQuizComplete }) {
  const navigate = useNavigate();

  const handleStartQuiz = () => {
    // Navigate to the existing DiagnosticQuiz page
    navigate(createPageUrl("DiagnosticQuiz") + `?lessonId=${lesson.id}&returnTo=documentViewer`);
  };

  if (!quiz || !quiz.completed) {
    return (
      <div className="flex flex-col h-[600px]">
        <CardHeader className="border-b border-purple-800/30">
          <CardTitle className="text-purple-100 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Diagnostic Quiz
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-20 h-20 rounded-full bg-purple-900/30 flex items-center justify-center mx-auto">
              <Brain className="w-10 h-10 text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-purple-100 mb-2">
                {quiz ? "Continue Your Quiz" : "Start Your Diagnostic Quiz"}
              </h3>
              <p className="text-purple-300 text-sm">
                Take a personalized quiz to assess your understanding and identify areas for improvement. This will unlock your predicted grade and personalized practice.
              </p>
            </div>
            <Button
              onClick={handleStartQuiz}
              className="bg-gradient-to-r from-purple-600 to-yellow-500 hover:from-purple-700 hover:to-yellow-600 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              {quiz ? "Continue Quiz" : "Start Quiz"}
            </Button>
          </div>
        </CardContent>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px]">
      <CardHeader className="border-b border-purple-800/30">
        <CardTitle className="text-purple-100 flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Quiz Results
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 rounded-full bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-purple-100 mb-2">
              Quiz Completed!
            </h3>
            <div className="text-4xl font-bold text-yellow-400 mb-4">
              {quiz.score}%
            </div>
            <p className="text-purple-300 text-sm">
              Great job! You've completed the diagnostic quiz. Check out the Predicted Grade tab to continue your learning journey.
            </p>
          </div>
        </div>
      </CardContent>
    </div>
  );
}