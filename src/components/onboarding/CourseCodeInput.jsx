import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CourseCodeInput({ value, onChange, onNext, onBack }) {
  const [courseCode, setCourseCode] = useState(value || '');

  const handleNext = () => {
    const trimmedCode = courseCode.trim();
    if (trimmedCode) {
      onChange(trimmedCode);
      // Pass value directly to onNext to avoid race condition
      onNext(trimmedCode);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
          What's your course name or code?
        </h2>
        <p className="text-slate-400 text-lg">
          e.g., MATH 101, Calculus I, Introduction to Biology
        </p>
      </div>

      <div className="mb-8">
        <Input
          type="text"
          placeholder="e.g., MATH 265, Calculus II..."
          value={courseCode}
          onChange={(e) => setCourseCode(e.target.value)}
          className="h-14 text-lg bg-white/5 border-white/10 text-white placeholder:text-slate-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && courseCode.trim()) {
              handleNext();
            }
          }}
          autoFocus
        />
      </div>

      <div className="flex gap-4 justify-center">
        {onBack && (
          <Button
            onClick={onBack}
            variant="outline"
            className="h-14 px-8 text-lg border-white/10 hover:bg-white/5"
          >
            Back
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={!courseCode.trim()}
          className="h-14 px-12 text-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}