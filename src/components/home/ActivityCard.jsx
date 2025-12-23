import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { 
  BookOpen, Calculator, Beaker, Globe, BookText, Languages, 
  Code, Palette, Music, Briefcase, FileCheck, Sparkles, ChevronRight, Clock
} from "lucide-react";

// Unique gradient themes for different subjects
const subjectThemes = {
  math: { bg: "from-blue-500 to-indigo-600", accent: "bg-blue-400", light: "bg-blue-50" },
  science: { bg: "from-emerald-500 to-teal-600", accent: "bg-emerald-400", light: "bg-emerald-50" },
  history: { bg: "from-amber-500 to-orange-600", accent: "bg-amber-400", light: "bg-amber-50" },
  english: { bg: "from-rose-500 to-pink-600", accent: "bg-rose-400", light: "bg-rose-50" },
  language: { bg: "from-violet-500 to-purple-600", accent: "bg-violet-400", light: "bg-violet-50" },
  cs: { bg: "from-cyan-500 to-blue-600", accent: "bg-cyan-400", light: "bg-cyan-50" },
  art: { bg: "from-fuchsia-500 to-pink-600", accent: "bg-fuchsia-400", light: "bg-fuchsia-50" },
  music: { bg: "from-red-500 to-rose-600", accent: "bg-red-400", light: "bg-red-50" },
  business: { bg: "from-slate-600 to-zinc-700", accent: "bg-slate-400", light: "bg-slate-50" },
  default: { bg: "from-purple-500 to-indigo-600", accent: "bg-purple-400", light: "bg-purple-50" }
};

const getSubjectInfo = (courseName) => {
  const name = courseName?.toLowerCase() || "";
  
  if (name.includes('math') || name.includes('calculus') || name.includes('algebra') || name.includes('geometry') || name.includes('statistics')) {
    return { icon: Calculator, theme: subjectThemes.math, label: "Mathematics" };
  }
  if (name.includes('physics') || name.includes('chemistry') || name.includes('biology') || name.includes('science')) {
    return { icon: Beaker, theme: subjectThemes.science, label: "Science" };
  }
  if (name.includes('geography') || name.includes('geo')) {
    return { icon: Globe, theme: subjectThemes.default, label: "Geography" };
  }
  if (name.includes('history') || name.includes('humanities') || name.includes('philosophy')) {
    return { icon: BookText, theme: subjectThemes.history, label: "History" };
  }
  if (name.includes('english') || name.includes('literature') || name.includes('writing')) {
    return { icon: BookText, theme: subjectThemes.english, label: "English" };
  }
  if (name.includes('language') || name.includes('french') || name.includes('spanish') || name.includes('german') || name.includes('chinese')) {
    return { icon: Languages, theme: subjectThemes.language, label: "Language" };
  }
  if (name.includes('computer') || name.includes('coding') || name.includes('programming') || name.includes('cs')) {
    return { icon: Code, theme: subjectThemes.cs, label: "Computer Science" };
  }
  if (name.includes('art') || name.includes('design')) {
    return { icon: Palette, theme: subjectThemes.art, label: "Art & Design" };
  }
  if (name.includes('music')) {
    return { icon: Music, theme: subjectThemes.music, label: "Music" };
  }
  if (name.includes('business') || name.includes('economics') || name.includes('econ') || name.includes('finance')) {
    return { icon: Briefcase, theme: subjectThemes.business, label: "Business" };
  }
  
  return { icon: BookOpen, theme: subjectThemes.default, label: "Study" };
};

const formatStudyTime = (seconds) => {
  if (!seconds || seconds === 0) return null;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hrs}h ${remainingMins}m`;
};

export function LessonActivityCard({ lesson, exams = [], index = 0 }) {
  const navigate = useNavigate();
  const { icon: SubjectIcon, theme, label } = getSubjectInfo(lesson.course_name);
  
  const completedCount = exams.filter(e => e.completed).length;
  const latestCompleted = exams.filter(e => e.completed).sort((a, b) => b.exam_number - a.exam_number)[0];
  const progress = Math.round((completedCount / 6) * 100);
  const studyTime = formatStudyTime(lesson.total_study_time_seconds);

  const handleClick = () => {
    navigate(createPageUrl("DocumentViewer") + `?lessonId=${lesson.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      onClick={handleClick}
      className="group cursor-pointer"
    >
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-slate-300 transition-all duration-300 hover:-translate-y-1">
        {/* Colored top bar */}
        <div className={`h-1.5 bg-gradient-to-r ${theme.bg}`} />
        
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme.bg} flex items-center justify-center shadow-lg shadow-slate-200`}>
              <SubjectIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 truncate text-sm group-hover:text-slate-700 transition-colors">
                {lesson.course_name}
              </h3>
              <span className="text-xs text-slate-400">{label}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all mt-1" />
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between">
            {latestCompleted ? (
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold bg-gradient-to-r ${theme.bg} bg-clip-text text-transparent`}>
                  {latestCompleted.predicted_grade || "—"}
                </span>
                <span className="text-xs text-slate-400">predicted</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ready to start</span>
              </div>
            )}
            
            {/* Mini progress */}
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[...Array(6)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-1.5 h-4 rounded-full transition-colors ${
                      i < completedCount 
                        ? `bg-gradient-to-t ${theme.bg}` 
                        : 'bg-slate-100'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-400 ml-1">{completedCount}/6</span>
            </div>
          </div>

          {/* Study time */}
          {studyTime && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
              <Clock className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500">{studyTime} studied</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function AssignmentActivityCard({ assignment, index = 0 }) {
  const navigate = useNavigate();
  const { theme } = getSubjectInfo(assignment.course_name);
  const hasResult = assignment.grading_result;
  const grade = hasResult?.predicted_grade;
  const score = hasResult?.total_score ? Math.round(hasResult.total_score) : null;

  const handleClick = () => {
    navigate(createPageUrl("GradeResults") + `?assignmentId=${assignment.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      onClick={handleClick}
      className="group cursor-pointer"
    >
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 hover:-translate-y-1">
        {/* Colored top bar - emerald for graded */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
        
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-slate-200">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 truncate text-sm group-hover:text-slate-700 transition-colors">
                {assignment.course_name}
              </h3>
              <span className="text-xs text-slate-400 truncate block">{assignment.assignment_title}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all mt-1" />
          </div>

          {/* Grade Display */}
          <div className="flex items-center justify-between">
            {hasResult ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
                    {grade}
                  </span>
                  <span className="text-xs text-slate-400">grade</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-full">
                  <span className="text-xs font-medium text-emerald-700">{score}%</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-3 h-3 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}