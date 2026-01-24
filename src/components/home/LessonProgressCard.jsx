import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, Target, TrendingUp, CheckCircle2, Clock, ArrowRight, Calculator, Beaker, Globe, BookText, Languages, Code, Palette, Music, Briefcase } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const getSubjectIcon = (courseName) => {
  const name = (courseName || '').toLowerCase();
  if (name.includes('math') || name.includes('calculus') || name.includes('algebra')) return Calculator;
  if (name.includes('physics') || name.includes('chemistry') || name.includes('biology') || name.includes('science')) return Beaker;
  if (name.includes('geography')) return Globe;
  if (name.includes('history') || name.includes('english') || name.includes('literature')) return BookText;
  if (name.includes('language') || name.includes('french') || name.includes('spanish')) return Languages;
  if (name.includes('computer') || name.includes('coding') || name.includes('programming')) return Code;
  if (name.includes('art') || name.includes('design')) return Palette;
  if (name.includes('music')) return Music;
  if (name.includes('business') || name.includes('economics') || name.includes('finance')) return Briefcase;
  return BookOpen;
};

export default function LessonProgressCard({ lesson, studyPlan, index = 0 }) {
  const Icon = getSubjectIcon(lesson.course_name);
  
  const totalTasks = studyPlan?.tasks?.length || 0;
  const completedTasks = studyPlan?.tasks?.filter(t => t.completed)?.length || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const currentGrade = studyPlan?.current_predicted_grade || studyPlan?.initial_predicted_grade;
  const hasStarted = !!studyPlan;
  
  const getGradeColor = (grade) => {
    if (!grade) return 'text-slate-400';
    if (grade.startsWith('A')) return 'text-emerald-600';
    if (grade.startsWith('B')) return 'text-blue-600';
    if (grade.startsWith('C')) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <Link to={`${createPageUrl("DocumentViewer")}?id=${lesson.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ scale: 1.01 }}
        className="bg-white rounded-xl border border-slate-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-purple-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Course name */}
            <h3 className="font-semibold text-slate-900 text-sm truncate mb-1 group-hover:text-purple-700 transition-colors">
              {lesson.course_name}
            </h3>
            
            {/* Progress bar and stats */}
            {hasStarted ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Progress value={progressPercent} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-slate-500 font-medium">{completedTasks}/{totalTasks}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {currentGrade && (
                    <span className={`text-xs font-bold ${getGradeColor(currentGrade)}`}>
                      {currentGrade}
                    </span>
                  )}
                  {totalTasks - completedTasks > 0 ? (
                    <span className="text-[10px] text-slate-500">
                      {totalTasks - completedTasks} tasks remaining
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Complete
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1 text-purple-600">
                <Target className="w-3 h-3" />
                <span className="text-xs font-medium">Start diagnostic →</span>
              </div>
            )}
          </div>
          
          {/* Arrow on hover */}
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition-colors flex-shrink-0" />
        </div>
      </motion.div>
    </Link>
  );
}