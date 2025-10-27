
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function WorksheetQuestion({ question, questionNumber, answer, onAnswer }) {
  const renderQuestionInput = () => {
    if (question.type === "multiple_choice") {
      return (
        <RadioGroup value={answer} onValueChange={onAnswer}>
          <div className="space-y-3">
            {question.options?.map((option, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  answer === option
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                }`}
                onClick={() => onAnswer(option)}
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

    if (question.type === "true_false") {
      return (
        <RadioGroup value={answer} onValueChange={onAnswer}>
          <div className="space-y-3">
            {["True", "False"].map((option) => (
              <div
                key={option}
                className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  answer === option
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                }`}
                onClick={() => onAnswer(option)}
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

    if (question.type === "short_answer") {
      return (
        <div className="space-y-2">
          <Label htmlFor="answer">Your Answer (1-2 sentences)</Label>
          <Input
            id="answer"
            value={answer}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder="Type your answer here..."
            className="text-base"
          />
        </div>
      );
    }

    if (question.type === "long_answer") {
      return (
        <div className="space-y-2">
          <Label htmlFor="answer">Your Answer (detailed response)</Label>
          <Textarea
            id="answer"
            value={answer}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder="Provide a detailed answer..."
            className="min-h-[200px] text-base"
          />
        </div>
      );
    }
  };

  const getQuestionTypeLabel = () => {
    const types = {
      multiple_choice: "Multiple Choice",
      true_false: "True/False",
      short_answer: "Short Answer",
      long_answer: "Long Answer"
    };
    return types[question.type] || question.type;
  };

  const getQuestionTypeColor = () => {
    const colors = {
      multiple_choice: "bg-blue-100 text-blue-700",
      true_false: "bg-purple-100 text-purple-700",
      short_answer: "bg-teal-100 text-teal-700",
      long_answer: "bg-amber-100 text-amber-700"
    };
    return colors[question.type] || "bg-gray-100 text-gray-700";
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
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">{questionNumber}</span>
              </div>
              <div>
                <CardTitle className="text-xl">Question {questionNumber}</CardTitle>
                <div className="flex gap-2 mt-1">
                  <Badge className={getQuestionTypeColor()}>
                    {getQuestionTypeLabel()}
                  </Badge>
                  <Badge variant="outline">{question.points} points</Badge>
                </div>
              </div>
            </div>
          </div>
          <p className="text-lg text-slate-700 leading-relaxed">{question.question}</p>
        </CardHeader>
        <CardContent>
          {renderQuestionInput()}
        </CardContent>
      </Card>
    </motion.div>
  );
}
