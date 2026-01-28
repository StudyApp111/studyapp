import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, MapPin, GraduationCap, Users, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function SchoolSelector({ value, onChange, prefetchedData }) {
  const [searchQuery, setSearchQuery] = useState(value || "");
  const [nearbySchools, setNearbySchools] = useState([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  useEffect(() => {
    if (!hasLoadedInitial) {
      if (prefetchedData?.schools?.length > 0) {
        setNearbySchools(prefetchedData.schools);
        setUserLocation(prefetchedData.location);
        setHasLoadedInitial(true);
      } else {
        loadNearbySchools();
      }
    }
  }, [hasLoadedInitial, prefetchedData]);

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

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
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

  const handleManualEntry = () => {
    if (searchQuery.trim()) {
      onChange(searchQuery.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input with clear styling */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
        <Input
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Type your school name..."
          className="text-base pl-12 pr-4 py-5 h-auto rounded-xl border-2 border-purple-500/30 focus:border-purple-400 text-white bg-slate-800/80 placeholder:text-slate-500"
          autoComplete="off"
        />
      </div>

      {/* Location indicator - friendly */}
      {userLocation?.city && (
        <div className="flex items-center justify-center gap-2 text-sm text-purple-300 bg-purple-500/10 rounded-lg py-2 px-3">
          <MapPin className="w-4 h-4" />
          <span>Showing schools near <strong>{userLocation.city}</strong></span>
        </div>
      )}

      {/* Schools List - Always visible, not hidden until typing */}
      <div className="rounded-xl border border-slate-600/50 bg-slate-800/50 overflow-hidden">
        {isLoadingSchools ? (
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span className="text-slate-300">Finding nearby schools...</span>
          </div>
        ) : nearbySchools.length > 0 ? (
          <div className="max-h-[240px] overflow-y-auto divide-y divide-slate-700/50">
            {nearbySchools.map((school, idx) => {
              const isSelected = value === school.name;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectSchool(school.name)}
                  className={`w-full flex items-center gap-3 p-4 text-left transition-all ${
                    isSelected 
                      ? 'bg-gradient-to-r from-purple-500/30 to-indigo-500/30' 
                      : 'hover:bg-purple-500/10'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-purple-500' : 'bg-slate-700'
                  }`}>
                    <GraduationCap className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-slate-300'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                      {school.name}
                    </p>
                    {school.classmates > 0 && (
                      <p className="text-sm text-purple-400 flex items-center gap-1 mt-0.5">
                        <Users className="w-3.5 h-3.5" />
                        {school.classmates} classmate{school.classmates !== 1 ? 's' : ''} here
                      </p>
                    )}
                  </div>
                  <ChevronRight className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-purple-300' : 'text-slate-500'}`} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center px-4">
            <p className="text-slate-300 mb-1">No schools found nearby</p>
            <p className="text-sm text-slate-500">Type your school name above</p>
          </div>
        )}
      </div>

      {/* Manual entry - always visible when typing something not in list */}
      {searchQuery.trim() && !nearbySchools.find(s => s.name.toLowerCase() === searchQuery.toLowerCase()) && (
        <button
          type="button"
          onClick={handleManualEntry}
          className="w-full p-4 text-center bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 rounded-xl transition-all border border-purple-500/30 group"
        >
          <span className="text-purple-200 font-medium group-hover:text-white transition-colors">
            Continue with "<strong>{searchQuery}</strong>"
          </span>
        </button>
      )}
    </div>
  );
}