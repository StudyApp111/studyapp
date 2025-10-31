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
      // Ensure options exist
      if (!question.options || question.options.length < 2) {
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
            <p className="text-xs text-amber-600">Note: This question appears to be missing options. Please provide a written answer.</p>
          </div>
        );
      }

      return (
        <RadioGroup value={selectedAnswer?.toString()} onValueChange={(val) => onSelectAnswer(val)}>
          <div className="space-y-3">
            {question.options.map((option, idx) => (
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
    const difficulty = question.difficulty_index;
    const colors = {
      "Foundational": "bg-emerald-50 text-emerald-700 border-emerald-200",
      "Conceptual": "bg-cyan-50 text-cyan-700 border-cyan-200",
      "Applied/Multi-step": "bg-orange-50 text-orange-700 border-orange-200",
      "Applied": "bg-orange-50 text-orange-700 border-orange-200"
    };
    return colors[difficulty] || "bg-slate-50 text-slate-700 border-slate-200";
  };

  const getQuestionTypeColor = () => {
    const type = question.question_type;
    const colors = {
      "Multiple Choice": "bg-indigo-50 text-indigo-700 border-indigo-200",
      "MCQ": "bg-indigo-50 text-indigo-700 border-indigo-200",
      "True/False": "bg-teal-50 text-teal-700 border-teal-200",
      "Short Answer": "bg-violet-50 text-violet-700 border-violet-200",
      "Fill-in-the-Blank": "bg-pink-50 text-pink-700 border-pink-200",
      "Problem-Solving": "bg-rose-50 text-rose-700 border-rose-200"
    };
    return colors[type] || "bg-slate-50 text-slate-700 border-slate-200";
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
            <Badge className={`${getDifficultyColor()} border`}>
              {question.difficulty_index}
            </Badge>
            <Badge className={`${getQuestionTypeColor()} border`}>
              {question.question_type}
            </Badge>
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