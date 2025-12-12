import React from "react";
import { Card } from "@/components/ui/card";
import { Map, Calendar, Target, TrendingUp, BookOpen, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function CourseMapper() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-12 md:py-20">
        {/* Coming Soon Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold border border-purple-300">
            <Sparkles className="w-4 h-4" />
            Coming Soon
          </span>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-12"
        >
          <div className="flex justify-center mb-6">
            <div className="p-6 bg-white rounded-2xl shadow-2xl">
              <Map className="w-16 h-16 text-purple-600" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Course Mapper
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 font-medium">
            Your entire semester, mapped for you.
          </p>
        </motion.div>

        {/* Description Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm shadow-2xl border-0 p-8 md:p-10 mb-8">
            <div className="space-y-6 text-slate-700 text-base md:text-lg leading-relaxed">
              <p>
                The Course Mapper takes your course outline and instantly turns it into a <strong className="text-purple-700">personalized study plan</strong> that updates as you learn. Upload your syllabus, tell us a bit about how you study, and the app builds a full roadmap for the semester — topics, timelines, worksheets, suggested readings, and daily study targets.
              </p>
              
              <p>
                It shows you <strong className="text-purple-700">where you stand in real time</strong>. As you complete diagnostics, worksheets, and lessons, the Course Mapper updates your predicted grade and highlights what you need to focus on next. You'll see which units you've mastered, which ones need more time, and how your effort today affects your final exam score.
              </p>
              
              <p>
                Instead of guessing what to do or when to do it, you get a <strong className="text-purple-700">clear path</strong> built around your course, your strengths, and your learning style. It's like having a personal study coach for every class you take.
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid md:grid-cols-2 gap-6"
        >
          <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Semester Roadmap</h3>
                <p className="text-slate-600 text-sm">
                  Complete timeline with topics, deadlines, and study targets
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Focus Areas</h3>
                <p className="text-slate-600 text-sm">
                  See exactly which units need more attention
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Live Grade Prediction</h3>
                <p className="text-slate-600 text-sm">
                  Track your predicted final grade as you progress
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Personalized Plan</h3>
                <p className="text-slate-600 text-sm">
                  Adapts to your learning style and course requirements
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-12"
        >
          <p className="text-slate-500 text-sm">
            We're working hard to bring you this feature. Stay tuned!
          </p>
        </motion.div>
      </div>
    </div>
  );
}