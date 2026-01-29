import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SchoolInput({ value, onChange, onNext, onBack }) {
  const [school, setSchool] = useState(value || '');

  const handleNext = () => {
    const trimmedSchool = school.trim();
    if (trimmedSchool) {
      onChange(trimmedSchool);
      onNext(trimmedSchool); // Pass value directly to avoid race condition
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
          What school do you attend?
        </h2>
        <p className="text-slate-400 text-lg">
          This helps us tailor questions to your curriculum
        </p>
      </div>

      <div className="mb-8">
        <Input
          type="text"
          placeholder="e.g., University of Calgary, Harvard..."
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          className="h-14 text-lg bg-white/5 border-white/10 text-white placeholder:text-slate-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && school.trim()) {
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
          disabled={!school.trim()}
          className="h-14 px-12 text-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}