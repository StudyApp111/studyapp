import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function OnboardingQuestion({ question, value, onChange }) {
  if (question.type === "single") {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">{question.question}</h2>
        <RadioGroup value={value} onValueChange={onChange} className="space-y-3">
          {question.options.map((option, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer"
            >
              <RadioGroupItem value={option} id={`option-${index}`} />
              <Label
                htmlFor={`option-${index}`}
                className="flex-1 cursor-pointer font-medium text-slate-700"
              >
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  }

  if (question.type === "multiple") {
    const selectedValues = value || [];
    
    const handleToggle = (option) => {
      const newValues = selectedValues.includes(option)
        ? selectedValues.filter(v => v !== option)
        : [...selectedValues, option];
      onChange(newValues);
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">{question.question}</h2>
        <p className="text-sm text-slate-600">Select all that apply</p>
        <div className="space-y-3">
          {question.options.map((option, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer"
              onClick={() => handleToggle(option)}
            >
              <Checkbox
                checked={selectedValues.includes(option)}
                onCheckedChange={() => handleToggle(option)}
                id={`checkbox-${index}`}
              />
              <Label
                htmlFor={`checkbox-${index}`}
                className="flex-1 cursor-pointer font-medium text-slate-700"
              >
                {option}
              </Label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === "text") {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">{question.question}</h2>
        <Textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="min-h-[150px] text-base resize-none"
        />
      </div>
    );
  }

  return null;
}