import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageCircle, Send, X, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import MathText from "@/components/math/MathText";

export default function AITutorChat({ lesson, extractedContent }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi! I'm your AI tutor for ${lesson?.course_name || 'this course'}. Ask me anything about the material and I'll help explain concepts, answer questions, and guide your learning. 🎓`
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await base44.functions.invoke('aiTutorChat', {
        messages: [...messages, { role: "user", content: userMessage }],
        lessonContext: {
          course_name: lesson?.course_name,
          extracted_content: extractedContent?.substring(0, 3000) // Limit context size
        }
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: response.data.reply 
      }]);
    } catch (error) {
      console.error("Tutor error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Desktop: Side Panel */}
      <div className="hidden md:block fixed left-4 top-24 bottom-24 w-80 z-40">
        <Card className="h-full flex flex-col bg-white/95 backdrop-blur-xl shadow-2xl border-purple-200">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 rounded-t-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-semibold">AI Tutor</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <MathText className="text-sm prose prose-sm max-w-none">
                      {msg.content}
                    </MathText>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-slate-200">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Mobile: Floating Button + Modal */}
      <div className="md:hidden">
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              onClick={() => setIsOpen(true)}
              className="fixed bottom-24 right-4 z-50 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 rounded-full shadow-2xl"
            >
              <MessageCircle className="w-6 h-6" />
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-black/50 z-50"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25 }}
                className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl"
                style={{ height: '80vh' }}
              >
                <div className="flex flex-col h-full">
                  <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 rounded-t-3xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      <h3 className="font-semibold">AI Tutor</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsOpen(false)}
                      className="text-white hover:bg-white/20"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-4 py-2 ${
                            msg.role === 'user'
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-100 text-slate-900'
                          }`}
                        >
                          {msg.role === 'assistant' ? (
                            <MathText className="text-sm prose prose-sm max-w-none">
                              {msg.content}
                            </MathText>
                          ) : (
                            <p className="text-sm">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 rounded-lg px-4 py-2">
                          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 border-t border-slate-200 safe-area-inset-bottom">
                    <div className="flex gap-2">
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask a question..."
                        disabled={isLoading}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        size="icon"
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}