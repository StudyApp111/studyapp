import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, School, ChevronLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function StepSchool({ user, isGuest, schoolSuggestions, schoolsLoading, schoolLocation, onComplete, onBack }) {
  const { isDark } = useTheme();
  const [school, setSchool] = useState(() => {
    return sessionStorage.getItem("onboarding_profile_school") || "";
  });
  const [submitting, setSubmitting] = useState(false);

  // Load saved school from learning profile if user is authenticated
  React.useEffect(() => {
    if (!isGuest && user && !sessionStorage.getItem("onboarding_profile_school")) {
      base44.entities.LearningProfile.list('-created_date', 1)
        .then(profiles => {
          if (profiles.length > 0 && profiles[0].school) {
            setSchool(profiles[0].school);
          }
        })
        .catch(() => {});
    }
  }, [user, isGuest]);

  const filteredSuggestions = useMemo(() => {
    const suggestions = schoolSuggestions || [];
    if (!school.trim()) return suggestions;
    const query = school.toLowerCase().trim();
    const words = query.split(/\s+/).filter(w => w.length > 0);
    
    const scored = suggestions.map(s => {
      const name = s.name.toLowerCase();
      let score = 0;
      if (name === query) score += 100;
      else if (name.startsWith(query)) score += 50;
      else if (name.includes(query)) score += 30;
      else if (words.every(w => name.includes(w))) score += 20;
      else {
        const matchCount = words.filter(w => name.includes(w)).length;
        if (matchCount > 0) score += matchCount * 5;
      }
      return { ...s, _score: score };
    });
    
    return scored
      .filter(s => s._score > 0)
      .sort((a, b) => b._score - a._score);
  }, [school, schoolSuggestions]);

  const handleSubmit = async () => {
    if (!school.trim()) return;
    setSubmitting(true);
    await onComplete({ school: school.trim() });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 py-2"
    >
      <div className="text-center space-y-1">
        <h2 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
          Which school do you go to? 🎓
        </h2>
        <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          We'll match your curriculum to predict your grade accurately.
        </p>
      </div>

      <div className="space-y-1.5">
        <Input
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          placeholder="Search for your school..."
          className={`h-12 text-base rounded-xl ${
            isDark
              ? "bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
          }`}
          autoFocus
        />

        {schoolLocation?.city && (
          <div className={`flex items-center gap-1.5 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            <MapPin className="w-3 h-3" />
            Near {schoolLocation.city}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-2 max-h-[160px] overflow-y-auto">
          {schoolsLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className={`w-4 h-4 animate-spin ${isDark ? "text-purple-400" : "text-purple-600"}`} />
              <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Finding nearby schools...
              </span>
            </div>
          ) : filteredSuggestions.length > 0 ? (
            filteredSuggestions.slice(0, 8).map((s, idx) => (
              <button
                key={idx}
                onClick={() => setSchool(s.name)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all border ${
                  school === s.name
                    ? isDark
                      ? "bg-purple-600/30 border-purple-500/50 text-purple-300"
                      : "bg-purple-100 border-purple-300 text-purple-700"
                    : isDark
                    ? "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                    : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <School className="w-3 h-3" />
                {s.name}
                {s.distance && (
                  <span className="opacity-60">
                    {s.distance.toFixed(0)}km
                  </span>
                )}
              </button>
            ))
          ) : (
            <span className={`text-xs py-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Type your school name above
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        {onBack && (
          <Button
            variant="ghost"
            onClick={onBack}
            className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!school.trim() || submitting}
          className="flex-1 h-12 text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-purple-500/20 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continue"}
        </Button>
      </div>
    </motion.div>
  );
}