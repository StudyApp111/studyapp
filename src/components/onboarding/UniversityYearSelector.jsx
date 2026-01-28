import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const years = [
  { id: "1st_year", label: "1st Year" },
  { id: "2nd_year", label: "2nd Year" },
  { id: "3rd_year", label: "3rd Year" },
  { id: "4th_year", label: "4th Year" },
  { id: "other", label: "Other" }
];

export default function UniversityYearSelector({ value, onChange }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-1 gap-3">
      {years.map((year) => {
        const isSelected = value === year.id;
        
        return (
          <label
            key={year.id}
            htmlFor={`year-${year.id}`}
            className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              isSelected 
                ? 'border-purple-500 bg-purple-500/20' 
                : 'border-slate-600 bg-slate-800/50 hover:border-purple-400'
            }`}
          >
            <RadioGroupItem value={year.id} id={`year-${year.id}`} className="shrink-0" />
            <span className={`text-lg font-semibold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
              {year.label}
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}