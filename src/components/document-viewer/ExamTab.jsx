import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export default function ExamTab({ lesson, quiz }) {
  const navigate = useNavigate();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Auto-redirect to Exam 1 when quiz is completed (only once)
    if (quiz && quiz.completed && lesson && !hasRedirected) {
      setHasRedirected(true);
      
      // Check if Exam 1 exists
      base44.entities.Exam.filter({ 
        lesson_id: lesson.id,
        exam_number: 1
      }).then(exams => {
        if (exams.length > 0 && !exams[0].completed) {
          // If exam exists but not completed, redirect to it
          navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}&worksheet=1`);
        } else if (exams.length === 0) {
          // If no exam exists, create placeholder and redirect
          navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}&worksheet=1`);
        }
      });
    }
  }, [quiz?.completed, lesson?.id, hasRedirected, navigate]);

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