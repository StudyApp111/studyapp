import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Brain, Target, Zap, TrendingUp, Lightbulb, MessageCircle, X, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

// Fun facts about learning & memory
const POLLY_MESSAGES = [
  { type: 'fact', icon: '🧠', message: "Did you know? Spaced repetition can boost retention by 200%! That's why I recommend flashcards.", color: 'from-purple-500 to-indigo-600' },
  { type: 'fact', icon: '💡', message: "Fun fact: Teaching others helps you retain 90% of what you learn. Try the Teach It feature!", color: 'from-amber-500 to-orange-600' },
  { type: 'fact', icon: '🎯', message: "Studies show that testing yourself is more effective than re-reading notes. Let's quiz!", color: 'from-emerald-500 to-teal-600' },
  { type: 'fact', icon: '⚡', message: "Your brain forms stronger connections when you study in short bursts. 25 min sessions work best!", color: 'from-blue-500 to-cyan-600' },
  { type: 'joke', icon: '😄', message: "Why did the student eat their homework? Because their teacher said it was a piece of cake! 🍰", color: 'from-pink-500 to-rose-600' },
  { type: 'motivation', icon: '🚀', message: "Every expert was once a beginner. You're making progress every day!", color: 'from-violet-500 to-purple-600' },
];

export default function PollyCard({ lessons, studyPlans, user }) {
  const navigate = useNavigate();
  const [recommendation, setRecommendation] = useState(null);
  const [pollyMessage, setPollyMessage] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    generateRecommendation();
    // Pick a random Polly message
    const randomMessage = POLLY_MESSAGES[Math.floor(Math.random() * POLLY_MESSAGES.length)];
    setPollyMessage(randomMessage);
  }, [lessons, studyPlans]);

  const generateRecommendation = async () => {
    if (!lessons || lessons.length === 0) {
      setRecommendation({
        type: 'start',
        title: "Let's get started!",
        description: "Upload your first lecture notes and I'll create a personalized study plan",
        action: null,
        urgency: 'low'
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
        if (priority < 3) {
          bestAction = {
            type: 'diagnostic',
            title: `Take your ${lesson.course_name} diagnostic`,
            description: "I'll predict your grade and create a study plan just for you",
            lessonId: lesson.id,
            lessonName: lesson.course_name,
            urgency: 'high'
          };
          priority = 3;
        }
      } else {
        const incompleteTasks = plan.tasks?.filter(t => !t.completed) || [];
        const currentGrade = plan.current_predicted_grade || plan.initial_predicted_grade;
        
        if (incompleteTasks.length > 0) {
          const nextTask = incompleteTasks[0];
          const isFocusFactor = nextTask.is_focus_factor;
          const taskPriority = isFocusFactor ? 5 : 4;
          
          if (taskPriority > priority) {
            const taskLabel = nextTask.task_type === 'flashcards' ? 'flashcard session' :
                             nextTask.task_type === 'teach_it' ? 'Teach It challenge' :
                             nextTask.task_type === 'practice_exam' ? 'practice quiz' : 'review session';
            
            bestAction = {
              type: 'task',
              title: isFocusFactor 
                ? `🎯 Focus area: ${nextTask.title || taskLabel}`
                : `Next up: ${nextTask.title || taskLabel}`,
              description: isFocusFactor
                ? `This will help close your biggest gap in ${lesson.course_name}`
                : `${incompleteTasks.length} task${incompleteTasks.length > 1 ? 's' : ''} remaining • Currently at ${currentGrade || 'N/A'}`,
              lessonId: lesson.id,
              lessonName: lesson.course_name,
              taskType: nextTask.task_type,
              urgency: isFocusFactor ? 'high' : 'medium',
              currentGrade
            };
            priority = taskPriority;
          }
        }
      }
    }

    if (!bestAction) {
      const mostRecentLesson = lessons[0];
      bestAction = {
        type: 'review',
        title: "You're crushing it! 🎉",
        description: "All tasks complete! How about a quick review to keep things fresh?",
        lessonId: mostRecentLesson?.id,
        lessonName: mostRecentLesson?.course_name,
        urgency: 'low'
      };
    }

    setRecommendation(bestAction);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-5 animate-pulse">
        <div className="h-24" />
      </div>
    );
  }

  if (!recommendation) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-2xl shadow-xl">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl -ml-16 -mb-16" />
        <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-pink-400/10 rounded-full blur-xl" />

        <div className="relative p-5">
          {/* Header with Polly branding */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <span className="text-2xl">🦜</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center border-2 border-purple-700">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Hey, I'm Polly!</h3>
              <p className="text-white/70 text-xs">Your AI study buddy</p>
            </div>
          </div>

          {/* Polly's fun message */}
          {pollyMessage && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-4 border border-white/10">
              <div className="flex items-start gap-2">
                <span className="text-lg">{pollyMessage.icon}</span>
                <p className="text-white/90 text-sm leading-relaxed">{pollyMessage.message}</p>
              </div>
            </div>
          )}

          {/* Action recommendation */}
          {recommendation.lessonId ? (
            <Link to={`${createPageUrl("DocumentViewer")}?id=${recommendation.lessonId}`}>
              <div className={`bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl p-4 transition-all cursor-pointer group border border-white/10 ${
                recommendation.urgency === 'high' ? 'ring-2 ring-yellow-400/50' : ''
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {recommendation.urgency === 'high' && (
                        <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold rounded-full">PRIORITY</span>
                      )}
                    </div>
                    <h4 className="text-white font-bold text-base mb-1">{recommendation.title}</h4>
                    <p className="text-white/70 text-sm">{recommendation.description}</p>
                    {recommendation.lessonName && (
                      <p className="text-white/50 text-xs mt-1">{recommendation.lessonName}</p>
                    )}
                  </div>
                  <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                    <ArrowRight className="w-5 h-5 text-purple-900" />
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <h4 className="text-white font-bold text-base mb-1">{recommendation.title}</h4>
              <p className="text-white/70 text-sm">{recommendation.description}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}