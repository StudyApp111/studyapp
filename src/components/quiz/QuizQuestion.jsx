import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import MathText from "../math/MathText";

export default function QuizQuestion({ question, questionNumber, selectedAnswer, onSelectAnswer }) {
  const getDifficultyColor = (difficulty) => {
    if (!difficulty) return "bg-slate-100 text-slate-700";
    if (difficulty.includes("Foundational")) return "bg-blue-100 text-blue-700";
    if (difficulty.includes("Conceptual")) return "bg-green-100 text-green-700";
    if (difficulty.includes("Applied") || difficulty.includes("Multi-step")) return "bg-orange-100 text-orange-700";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="shadow-2xl border-0 bg-white">
        <CardContent className="p-6 md:p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge className="bg-purple-100 text-purple-700">
                Question {questionNumber}
              </Badge>
              <Badge className={getDifficultyColor(question.difficulty_index)}>
                {question.difficulty_index}
              </Badge>
            </div>

            <MathText className="text-lg md:text-xl font-medium text-slate-900 leading-relaxed">
              {question.question_text}
            </MathText>
          </div>

          <RadioGroup value={selectedAnswer} onValueChange={onSelectAnswer} className="space-y-3">
            {question.options.map((option, index) => (
              <div
                key={index}
                className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all ${
                  selectedAnswer === option
                    ? "border-purple-500 bg-purple-50"
                    : "border-slate-200 hover:border-purple-300 bg-white"
                }`}
              >
                <RadioGroupItem value={option} id={`option-${index}`} className="mt-1" />
                <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                  <MathText inline className="text-slate-700">
                    {String.fromCharCode(65 + index)}. {option}
                  </MathText>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
    </motion.div>
  );
}