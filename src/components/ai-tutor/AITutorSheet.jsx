import React, { useRef, useEffect, useState } from "react";
import * as ReactDOM from "react-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Send, X, Sparkles, Loader2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useAITutor } from "./AITutorContext";

export default function AITutorSheet() {
  const { isOpen, setIsOpen, context, messages, setMessages, close } = useAITutor();
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
      }
      
      setMessages([{ role: "assistant", content: welcomeMessage }]);
      
      // Auto-send the initial prompt after a short delay
      if (context.initialPrompt) {
        setTimeout(() => {
          handleSend(context.initialPrompt);
        }, 500);
      }
    }
  }, [isOpen, context]);

  const handleSend = async (customMessage) => {
    const messageToSend = customMessage || input.trim();
    if (!messageToSend || isLoading) return;

    if (!customMessage) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: messageToSend }]);
    setIsLoading(true);
    setHasUsedInitialPrompt(true);

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

  // Only show on mobile
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Don't render on desktop - use the side panel instead
  if (!isMobile) return null;

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
            className="fixed inset-0 z-50 bg-black/40 md:hidden"
          />
          
          {/* Sheet - Mobile only */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className="fixed left-0 right-0 bottom-0 z-[9999] bg-white rounded-t-3xl flex flex-col overflow-hidden shadow-2xl md:hidden"
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
              <div className="px-4 py-2 bg-purple-50 border-b border-purple-100">
                <div className="text-[10px] text-purple-600 font-medium mb-1">
                  {context.type === "question" ? "📝 Question:" : context.type === "flashcard" ? "🎴 Flashcard:" : "📄 Selected text:"}
                </div>
                <p className="text-xs text-slate-700 line-clamp-2">
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
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <ReactMarkdown className="text-[11px] leading-relaxed prose prose-xs max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-1 [&>ul]:my-1 [&>ul]:ml-3 [&>ul]:text-[11px] [&>ol]:my-1 [&>ol]:ml-3">
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
                  <div className="bg-slate-100 rounded-2xl px-4 py-3">
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
                  className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-medium whitespace-nowrap hover:bg-purple-200 transition-colors"
                >
                  Explain like I'm 5
                </button>
                <button
                  onClick={() => handleSend("Give me a real-world example of the main concept")}
                  className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-medium whitespace-nowrap hover:bg-purple-200 transition-colors"
                >
                  Give me an example
                </button>
                <button
                  onClick={() => handleSend("Why is this material important? When would I use it?")}
                  className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-medium whitespace-nowrap hover:bg-purple-200 transition-colors"
                >
                  Why is this important?
                </button>
                <button
                  onClick={() => handleSend("Quiz me with 3 questions on this material")}
                  className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-medium whitespace-nowrap hover:bg-purple-200 transition-colors"
                >
                  Quiz Me
                </button>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-slate-200 p-3 bg-white flex-shrink-0">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask a follow-up question..."
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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