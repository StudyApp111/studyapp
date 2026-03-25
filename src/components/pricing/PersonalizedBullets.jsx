import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Infinity, Target, Brain, MessageSquare, Sparkles, Zap, BookOpen } from "lucide-react";

const GRADE_VALUES = {
  "A+": 97, A: 93, "A-": 90, "B+": 87, B: 83, "B-": 80,
  "C+": 77, C: 73, "C-": 70, "D+": 67, D: 63, "D-": 60, F: 50,
};

export default function PersonalizedBullets() {
  const { data: lessons } = useQuery({
    queryKey: ["pricing-bullets-lessons"],
    queryFn: () => base44.entities.Lesson.list("-created_date", 5),
    initialData: [],
  });

  const latestLesson = lessons[0];

  const { data: exams } = useQuery({
    queryKey: ["pricing-bullets-exams", latestLesson?.id],
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
    queryKey: ["pricing-bullets-plans", latestLesson?.id],
    queryFn: () =>
      base44.entities.StudyPlan.filter(
        { lesson_id: latestLesson.id, status: "active" },
        "-created_date",
        1
      ),
    enabled: !!latestLesson?.id,
    initialData: [],
  });

  const { data: flashcards } = useQuery({
    queryKey: ["pricing-bullets-flashcards", latestLesson?.id],
    queryFn: () =>
      base44.entities.Flashcard.filter({ lesson_id: latestLesson.id }),
    enabled: !!latestLesson?.id,
    initialData: [],
  });

  const latestExam = exams[0];
  const plan = studyPlans[0];
  const courseName = latestLesson?.course_name;
  const grade = latestExam?.predicted_grade;
  const score = latestExam?.total_score;
  const masteryGap = plan?.mastery_gap;
  const taskCount = plan?.tasks?.length || 0;
  const completedCount = plan?.tasks?.filter(t => t.completed)?.length || 0;
  const courseCount = lessons.length;

  // Determine if we have enough data for personalization
  const hasData = !!latestLesson && !!latestExam;

  if (!hasData) {
    // Fallback: generic bullets
    return <GenericBullets />;
  }

  // Build personalized bullets
  const bullets = [];

  // 1. Unlimited access — personalized with course count
  bullets.push({
    icon: Infinity,
    gradient: "bg-purple-500",
    text: courseCount > 1
      ? `Unlimited access to all ${courseCount} of your courses & more`
      : `Unlimited access for ${courseName} & all future courses`,
  });

  // 2. Grade prediction — personalized
  if (grade) {
    const gradeVal = GRADE_VALUES[grade] || 70;
    if (gradeVal < 80) {
      bullets.push({
        icon: Target,
        gradient: "bg-purple-500",
        text: `Your ${courseName} grade is ${grade} — Pro shows you how to reach an A`,
      });
    } else {
      bullets.push({
        icon: Target,
        gradient: "bg-purple-500",
        text: `You're at ${grade} in ${courseName} — push it to A+ with Pro`,
      });
    }
  } else {
    bullets.push({
      icon: Target,
      gradient: "bg-purple-500",
      text: "Know your predicted exam grade before you walk in",
    });
  }

  // 3. Weak spots — personalized with mastery gap
  if (masteryGap) {
    bullets.push({
      icon: Brain,
      gradient: "bg-purple-500",
      text: `Target your weak spot in "${masteryGap}" with focused drills`,
    });
  } else {
    bullets.push({
      icon: Brain,
      gradient: "bg-purple-500",
      text: "AI pinpoints exactly what you're struggling with",
    });
  }

  // 4. AI Tutor
  bullets.push({
    icon: MessageSquare,
    gradient: "bg-gradient-to-r from-amber-400 to-orange-500",
    text: "24/7 AI tutor — ask unlimited questions, get instant answers",
  });

  // 5. Study plan — personalized with task count
  if (taskCount > 0) {
    const remaining = taskCount - completedCount;
    bullets.push({
      icon: Sparkles,
      gradient: "bg-gradient-to-r from-emerald-400 to-teal-500",
      text: remaining > 0
        ? `${remaining} study tasks waiting for you — your roadmap to an A+`
        : `Your study plan is ready — keep improving with new tasks`,
    });
  } else {
    bullets.push({
      icon: Sparkles,
      gradient: "bg-gradient-to-r from-emerald-400 to-teal-500",
      text: "Get a personalized daily study roadmap to an A+",
    });
  }

  // 6. Flashcards — personalized with count
  if (flashcards.length > 0) {
    const unmasteredCount = flashcards.filter(f => !f.mastered).length;
    if (unmasteredCount > 0) {
      bullets.push({
        icon: BookOpen,
        gradient: "bg-gradient-to-r from-purple-400 to-pink-500",
        text: `📚 ${unmasteredCount} flashcards waiting for you in ${courseName}`,
      });
    } else {
      bullets.push({
        icon: BookOpen,
        gradient: "bg-gradient-to-r from-purple-400 to-pink-500",
        text: `You've mastered all ${flashcards.length} flashcards in ${courseName} — generate more with Pro`,
      });
    }
  } else {
    bullets.push({
      icon: Zap,
      gradient: "bg-gradient-to-r from-purple-400 to-pink-500",
      text: "Watch your predicted grade climb as you study",
    });
  }

  return (
    <ul className="space-y-3 mb-6 flex-1">
      {bullets.map((b, i) => (
        <li key={i} className="flex items-center gap-3 text-white">
          <div className={`w-5 h-5 rounded-full ${b.gradient} flex items-center justify-center flex-shrink-0`}>
            <b.icon className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium">{b.text}</span>
        </li>
      ))}
    </ul>
  );
}

function GenericBullets() {
  const items = [
    { icon: Infinity, gradient: "bg-purple-500", text: "Unlimited everything — all courses, all features" },
    { icon: Target, gradient: "bg-purple-500", text: "Know if you'll pass — Advanced grade predictions" },
    { icon: Brain, gradient: "bg-purple-500", text: "Study only weak spots — AI identifies what you need" },
    { icon: MessageSquare, gradient: "bg-gradient-to-r from-amber-400 to-orange-500", text: "24/7 AI tutor — Unlimited questions, instant answers" },
    { icon: Sparkles, gradient: "bg-gradient-to-r from-emerald-400 to-teal-500", text: "Custom study plans — Daily roadmap to an A+" },
    { icon: Zap, gradient: "bg-gradient-to-r from-purple-400 to-pink-500", text: "Progress tracking — Watch your grade prediction improve" },
  ];

  return (
    <ul className="space-y-3 mb-6 flex-1">
      {items.map((b, i) => (
        <li key={i} className="flex items-center gap-3 text-white">
          <div className={`w-5 h-5 rounded-full ${b.gradient} flex items-center justify-center flex-shrink-0`}>
            <b.icon className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium">{b.text}</span>
        </li>
      ))}
    </ul>
  );
}