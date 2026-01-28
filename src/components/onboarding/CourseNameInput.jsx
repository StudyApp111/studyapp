import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { BookOpen, Loader2, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DEFAULT_COURSES = [
  "ECON 203",
  "BIOL 241",
  "PSYC 200",
  "MATH 101",
  "CHEM 351",
  "POLI 201"
];

export default function CourseNameInput({ value, onChange, school, year }) {
  const [suggestions, setSuggestions] = useState(DEFAULT_COURSES);
  const [loading, setLoading] = useState(false);
  const [hasTriedFetch, setHasTriedFetch] = useState(false);

  useEffect(() => {
    if (school && !hasTriedFetch) {
      fetchCourseCodes();
    }
  }, [school, hasTriedFetch]);

  const fetchCourseCodes = async () => {
    setLoading(true);
    setHasTriedFetch(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const result = await base44.functions.invoke('generateCourseCodes', { 
        school, 
        year 
      });
      
      clearTimeout(timeoutId);
      
      if (result?.data?.codes?.length > 0) {
        setSuggestions(result.data.codes.slice(0, 6));
      }
    } catch (err) {
      console.warn("Could not fetch course codes:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Main input - prominent and clear */}
      <div className="relative">
        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., ECON 203 or Biology 101"
          className="text-lg pl-12 pr-4 py-5 h-auto rounded-xl border-2 border-purple-500/30 focus:border-purple-400 text-white bg-slate-800/80 placeholder:text-slate-500"
          autoComplete="off"
          autoFocus
        />
      </div>
      
      {/* Quick pick suggestions - only show if no value entered */}
      {!value && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">Quick pick a course</span>
            {loading && <Loader2 className="w-3 h-3 animate-spin text-purple-400 ml-auto" />}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {suggestions.map((course) => (
              <button
                key={course}
                type="button"
                onClick={() => onChange(course)}
                className="text-sm bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 text-white font-medium px-4 py-3 rounded-xl transition-all border border-purple-500/30 hover:border-purple-400/50 hover:scale-[1.02]"
              >
                {course}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Value entered - show confirmation */}
      {value && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <span className="text-xl">📗</span>
          </div>
          <div>
            <p className="text-emerald-300 font-medium">Great choice!</p>
            <p className="text-sm text-slate-400">We'll create your first lesson for {value}</p>
          </div>
        </div>
      )}
    </div>
  );
}