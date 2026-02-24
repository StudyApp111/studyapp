import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, Play, Sparkles, BookOpen, Filter, X, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import TopicSelectionModal from "@/components/study-plan/TopicSelectionModal";

export default function TopicConfirmationBanner({ lesson, onGoToDiagnostic, diagnosticReady, diagnosticCompleted }) {
  const { isDark } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [liveReady, setLiveReady] = useState(diagnosticReady);
  const [showTopicSelection, setShowTopicSelection] = useState(false);
  const [selectedCount, setSelectedCount] = useState(null);

  const topics = lesson?.topics || [];
  const dismissKey = `topic_banner_dismissed_${lesson?.id}`;
  const topLevelTopics = topics.filter(t => t.title);

  useEffect(() => {
    if (lesson?.id && localStorage.getItem(dismissKey)) setDismissed(true);
  }, [lesson?.id]);

  useEffect(() => {
    if (diagnosticReady) setLiveReady(true);
  }, [diagnosticReady]);

  useEffect(() => {
    if (liveReady || !lesson?.id) return;
    const unsubscribe = base44.entities.Exam.subscribe((event) => {
      if (event.data?.lesson_id === lesson.id && event.data?.exam_number === 1 && event.data?.exam_type !== 'practice' && event.data?.questions?.length > 0) {
        setLiveReady(true);
      }
    });
    return () => unsubscribe();
  }, [lesson?.id, liveReady]);

  useEffect(() => {
    if (lesson?.selected_topics?.length > 0) {
      setSelectedCount(lesson.selected_topics.length);
    }
  }, [lesson?.selected_topics]);

  if (topLevelTopics.length === 0 || dismissed || diagnosticCompleted) return null;

  const showModal = !dismissed && topLevelTopics.length > 0;

  const handleDismiss = () => {
    localStorage.setItem(dismissKey, 'true');
    setDismissed(true);
  };

  const handleGoToDiagnostic = () => {
    handleDismiss();
    onGoToDiagnostic();
  };

  return (
    <>
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
        <DialogContent className={`max-w-[calc(100vw-24px)] sm:max-w-md p-0 overflow-hidden border-0 bg-transparent [&>button]:hidden`}>
          <DialogTitle className="sr-only">Your Material Analysis</DialogTitle>
          <DialogDescription className="sr-only">AI has analyzed and organized your study material into topics</DialogDescription>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative overflow-hidden rounded-2xl border shadow-2xl ${isDark ? 'bg-[#12121a] border-purple-500/30' : 'bg-white border-slate-200'}`}
          >
            {/* Close button */}
            <button 
              onClick={handleDismiss}
              className={`absolute top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700'}`}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Hero section */}
            <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 px-6 pt-7 pb-5 text-center relative overflow-hidden">
              {/* Decorative glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring" }}
                className="relative mb-3"
              >
                <div className="w-16 h-16 mx-auto rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  <Brain className="w-8 h-8 text-white" />
                </div>
              </motion.div>

              <motion.h2 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-black text-white mb-1.5"
              >
                Material Analysis Complete
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-emerald-100/80 text-sm leading-relaxed max-w-[280px] mx-auto"
              >
                Our AI analyzed your <span className="font-bold text-white">{lesson?.course_name || 'material'}</span> and identified <span className="font-bold text-white">{topLevelTopics.length} key section{topLevelTopics.length !== 1 ? 's' : ''}</span>
              </motion.p>
            </div>

            {/* Topics list */}
            <div className={`px-5 py-4 ${isDark ? '' : ''}`}>
              <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto">
                {topLevelTopics.map((topic, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.35 + idx * 0.04 }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}
                  >
                    <CheckCircle2 className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    <span className="truncate max-w-[200px]">{topic.title}</span>
                  </motion.div>
                ))}
              </div>

              {/* Filter option */}
              <button
                onClick={() => setShowTopicSelection(true)}
                className={`flex items-center gap-1.5 mt-3 text-xs font-semibold transition-colors ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}
              >
                <Filter className="w-3.5 h-3.5" />
                {selectedCount ? `${selectedCount} topics selected — tap to change` : 'Select specific topics to focus on'}
              </button>
            </div>

            {/* CTA */}
            <div className={`px-5 pb-5 pt-1`}>
              <Button
                onClick={handleGoToDiagnostic}
                disabled={!liveReady}
                className={`w-full font-bold text-sm h-12 rounded-xl shadow-lg ${liveReady ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/20' : 'bg-slate-400 text-white/70 cursor-not-allowed'}`}
              >
                {liveReady ? (
                  <><Play className="w-4 h-4 mr-2" /> Take Diagnostic Quiz</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2 animate-pulse" /> Preparing Quiz...</>
                )}
              </Button>
              <button
                onClick={handleDismiss}
                className={`w-full text-center text-[11px] mt-2.5 py-1 font-medium ${isDark ? 'text-slate-500 hover:text-slate-400' : 'text-slate-400 hover:text-slate-500'}`}
              >
                I'll take the quiz later
              </button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      <TopicSelectionModal
        open={showTopicSelection}
        onOpenChange={setShowTopicSelection}
        lesson={lesson}
        onConfirm={(selected) => {
          setSelectedCount(selected.length);
          window.dispatchEvent(new Event('reloadLesson'));
        }}
      />
    </>
  );
}