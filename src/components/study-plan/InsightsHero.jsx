import React from "react";
import { Sparkles, Target, Clock, AlertCircle, TrendingUp, TrendingDown, Minus, ArrowRight, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const gradeFromScore = (val) => {
  if (val >= 95) return 'A+';
  if (val >= 90) return 'A';
  if (val >= 85) return 'A-';
  if (val >= 80) return 'B+';
  if (val >= 75) return 'B';
  if (val >= 70) return 'B-';
  if (val >= 65) return 'C+';
  if (val >= 60) return 'C';
  if (val >= 55) return 'C-';
  if (val >= 50) return 'D+';
  if (val >= 45) return 'D';
  if (val >= 40) return 'D-';
  return 'F';
};

export default function InsightsHero({ lesson, studyPlan, behavioralInsights, latestExam }) {
  const { isDark } = useTheme();

  const currentGrade = studyPlan?.current_predicted_grade || studyPlan?.initial_predicted_grade || '—';
  const masteryGap = studyPlan?.mastery_gap || studyPlan?.priority_focus;
  const courseName = lesson?.course_name || 'your course';

  // Build the dynamic hero message
  const gradeIsGood = currentGrade.startsWith('A');
  const gradeIsBad = currentGrade.startsWith('D') || currentGrade.startsWith('F');

  let headline = '';
  let subtext = '';

  if (gradeIsGood) {
    headline = `You're on track for an ${currentGrade} in ${courseName}.`;
    subtext = masteryGap 
      ? `Keep it up! Fine-tune your understanding of "${masteryGap}" to lock in that top grade.`
      : `Keep completing tasks below to maintain your edge.`;
  } else if (gradeIsBad) {
    headline = `Your predicted grade for ${courseName} is a ${currentGrade} — but we've got a plan.`;
    subtext = masteryGap
      ? `Your biggest gap is "${masteryGap}." The study plan below is designed to close it. Let's get you to an A.`
      : `The tasks below target your weakest areas. Every one you complete moves the needle.`;
  } else {
    headline = `Welcome to your study hub for ${courseName}.`;
    subtext = masteryGap
      ? `Your predicted grade is a ${currentGrade}. We've identified "${masteryGap}" as your #1 gap — your custom plan below targets it directly to get you to an A.`
      : `Your predicted grade is a ${currentGrade}. Complete the tasks below and watch your grade climb.`;
  }

  // Format source to short task name
  const formatSource = (source) => {
    if (!source || source === 'polly_engine') return 'Update';
    if (source.includes('practice_exam')) return 'Quiz';
    if (source.includes('flashcard')) return 'Cards';
    if (source.includes('teach_it')) return 'Feynman';
    if (source.includes('notes')) return 'Notes';
    return 'Update';
  };

  // Build chart data with roadmap milestones
  const gradeHistory = studyPlan?.grade_history || [];
  const roadmap = latestExam?.ai_feedback?.study_roadmap || null;
  const baseData = [];
  
  if (gradeHistory.length > 0) {
    gradeHistory.forEach((entry, idx) => {
      baseData.push({
        name: idx === 0 ? 'Diagnostic' : formatSource(entry.source),
        actualScore: entry.score || 0,
        grade: entry.predicted_grade || 'F'
      });
    });
  } else {
    baseData.push({
      name: 'Diagnostic',
      actualScore: studyPlan?.initial_score || 0,
      grade: studyPlan?.initial_predicted_grade || 'F'
    });
    if (studyPlan?.current_score && studyPlan.current_score !== studyPlan.initial_score) {
      baseData.push({
        name: 'Current',
        actualScore: studyPlan.current_score,
        grade: studyPlan.current_predicted_grade
      });
    }
  }

  const lastPoint = baseData[baseData.length - 1];
  const lastScore = lastPoint.actualScore || 0;
  const targetScore = 95;
  const gap = targetScore - lastScore;

  // Build milestone points from roadmap or fall back to generic
  const milestones = [];
  if (roadmap) {
    const totalTasks = (roadmap.flashcard_sets || 0) + (roadmap.feynman_cards || 0) + 
                       (roadmap.practice_quizzes || 0) + (roadmap.review_sessions || 0);
    // Create ordered milestones from task types (only include types with count > 0)
    const taskTypes = [
      { key: 'review_sessions', label: 'Reviews', count: roadmap.review_sessions || 0, icon: '📖' },
      { key: 'flashcard_sets', label: 'Flashcards', count: roadmap.flashcard_sets || 0, icon: '🃏' },
      { key: 'feynman_cards', label: 'Feynman', count: roadmap.feynman_cards || 0, icon: '🧠' },
      { key: 'practice_quizzes', label: 'Quizzes', count: roadmap.practice_quizzes || 0, icon: '✍️' },
    ].filter(t => t.count > 0);

    let cumulativeTasks = 0;
    taskTypes.forEach((task) => {
      cumulativeTasks += task.count;
      const progress = cumulativeTasks / totalTasks;
      const projectedScore = Math.round(lastScore + gap * progress * 0.85); // 85% of gap covered by tasks
      milestones.push({
        name: `${task.count} ${task.label}`,
        projectedScore,
        taskCount: task.count,
        taskType: task.key,
      });
    });
  } else {
    // Fallback: generic weekly milestones
    for (let i = 1; i <= 3; i++) {
      milestones.push({
        name: `Week ${i}`,
        projectedScore: Math.round(lastScore + (gap * i) / 4),
      });
    }
  }

  // Assemble chart data
  const chartData = [...baseData];
  // Bridge: last actual point also starts the future line
  chartData[chartData.length - 1].futureScore = lastPoint.actualScore;
  
  milestones.forEach(m => {
    chartData.push({
      name: m.name,
      futureScore: m.projectedScore,
      grade: gradeFromScore(m.projectedScore),
      isFuture: true,
      taskCount: m.taskCount,
      taskType: m.taskType,
    });
  });
  
  chartData.push({
    name: 'A+ 🎯',
    futureScore: targetScore,
    grade: 'A+',
    isFuture: true
  });

  const estimatedHours = roadmap?.estimated_hours || behavioralInsights?.estimated_hours_to_target;
  const milestoneMessage = roadmap?.milestone_message;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay: 0.1 }}
      className="px-3 md:px-4 w-full"
    >
      <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-gradient-to-br from-indigo-950/60 via-purple-950/40 to-slate-950/60 border-indigo-500/20' : 'bg-gradient-to-br from-indigo-50 via-purple-50 to-white border-indigo-200/60'}`}>
        {/* Main message */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-purple-500/30 to-indigo-500/30' : 'bg-gradient-to-br from-purple-100 to-indigo-100'}`}>
              <Sparkles className={`w-4 h-4 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm md:text-base font-bold leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {headline}
              </p>
              <p className={`text-xs md:text-sm leading-relaxed mt-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {subtext}
              </p>
            </div>
          </div>
        </div>

        {/* Grade Progress Chart */}
        <div className={`px-4 py-4 border-t ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200/60 bg-slate-50/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Grade Trajectory</h4>
            {estimatedHours && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                <Clock className="w-3 h-3" />
                ~{Math.round(estimatedHours)}h to A+
              </div>
            )}
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: isDark ? '#94a3b8' : '#64748b' }} 
                  dy={10}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={40}
                />
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }}
                  ticks={[0, 50, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#1e293b' : '#fff',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value, name, props) => {
                    const grade = props.payload.grade || gradeFromScore(value);
                    if (name === 'futureScore') return [`${value}% (${grade})`, 'Projected'];
                    return [`${value}% (${grade})`, 'Score'];
                  }}
                  labelStyle={{ color: isDark ? '#cbd5e1' : '#475569', fontWeight: 'bold', marginBottom: '4px' }}
                />
                <ReferenceLine y={90} stroke={isDark ? '#22c55e50' : '#22c55e50'} strokeDasharray="3 3" />
                <Line 
                  type="monotone" 
                  dataKey="actualScore" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: isDark ? '#0f172a' : '#fff' }}
                  activeDot={{ r: 6, fill: '#8b5cf6', strokeWidth: 0 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="futureScore" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: isDark ? '#0f172a' : '#fff' }}
                  activeDot={{ r: 6, fill: '#10b981', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between items-center mt-3 px-2">
            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Diagnostic: {studyPlan?.initial_predicted_grade || '—'}
            </span>
            <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
              Current: {currentGrade}
            </span>
            <span className={`text-[10px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Target: A+
            </span>
          </div>
          {milestoneMessage && (
            <p className={`text-center text-[11px] mt-2 px-3 font-medium ${isDark ? 'text-emerald-400/80' : 'text-emerald-600'}`}>
              ✨ {milestoneMessage}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}