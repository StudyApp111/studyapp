import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export default function ExamTab({ lesson, quiz }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-redirect to Exam 1 when quiz is completed
    if (quiz && quiz.completed && lesson) {
      navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}`);
    }
  }, [quiz, lesson, navigate]);

  if (!quiz || !quiz.completed) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl min-h-[400px] shadow-xl flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Complete the Diagnostic Quiz First</h3>
            <p className="text-slate-600 mt-2">
              The exam is locked until you complete the diagnostic quiz. This helps us create personalized exam questions for you.
            </p>
          </div>
          <Button
            onClick={() => window.dispatchEvent(new Event('switchToQuizTab'))}
            className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
          >
            Go to Diagnostic Quiz
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}