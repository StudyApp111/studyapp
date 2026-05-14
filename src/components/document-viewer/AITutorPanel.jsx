import React, { useRef, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, FileText, HelpCircle, List, Lightbulb, Lock, Crown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { useSubscription } from "@/components/subscription/SubscriptionContext";
import { renderMathContent } from "@/components/utils/MathRenderer";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AITutorPanel({ messages, setMessages, input, setInput, isLoading, setIsLoading, lesson }) {
  const { canSendAIMessage, incrementAIMessageCount, triggerUpgradeModal, isPro } = useSubscription();
  const { isDark } = useTheme();
  const messagesEndRef = useRef(null);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history or show welcome message
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!lesson?.id) return;
      
      try {
        // Try to load existing chat history
        const histories = await base44.entities.PollyChatHistory.filter({ lesson_id: lesson.id });
        
        if (histories.length > 0 && histories[0].messages?.length > 0) {
          setMessages(histories[0].messages);
          return;
        }
      } catch (err) {
        console.error("Error loading chat history:", err);
      }
      
      // No history - show welcome message
      const courseName = lesson.course_name || "your course";
      
      let pollyInsight = '';
      try {
        const plans = await base44.entities.StudyPlan.filter({ 
          lesson_id: lesson.id, 
          status: 'active' 
        });
        if (plans.length > 0 && plans[0].current_predicted_grade) {
          const plan = plans[0];
          const velocityEmoji = plan.learning_velocity === 'Accelerating' ? '📈' : 
                                 plan.learning_velocity === 'Declining' ? '📉' : '➡️';
          pollyInsight = `\n\n🔮 **Current Prediction:** ${plan.current_predicted_grade} (${plan.current_confidence || 45}% confidence) ${velocityEmoji}`;
          if (plan.mastery_gap) {
            pollyInsight += `\n💡 Focus area: *${plan.mastery_gap}*`;
          }
        }
      } catch (err) {}
      
      // Turbo-style welcome: short greeting + bulleted suggestion list.
      // Markdown renders these as clean bullets — much cleaner than a paragraph blob.
      setMessages([{
        role: "assistant",
        content: `Hey! I'm **Polly**, your AI study buddy for **${courseName}**.${pollyInsight}

How can I help you today?

- Ask me anything about your notes or document
- Need a study tool? I can spin up flashcards, a quiz, or a Feynman session
- Ready to start? Take the **5-question diagnostic** in the Quizzes tab and I'll predict your grade

Just tell me what you'd like to do next! 🚀`
      }]);
    };
    loadChatHistory();
  }, [lesson?.id]);

  // Save chat history when messages change
  useEffect(() => {
    const saveChatHistory = async () => {
      if (!lesson?.id || messages.length === 0) return;
      
      try {
        const histories = await base44.entities.PollyChatHistory.filter({ lesson_id: lesson.id });
        
        if (histories.length > 0) {
          await base44.entities.PollyChatHistory.update(histories[0].id, { messages });
        } else {
          await base44.entities.PollyChatHistory.create({ lesson_id: lesson.id, messages });
        }
      } catch (err) {
        console.error("Error saving chat history:", err);
      }
    };
    
    // Debounce save
    const timeout = setTimeout(saveChatHistory, 1000);
    return () => clearTimeout(timeout);
  }, [messages, lesson?.id]);

  // Listen for "Ask AI" button clicks from exam/flashcard components
  useEffect(() => {
    const handleAskAI = (event) => {
      const contextData = event.detail;
      if (contextData?.initialPrompt) {
        setShowQuickActions(false);
        handleSend(contextData.initialPrompt);
      }
    };

    window.addEventListener('askAIFromContext', handleAskAI);
    return () => window.removeEventListener('askAIFromContext', handleAskAI);
  }, [messages]);

  // Listen for study plan CTA actions
  useEffect(() => {
    const handleStudyPlanAction = (event) => {
      const { message } = event.detail || {};
      if (message) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: message
        }]);
      }
    };
    window.addEventListener('pollyStudyPlanAction', handleStudyPlanAction);
    return () => window.removeEventListener('pollyStudyPlanAction', handleStudyPlanAction);
  }, []);

  // Listen for diagnostic completion to add Polly message directing to study plan
  // SKIP for guest sessions — we don't want the chat to auto-popup and spoil the surprise
  useEffect(() => {
    const handleDiagnosticComplete = (event) => {
      // Check if this is a guest session by looking at URL or sessionStorage
      const isGuestSession = sessionStorage.getItem('guest_session_active') === 'true';
      if (isGuestSession) return; // Don't auto-populate chat for guests
      
      const { predicted_grade, total_score, mastery_gap } = event.detail || {};
      
      let gradeInfo = '';
      if (predicted_grade && total_score) {
        gradeInfo = `\n\n📊 **Your predicted grade: ${predicted_grade} (${total_score}%)**`;
      }
      let gapInfo = '';
      if (mastery_gap) {
        gapInfo = `\nYour biggest opportunity to improve: **${mastery_gap}**`;
      }
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `🎉 **Diagnostic complete!** Nice work.${gradeInfo}${gapInfo}\n\nI've built a **custom Study Plan** just for you — it targets your specific weak spots with flashcards, practice quizzes, and more.\n\n👉 **Head over to the Study Plan tab** to see your personalized roadmap and start improving! 📈`
      }]);
    };

    window.addEventListener('pollyDiagnosticComplete', handleDiagnosticComplete);
    return () => window.removeEventListener('pollyDiagnosticComplete', handleDiagnosticComplete);
  }, []);

  const handleSend = async (customMessage) => {
    const messageToSend = customMessage || input.trim();
    if (!messageToSend || isLoading) return;

    setIsLoading(true);

    // Check per-lesson free limit
    const currentUserCount = messages.filter(m => m.role === 'user').length;
    if (!isPro() && currentUserCount >= FREE_POLLY_LIMIT) {
      setIsLoading(false);
      return;
    }

    // Check global AI message limit BEFORE sending
    const aiCheck = await canSendAIMessage();
    console.log('🔒 AITutorPanel: canSendAIMessage result:', aiCheck);
    
    if (!aiCheck.allowed) {
      setIsLoading(false);
      triggerUpgradeModal('ai_message');
      return;
    }

    if (!customMessage) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: messageToSend }]);
    setShowQuickActions(false);

    // Increment counter AFTER check passes
    await incrementAIMessageCount();

    try {
      const docContent = lesson?.extracted_content || '';
      
      // Use pollyChat function - single source of truth
      const { data: response } = await base44.functions.invoke('pollyChat', {
        messages: [...messages, { role: 'user', content: messageToSend }],
        lessonContext: lesson,
        documentContent: docContent
      });

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: response.reply || "I'm sorry, I couldn't generate a response. Please try again."
      }]);
    } catch (error) {
      console.error("Tutor error:", error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: "Explain like I'm 5", icon: Lightbulb, prompt: "Explain this material like I'm 5 years old - super simple!" },
    { label: "Give me an example", icon: FileText, prompt: "Give me a real-world example of the main concept" },
    { label: "Why is this important?", icon: HelpCircle, prompt: "Why is this material important? When would I use it?" },
    { label: "🧩 Riddle Me", icon: Sparkles, prompt: "Give me a clever, challenging riddle that's loosely based on the concepts I'm learning. Make it tricky but solvable - I want to think!" },
  ];

  const hasDocument = lesson?.extracted_content || lesson?.file_url;

  const FREE_POLLY_LIMIT = 5;
  const userMessageCount = messages.filter(m => m.role === 'user').length;
  const isLimitReached = !isPro() && userMessageCount >= FREE_POLLY_LIMIT;

  return (
    <div className={`flex-1 rounded-xl shadow-xl border flex flex-col overflow-hidden relative z-10 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-purple-200'}`} style={{ height: '100%' }}>
      {/* Header — branded pill on the left + course context, with a live status dot */}
      <div className={`flex items-center justify-between px-3 py-2.5 flex-shrink-0 relative z-20 border-b ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border flex-shrink-0 ${isDark ? 'bg-purple-500/15 border-purple-400/25' : 'bg-purple-50 border-purple-200'}`}>
            <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
            <span className={`text-[12px] font-semibold ${isDark ? 'text-purple-200' : 'text-purple-700'}`}>Polly AI</span>
          </div>
          <div className="min-w-0 flex flex-col leading-tight">
            <span className={`text-[12px] font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {lesson?.course_name || 'Your AI tutor'}
            </span>
            <span className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-500 opacity-70 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </span>
              Online · Knows Your Document
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions - Always visible above input as pills */}

      {/* Messages — clean white surface (Turbo-style), no gradient distraction */}
      <div className={`flex-1 overflow-y-auto p-3 space-y-2 ${isDark ? 'bg-[#0f0f17]' : 'bg-white'}`}>
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? (isDark ? 'bg-purple-600/20 text-purple-100 border border-purple-500/30' : 'bg-purple-50 text-purple-900 border border-purple-100')
                  : isDark ? 'bg-transparent text-slate-200' : 'bg-transparent text-slate-800'
              }`}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown 
                  className={`text-[13px] leading-relaxed prose prose-sm max-w-none [&>p]:my-1.5 [&>ul]:my-2 [&>ul]:ml-4 [&>ul]:list-disc [&>ol]:my-2 [&>ol]:ml-4 [&>li]:my-1 [&_strong]:font-semibold ${isDark ? '[&_strong]:text-white [&>ul]:marker:text-purple-400' : '[&_strong]:text-slate-900 [&>ul]:marker:text-purple-500'}`}
                  components={{
                    p: ({ children }) => {
                      const text = typeof children === 'string' ? children : 
                        (Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : '');
                      if (text.includes('$')) {
                        return <p className="my-0.5" dangerouslySetInnerHTML={{ __html: renderMathContent(text) }} />;
                      }
                      return <p className="my-0.5">{children}</p>;
                    },
                    li: ({ children }) => {
                      const text = typeof children === 'string' ? children : 
                        (Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : '');
                      if (text.includes('$')) {
                        return <li dangerouslySetInnerHTML={{ __html: renderMathContent(text) }} />;
                      }
                      return <li>{children}</li>;
                    },
                    code: ({ inline, children }) => inline ? 
                      <code className="bg-purple-100 px-1 rounded text-[10px]">{children}</code> : 
                      <pre className="bg-slate-800 text-slate-200 p-2 rounded text-[10px] overflow-x-auto"><code>{children}</code></pre>
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <p className="text-[13px] leading-relaxed">{msg.content}</p>
              )}
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className={`rounded-2xl px-4 py-3 shadow-sm border ${isDark ? 'bg-[#1a1a2e] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="flex gap-1">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                  className="w-2 h-2 bg-purple-500 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                  className="w-2 h-2 bg-purple-500 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                  className="w-2 h-2 bg-purple-500 rounded-full"
                />
              </div>
            </div>
          </motion.div>
        )}
        {/* Inline upgrade prompt when limit reached */}
        {isLimitReached && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mx-auto max-w-[90%] rounded-2xl px-4 py-3 text-center border ${isDark ? 'bg-purple-900/30 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}
          >
            <Lock className={`w-4 h-4 mx-auto mb-1.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <p className={`text-xs font-medium mb-1.5 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
              You've used your free questions for this lesson.
            </p>
            <Link
              to={createPageUrl("PricingPlans")}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 text-white text-xs font-semibold hover:from-purple-500 hover:to-purple-600 transition-all"
            >
              <Crown className="w-3 h-3" />
              Upgrade for unlimited Polly conversations
            </Link>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Sticky composer — quick action pills + prominent input, always accessible */}
      <div className={`p-3 border-t rounded-b-xl flex-shrink-0 space-y-2 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'}`}>
        {/* Quick Actions Pills - Hidden when limit reached */}
        {!isLimitReached && (
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleSend(action.prompt)}
              disabled={isLoading}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all text-[11px] font-medium whitespace-nowrap ${isDark ? 'bg-purple-600/15 border-purple-500/25 hover:bg-purple-600/25 text-purple-300' : 'bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-700'}`}
            >
              <action.icon className="w-3 h-3" />
              {action.label}
            </button>
          ))}
        </div>
        )}

        {/* Prominent input row — clear focus ring, bigger send button */}
        <div className={`flex items-center gap-2 rounded-2xl border px-2 py-1.5 transition-all focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} ${isLimitReached ? 'opacity-50' : ''}`}>
          <input
            value={isLimitReached ? '' : input}
            onChange={(e) => !isLimitReached && setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !isLimitReached && handleSend()}
            placeholder={isLimitReached ? "Upgrade to continue chatting..." : (hasDocument ? "Ask about your document…" : "Ask me anything…")}
            disabled={isLoading || isLimitReached}
            className={`flex-1 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-[13px] px-2 py-1.5 ${isDark ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'} ${isLimitReached ? 'cursor-not-allowed' : ''}`}
          />
          <Button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim() || isLimitReached}
            size="icon"
            className="bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-md h-9 w-9 flex-shrink-0 disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}