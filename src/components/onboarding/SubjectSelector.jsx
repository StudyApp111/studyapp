import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const subjects = [
  { name: 'Math', icon: '📐', value: 'math' },
  { name: 'Biology', icon: '🧬', value: 'biology' },
  { name: 'Chemistry', icon: '⚗️', value: 'chemistry' },
  { name: 'Statistics', icon: '📊', value: 'statistics' },
  { name: 'English', icon: '✍️', value: 'english' },
  { name: 'History', icon: '🌍', value: 'history' },
  { name: 'Computer Science', icon: '💻', value: 'computer_science' },
];

export default function SubjectSelector({ value, onChange, onNext }) {
  const [customSubject, setCustomSubject] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(value || '');

  const handleSubjectClick = (subjectValue) => {
    setSelectedSubject(subjectValue);
    onChange(subjectValue);
  };

  const handleCustomSubmit = () => {
    if (customSubject.trim()) {
      onChange(customSubject.trim());
      setSelectedSubject(customSubject.trim());
    }
  };

  const handleNext = () => {
    if (selectedSubject || customSubject.trim()) {
      onNext();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
          What subject are you studying?
        </h2>
        <p className="text-slate-400 text-lg">
          Select from popular subjects or enter your own
        </p>
      </div>

      {/* Subject Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {subjects.map((subject) => (
          <button
            key={subject.value}
            onClick={() => handleSubjectClick(subject.value)}
            className={`
              relative group h-28 md:h-32 rounded-2xl border-2 transition-all duration-200
              flex flex-col items-center justify-center gap-2 p-4
              ${
                selectedSubject === subject.value
                  ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-500/30'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }
            `}
          >
            <span className="text-4xl md:text-5xl">{subject.icon}</span>
            <span className="text-white font-medium text-sm md:text-base text-center">
              {subject.name}
            </span>
            {selectedSubject === subject.value && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Custom Subject Input */}
      <div className="mb-8">
        <label className="block text-white font-medium mb-3 text-center">
          Or type your subject
        </label>
        <div className="flex gap-3 max-w-md mx-auto">
          <Input
            type="text"
            placeholder="e.g., Psychology, Philosophy..."
            value={customSubject}
            onChange={(e) => {
              setCustomSubject(e.target.value);
              setSelectedSubject('');
            }}
            className="flex-1 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCustomSubmit();
              }
            }}
          />
          {customSubject.trim() && (
            <Button
              onClick={handleCustomSubmit}
              className="h-12 px-6 bg-purple-600 hover:bg-purple-700"
            >
              Select
            </Button>
          )}
        </div>
      </div>

      {/* Next Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleNext}
          disabled={!selectedSubject && !customSubject.trim()}
          className="h-14 px-12 text-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}