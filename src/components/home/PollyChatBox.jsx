import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, X, ChevronDown, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ReactMarkdown from "react-markdown";

// Quick starter prompts
const QUICK_PROMPTS = [
  "What should I study next?",
  "Give me a study tip",
  "How am I doing?",
];

// Fun opening messages Polly can use
const POLLY_GREETINGS = [
  { message: "Ready to crush some studying today? I've got recommendations based on your progress! 📚", type: "greeting" },
  { message: "Fun fact: Spaced repetition can boost retention by 200%! That's why flashcards work so well. Want to try some?", type: "fact" },
  { message: "Did you know teaching others helps you retain 90% of what you learn? Try the Teach It feature!", type: "fact" },
  { message: "Your brain forms stronger connections during short study bursts. 25-minute sessions are perfect!", type: "tip" },
  { message: "I noticed you've been making great progress! Let's keep that momentum going 🚀", type: "encouragement" },
];

export default function PollyChatBox({ lessons = [], studyPlans = [], user, onActionClick }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);

  // Generate smart recommendation based on user data
  const getSmartRecommendation = () => {
    if (!lessons || lessons.length === 0) {
      return {
        text: "Upload your first lesson and I'll create a personalized study plan!",
        action: null,
        actionLabel: null
      };
    }

    // Find lessons needing diagnostic
    const lessonsNeedingDiagnostic = lessons.filter(l => {
      const plan = studyPlans.find(sp => sp.lesson_id === l.id);
      return !plan;
    });

    if (lessonsNeedingDiagnostic.length > 0) {
      const lesson = lessonsNeedingDiagnostic[0];
      return {
        text: `Take the ${lesson.course_name} diagnostic to get your grade prediction!`,
        action: `${createPageUrl("DocumentViewer")}?id=${lesson.id}`,
        actionLabel: "Start Diagnostic"
      };
    }

    // Find lessons with incomplete tasks
    for (const lesson of lessons) {
      const plan = studyPlans.find(sp => sp.lesson_id === lesson.id && sp.status === 'active');
      if (plan) {
        const incompleteTasks = plan.tasks?.filter(t => !t.completed) || [];
        if (incompleteTasks.length > 0) {
          const nextTask = incompleteTasks[0];
          const taskLabel = nextTask.task_type === 'flashcards' ? 'flashcard session' :
                           nextTask.task_type === 'teach_it' ? 'Teach It challenge' :
                           nextTask.task_type === 'practice_exam' ? 'practice quiz' : 'review';
          return {
            text: `Your ${lesson.course_name} ${taskLabel} is waiting! ${incompleteTasks.length} tasks left to boost your grade.`,
            action: `${createPageUrl("DocumentViewer")}?id=${lesson.id}`,
            actionLabel: "Let's Go"
          };
        }
      }
    }

    return {
      text: "You're all caught up! 🎉 Great job staying on top of your studies.",
      action: null,
      actionLabel: null
    };
  };

  // Initialize with a greeting
  useEffect(() => {
    const recommendation = getSmartRecommendation();
    const greeting = POLLY_GREETINGS[Math.floor(Math.random() * POLLY_GREETINGS.length)];
    
    // Personalize greeting with user data
    let personalizedMessage = greeting.message;
    if (user?.current_streak > 0) {
      personalizedMessage = `🔥 ${user.current_streak}-day streak! ${greeting.message}`;
    }

    setMessages([
      {
        role: "assistant",
        content: personalizedMessage,
        recommendation
      }
    ]);
  }, [lessons, studyPlans, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text = inputValue) => {
    if (!text.trim() || isLoading) return;

    const userMessage = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      let convId = conversationId;
      
      // Create conversation if needed
      if (!convId) {
        const conv = await base44.agents.createConversation({
          agent_name: "polly_home",
          metadata: { name: "Polly Chat", user_id: user?.id }
        });
        convId = conv.id;
        setConversationId(convId);
      }

      // Get conversation and send message
      const conversation = await base44.agents.getConversation(convId);
      
      // Add context about user's current state
      const contextMessage = `[Context: User has ${lessons.length} courses, ${studyPlans.filter(sp => sp.status === 'active').length} active study plans. Current streak: ${user?.current_streak || 0} days. Daily XP: ${user?.daily_xp || 0}]\n\nUser says: ${text}`;
      
      await base44.agents.addMessage(conversation, {
        role: "user",
        content: contextMessage
      });

      // Subscribe to get the response
      const unsubscribe = base44.agents.subscribeToConversation(convId, (data) => {
        const lastMessage = data.messages?.[data.messages.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
          setMessages(prev => {
            const withoutLoading = prev.filter(m => !m.isLoading);
            const existingAssistant = withoutLoading.find(m => m.id === lastMessage.id);
            if (existingAssistant) {
              return withoutLoading.map(m => m.id === lastMessage.id ? { ...lastMessage, recommendation: getSmartRecommendation() } : m);
            }
            return [...withoutLoading, { ...lastMessage, recommendation: getSmartRecommendation() }];
          });
          setIsLoading(false);
        }
      });

      // Cleanup after 30 seconds
      setTimeout(() => {
        unsubscribe();
        setIsLoading(false);
      }, 30000);

    } catch (error) {
      console.error("Polly chat error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Oops! I had a little hiccup. Let me try again - what would you like help with?",
        recommendation: getSmartRecommendation()
      }]);
      setIsLoading(false);
    }
  };

  const recommendation = getSmartRecommendation();

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div 
        className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <span className="text-2xl">🦜</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-purple-600" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Polly</h3>
              <p className="text-white/70 text-xs">Your AI Study Buddy</p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-white/70 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Collapsed view - show recommendation */}
      {!isExpanded && (
        <div className="p-4">
          <p className="text-slate-700 text-sm mb-3">{recommendation.text}</p>
          {recommendation.action && (
            <Link to={recommendation.action}>
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 w-full">
                {recommendation.actionLabel} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Expanded chat view */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Messages */}
            <div className="h-64 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    msg.role === 'user' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown className="text-sm prose prose-sm max-w-none">
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                    
                    {/* Show recommendation action button for assistant messages */}
                    {msg.role === 'assistant' && msg.recommendation?.action && (
                      <Link to={msg.recommendation.action} className="block mt-2">
                        <Button size="sm" variant="outline" className="w-full text-xs border-purple-200 text-purple-700 hover:bg-purple-50">
                          {msg.recommendation.actionLabel} <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
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
            <div className="px-4 py-2 border-t border-slate-100 flex gap-2 overflow-x-auto">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium whitespace-nowrap hover:bg-purple-100 transition-colors"
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
                  placeholder="Ask Polly anything..."
                  className="flex-1 px-4 py-2 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <Button 
                  size="icon" 
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-purple-600 hover:bg-purple-700 rounded-xl"
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