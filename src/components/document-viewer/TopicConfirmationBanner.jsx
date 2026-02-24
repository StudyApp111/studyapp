import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, ChevronDown, ChevronRight, FolderOpen, Search, Play, CheckCircle2, Target, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function TopicConfirmationBanner({ lesson, onGoToDiagnostic, diagnosticReady, diagnosticCompleted }) {
  const { isDark } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(1); // 1 = topics, 2 = diagnostic prompt
  const [liveReady, setLiveReady] = useState(diagnosticReady);

  // Topic selection state
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [searchQuery, setSearchQuery] = useState("");

  const topics = lesson?.topics || [];
  const dismissKey = `topic_flow_dismissed_${lesson?.id}`;
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

  // Initialize topic selection
  useEffect(() => {
    if (!lesson?.id || topLevelTopics.length === 0) return;
    const saved = lesson?.selected_topics;
    if (saved?.length > 0) {
      setSelectedTopics(saved);
    } else {
      const all = [];
      topics.forEach(t => {
        all.push(t.title);
        t.subtopics?.forEach(st => all.push(st.title));
      });
      setSelectedTopics(all);
    }
    const map = {};
    topics.forEach(t => { map[t.title] = true; });
    setExpandedGroups(map);
  }, [lesson?.id, topLevelTopics.length]);

  if (topLevelTopics.length === 0 || dismissed || diagnosticCompleted) return null;

  const getAllTitles = () => {
    const titles = [];
    topics.forEach(t => {
      titles.push(t.title);
      t.subtopics?.forEach(st => titles.push(st.title));
    });
    return titles;
  };
  const allTitles = getAllTitles();
  const totalCount = allTitles.length;
  const selectedCount = selectedTopics.length;

  const toggleTopic = (title) => {
    setSelectedTopics(prev => prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]);
  };

  const toggleGroup = (parentTitle, subtopics) => {
    const groupTitles = [parentTitle, ...(subtopics || []).map(st => st.title)];
    const allSelected = groupTitles.every(t => selectedTopics.includes(t));
    if (allSelected) {
      setSelectedTopics(prev => prev.filter(t => !groupTitles.includes(t)));
    } else {
      setSelectedTopics(prev => [...new Set([...prev, ...groupTitles])]);
    }
  };

  const handleSelectAll = () => setSelectedTopics([...allTitles]);
  const handleDeselectAll = () => setSelectedTopics([]);

  const handleConfirmTopics = async () => {
    await base44.entities.Lesson.update(lesson.id, { selected_topics: selectedTopics });
    window.dispatchEvent(new Event('reloadLesson'));
    setStep(2);
  };

  const handleStartDiagnostic = () => {
    localStorage.setItem(dismissKey, 'true');
    setDismissed(true);
    onGoToDiagnostic();
  };

  const handleSkipDiagnostic = () => {
    localStorage.setItem(dismissKey, 'true');
    localStorage.setItem(`diagnostic_skipped_${lesson?.id}`, 'true');
    setDismissed(true);
    window.dispatchEvent(new CustomEvent('diagnosticSkipped', { detail: { lessonId: lesson.id } }));
  };

  const filteredTopics = topics.filter(t => {
    const q = searchQuery.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.subtopics?.some(st => st.title.toLowerCase().includes(q));
  });

  return (
    <Dialog open={!dismissed} onOpenChange={() => {}}>
      <DialogContent 
        className={`sm:max-w-[500px] max-h-[85vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col max-w-[calc(100vw-24px)] border-0 ${isDark ? 'bg-[#12121a]' : 'bg-white'} [&>button]:hidden`}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{step === 1 ? 'Select Topics' : 'Start Diagnostic'}</DialogTitle>
        <DialogDescription className="sr-only">{step === 1 ? 'Choose topics to study' : 'Take diagnostic quiz'}</DialogDescription>

        {step === 1 ? (
          <>
            {/* Step 1: Topic Selection */}
            <div className={`px-5 pt-5 pb-3 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Select Topics</h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {selectedCount} of {totalCount} selected
              </p>

              <div className="flex items-center gap-2 mt-3">
                <div className="flex-1 relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search topics..."
                    className={`pl-9 h-9 text-sm rounded-lg ${isDark ? 'bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500' : ''}`}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectedCount === totalCount ? handleDeselectAll : handleSelectAll}
                  className={`text-xs h-9 px-3 whitespace-nowrap ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/10' : ''}`}
                >
                  {selectedCount === totalCount ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </div>

            {/* Topic List */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5 max-h-[50vh]">
              {filteredTopics.map((topic) => {
                const hasSubtopics = topic.subtopics?.length > 0;
                const isExpanded = expandedGroups[topic.title];
                const isParentSelected = selectedTopics.includes(topic.title);
                const groupTitles = [topic.title, ...(topic.subtopics || []).map(st => st.title)];
                const allGroupSelected = groupTitles.every(t => selectedTopics.includes(t));

                return (
                  <div key={topic.title}>
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                      isParentSelected
                        ? isDark ? 'bg-purple-600/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'
                        : isDark ? 'bg-white/5 border border-white/5 hover:bg-white/10' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'
                    }`}>
                      {hasSubtopics && (
                        <button onClick={() => setExpandedGroups(prev => ({ ...prev, [topic.title]: !prev[topic.title] }))} className="p-0.5 flex-shrink-0">
                          {isExpanded
                            ? <ChevronDown className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                            : <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                          }
                        </button>
                      )}
                      {hasSubtopics && <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />}
                      <span
                        onClick={() => hasSubtopics ? toggleGroup(topic.title, topic.subtopics) : toggleTopic(topic.title)}
                        className={`flex-1 text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
                      >
                        {topic.title}
                      </span>
                      <button
                        onClick={() => hasSubtopics ? toggleGroup(topic.title, topic.subtopics) : toggleTopic(topic.title)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                          (hasSubtopics ? allGroupSelected : isParentSelected)
                            ? 'bg-purple-600 text-white'
                            : isDark ? 'border border-white/20 bg-white/5' : 'border border-slate-300 bg-white'
                        }`}
                      >
                        {(hasSubtopics ? allGroupSelected : isParentSelected) && <Check className="w-4 h-4" />}
                      </button>
                    </div>

                    {hasSubtopics && isExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {topic.subtopics
                          .filter(st => !searchQuery || st.title.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((st) => {
                            const isSubSelected = selectedTopics.includes(st.title);
                            return (
                              <div
                                key={st.title}
                                onClick={() => toggleTopic(st.title)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                                  isSubSelected
                                    ? isDark ? 'bg-purple-600/15 border border-purple-500/20' : 'bg-purple-50/80 border border-purple-200/60'
                                    : isDark ? 'bg-white/[0.03] border border-transparent hover:bg-white/5' : 'bg-white/50 border border-transparent hover:bg-slate-50'
                                }`}
                              >
                                <span className={`flex-1 text-sm truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{st.title}</span>
                                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all ${
                                  isSubSelected ? 'bg-purple-600 text-white' : isDark ? 'border border-white/20 bg-white/5' : 'border border-slate-300 bg-white'
                                }`}>
                                  {isSubSelected && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Confirm Topics CTA */}
            <div className={`px-5 py-4 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <Button
                onClick={handleConfirmTopics}
                disabled={selectedCount === 0}
                className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-4 h-4 mr-2" />
                Confirm Topics
                {selectedCount > 0 && selectedCount < totalCount && (
                  <span className="ml-2 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{selectedCount}/{totalCount}</span>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2: Diagnostic Prompt */}
            <div className="px-6 pt-8 pb-6 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="mb-5"
              >
                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
                  <Target className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                </div>
              </motion.div>

              <motion.h2 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className={`text-xl font-black mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}
              >
                One More Step Before You Start Studying
              </motion.h2>

              <motion.p 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`text-sm mb-5 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
              >
                Take a quick 5-question diagnostic so we can:
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="space-y-2.5 mb-6 max-w-[280px] mx-auto text-left"
              >
                {[
                  'Predict your exam grade',
                  'Find your weak spots',
                  'Build your personalized study plan'
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{text}</span>
                  </div>
                ))}
              </motion.div>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={`text-xs mb-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                This takes 3 minutes and makes everything else work better.
              </motion.p>

              <Button
                onClick={handleStartDiagnostic}
                disabled={!liveReady}
                className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20"
              >
                {liveReady ? (
                  <>Start 5-Question Diagnostic <Play className="w-4 h-4 ml-2" /></>
                ) : (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing Quiz...</>
                )}
              </Button>

              <button
                onClick={handleSkipDiagnostic}
                className={`w-full text-center text-[11px] mt-3 py-1 font-medium ${isDark ? 'text-slate-600 hover:text-slate-500' : 'text-slate-400 hover:text-slate-500'}`}
              >
                Skip for now (you'll miss out on predictions)
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}