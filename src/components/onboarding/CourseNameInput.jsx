import React from "react";
import { Input } from "@/components/ui/input";
import { BookOpen } from "lucide-react";

const EXAMPLE_COURSES = [
  "ECON 203",
  "POLI 418",
  "MATH 101",
  "BIOL 241",
  "PSYC 200",
  "CHEM 351"
];

export default function CourseNameInput({ value, onChange }) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., ECON 203, Biology 101"
          className="text-lg pl-12 pr-4 py-6 h-auto rounded-xl border-2 border-slate-200 focus:border-purple-400"
          autoComplete="off"
          autoFocus
        />
      </div>
      
      {/* Example course codes */}
      {!value && (
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLE_COURSES.map((course) => (
            <button
              key={course}
              type="button"
              onClick={() => onChange(course)}
              className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full transition-colors border border-purple-200"
            >
              {course}
            </button>
          ))}
        </div>
      )}
      
      <p className="text-center text-sm text-slate-500">
        Enter the exact course name or subject you'd like to study first
      </p>
    </div>
  );
}