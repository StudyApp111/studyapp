import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function QuizQuestion({ question, questionNumber, selectedAnswer, onSelectAnswer }) {
  const renderQuestionInput = () => {
    if (question.question_type === "MCQ" || question.question_type === "Multiple Choice") {
      return (
        <RadioGroup value={selectedAnswer?.toString()} onValueChange={(val) => onSelectAnswer(val)}>
          <div className="space-y-3">
            {question.options?.map((option, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedAnswer === option
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/30'
                }`}
                onClick={() => onSelectAnswer(option)}
              >
                <RadioGroupItem value={option} id={`option-${idx}`} className="mt-0.5" />
                <Label
                  htmlFor={`option-${idx}`}
                  className="flex-1 cursor-pointer text-slate-700 font-medium leading-relaxed"
                >
                  {option}
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      );
    }

    if (question.question_type === "True/False") {
      return (
        <RadioGroup value={selectedAnswer} onValueChange={onSelectAnswer}>
          <div className="space-y-3">
            {["True", "False"].map((option) => (
              <div
                key={option}
                className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedAnswer === option
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/30'
                }`}
                onClick={() => onSelectAnswer(option)}
              >
                <RadioGroupItem value={option} id={option} />
                <Label htmlFor={option} className="flex-1 cursor-pointer text-slate-700 font-medium">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      );
    }

    if (question.question_type === "Short Answer" || question.question_type === "Fill-in-the-Blank") {
      return (
        <div className="space-y-2">
          <Label htmlFor="answer">Your Answer</Label>
          <Input
            id="answer"
            value={selectedAnswer || ""}
            onChange={(e) => onSelectAnswer(e.target.value)}
            placeholder="Type your answer here..."
            className="text-base"
          />
        </div>
      );
    }

    if (question.question_type === "Problem-Solving") {
      return (
        <div className="space-y-2">
          <Label htmlFor="answer">Your Solution</Label>
          <Textarea
            id="answer"
            value={selectedAnswer || ""}
            onChange={(e) => onSelectAnswer(e.target.value)}
            placeholder="Show your work and provide your answer..."
            className="min-h-[120px] text-base"
          />
        </div>
      );
    }
  };

  const getDifficultyColor = () => {
    const colors = {
      "Foundational": "bg-blue-100 text-blue-700",
      "Conceptual": "bg-purple-100 text-purple-700",
      "Applied/Multi-step": "bg-amber-100 text-amber-700"
    };
    return colors[question.difficulty_index] || "bg-gray-100 text-gray-700";
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">{questionNumber}</span>
            </div>
            <CardTitle className="text-xl">Question {questionNumber}</CardTitle>
          </div>
          <div className="flex gap-2 mb-4">
            <Badge className={getDifficultyColor()}>
              {question.difficulty_index}
            </Badge>
            <Badge variant="outline">{question.question_type}</Badge>
          </div>
          <p className="text-lg text-slate-700">{question.question_text}</p>
          {question.targeted_misconception && question.targeted_misconception !== "null" && (
            <p className="text-sm text-slate-500 mt-2 italic">
              💡 This question addresses a common misconception
            </p>
          )}
        </CardHeader>
        <CardContent>
          {renderQuestionInput()}
        </CardContent>
      </Card>
    </motion.div>
  );
}