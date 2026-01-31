import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { Loader2, BookOpen, ChevronRight } from 'lucide-react';

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
      const result = await base44.functions.invoke('generateCourseCodes', { 
        school: school || '',
        year: null 
      });
      if (result?.data?.codes) {
        setSuggestions(result.data.codes);
      }
    } catch (error) {
      console.error('Error loading course codes:', error);
      // Fallback suggestions
      setSuggestions(['MATH 101', 'ECON 201', 'PSYC 200', 'BIOL 241', 'CHEM 201', 'POLI 200']);
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
    <div className="w-full max-w-2xl mx-auto px-4 py-6 bg-white rounded-2xl shadow-2xl">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-4">📚</div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
          What course are you studying?
        </h2>
        <p className="text-slate-600 text-sm md:text-base">
          Enter your course name or code (e.g., MATH 101, Calculus I)
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
      <div className="flex gap-4 justify-center pt-2">
        {onBack && (
          <Button
            onClick={onBack}
            variant="outline"
            className="h-12 px-6 text-base border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl"
          >
            Back
          </Button>
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