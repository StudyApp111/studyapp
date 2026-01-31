import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { Loader2, MapPin, School, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SchoolInput({ value, onChange, onNext, onBack }) {
  const [school, setSchool] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const inputRef = useRef(null);

  // Load nearby schools on mount
  useEffect(() => {
    loadNearbySchools();
  }, []);

  const loadNearbySchools = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('getNearbySchools', { searchQuery: '' });
      if (result?.data?.success) {
        setSuggestions(result.data.schools || []);
        setUserLocation(result.data.location);
      }
    } catch (error) {
      console.error('Error loading schools:', error);
      // Fallback schools
      setSuggestions([
        { name: 'University of Toronto', type: 'university' },
        { name: 'University of British Columbia', type: 'university' },
        { name: 'McGill University', type: 'university' },
        { name: 'University of Alberta', type: 'university' },
        { name: 'University of Calgary', type: 'university' },
        { name: 'Harvard University', type: 'university' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolSelect = (schoolName) => {
    setSchool(schoolName);
    setShowSuggestions(false);
    onChange(schoolName);
    onNext(schoolName);
  };

  const handleNext = () => {
    const trimmedSchool = school.trim();
    if (trimmedSchool) {
      onChange(trimmedSchool);
      onNext(trimmedSchool);
    }
  };

  const filteredSuggestions = school.trim() 
    ? suggestions.filter(s => s.name.toLowerCase().includes(school.toLowerCase()))
    : suggestions;

  return (
    <div className="relative w-full max-w-2xl mx-auto px-3 sm:px-4 py-6 overflow-hidden bg-white rounded-2xl shadow-2xl">
      {/* Animated Background Sparkles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-purple-400/30 rounded-full"
          initial={{ opacity: 0, x: Math.random() * 600, y: Math.random() * 400 }}
          animate={{
            opacity: [0, 0.7, 0],
            x: Math.random() * 600,
            y: Math.random() * 400,
          }}
          transition={{
            duration: 3.5 + Math.random() * 1.5,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-4">🏫</div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
          What school do you attend?
        </h2>
        <p className="text-slate-600 text-sm md:text-base">
          This helps us tailor questions to your curriculum
        </p>
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search for your school..."
          value={school}
          onChange={(e) => {
            setSchool(e.target.value);
            setShowSuggestions(true);
          }}
          className="h-14 text-lg bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl focus:border-purple-500 focus:ring-purple-100"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && school.trim()) {
              handleNext();
            }
          }}
          autoFocus
        />
      </div>

      {/* Location indicator */}
      {userLocation?.city && (
        <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
          <MapPin className="w-4 h-4" />
          <span>Showing schools near {userLocation.city}</span>
        </div>
      )}

      {/* Suggestions List */}
      {showSuggestions && (
        <div className="mb-6 max-h-[300px] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-slate-50">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <span className="ml-2 text-slate-600">Finding nearby schools...</span>
            </div>
          ) : filteredSuggestions.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {filteredSuggestions.slice(0, 8).map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSchoolSelect(s.name)}
                  className="w-full flex items-center gap-3 p-3 sm:p-4 hover:bg-purple-50 transition-colors text-left group"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <School className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="font-medium text-slate-900 text-sm sm:text-base truncate">{s.name}</p>
                    {s.distance && (
                      <p className="text-xs text-slate-500">{s.distance.toFixed(1)} km away</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-purple-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">
              <p>No schools found. Type your school name above.</p>
            </div>
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
          disabled={!school.trim()}
          className="h-12 px-10 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white disabled:opacity-50 shadow-lg shadow-purple-500/30 rounded-xl"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}