import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Target, Sparkles } from "lucide-react";

export default function LearningTrajectory({ studyPlans, lessons }) {
  if (!studyPlans || studyPlans.length === 0) return null;

  // Get lessons with grades
  const lessonsWithGrades = lessons
    .map(lesson => {
      const plan = studyPlans.find(sp => sp.lesson_id === lesson.id);
      if (!plan) return null;
      const grade = plan.current_predicted_grade || plan.initial_predicted_grade;
      if (!grade) return null;
      return { lesson, plan, grade };
    })
    .filter(Boolean)
    .slice(0, 5);

  if (lessonsWithGrades.length === 0) return null;

  const getGradeValue = (grade) => {
    const gradeMap = { 'A+': 95, 'A': 90, 'A-': 87, 'B+': 83, 'B': 80, 'B-': 77, 'C+': 73, 'C': 70, 'C-': 67, 'D': 60, 'F': 50 };
    return gradeMap[grade] || 70;
  };

  const getGradeColor = (grade) => {
    if (grade?.startsWith('A')) return 'bg-emerald-500';
    if (grade?.startsWith('B')) return 'bg-blue-500';
    if (grade?.startsWith('C')) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // Calculate average grade
  const avgGradeValue = lessonsWithGrades.reduce((sum, l) => sum + getGradeValue(l.grade), 0) / lessonsWithGrades.length;
  
  // Determine trend
  let trend = 'stable';
  if (lessonsWithGrades.length >= 2) {
    const recent = getGradeValue(lessonsWithGrades[0].grade);
    const older = getGradeValue(lessonsWithGrades[lessonsWithGrades.length - 1].grade);
    if (recent > older + 3) trend = 'up';
    else if (recent < older - 3) trend = 'down';
  }

  const trendText = trend === 'up' ? 'Improving' : trend === 'down' ? 'Needs focus' : 'Stable';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Learning Trajectory</h3>
            <p className="text-[10px] text-white/80">{lessonsWithGrades.length} courses tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/20">
          {trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-white" />}
          {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-white" />}
          {trend === 'stable' && <Minus className="w-3.5 h-3.5 text-white" />}
          <span className="text-xs font-medium text-white">{trendText}</span>
        </div>
      </div>
      
      <div className="p-4">

        {/* Grade bars */}
        <div className="space-y-2">
          {lessonsWithGrades.map(({ lesson, grade }, idx) => (
            <div key={lesson.id} className="flex items-center gap-2">
              <div className="w-16 truncate">
                <span className="text-[10px] text-slate-500 truncate block">{lesson.course_name.split(' ').slice(0, 2).join(' ')}</span>
              </div>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${getGradeValue(grade)}%` }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  className={`h-full rounded-full ${getGradeColor(grade)}`}
                />
              </div>
              <span className="text-xs font-bold text-slate-700 w-8 text-right">{grade}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}