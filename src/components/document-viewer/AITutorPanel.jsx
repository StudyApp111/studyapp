import React, { useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";

export default function AITutorPanel({ messages, setMessages, input, setInput, isLoading, setIsLoading, lesson }) {
  const messagesEndRef = useRef(null);

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
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await base44.functions.invoke('aiTutorChat', {
        messages: [...messages, { role: "user", content: userMessage }],
        lessonContext: lesson || {}
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

  return (
    <div className="flex-1 bg-white rounded-xl shadow-xl border-2 border-purple-200 flex flex-col overflow-hidden" style={{ height: '100%' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-t-xl px-4 py-3 flex items-center gap-3 shadow-lg flex-shrink-0">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">Polli</h3>
          <p className="text-xs text-white/80">Your AI study buddy</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-purple-50/30 to-white">
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-md'
                  : 'bg-white text-slate-900 shadow-sm border border-slate-200'
              }`}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown className="text-sm leading-relaxed prose prose-sm max-w-none [&>p]:my-0.5 [&>ul]:my-1 [&>ol]:my-1">
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <p className="text-sm leading-relaxed">{msg.content}</p>
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
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-200">
              <div className="flex gap-1">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                  className="w-2 h-2 bg-purple-600 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                  className="w-2 h-2 bg-purple-600 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                  className="w-2 h-2 bg-purple-600 rounded-full"
                />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-200 rounded-b-xl flex-shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="flex-1 border-slate-200 focus-visible:ring-purple-500 text-sm rounded-xl"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-xl shadow-md"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}