import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
            {question.options.map((option, index) => {
              const optionLetter = String.fromCharCode(65 + index);
              return (
                <label
                  key={index}
                  htmlFor={`option-${index}`}
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedAnswer === option
                      ? "border-purple-500 bg-purple-50"
                      : "border-slate-200 hover:border-purple-300 bg-white hover:bg-slate-50"
                  }`}
                >
                  <RadioGroupItem value={option} id={`option-${index}`} className="flex-shrink-0 mt-0.5" />
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-semibold text-slate-700">{optionLetter}.</span>
                    <MathText className="text-base text-slate-700 leading-relaxed">{option}</MathText>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>
    </motion.div>
  );
}