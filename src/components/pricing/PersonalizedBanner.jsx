import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import GradeTrajectoryChart from "./GradeTrajectoryChart";

export default function PersonalizedBanner() {
  const { data: lessons } = useQuery({
    queryKey: ["pricing-lessons"],
    queryFn: () => base44.entities.Lesson.list("-created_date", 1),
    initialData: [],
  });

  const latestLesson = lessons[0];

  const { data: exams } = useQuery({
    queryKey: ["pricing-exams", latestLesson?.id],
    queryFn: () =>
      base44.entities.Exam.filter(
        { lesson_id: latestLesson.id, status: "completed" },
        "-created_date",
        1
      ),
    enabled: !!latestLesson?.id,
    initialData: [],
  });

  const { data: studyPlans } = useQuery({
    queryKey: ["pricing-plans", latestLesson?.id],
    queryFn: () =>
      base44.entities.StudyPlan.filter(
        { lesson_id: latestLesson.id, status: "active" },
        "-created_date",
        1
      ),
    enabled: !!latestLesson?.id,
    initialData: [],
  });

  const latestExam = exams[0];
  const activePlan = studyPlans[0];

  if (!latestLesson || !latestExam) return null;

  const grade = latestExam.predicted_grade || latestExam.ai_feedback?.predicted_exam_score_percentage;
  const score = latestExam.total_score;
  const courseName = latestLesson.course_name;

  if (!courseName || (!grade && score == null)) return null;

  const gradeDisplay = grade || `${Math.round(score)}%`;
  const scoreDisplay = score != null ? `${Math.round(score)}%` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto mb-6"
    >
      <div className="bg-white/5 backdrop-blur-sm border border-purple-500/30 rounded-2xl px-5 py-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
            Your Progress
          </span>
        </div>
        <p className="text-white text-lg font-bold leading-snug">
          Your <span className="text-purple-300">{courseName}</span> grade is projected at{" "}
          <span className="text-amber-400">
            {grade && scoreDisplay ? `${grade} (${scoreDisplay})` : gradeDisplay}
          </span>
        </p>
        {activePlan?.tasks?.length > 0 && (
          <p className="text-purple-200/80 text-sm mt-1.5">
            Your study plan has <span className="text-white font-semibold">{activePlan.tasks.length} tasks</span> designed to get you to an A. You've completed{" "}
            <span className="text-emerald-400 font-semibold">{activePlan.tasks.filter(t => t.completed).length}</span>.
          </p>
        )}
        {/* Grade Trajectory Chart */}
        <div className="mt-4">
          <GradeTrajectoryChart
            currentGrade={grade}
            currentScore={score}
            gradeHistory={activePlan?.grade_history}
          />
        </div>

        <p className="text-purple-300/70 text-xs mt-2">
          Upgrade to unlock your personalized study plan and improve it.
        </p>
      </div>
    </motion.div>
  );
}