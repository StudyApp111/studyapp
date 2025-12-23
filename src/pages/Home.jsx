import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, Clock, Calculator, Beaker, Globe, BookText, Languages, Code, Palette, Music, Briefcase, FileCheck, ArrowRight, Sparkles, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import BadgeDisplay from "@/components/gamification/BadgeDisplay";
import CreateLessonModal from "@/components/modals/CreateLessonModal";
import { LessonActivityCard, AssignmentActivityCard } from "@/components/home/ActivityCard";

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [createLessonModalOpen, setCreateLessonModalOpen] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        if (!currentUser.onboarding_completed) {
          navigate(createPageUrl("Onboarding"));
        } else if (currentUser.learning_profile_id) {
          const profile = await base44.entities.LearningProfile.filter({
            id: currentUser.learning_profile_id
          });
          if (profile.length > 0) {
            setLearningProfile(profile[0]);
          }
        }
      } catch (error) {
        console.error("Error checking user:", error);
      }
    };
    
    checkOnboarding();
  }, [navigate]);

  const [learningProfile, setLearningProfile] = useState(null);

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: () => base44.entities.Lesson.list('-created_date', 100),
    initialData: [],
  });

  const { data: gradedAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['gradedAssignments'],
    queryFn: () => base44.entities.GradedAssignment.list('-created_date', 100),
    initialData: [],
  });

  const isLoading = lessonsLoading || assignmentsLoading;

  // Combine and sort lessons and graded assignments by date
  const recentItems = React.useMemo(() => {
    const combined = [
      ...lessons.map(l => ({ ...l, type: 'lesson', date: new Date(l.created_date) })),
      ...gradedAssignments.map(a => ({ ...a, type: 'assignment', date: new Date(a.created_date) }))
    ];
    return combined.sort((a, b) => b.date - a.date).slice(0, 6);
  }, [lessons, gradedAssignments]);

  const { data: allExams = [] } = useQuery({
    queryKey: ['exams'],
    queryFn: () => base44.entities.Exam.list('-created_date'),
    initialData: [],
  });

  // Group exams by lesson
  const lessonExams = {};
  allExams.forEach(e => {
    if (!lessonExams[e.lesson_id]) {
      lessonExams[e.lesson_id] = [];
    }
    lessonExams[e.lesson_id].push(e);
  });

  // Calculate stats
  const completedExams = allExams.filter(e => e.completed).length;
  const inProgressExams = allExams.filter(e => e.status === "in_progress").length;
  const totalExams = allExams.filter(e => e.completed).length;
  const avgScore = totalExams > 0
    ? Math.round(allExams.filter(e => e.completed).reduce((sum, e) => sum + (e.total_score || 0), 0) / totalExams)
    : 0;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h`;
    }
    return `${minutes}m`;
  };

  const getSubjectIcon = (courseName) => {
    const name = courseName.toLowerCase();
    
    // Math & Calculus
    if (name.includes('math') || name.includes('calculus') || name.includes('algebra') || name.includes('geometry') || name.includes('trigonometry') || name.includes('statistics')) {
      return Calculator;
    }
    // Science subjects
    if (name.includes('physics') || name.includes('chemistry') || name.includes('biology') || name.includes('science')) {
      return Beaker;
    }
    // Geography
    if (name.includes('geography') || name.includes('geo')) {
      return Globe;
    }
    // Humanities (History, Philosophy, etc)
    if (name.includes('history') || name.includes('humanities') || name.includes('philosophy') || name.includes('literature') || name.includes('english')) {
      return BookText;
    }
    // Languages
    if (name.includes('language') || name.includes('french') || name.includes('spanish') || name.includes('german') || name.includes('chinese')) {
      return Languages;
    }
    // Computer Science
    if (name.includes('computer') || name.includes('coding') || name.includes('programming') || name.includes('cs')) {
      return Code;
    }
    // Art
    if (name.includes('art') || name.includes('design')) {
      return Palette;
    }
    // Music
    if (name.includes('music')) {
      return Music;
    }
    // Business/Economics
    if (name.includes('business') || name.includes('economics') || name.includes('econ') || name.includes('finance') || name.includes('accounting')) {
      return Briefcase;
    }
    
    // Default
    return BookOpen;
  };



  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto">
      {/* Centered Hero Section with Gradient */}
      <div className="mb-6 md:mb-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-purple-700 to-yellow-500 p-6 md:p-8 shadow-2xl">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-400/20 rounded-full blur-2xl -ml-24 -mb-24" />
          
          <div className="relative text-center">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 whitespace-nowrap">
              Welcome {user.full_name?.split(' ')[0] || 'Learner'}!
            </h1>
            <p className="text-white/90 text-sm md:text-lg max-w-2xl mx-auto">
              {learningProfile?.grade && learningProfile?.school && learningProfile?.city ? (
                <>
                  {learningProfile.grade} student at {learningProfile.school} • {learningProfile.city}
                </>
              ) : (
                "Ready to continue your learning journey?"
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Beautiful CTA Section */}
      <div className="mb-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Upload Notes Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            onClick={() => setCreateLessonModalOpen(true)}
            className="cursor-pointer group"
          >
            <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 hover:scale-[1.02]">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-7 h-7 text-white" />
                  </div>
                  <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-5 h-5 text-slate-900" />
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Upload Notes</h3>
                <p className="text-white/80 text-sm md:text-base mb-4">
                  Drop your lecture notes, textbook chapters, or study materials
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-white/20 rounded-full text-xs text-white/90">AI Quiz</span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-xs text-white/90">Grade Prediction</span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-xs text-white/90">Flashcards</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Grade Assignment Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            onClick={() => navigate(createPageUrl("SmartGrader"))}
            className="cursor-pointer group"
          >
            <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 hover:scale-[1.02]">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileCheck className="w-7 h-7 text-white" />
                  </div>
                  <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-5 h-5 text-slate-900" />
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Grade Assignment</h3>
                <p className="text-white/80 text-sm md:text-base mb-4">
                  Upload your work and get instant AI feedback with detailed analysis
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-white/20 rounded-full text-xs text-white/90">Instant Grade</span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-xs text-white/90">Rubric Analysis</span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-xs text-white/90">Improvements</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Recent Activity - Below CTA */}
      {!isLoading && recentItems.length > 0 && (
        <div className="mb-8 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">Recent Activity</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {recentItems.map((item, idx) => (
              item.type === 'lesson' ? (
                <LessonActivityCard 
                  key={`lesson-${item.id}`} 
                  lesson={item} 
                  worksheets={lessonWorksheets[item.id] || []}
                  index={idx}
                />
              ) : (
                <AssignmentActivityCard 
                  key={`assignment-${item.id}`} 
                  assignment={item}
                  index={idx}
                />
              )
            ))}
          </div>
        </div>
      )}

{/* Create Lesson Modal */}
<CreateLessonModal 
  open={createLessonModalOpen} 
  onOpenChange={setCreateLessonModalOpen} 
/>
</div>
);
}