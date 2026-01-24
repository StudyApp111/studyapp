import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ChevronDown, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ReactMarkdown from "react-markdown";

const QUICK_PROMPTS = [
  "What should I study next?",
  "Give me a study tip",
  "How does this app work?",
];

const STORAGE_KEY = 'polly_home_chat_history';

export default function PollyChatBox({ lessons = [], studyPlans = [], user }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setMessages(parsed);
    } else {
      // Initialize with welcome message
      const welcomeMessage = getWelcomeMessage();
      setMessages([{ role: "assistant", content: welcomeMessage }]);
    }
  }, []);

  // Save chat history whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Keep only last 20 messages to avoid bloating localStorage
      const toSave = messages.slice(-20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    }
  }, [messages]);

  const getWelcomeMessage = () => {
    if (lessons.length === 0) {
      return "Hey! I'm Polly 🦜 Upload your first lecture notes and I'll help you create a personalized study plan!";
    }
    
    // Find a lesson needing work
    const lessonNeedingDiagnostic = lessons.find(l => {
      const plan = studyPlans.find(sp => sp.lesson_id === l.id);
      return !plan;
    });
    
    if (lessonNeedingDiagnostic) {
      return `Ready to see your predicted grade for ${lessonNeedingDiagnostic.course_name}? Take the diagnostic - it only takes 5 minutes! 📊`;
    }
    
    // Find lesson with tasks
    for (const lesson of lessons) {
      const plan = studyPlans.find(sp => sp.lesson_id === lesson.id && sp.status === 'active');
      if (plan) {
        const incompleteTasks = plan.tasks?.filter(t => !t.completed)?.length || 0;
        if (incompleteTasks > 0) {
          return `You have ${incompleteTasks} tasks left in ${lesson.course_name}. Let's knock one out! 💪`;
        }
      }
    }
    
    return "You're crushing it! All tasks done. Upload more notes or review what you've learned! 🎉";
  };

  const getSmartRecommendation = () => {
    if (!lessons || lessons.length === 0) {
      return { text: "Upload your first lesson to get started!", action: null };
    }

    const lessonNeedingDiagnostic = lessons.find(l => {
      const plan = studyPlans.find(sp => sp.lesson_id === l.id);
      return !plan;
    });

    if (lessonNeedingDiagnostic) {
      return {
        text: `Take ${lessonNeedingDiagnostic.course_name} diagnostic`,
        action: `${createPageUrl("DocumentViewer")}?id=${lessonNeedingDiagnostic.id}`,
        actionLabel: "Start"
      };
    }

    for (const lesson of lessons) {
      const plan = studyPlans.find(sp => sp.lesson_id === lesson.id && sp.status === 'active');
      if (plan) {
        const incompleteTasks = plan.tasks?.filter(t => !t.completed) || [];
        if (incompleteTasks.length > 0) {
          return {
            text: `Continue ${lesson.course_name}`,
            action: `${createPageUrl("DocumentViewer")}?id=${lesson.id}`,
            actionLabel: "Go"
          };
        }
      }
    }

    return { text: "All caught up! 🎉", action: null };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isExpanded) scrollToBottom();
  }, [messages, isExpanded]);

  const handleSend = async (text = inputValue) => {
    if (!text.trim() || isLoading) return;

    const userMessage = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await base44.functions.invoke('pollyChat', {
        messages: [...messages, userMessage].slice(-10), // Last 10 for context
        homeContext: {
          lessons: lessons.map(l => ({ id: l.id, course_name: l.course_name })),
          studyPlans: studyPlans.map(sp => ({
            lesson_id: sp.lesson_id,
            status: sp.status,
            current_predicted_grade: sp.current_predicted_grade,
            initial_predicted_grade: sp.initial_predicted_grade,
            tasks: sp.tasks?.map(t => ({ completed: t.completed, task_type: t.task_type }))
          })),
          userName: user?.full_name?.split(' ')[0],
          streak: user?.current_streak || 0
        }
      });

      const reply = response.data?.reply || "I'm here to help! What would you like to know?";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (error) {
      console.error("Polly error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Oops, had a little hiccup! What would you like help with?" 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const recommendation = getSmartRecommendation();
  const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div 
        className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span className="text-xl">🦜</span>
            </div>
            <div>
              <h3 className="text-white font-bold">Polly</h3>
              <p className="text-white/70 text-xs">Your Study Buddy</p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-white/70 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Collapsed view */}
      {!isExpanded && (
        <div className="p-4">
          <p className="text-slate-700 text-sm mb-3">{lastAssistantMessage?.content || getWelcomeMessage()}</p>
          {recommendation.action && (
            <Link to={recommendation.action}>
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 w-full">
                {recommendation.actionLabel} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Expanded chat */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="h-56 overflow-y-auto p-3 space-y-2 bg-slate-50">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    msg.role === 'user' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown className="text-sm prose prose-sm max-w-none [&>p]:m-0">
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick prompts */}
            <div className="px-3 py-2 border-t border-slate-100 flex gap-2 overflow-x-auto">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium whitespace-nowrap hover:bg-purple-100"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask Polly..."
                  className="flex-1 px-3 py-2 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <Button 
                  size="icon" 
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-purple-600 hover:bg-purple-700 rounded-xl h-9 w-9"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}