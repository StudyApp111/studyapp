import React from "react";
import { Input } from "@/components/ui/input";
import { BookOpen } from "lucide-react";

export default function CourseNameInput({ value, onChange }) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., Biology 101, Calculus II, AP Chemistry"
          className="text-lg pl-12 pr-4 py-6 h-auto rounded-xl border-2 border-slate-200 focus:border-purple-400"
          autoComplete="off"
          autoFocus
        />
      </div>
      <p className="text-center text-sm text-slate-500">
        Enter the course or subject you want to study first
      </p>
    </div>
  );
}