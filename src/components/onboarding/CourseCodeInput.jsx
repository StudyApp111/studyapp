import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { Loader2, BookOpen, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CourseCodeInput({ value, onChange, onNext, onBack, school }) {
  const [courseCode, setCourseCode] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Load course suggestions on mount
  useEffect(() => {
    if (school) {
      loadCourseSuggestions();
    }
  }, [school]);

  const loadCourseSuggestions = async () => {
    setLoading(true);
    try {
      // Set a 6-second timeout — if suggestions take too long, show empty and let user type
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 6000)
      );
      const fetchPromise = base44.functions.invoke('generateCourseCodes', { 
        school: school || '',
        year: null 
      });
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      if (result?.data?.codes) {
        setSuggestions(result.data.codes);
      }
    } catch (error) {
      console.error('Error loading course codes:', error);
      // No fallback — user can just type their course
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCourseSelect = (code) => {
    setCourseCode(code);
    setShowSuggestions(false);
    onChange(code);
    onNext(code);
  };

  const handleNext = () => {
    const trimmedCode = courseCode.trim();
    if (trimmedCode) {
      onChange(trimmedCode);
      onNext(trimmedCode);
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto px-4 py-6 overflow-hidden bg-white rounded-2xl shadow-2xl">
      {/* Floating animated element */}
      <motion.div
        className="absolute top-4 right-4 text-2xl select-none pointer-events-none z-0"
        animate={{ rotate: [0, 10, -10, 0], y: [0, -4, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        🎯
      </motion.div>

      {/* Header */}
      <div className="text-center mb-6">
        <motion.div
          className="text-5xl mb-4"
          animate={{ y: [0, -6, 0], rotate: [0, -3, 3, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          📚
        </motion.div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
          What course are you studying?
        </h2>
        <p className="text-slate-600 text-sm md:text-base">
          Next up: a 5-question diagnostic exam to predict your grade.
        </p>
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <Input
          type="text"
          placeholder="e.g., MATH 265, Calculus II..."
          value={courseCode}
          onChange={(e) => {
            setCourseCode(e.target.value);
            setShowSuggestions(true);
          }}
          className="h-14 text-lg bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl focus:border-purple-500 focus:ring-purple-100"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && courseCode.trim()) {
              handleNext();
            }
          }}
          autoFocus
        />
      </div>

      {/* Suggestions */}
      {showSuggestions && (
        <div className="mb-6">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              <span className="ml-2 text-slate-600 text-sm">Loading suggestions...</span>
            </div>
          ) : suggestions.length > 0 && (
            <>
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-wide text-center font-medium">Popular courses at {school || 'your school'}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((code, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCourseSelect(code)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 border border-purple-200 hover:border-purple-400 hover:bg-purple-100 transition-all text-slate-900 text-sm font-medium"
                  >
                    <BookOpen className="w-4 h-4 text-purple-600" />
                    {code}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-4 justify-center pt-2 relative z-10">
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors font-medium rounded-lg"
          >
            ← Back
          </button>
        )}
        <Button
          onClick={handleNext}
          disabled={!courseCode.trim()}
          className="h-12 px-10 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white disabled:opacity-50 shadow-lg shadow-purple-500/30 rounded-xl"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}