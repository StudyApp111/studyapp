import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { BookOpen, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DEFAULT_COURSES = [
  "ECON 203",
  "POLI 418",
  "MATH 101",
  "BIOL 241",
  "PSYC 200",
  "CHEM 351"
];

export default function CourseNameInput({ value, onChange, school, year }) {
  const [suggestions, setSuggestions] = useState(DEFAULT_COURSES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch school-specific course codes if school is provided
    if (school) {
      fetchCourseCodes();
    }
  }, [school]);

  const fetchCourseCodes = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('generateCourseCodes', { 
        school, 
        year 
      });
      if (result?.data?.codes?.length > 0) {
        setSuggestions(result.data.codes);
      }
    } catch (err) {
      console.warn("Could not fetch course codes:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., ECON 203, Biology 101"
          className="text-lg pl-12 pr-4 py-6 h-auto rounded-xl border-2 border-slate-200 focus:border-purple-400 text-slate-900 bg-white"
          autoComplete="off"
          autoFocus
        />
      </div>
      
      {/* Example course codes */}
      {!value && (
        <div className="flex flex-wrap justify-center gap-2">
          {loading ? (
            <div className="flex items-center gap-2 text-purple-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading courses...</span>
            </div>
          ) : (
            suggestions.map((course) => (
              <button
                key={course}
                type="button"
                onClick={() => onChange(course)}
                className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full transition-colors border border-purple-200"
              >
                {course}
              </button>
            ))
          )}
        </div>
      )}
      
      <p className="text-center text-sm text-slate-500">
        Enter the exact course name or subject you'd like to study first
      </p>
    </div>
  );
}