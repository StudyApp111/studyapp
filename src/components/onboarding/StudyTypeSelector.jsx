import React from "react";
import { GraduationCap, BookOpen, School, Stethoscope, Award, FileText, Sparkles } from "lucide-react";

const studyTypes = [
  {
    id: "university",
    header: "University",
    sub: "Intro courses, major requirements, finals, etc.",
    icon: GraduationCap,
    color: "purple"
  },
  {
    id: "grad_school",
    header: "Grad School",
    sub: "Masters, PhD, dissertations",
    icon: BookOpen,
    color: "indigo"
  },
  {
    id: "high_school",
    header: "High School",
    sub: "AP, IB, Honors, or regular classes",
    icon: School,
    color: "emerald"
  },
  {
    id: "med_school",
    header: "Med School",
    sub: "Pre-clinical, Step 1, Step 2, rotations",
    icon: Stethoscope,
    color: "rose"
  },
  {
    id: "professional_cert",
    header: "Professional Certification",
    sub: "NCLEX, Bar Exam, CPA, PMP, AWS certs, etc.",
    icon: Award,
    color: "amber"
  },
  {
    id: "standardized_tests",
    header: "Standardized Tests",
    sub: "SAT, ACT, MCAT, GRE, GMAT, LSAT, etc.",
    icon: FileText,
    color: "blue"
  },
  {
    id: "other",
    header: "Other",
    sub: "Self-study, hobbies, or something else",
    icon: Sparkles,
    color: "slate"
  }
];

// Dark mode color classes for onboarding
const colorClasses = {
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    selectedBorder: "border-purple-500",
    selectedBg: "bg-purple-500/20",
    icon: "text-purple-400",
    iconBg: "bg-purple-500/20"
  },
  indigo: {
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    selectedBorder: "border-indigo-500",
    selectedBg: "bg-indigo-500/20",
    icon: "text-indigo-400",
    iconBg: "bg-indigo-500/20"
  },
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    selectedBorder: "border-emerald-500",
    selectedBg: "bg-emerald-500/20",
    icon: "text-emerald-400",
    iconBg: "bg-emerald-500/20"
  },
  rose: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    selectedBorder: "border-rose-500",
    selectedBg: "bg-rose-500/20",
    icon: "text-rose-400",
    iconBg: "bg-rose-500/20"
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    selectedBorder: "border-amber-500",
    selectedBg: "bg-amber-500/20",
    icon: "text-amber-400",
    iconBg: "bg-amber-500/20"
  },
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    selectedBorder: "border-blue-500",
    selectedBg: "bg-blue-500/20",
    icon: "text-blue-400",
    iconBg: "bg-blue-500/20"
  },
  slate: {
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    selectedBorder: "border-slate-400",
    selectedBg: "bg-slate-500/20",
    icon: "text-slate-400",
    iconBg: "bg-slate-500/20"
  }
};

export default function StudyTypeSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 px-1">
      {studyTypes.map((type) => {
        const isSelected = value === type.id;
        const colors = colorClasses[type.color];
        const Icon = type.icon;
        
        return (
          <button
            key={type.id}
            type="button"
            onClick={() => onChange(type.id)}
            className={`relative w-full flex flex-col items-center gap-2 p-4 md:p-5 rounded-2xl border-2 transition-all text-center hover:scale-[1.02] ${
              isSelected 
                ? `${colors.selectedBorder} ${colors.selectedBg} shadow-lg` 
                : `${colors.border} ${colors.bg} hover:border-opacity-80`
            }`}
          >
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl ${colors.iconBg} flex items-center justify-center`}>
              <Icon className={`w-6 h-6 md:w-7 md:h-7 ${colors.icon}`} />
            </div>
            <div>
              <p className="font-bold text-white text-sm md:text-base">{type.header}</p>
              <p className="text-[10px] md:text-xs text-slate-400 leading-tight line-clamp-2 mt-0.5">{type.sub}</p>
            </div>
            {isSelected && (
              <div className={`absolute top-2 right-2 w-5 h-5 rounded-full ${colors.selectedBorder.replace('border-', 'bg-')} flex items-center justify-center`}>
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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