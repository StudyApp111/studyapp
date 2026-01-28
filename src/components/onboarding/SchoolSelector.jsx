import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, MapPin, GraduationCap, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function SchoolSelector({ value, onChange, prefetchedData }) {
  const [searchQuery, setSearchQuery] = useState(value || "");
  const [nearbySchools, setNearbySchools] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      if (prefetchedData?.schools?.length > 0) {
        setNearbySchools(prefetchedData.schools);
        setUserLocation(prefetchedData.location);
      } else {
        loadSchools();
      }
      setInitialized(true);
    }
  }, [initialized, prefetchedData]);

  const loadSchools = async (query = "") => {
    setIsLoading(true);
    try {
      const result = await base44.functions.invoke('getNearbySchools', { searchQuery: query });
      if (result?.data?.success) {
        setNearbySchools(result.data.schools || []);
        setUserLocation(result.data.location);
      }
    } catch (error) {
      console.error("Error loading schools:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Debounced search
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        loadSchools(query);
      } else if (query.length === 0) {
        loadSchools();
      }
    }, 300);
    
    return () => clearTimeout(timer);
  };

  const selectSchool = (schoolName) => {
    onChange(schoolName);
    setSearchQuery(schoolName);
  };

  const useCustomSchool = () => {
    if (searchQuery.trim()) {
      onChange(searchQuery.trim());
    }
  };

  const isSchoolSelected = value && nearbySchools.some(s => s.name === value);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
        <Input
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Search or type your school..."
          className="text-base pl-12 pr-4 py-5 h-auto rounded-xl border-2 border-purple-500/30 focus:border-purple-400 text-white bg-slate-800/80 placeholder:text-slate-500"
          autoComplete="off"
        />
      </div>

      {/* Location indicator */}
      {userLocation?.city && (
        <div className="flex items-center justify-center gap-2 text-sm text-purple-300 bg-purple-500/10 rounded-lg py-2">
          <MapPin className="w-4 h-4" />
          <span>Near {userLocation.city}</span>
        </div>
      )}

      {/* Schools List */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden max-h-[220px] overflow-y-auto overflow-x-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span className="text-slate-300 text-sm">Finding schools...</span>
          </div>
        ) : nearbySchools.length > 0 ? (
          <div className="divide-y divide-slate-700/30">
            {nearbySchools.slice(0, 6).map((school, idx) => {
              const isSelected = value === school.name;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectSchool(school.name)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-all ${
                    isSelected 
                      ? 'bg-purple-500/20' 
                      : 'hover:bg-slate-700/30'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-purple-500' : 'bg-slate-700'
                  }`}>
                    <GraduationCap className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                  <span className={`flex-1 truncate text-sm ${isSelected ? 'text-white font-medium' : 'text-slate-200'}`} style={{ maxWidth: 'calc(100% - 60px)' }}>
                    {school.name.length > 40 ? school.name.substring(0, 40) + '...' : school.name}
                  </span>
                  {isSelected && <ChevronRight className="w-4 h-4 text-purple-300" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-slate-400 text-sm">
            No schools found nearby
          </div>
        )}
      </div>

      {/* Custom entry option */}
      {searchQuery.trim() && !isSchoolSelected && (
        <button
          type="button"
          onClick={useCustomSchool}
          className="w-full p-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-200 font-medium transition-all"
        >
          Use "{searchQuery}"
        </button>
      )}
    </div>
  );
}