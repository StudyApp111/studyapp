import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

export default function QuizQuestion({ question, questionNumber, selectedAnswer, onSelectAnswer }) {
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
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">{questionNumber}</span>
            </div>
            <CardTitle className="text-xl">Question {questionNumber}</CardTitle>
          </div>
          <p className="text-lg text-slate-700">{question.question}</p>
        </CardHeader>
        <CardContent>
          <RadioGroup value={selectedAnswer?.toString()} onValueChange={(val) => onSelectAnswer(parseInt(val))}>
            <div className="space-y-3">
              {question.options.map((option, idx) => (
                <div
                  key={idx}
                  className={`flex items-start space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedAnswer === idx
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                  }`}
                  onClick={() => onSelectAnswer(idx)}
                >
                  <RadioGroupItem value={idx.toString()} id={`option-${idx}`} className="mt-0.5" />
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
        </CardContent>
      </Card>
    </motion.div>
  );
}