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
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all cursor-pointer touch-manipulation active:scale-[0.99] ${
                    selectedAnswer === option
                      ? "border-purple-500 bg-purple-50"
                      : "border-slate-200 hover:border-purple-300 bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => onSelectAnswer(option)}
                >
                  <RadioGroupItem value={option} id={`option-${index}`} className="flex-shrink-0 mt-0.5 pointer-events-none" />
                  <div className="flex items-center gap-2 flex-1 pointer-events-none">
                    <span className="font-semibold text-slate-700">{optionLetter}.</span>
                    <MathText className="text-base text-slate-700 leading-relaxed">{option}</MathText>
                  </div>
                </label>
              );
            })}
          </RadioGroup>

          {selectedAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 pt-6 border-t border-slate-200 space-y-5"
            >
              {/* Reasoning Method */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <label className="text-sm font-semibold text-slate-700">
                    How did you choose this answer?
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {["I Knew It", "I Worked It Out", "I Guessed", "It Felt Right"].map((method) => (
                    <button
                      key={method}
                      onClick={() => onMetadataChange({ ...metadata, reasoning_method: method })}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
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
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-purple-600" />
                  <label className="text-sm font-semibold text-slate-700">
                    How confident are you?
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["Low", "Medium", "High"].map((level) => (
                    <button
                      key={level}
                      onClick={() => onMetadataChange({ ...metadata, confidence_level: level })}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
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