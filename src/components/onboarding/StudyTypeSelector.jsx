import React from "react";
import { GraduationCap, BookOpen, School, Stethoscope, Award, FileText, Sparkles } from "lucide-react";

const studyTypes = [
  {
    id: "university",
    header: "University",
    sub: "Undergrad courses & finals",
    icon: GraduationCap,
    emoji: "🎓",
    gradient: "from-purple-500 to-indigo-600"
  },
  {
    id: "high_school",
    header: "High School",
    sub: "AP, IB & regular classes",
    icon: School,
    emoji: "📚",
    gradient: "from-emerald-500 to-teal-600"
  },
  {
    id: "grad_school",
    header: "Grad School",
    sub: "Masters & PhD",
    icon: BookOpen,
    emoji: "🎯",
    gradient: "from-blue-500 to-cyan-600"
  },
  {
    id: "med_school",
    header: "Med School",
    sub: "Pre-clinical & boards",
    icon: Stethoscope,
    emoji: "🩺",
    gradient: "from-rose-500 to-pink-600"
  },
  {
    id: "professional_cert",
    header: "Certifications",
    sub: "CPA, PMP, AWS & more",
    icon: Award,
    emoji: "🏆",
    gradient: "from-amber-500 to-orange-600"
  },
  {
    id: "standardized_tests",
    header: "Test Prep",
    sub: "SAT, MCAT, GRE, LSAT",
    icon: FileText,
    emoji: "📝",
    gradient: "from-violet-500 to-purple-600"
  },
  {
    id: "other",
    header: "Other",
    sub: "Self-study & hobbies",
    icon: Sparkles,
    emoji: "✨",
    gradient: "from-slate-500 to-slate-600"
  }
];

export default function StudyTypeSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 px-1">
      {studyTypes.map((type) => {
        const isSelected = value === type.id;
        
        return (
          <button
            key={type.id}
            type="button"
            onClick={() => onChange(type.id)}
            className={`relative group w-full flex flex-col items-center gap-2 p-4 md:p-5 rounded-2xl border-2 transition-all duration-200 text-center ${
              isSelected 
                ? `border-white/50 bg-gradient-to-br ${type.gradient} shadow-xl scale-[1.02]` 
                : `border-slate-600/50 bg-slate-800/40 hover:bg-slate-700/50 hover:border-slate-500/50 hover:scale-[1.01]`
            }`}
          >
            {/* Large emoji for warmth */}
            <div className={`text-4xl md:text-5xl transition-transform duration-200 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}>
              {type.emoji}
            </div>
            
            <div>
              <p className={`font-bold text-base md:text-lg ${isSelected ? 'text-white' : 'text-white/90'}`}>
                {type.header}
              </p>
              <p className={`text-xs md:text-sm leading-tight mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                {type.sub}
              </p>
            </div>
            
            {/* Selected checkmark */}
            {isSelected && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}