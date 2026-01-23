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

const colorClasses = {
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    selectedBorder: "border-purple-500",
    selectedBg: "bg-purple-100",
    icon: "text-purple-600",
    iconBg: "bg-purple-100"
  },
  indigo: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    selectedBorder: "border-indigo-500",
    selectedBg: "bg-indigo-100",
    icon: "text-indigo-600",
    iconBg: "bg-indigo-100"
  },
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    selectedBorder: "border-emerald-500",
    selectedBg: "bg-emerald-100",
    icon: "text-emerald-600",
    iconBg: "bg-emerald-100"
  },
  rose: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    selectedBorder: "border-rose-500",
    selectedBg: "bg-rose-100",
    icon: "text-rose-600",
    iconBg: "bg-rose-100"
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    selectedBorder: "border-amber-500",
    selectedBg: "bg-amber-100",
    icon: "text-amber-600",
    iconBg: "bg-amber-100"
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    selectedBorder: "border-blue-500",
    selectedBg: "bg-blue-100",
    icon: "text-blue-600",
    iconBg: "bg-blue-100"
  },
  slate: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    selectedBorder: "border-slate-500",
    selectedBg: "bg-slate-100",
    icon: "text-slate-600",
    iconBg: "bg-slate-100"
  }
};

export default function StudyTypeSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[400px] md:max-h-none overflow-y-auto px-1">
      {studyTypes.map((type) => {
        const isSelected = value === type.id;
        const colors = colorClasses[type.color];
        const Icon = type.icon;
        
        return (
          <button
            key={type.id}
            type="button"
            onClick={() => onChange(type.id)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
              isSelected 
                ? `${colors.selectedBorder} ${colors.selectedBg}` 
                : `${colors.border} ${colors.bg} hover:border-opacity-80`
            }`}
          >
            <div className={`w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-6 h-6 ${colors.icon}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-base">{type.header}</p>
              <p className="text-sm text-slate-500 truncate">{type.sub}</p>
            </div>
            {isSelected && (
              <div className={`w-6 h-6 rounded-full ${colors.selectedBorder.replace('border-', 'bg-')} flex items-center justify-center`}>
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