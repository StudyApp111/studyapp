import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Lock, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useSubscription } from "@/components/subscription/SubscriptionContext";
import { useTheme } from "@/components/theme/ThemeProvider";
import LearnTopicList from "./LearnTopicList";
import LecturePlayer from "./LecturePlayer";

export default function LearnTab({ lesson, extractedContent, onNavigateToExam }) {
  const { isPro, triggerUpgradeModal } = useSubscription();
  const { isDark } = useTheme();

  const [topics, setTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [selectedTopicIdx, setSelectedTopicIdx] = useState(null);
  const [lecture, setLecture] = useState(null);
  const [loadingLecture, setLoadingLecture] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Do NOT auto-load on mount — user clicks "Generate Topics" to avoid rate limits

  const [errorMsg, setErrorMsg] = useState(null);

  const loadTopics = async () => {
    if (!lesson?.id) return;
    setLoadingTopics(true);
    setErrorMsg(null);
    try {
      const { data } = await base44.functions.invoke('generateLearnTopics', { lesson_id: lesson.id });
      if (data?.topics) {
        setTopics(data.topics);
      }
    } catch (err) {
      console.error("Error loading topics:", err);
      const msg = err?.response?.data?.error;
      if (msg === 'Insufficient content') {
        setErrorMsg("This lesson doesn't have enough material to generate topics. Try uploading a document or adding more content first.");
      } else {
        setErrorMsg("Something went wrong generating topics. Please try again.");
      }
    } finally {
      setLoadingTopics(false);
      setHasLoaded(true);
    }
  };

  const handleSelectTopic = async (idx) => {
    setSelectedTopicIdx(idx);
    setLecture(null);
    setLoadingLecture(true);

    const topic = topics[idx];
    try {
      const { data } = await base44.functions.invoke('generateMiniLecture', {
        course_name: lesson?.course_name || '',
        topic_title: topic.title,
        topic_content: topic.key_content || topic.description || topic.title
      });
      if (data?.lecture) {
        setLecture(data.lecture);
      }
    } catch (err) {
      console.error("Error generating lecture:", err);
    } finally {
      setLoadingLecture(false);
    }
  };

  const handleQuizPrompt = () => {
    const topic = topics[selectedTopicIdx];
    if (!topic) return;

    // Dispatch event to generate a practice exam focused on this topic
    window.dispatchEvent(new CustomEvent('generatePracticeExamFromTask', {
      detail: {
        task: {
          task_id: `learn_quiz_${Date.now()}`,
          task_type: 'practice_exam',
          title: `Quiz: ${topic.title}`,
          focus_topics: [topic.title],
          target_competency: topic.title,
          misconception_addressed: ''
        },
        focus_topics: [topic.title],
        target_competency: topic.title,
        misconception_addressed: ''
      }
    }));

    // Navigate to exam tab
    if (onNavigateToExam) {
      setTimeout(() => onNavigateToExam(), 50);
    }
  };

  // Paywall for free users
  if (!isPro()) {
    return (
      <div className={`flex items-center justify-center p-4 pb-8 min-h-[400px] ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className={`backdrop-blur-xl border-2 shadow-2xl overflow-hidden ${isDark ? 'bg-[#12121a]/95 border-purple-500/30' : 'bg-white/95 border-purple-200'}`}>
            <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 px-5 py-6 text-center">
              <Lock className="w-12 h-12 text-white/80 mx-auto mb-3" />
              <h3 className="text-xl font-black text-white mb-1">AI Voice Lectures</h3>
              <p className="text-purple-100 text-xs">Pro feature</p>
            </div>
            <div className="p-5 text-center">
              <p className={`mb-5 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Get AI-generated voice lectures that explain each topic from your material in detail, with key concepts and examples.
              </p>
              <Button
                onClick={() => triggerUpgradeModal('default')}
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Unlock Learn Tab
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Show lecture player if a topic is selected
  if (selectedTopicIdx !== null) {
    return (
      <LecturePlayer
        topic={topics[selectedTopicIdx]}
        topicIndex={selectedTopicIdx}
        totalTopics={topics.length}
        lecture={lecture}
        isLoadingLecture={loadingLecture}
        onBack={() => { setSelectedTopicIdx(null); setLecture(null); }}
        onQuizPrompt={handleQuizPrompt}
      />
    );
  }

  // Show initial state or topic list
  if (!hasLoaded && !loadingTopics) {
    return (
      <div className={`flex items-center justify-center p-4 pb-8 min-h-[400px] ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className={`backdrop-blur-xl border-2 shadow-2xl overflow-hidden ${isDark ? 'bg-[#12121a]/95 border-purple-500/30' : 'bg-white/95 border-purple-200'}`}>
            <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 px-5 py-6 text-center">
              <BookOpen className="w-16 h-16 text-yellow-300 mx-auto mb-3 drop-shadow-lg" />
              <h3 className="text-xl font-black text-white mb-1">AI Voice Lectures</h3>
              <p className="text-purple-100 text-xs">Learn by listening to AI-generated lectures from your material</p>
            </div>
            <div className="p-5 text-center">
              <p className={`mb-5 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                We'll break your material into topics and generate detailed lectures you can read or listen to.
              </p>
              <Button
                onClick={loadTopics}
                className="w-full h-14 bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 hover:from-purple-700 hover:via-purple-800 hover:to-purple-900 text-white font-bold text-lg rounded-xl shadow-xl"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Generate Topics
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Show topic list
  return (
    <LearnTopicList
      topics={topics}
      currentTopicIndex={selectedTopicIdx}
      onSelectTopic={handleSelectTopic}
      loading={loadingTopics}
    />
  );
}