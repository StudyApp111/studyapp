import React, { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { School, GraduationCap, BookOpen, Search, Loader2, Users, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function OnboardingQuestion({ question, value, onChange, prefetchedData }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [nearbySchools, setNearbySchools] = useState([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  // Load nearby schools when school-search question is shown
  useEffect(() => {
    if (question.type === "school-search" && !hasLoadedInitial) {
      // Use prefetched data if available
      if (prefetchedData?.schools) {
        setNearbySchools(prefetchedData.schools);
        setUserLocation(prefetchedData.location);
        setHasLoadedInitial(true);
      } else {
        loadNearbySchools();
      }
    }
  }, [question.type, hasLoadedInitial, prefetchedData]);

  const loadNearbySchools = async (query = "") => {
    setIsLoadingSchools(true);
    try {
      const result = await base44.functions.invoke('getNearbySchools', { searchQuery: query });
      if (result?.data?.success) {
        setNearbySchools(result.data.schools || []);
        setUserLocation(result.data.location);
      }
    } catch (error) {
      console.error("Error loading nearby schools:", error);
    } finally {
      setIsLoadingSchools(false);
      setHasLoadedInitial(true);
    }
  };

  const handleSchoolSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    // Debounce search
    if (query.length >= 2) {
      const timer = setTimeout(() => loadNearbySchools(query), 300);
      return () => clearTimeout(timer);
    } else if (query.length === 0) {
      loadNearbySchools();
    }
  };

  const selectSchool = (schoolName) => {
    onChange(schoolName);
    setSearchQuery(schoolName);
  };

  // School search type
  if (question.type === "school-search") {
    return (
      <div className="space-y-4">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 text-center">{question.question}</h2>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={handleSchoolSearch}
            placeholder={question.placeholder}
            className="text-base pl-12 pr-4 py-6 h-auto rounded-xl border-2 border-slate-200 focus:border-purple-400 text-slate-900 bg-white placeholder:text-slate-400"
            autoComplete="off"
          />
        </div>

        {/* Location indicator */}
        {userLocation?.city && (
          <div className="flex items-center justify-center gap-1.5 text-sm text-slate-500">
            <MapPin className="w-4 h-4" />
            <span>Showing schools near {userLocation.city}</span>
          </div>
        )}

        {/* Schools List */}
        <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {isLoadingSchools ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <span className="ml-2 text-slate-600">Finding nearby schools...</span>
            </div>
          ) : nearbySchools.length > 0 ? (
            nearbySchools.map((school, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectSchool(school.name)}
                className={`w-full flex items-start gap-3 p-4 text-left hover:bg-purple-50 transition-colors ${
                  value === school.name ? 'bg-purple-50 border-l-4 border-purple-500' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{school.name}</p>
                  {school.address && (
                    <p className="text-sm text-slate-500 truncate">{school.address}</p>
                  )}
                  {school.classmates > 0 && (
                    <p className="text-sm font-medium text-purple-600 flex items-center gap-1 mt-0.5">
                      <Users className="w-3.5 h-3.5" />
                      {school.classmates} classmate{school.classmates !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </button>
            ))
          ) : searchQuery.length >= 2 ? (
            <div className="py-8 text-center">
              <p className="text-slate-600">No schools found matching "{searchQuery}"</p>
              <p className="text-sm text-slate-400 mt-1">Try a different search or enter your school name manually</p>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-600">Start typing to search for your school</p>
            </div>
          )}
        </div>

        {/* Manual entry option */}
        {searchQuery && !nearbySchools.find(s => s.name === searchQuery) && (
          <button
            type="button"
            onClick={() => onChange(searchQuery)}
            className="w-full p-3 text-center text-purple-600 font-medium hover:bg-purple-50 rounded-lg transition-colors border border-purple-200"
          >
            Use "{searchQuery}" as my school
          </button>
        )}
      </div>
    );
  }

  if (question.type === "single") {
    const isGradeQuestion = question.id === "grade";
    
    if (isGradeQuestion) {
      const gradeGroups = [
        {
          title: "Middle School",
          icon: BookOpen,
          color: "emerald",
          options: question.options.slice(0, 3) // Grade 6-8
        },
        {
          title: "High School",
          icon: School,
          color: "purple",
          options: question.options.slice(3, 7) // Grade 9-12
        },
        {
          title: "University",
          icon: GraduationCap,
          color: "amber",
          options: question.options.slice(7) // University + Post Graduate
        }
      ];

      const colorClasses = {
        emerald: {
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          hoverBorder: "hover:border-emerald-400",
          selectedBorder: "border-emerald-500",
          selectedBg: "bg-emerald-100",
          icon: "text-emerald-600",
          title: "text-emerald-700"
        },
        purple: {
          bg: "bg-purple-50",
          border: "border-purple-200",
          hoverBorder: "hover:border-purple-400",
          selectedBorder: "border-purple-500",
          selectedBg: "bg-purple-100",
          icon: "text-purple-600",
          title: "text-purple-700"
        },
        amber: {
          bg: "bg-amber-50",
          border: "border-amber-200",
          hoverBorder: "hover:border-amber-400",
          selectedBorder: "border-amber-500",
          selectedBg: "bg-amber-100",
          icon: "text-amber-600",
          title: "text-amber-700"
        }
      };

      return (
        <div className="space-y-4">
          <RadioGroup value={value} onValueChange={onChange}>
            {/* Mobile: stacked sections with grid layout */}
            <div className="md:hidden space-y-3">
              {gradeGroups.map((group, groupIdx) => {
                const colors = colorClasses[group.color];
                const Icon = group.icon;
                
                return (
                  <div 
                    key={groupIdx} 
                    className={`rounded-2xl p-4 ${colors.bg} border-2 ${colors.border}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`w-5 h-5 ${colors.icon}`} />
                      <h3 className={`text-base font-bold ${colors.title}`}>
                        {group.title}
                      </h3>
                    </div>
                    <div className={`grid gap-2 ${
                      group.title === 'University' ? 'grid-cols-2' : 'grid-cols-3'
                    }`}>
                      {group.options.map((option, index) => {
                        const isSelected = value === option;
                        const mobileLabel = option
                          .replace('Grade ', '')
                          .replace('1st Year University', '1st Year')
                          .replace('2nd Year University', '2nd Year')
                          .replace('3rd Year University', '3rd Year')
                          .replace('4th Year University', '4th Year')
                          .replace('Post Graduate', 'Post Grad');
                        
                        return (
                          <label
                            key={index}
                            htmlFor={`mobile-option-${groupIdx}-${index}`}
                            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                              isSelected 
                                ? `${colors.selectedBorder} ${colors.selectedBg}` 
                                : `border-white/60 bg-white/80 ${colors.hoverBorder}`
                            }`}
                          >
                            <RadioGroupItem 
                              value={option} 
                              id={`mobile-option-${groupIdx}-${index}`}
                              className="shrink-0"
                            />
                            <span className={`text-sm font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                              {mobileLabel}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: 3 columns with better spacing */}
            <div className="hidden md:grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {gradeGroups.map((group, groupIdx) => {
                const colors = colorClasses[group.color];
                const Icon = group.icon;
                
                return (
                  <div 
                    key={groupIdx} 
                    className={`rounded-2xl p-5 ${colors.bg} border-2 ${colors.border}`}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Icon className={`w-5 h-5 ${colors.icon}`} />
                      <h3 className={`text-base font-bold ${colors.title}`}>
                        {group.title}
                      </h3>
                    </div>
                    <div className="space-y-2.5">
                      {group.options.map((option, index) => {
                        const isSelected = value === option;
                        
                        return (
                          <label
                            key={index}
                            htmlFor={`desktop-option-${groupIdx}-${index}`}
                            className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                              isSelected 
                                ? `${colors.selectedBorder} ${colors.selectedBg}` 
                                : `border-white/60 bg-white/80 ${colors.hoverBorder}`
                            }`}
                          >
                            <RadioGroupItem 
                              value={option} 
                              id={`desktop-option-${groupIdx}-${index}`}
                              className="shrink-0"
                            />
                            <span className={`text-sm font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                              {option}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </RadioGroup>
        </div>
      );
    }

    // Standard single select
    return (
      <div className="space-y-5">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 text-center">{question.question}</h2>
        <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {question.options.map((option, index) => {
            const isSelected = value === option;
            return (
              <label
                key={index}
                htmlFor={`option-${index}`}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  isSelected 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-slate-200 hover:border-purple-300 bg-white'
                }`}
              >
                <RadioGroupItem value={option} id={`option-${index}`} className="shrink-0" />
                <span className={`text-sm font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                  {option}
                </span>
              </label>
            );
          })}
        </RadioGroup>
      </div>
    );
  }

  if (question.type === "text") {
    return (
      <div className="space-y-5">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 text-center">{question.question}</h2>
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="text-lg p-6 h-auto text-center"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck="false"
          data-form-type="other"
          data-lpignore="true"
          name={`onboarding-${question.id}-${Date.now()}`}
        />
      </div>
    );
  }

  return null;
}