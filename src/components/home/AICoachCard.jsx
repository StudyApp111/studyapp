import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Brain, Target, Zap, Clock, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AICoachCard({ lessons, studyPlans, user }) {
  const [recommendation, setRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    generateRecommendation();
  }, [lessons, studyPlans]);

  const generateRecommendation = async () => {
    if (!lessons || lessons.length === 0) {
      setRecommendation({
        type: 'start',
        title: "Upload your first lesson",
        description: "Get started by uploading lecture notes or a textbook chapter",
        action: null,
        icon: Sparkles
      });
      setIsLoading(false);
      return;
    }

    // Find the most actionable next step
    let bestAction = null;
    let priority = 0;

    for (const lesson of lessons.slice(0, 5)) {
      const plan = studyPlans.find(sp => sp.lesson_id === lesson.id && sp.status === 'active');
      
      if (!plan) {
        // No study plan - needs diagnostic
        if (priority < 3) {
          bestAction = {
            type: 'diagnostic',
            title: `Start ${lesson.course_name} diagnostic`,
            description: "Take a quick exam to get your grade prediction",
            lessonId: lesson.id,
            lessonName: lesson.course_name,
            icon: Target
          };
          priority = 3;
        }
      } else {
        const incompleteTasks = plan.tasks?.filter(t => !t.completed) || [];
        const currentGrade = plan.current_predicted_grade || plan.initial_predicted_grade;
        
        if (incompleteTasks.length > 0) {
          const nextTask = incompleteTasks[0];
          const taskPriority = nextTask.is_focus_factor ? 5 : 4;
          
          if (taskPriority > priority) {
            bestAction = {
              type: 'task',
              title: nextTask.title || `${nextTask.task_type} task`,
              description: `${incompleteTasks.length} task${incompleteTasks.length > 1 ? 's' : ''} left • Currently ${currentGrade || 'N/A'}`,
              lessonId: lesson.id,
              lessonName: lesson.course_name,
              taskType: nextTask.task_type,
              icon: nextTask.task_type === 'flashcards' ? Brain : 
                    nextTask.task_type === 'practice_exam' ? Zap : Target
            };
            priority = taskPriority;
          }
        }
      }
    }

    if (!bestAction) {
      // All caught up - suggest review
      const mostRecentLesson = lessons[0];
      bestAction = {
        type: 'review',
        title: "You're all caught up!",
        description: "Great job! Consider reviewing past lessons",
        lessonId: mostRecentLesson?.id,
        lessonName: mostRecentLesson?.course_name,
        icon: TrendingUp
      };
    }

    setRecommendation(bestAction);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-4 animate-pulse">
        <div className="h-20" />
      </div>
    );
  }

  if (!recommendation) return null;

  const Icon = recommendation.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {recommendation.lessonId ? (
        <Link to={`${createPageUrl("DocumentViewer")}?id=${recommendation.lessonId}`}>
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-2xl p-4 shadow-xl cursor-pointer group hover:shadow-2xl transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-yellow-400/10 rounded-full blur-2xl -ml-12 -mb-12" />
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                </div>
                <span className="text-white/80 text-xs font-medium">AI Coach</span>
              </div>
              
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-base mb-1 truncate">{recommendation.title}</h3>
                  <p className="text-white/70 text-xs">{recommendation.description}</p>
                  {recommendation.lessonName && (
                    <p className="text-white/50 text-[10px] mt-1 truncate">{recommendation.lessonName}</p>
                  )}
                </div>
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-white/30 transition-colors">
                  <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Icon className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-slate-500 text-xs font-medium">AI Coach</span>
          </div>
          <h3 className="text-slate-900 font-bold text-base mb-1">{recommendation.title}</h3>
          <p className="text-slate-500 text-xs">{recommendation.description}</p>
        </div>
      )}
    </motion.div>
  );
}