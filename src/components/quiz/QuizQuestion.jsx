import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import MathText from "../math/MathText";
import { Brain, Target } from "lucide-react";

export default function QuizQuestion({ question, questionNumber, selectedAnswer, onSelectAnswer, metadata, onMetadataChange }) {
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
      <Card className="shadow-xl border-0 bg-white">
        <CardContent className="p-3 md:p-8">
          <div className="mb-3 md:mb-6">
            <div className="flex gap-1.5 mb-2 md:mb-4 flex-wrap">
              <Badge className="bg-purple-100 text-purple-700 text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1">
                Question {questionNumber}
              </Badge>
              <Badge className={`${getDifficultyColor(question.difficulty_index)} text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1`}>
                {question.difficulty_index}
              </Badge>
            </div>

            <MathText className="text-sm md:text-xl font-medium text-slate-900 leading-relaxed">
              {question.question_text}
            </MathText>
          </div>

          <RadioGroup value={selectedAnswer} onValueChange={onSelectAnswer} className="space-y-2 md:space-y-3">
            {question.options.map((option, index) => {
              const optionLetter = String.fromCharCode(65 + index);
              return (
                <label
                  key={index}
                  htmlFor={`option-${index}`}
                  className={`flex items-start space-x-2 md:space-x-3 p-2.5 md:p-4 rounded-lg border-2 transition-all cursor-pointer touch-manipulation active:scale-[0.99] ${
                    selectedAnswer === option
                      ? "border-purple-500 bg-purple-50"
                      : "border-slate-200 hover:border-purple-300 bg-white"
                  }`}
                  onClick={() => onSelectAnswer(option)}
                >
                  <RadioGroupItem value={option} id={`option-${index}`} className="mt-0.5 pointer-events-none" />
                  <div className="flex-1 pointer-events-none">
                    <div className="flex items-start gap-1.5 md:gap-2">
                      <span className="font-semibold text-slate-700 text-xs md:text-base">{optionLetter}.</span>
                      <MathText inline className="text-slate-700 text-xs md:text-base leading-snug">{option}</MathText>
                    </div>
                  </div>
                </label>
              );
            })}
          </RadioGroup>

          {selectedAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-slate-200 space-y-4 md:space-y-5"
            >
              {/* Reasoning Method */}
              <div>
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  <Brain className="w-3.5 h-3.5 md:w-4 md:h-4 text-purple-600" />
                  <label className="text-xs md:text-sm font-semibold text-slate-700">
                    How did you choose this answer?
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                  {["I Knew It", "I Worked It Out", "I Guessed", "It Felt Right"].map((method) => (
                    <button
                      key={method}
                      onClick={() => onMetadataChange({ ...metadata, reasoning_method: method })}
                      className={`px-2 md:px-4 py-2 md:py-2.5 rounded-lg text-[10px] md:text-sm font-medium transition-all ${
                        metadata?.reasoning_method === method
                          ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence Level */}
              <div>
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  <Target className="w-3.5 h-3.5 md:w-4 md:h-4 text-purple-600" />
                  <label className="text-xs md:text-sm font-semibold text-slate-700">
                    How confident are you?
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                  {["Low", "Medium", "High"].map((level) => (
                    <button
                      key={level}
                      onClick={() => onMetadataChange({ ...metadata, confidence_level: level })}
                      className={`px-2 md:px-4 py-2 md:py-2.5 rounded-lg text-[10px] md:text-sm font-medium transition-all ${
                        metadata?.confidence_level === level
                          ? level === "Low"
                            ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                            : level === "Medium"
                            ? "bg-yellow-500 text-white shadow-lg shadow-yellow-500/30"
                            : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}