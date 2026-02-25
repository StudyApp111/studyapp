import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, School, ChevronLeft, LogIn } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { checkIsInAppBrowser } from "@/components/utils/BrowserCompatibility";

export default function StepProfile({ user, isGuest, onComplete, onBack }) {
  const { isDark } = useTheme();
  const [name, setName] = useState(user?.full_name?.split(" ")[0] || "");
  const [school, setSchool] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const initialLoadDone = useRef(false);
  const loadTimeoutRef = useRef(null);

  useEffect(() => {
    // Load saved school from learning profile (skip for guests)
    if (!isGuest) {
      const loadSavedSchool = async () => {
        try {
          const profiles = await base44.entities.LearningProfile.list('-created_date', 1);
          if (profiles.length > 0 && profiles[0].school) {
            setSchool(profiles[0].school);
          }
        } catch {}
      };
      loadSavedSchool();
    }

    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      
      // Hard safety timeout — never show loading spinner for more than 4s
      loadTimeoutRef.current = setTimeout(() => {
        setLoadingSuggestions(false);
      }, 4000);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => loadSchools("", pos.coords.latitude, pos.coords.longitude),
          () => loadSchools(""),
          { timeout: 3000, maximumAge: 300000 }
        );
      } else {
        loadSchools("");
      }
    }

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, []);

  const loadSchools = async (query, lat = null, lon = null) => {
    setLoadingSuggestions(true);
    try {
      const payload = { searchQuery: query };
      if (lat && lon) {
        payload.lat = lat;
        payload.lon = lon;
      }
      
      // Race the API call against a 4s timeout so users never wait too long
      const timeoutPromise = new Promise((resolve) => 
        setTimeout(() => resolve({ data: { success: true, schools: [], location: {} } }), 4000)
      );
      const result = await Promise.race([
        base44.functions.invoke("getNearbySchools", payload),
        timeoutPromise
      ]);
      
      if (result?.data?.success) {
        setSuggestions(result.data.schools || []);
        if (result.data.location?.city) {
          setUserLocation(result.data.location);
        }
      }
    } catch (err) {
      console.error("Error loading schools:", err);
    } finally {
      setLoadingSuggestions(false);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    }
  };

  const handleSchoolInput = (e) => {
    const q = e.target.value;
    setSchool(q);
    // No re-fetching on type — just filter the already-loaded suggestions client-side
    // The initial loadSchools() call on mount fetches nearby schools once
  };

  const handleSubmit = async () => {
    if (!name.trim() || !school.trim()) return;
    setSubmitting(true);
    await onComplete({ name: name.trim(), school: school.trim() });
  };

  const filteredSuggestions = React.useMemo(() => {
    if (!school.trim()) return suggestions;
    const query = school.toLowerCase().trim();
    const words = query.split(/\s+/).filter(w => w.length > 0);
    
    // Score each suggestion: higher = better match
    const scored = suggestions.map(s => {
      const name = s.name.toLowerCase();
      let score = 0;
      // Exact match
      if (name === query) score += 100;
      // Starts with query
      else if (name.startsWith(query)) score += 50;
      // Contains full query
      else if (name.includes(query)) score += 30;
      // All words match somewhere in name
      else if (words.every(w => name.includes(w))) score += 20;
      // Some words match
      else {
        const matchCount = words.filter(w => name.includes(w)).length;
        if (matchCount > 0) score += matchCount * 5;
      }
      return { ...s, _score: score };
    });
    
    return scored
      .filter(s => s._score > 0)
      .sort((a, b) => b._score - a._score);
  }, [school, suggestions]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 py-2"
    >
      {/* Greeting */}
      <div className="text-center space-y-1 flex flex-col items-center">
        <h2
          className={`text-2xl font-black ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {user?.full_name ? `Hi ${user.full_name.split(" ")[0]}` : "Hi There"} 👋
        </h2>
        <p
          className={`text-sm ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}
        >
          Let's personalize your experience
        </p>
      </div>

      {/* Name input */}
      <div className="space-y-1.5">
        <label
          className={`text-sm font-medium ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}
        >
          What would you like us to call you?
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          className={`h-12 text-base rounded-xl ${
            isDark
              ? "bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
          }`}
          autoFocus
        />
      </div>

      {/* School input */}
      <div className="space-y-1.5">
        <label
          className={`text-sm font-medium ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}
        >
          What school do you go to?
        </label>
        <Input
          value={school}
          onChange={handleSchoolInput}
          placeholder="Search for your school..."
          className={`h-12 text-base rounded-xl ${
            isDark
              ? "bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
          }`}
        />

        {/* Location hint */}
        {userLocation?.city && (
          <div
            className={`flex items-center gap-1.5 text-xs ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            <MapPin className="w-3 h-3" />
            Near {userLocation.city}
          </div>
        )}

        {/* School suggestions as pills */}
        <div className="flex flex-wrap gap-2 mt-2 max-h-[160px] overflow-y-auto">
          {loadingSuggestions ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2
                className={`w-4 h-4 animate-spin ${
                  isDark ? "text-purple-400" : "text-purple-600"
                }`}
              />
              <span
                className={`text-xs ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
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

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-2">
        {onBack && (
          <Button
            variant="ghost"
            onClick={onBack}
            className={`${
              isDark
                ? "text-slate-400 hover:text-white"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!name.trim() || !school.trim() || submitting}
          className="flex-1 h-12 text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-purple-500/20 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Continue"
          )}
        </Button>
      </div>

      {/* Returning user login link */}
      {!user && (
        <div className="text-center pt-1">
          <button
            onClick={() => {
              if (checkIsInAppBrowser()) {
                // Can't sign in from in-app browser — show alert
                alert("Please open this page in your browser (Safari/Chrome) to sign in.");
                return;
              }
              const returnUrl = window.location.pathname + window.location.search;
              base44.auth.redirectToLogin(returnUrl);
            }}
            className={`text-sm font-medium ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'} transition-colors`}
          >
            <LogIn className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            Already have an account? Log in
          </button>
        </div>
      )}
    </motion.div>
  );
}