import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

export default function NameInput({ value, onChange, onNext, onBack }) {
  const [name, setName] = useState(value || '');

  const handleInputChange = (e) => {
    const val = e.target.value;
    setName(val);
    onChange(val);
  };

  const handleNext = () => {
    if (name.trim()) {
      onNext(name);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && name.trim()) {
      handleNext();
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 bg-white rounded-2xl shadow-2xl">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 mb-2">
          <User className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">What's your name?</h2>
        <p className="text-slate-600 text-sm">We'll personalize your learning experience</p>
      </div>

      {/* Input */}
      <div className="space-y-3">
        <Input
          type="text"
          placeholder="Enter your first name"
          value={name}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          className="h-14 text-base bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-100 rounded-xl"
          autoFocus
        />
      </div>

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
          disabled={!name.trim()}
          className="h-12 px-10 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white disabled:opacity-50 shadow-lg shadow-purple-500/30 rounded-xl"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}