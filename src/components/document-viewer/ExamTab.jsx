import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle } from "lucide-react";

export default function ExamTab({ lesson, quiz }) {
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

  return (
    <Card className="bg-white/90 border-purple-200 backdrop-blur-xl min-h-[400px] shadow-xl p-8">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-yellow-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-purple-600" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Exam Practice</h3>
          <p className="text-slate-600 mt-2 max-w-2xl mx-auto">
            Complete personalized practice exams based on your diagnostic quiz results. Each exam adapts to your learning needs.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {[1, 2, 3, 4, 5, 6].map((num) => (
            <Card key={num} className="p-6 hover:shadow-lg transition-shadow border-2 border-purple-200">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">Exam {num}</div>
                <p className="text-sm text-slate-600">Coming Soon</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Card>
  );
}