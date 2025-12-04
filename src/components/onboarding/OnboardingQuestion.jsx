import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function OnboardingQuestion({ question, value, onChange }) {
  if (question.type === "single") {
    // Special handling for grade selection with grouped options
    const isGradeQuestion = question.id === "grade";
    
    if (isGradeQuestion) {
      const gradeGroups = [
        {
          title: "High School",
          options: question.options.slice(0, 7) // Grade 6-12
        },
        {
          title: "University",
          options: question.options.slice(7, 11) // 1st-4th Year
        },
        {
          title: "Graduate Studies",
          options: question.options.slice(11) // Post Graduate
        }
      ];

      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">{question.question}</h2>
          <ScrollArea className="h-[50vh] max-h-[400px] pr-4">
            <RadioGroup value={value} onValueChange={onChange} className="space-y-6">
              {gradeGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-3">
                  <h3 className="text-sm font-semibold text-purple-700 uppercase tracking-wider">
                    {group.title}
                  </h3>
                  {group.options.map((option, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-3 p-4 rounded-xl border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer"
                    >
                      <RadioGroupItem value={option} id={`option-${groupIdx}-${index}`} />
                      <Label
                        htmlFor={`option-${groupIdx}-${index}`}
                        className="flex-1 cursor-pointer font-medium text-slate-700"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              ))}
            </RadioGroup>
          </ScrollArea>
        </div>
      );
    }

    // Standard single select for other questions
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">{question.question}</h2>
        <RadioGroup value={value} onValueChange={onChange} className="space-y-3">
          {question.options.map((option, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 p-4 rounded-xl border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer"
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

  if (question.type === "text") {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">{question.question}</h2>
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="text-lg p-6 h-auto"
        />
      </div>
    );
  }

  return null;
}