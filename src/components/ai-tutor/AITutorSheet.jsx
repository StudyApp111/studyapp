import React, { useRef, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useAITutor } from "./AITutorContext";
import { useSubscription } from "@/components/subscription/SubscriptionContext";
import { useTheme } from "@/components/theme/ThemeProvider";

import MathText, { renderMathText } from "@/components/math/MathText";

export default function AITutorSheet() {
  const { isOpen, setIsOpen, context, setContext, messages, setMessages, close } = useAITutor();
  const { canSendAIMessage, incrementAIMessageCount, triggerUpgradeModal } = useSubscription();
  const { isDark } = useTheme();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUsedInitialPrompt, setHasUsedInitialPrompt] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When opened with new context, set up initial message
  useEffect(() => {
    if (isOpen && context && messages.length === 0) {
      setHasUsedInitialPrompt(false);
      
      // Create welcome message based on context type
      let welcomeMessage = "👋 Hi! I'm Polly, your AI study assistant. How can I help?";
      
      if (context.type === "question") {
        welcomeMessage = `👋 I see you need help with this question. Let me break it down for you.`;
      } else if (context.type === "flashcard") {
        welcomeMessage = `👋 Let me help you understand this flashcard better.`;
      } else if (context.type === "document") {
        welcomeMessage = `👋 I'll help explain this section from your notes.`;
      } else if (context.type === "diagnostic_complete") {
        welcomeMessage = context.initialMessage || "Great work completing your diagnostic!";
      }
      
      setMessages([{ role: "assistant", content: welcomeMessage }]);
      
      // Auto-send the initial prompt after a short delay (skip for diagnostic_complete since message is already set)
      if (context.initialPrompt && context.type !== "diagnostic_complete") {
        setTimeout(() => {
          handleSend(context.initialPrompt);
        }, 500);
      }
    }
  }, [isOpen, context]);

  // Listen for diagnostic completion — auto-open on mobile with Polly message
  useEffect(() => {
    const handleDiagnosticComplete = (e) => {
      const isMobile = window.innerWidth < 768;
      if (!isMobile) return;

      const { predicted_grade, total_score, mastery_gap } = e.detail;
      
      const gradeEmoji = predicted_grade?.startsWith('A') ? '🌟' : predicted_grade?.startsWith('B') ? '💪' : '🎯';
      let message = `${gradeEmoji} **Your predicted grade: ${predicted_grade || '—'}** (${total_score ? Math.round(total_score) + '%' : '—'})\n\n`;
      
      if (mastery_gap) {
        message += `Your biggest opportunity to improve is in **${mastery_gap}**. `;
      }
      message += `Head to your **Study Plan** tab — I've created personalized tasks to help you get to an A! Each task you complete will improve your prediction.\n\nNeed help with anything? Just ask! 📚`;

      // Open the sheet with diagnostic context
      setMessages([]);
      setIsOpen(true);
      
      // Small delay to ensure sheet is rendered
      setTimeout(() => {
        setMessages([{ role: "assistant", content: message }]);
      }, 300);
    };

    window.addEventListener('pollyDiagnosticComplete', handleDiagnosticComplete);
    return () => window.removeEventListener('pollyDiagnosticComplete', handleDiagnosticComplete);
  }, []);

  // Listen for proactive "stuck" nudges on mobile
  useEffect(() => {
    const handleStuckNudge = (e) => {
      const isMobile = window.innerWidth < 768;
      if (!isMobile) return;
      // Don't interrupt if already open
      if (isOpen) return;

      const { question_text, topic, nudge_type } = e.detail || {};
      
      let message = '';
      if (nudge_type === 'exam_stuck') {
        message = `👋 Hey! I noticed you've been thinking about this one for a while — that's totally okay!\n\n`;
        if (question_text) {
          message += `Would you like me to:\n- **Break down** the question step by step\n- Give you a **hint** without the answer\n- Explain the **concept** behind it\n\nJust ask! No judgment here 😊`;
        } else {
          message += `Need a hint or want me to explain the concept? I'm here to help! 💡`;
        }
      } else if (nudge_type === 'flashcard_stuck') {
        message = `👋 Struggling with this flashcard? I can explain the concept in simpler terms or give you a memory trick. Just ask! 🧠`;
      } else {
        message = `👋 Need some help? I noticed you might be stuck. Want me to explain this differently or give you a hint? 💡`;
      }

      setMessages([]);
      setIsOpen(true);
      setTimeout(() => {
        setMessages([{ role: "assistant", content: message }]);
        // Set context so follow-up messages have lesson info
        if (e.detail?.lesson) {
          setContext({ type: "question", lesson: e.detail.lesson, question: { text: question_text } });
        }
      }, 200);
    };

    window.addEventListener('pollyStuckNudge', handleStuckNudge);
    return () => window.removeEventListener('pollyStuckNudge', handleStuckNudge);
  }, [isOpen]);

  const handleSend = async (customMessage) => {
    const messageToSend = customMessage || input.trim();
    if (!messageToSend || isLoading) return;

    setIsLoading(true);
    
    // Check subscription limit BEFORE showing user message
    const aiCheck = await canSendAIMessage();
    console.log('🔒 AITutorSheet: canSendAIMessage result:', aiCheck);
    
    if (!aiCheck.allowed) {
      setIsLoading(false);
      close();
      triggerUpgradeModal('ai_message');
      return;
    }

    if (!customMessage) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: messageToSend }]);
    setHasUsedInitialPrompt(true);

    // Increment counter AFTER check passes
    await incrementAIMessageCount();

    try {
      const response = await base44.functions.invoke('pollyChat', {
        messages: [...messages, { role: "user", content: messageToSend }],
        lessonContext: context?.lesson || {},
        documentContent: context?.lesson?.extracted_content || null,
        specificContext: context
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: response.data.reply
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

  const getContextLabel = () => {
    if (!context) return null;
    if (context.type === "question") return "Question Help";
    if (context.type === "flashcard") return "Flashcard Help";
    if (context.type === "document") return "Notes Help";
    return null;
  };

  // Show on both mobile and desktop - it's the primary AI tutor interface

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-50 bg-black/40"
          />
          
          {/* Sheet - Works on both mobile and desktop */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className={`fixed left-0 right-0 bottom-0 z-[9999] rounded-t-3xl flex flex-col overflow-hidden shadow-2xl md:left-auto md:right-4 md:bottom-4 md:w-[400px] md:h-[600px] md:rounded-2xl ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}
            style={{ height: '75vh', maxHeight: 'calc(100vh - 60px)' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="font-semibold text-white text-sm">Polly</span>
                  {getContextLabel() && (
                    <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-[10px] text-white/90">
                      {getContextLabel()}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={close}
                className="p-2 text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/10"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Context Preview */}
            {context && (context.question || context.flashcard || context.selectedText) && (
              <div className={`px-4 py-2 border-b ${isDark ? 'bg-purple-600/20 border-purple-500/30' : 'bg-purple-50 border-purple-100'}`}>
                <div className={`text-[10px] font-medium mb-1 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                  {context.type === "question" ? "📝 Question:" : context.type === "flashcard" ? "🎴 Flashcard:" : "📄 Selected text:"}
                </div>
                <p className={`text-xs line-clamp-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {context.question?.text || context.flashcard?.question || context.selectedText}
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md"
                        : isDark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <ReactMarkdown 
                        className="text-[11px] leading-relaxed prose prose-xs max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-1 [&>ul]:my-1 [&>ul]:ml-3 [&>ul]:text-[11px] [&>ol]:my-1 [&>ol]:ml-3"
                        components={{
                          p: ({ children }) => {
                            const text = typeof children === 'string' ? children : 
                              (Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : '');
                            return <p className="my-1" dangerouslySetInnerHTML={{ __html: renderMathText(text) }} />;
                          },
                          li: ({ children }) => {
                            const text = typeof children === 'string' ? children : 
                              (Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : '');
                            return <li dangerouslySetInnerHTML={{ __html: renderMathText(text) }} />;
                          },
                          code: ({ inline, children }) => inline ? 
                            <code className="bg-slate-700 px-1 rounded text-[10px]">{children}</code> : 
                            <pre className="bg-slate-800 text-slate-200 p-2 rounded text-[10px] overflow-x-auto"><code>{children}</code></pre>
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-[11px]">{msg.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className={`rounded-2xl px-4 py-3 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                    <div className="flex gap-1">
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-2 h-2 bg-purple-600 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-purple-600 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-purple-600 rounded-full" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions - Same as desktop panel */}
            {!isLoading && (
              <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => handleSend("Explain this material like I'm 5 years old - super simple!")}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${isDark ? 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                >
                  Explain like I'm 5
                </button>
                <button
                  onClick={() => handleSend("Give me a real-world example of the main concept")}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${isDark ? 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                >
                  Give me an example
                </button>
                <button
                  onClick={() => handleSend("Why is this material important? When would I use it?")}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${isDark ? 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                >
                  Why is this important?
                </button>
                <button
                  onClick={() => handleSend("Quiz me with 3 questions on this material")}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${isDark ? 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                >
                  Quiz Me
                </button>
              </div>
            )}

            {/* Input */}
            <div className={`border-t p-3 flex-shrink-0 ${isDark ? 'border-white/10 bg-[#12121a]' : 'border-slate-200 bg-white'}`}>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask a follow-up question..."
                  className={`flex-1 px-4 py-2.5 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${isDark ? 'border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500' : 'border-slate-200 bg-white text-slate-900'}`}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 h-10 w-10"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}