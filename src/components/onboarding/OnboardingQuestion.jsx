import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { School, GraduationCap, BookOpen } from "lucide-react";

export default function OnboardingQuestion({ question, value, onChange }) {
  if (question.type === "single") {
    const isGradeQuestion = question.id === "grade";
    
    if (isGradeQuestion) {
      const gradeGroups = [
        {
          title: "Middle School",
          icon: BookOpen,
          color: "emerald",
          options: question.options.slice(0, 3) // Grade 6-8
        },
        {
          title: "High School",
          icon: School,
          color: "purple",
          options: question.options.slice(3, 7) // Grade 9-12
        },
        {
          title: "University",
          icon: GraduationCap,
          color: "amber",
          options: question.options.slice(7) // University + Post Graduate
        }
      ];

      const colorClasses = {
        emerald: {
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          hoverBorder: "hover:border-emerald-400",
          selectedBorder: "border-emerald-500",
          selectedBg: "bg-emerald-100",
          icon: "text-emerald-600",
          title: "text-emerald-700"
        },
        purple: {
          bg: "bg-purple-50",
          border: "border-purple-200",
          hoverBorder: "hover:border-purple-400",
          selectedBorder: "border-purple-500",
          selectedBg: "bg-purple-100",
          icon: "text-purple-600",
          title: "text-purple-700"
        },
        amber: {
          bg: "bg-amber-50",
          border: "border-amber-200",
          hoverBorder: "hover:border-amber-400",
          selectedBorder: "border-amber-500",
          selectedBg: "bg-amber-100",
          icon: "text-amber-600",
          title: "text-amber-700"
        }
      };

      return (
        <div className="space-y-5">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 text-center">{question.question}</h2>
          <RadioGroup value={value} onValueChange={onChange}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {gradeGroups.map((group, groupIdx) => {
                const colors = colorClasses[group.color];
                const Icon = group.icon;
                
                return (
                  <div 
                    key={groupIdx} 
                    className={`rounded-2xl p-4 ${colors.bg} border-2 ${colors.border}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`w-5 h-5 ${colors.icon}`} />
                      <h3 className={`text-sm font-bold ${colors.title}`}>
                        {group.title}
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {group.options.map((option, index) => {
                        const isSelected = value === option;
                        return (
                          <label
                            key={index}
                            htmlFor={`option-${groupIdx}-${index}`}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                              isSelected 
                                ? `${colors.selectedBorder} ${colors.selectedBg}` 
                                : `border-white/60 bg-white/80 ${colors.hoverBorder}`
                            }`}
                          >
                            <RadioGroupItem 
                              value={option} 
                              id={`option-${groupIdx}-${index}`}
                              className="shrink-0"
                            />
                            <span className={`text-sm font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                              {option}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </RadioGroup>
        </div>
      );
    }

    // Standard single select
    return (
      <div className="space-y-5">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 text-center">{question.question}</h2>
        <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {question.options.map((option, index) => {
            const isSelected = value === option;
            return (
              <label
                key={index}
                htmlFor={`option-${index}`}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  isSelected 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-slate-200 hover:border-purple-300 bg-white'
                }`}
              >
                <RadioGroupItem value={option} id={`option-${index}`} className="shrink-0" />
                <span className={`text-sm font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                  {option}
                </span>
              </label>
            );
          })}
        </RadioGroup>
      </div>
    );
  }

  if (question.type === "text") {
    return (
      <div className="space-y-5">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 text-center">{question.question}</h2>
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="text-lg p-6 h-auto text-center"
        />
      </div>
    );
  }

  return null;
}