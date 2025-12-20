import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Send, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function AITutorModal({ open, onOpenChange }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi! I'm your AI tutor. Ask me anything about your studies and I'll help explain concepts, answer questions, and guide your learning. 🎓`
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await base44.functions.invoke('aiTutorChat', {
        messages: [...messages, { role: "user", content: userMessage }],
        lessonContext: {}
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] p-0 bg-white/95 backdrop-blur-xl border-purple-200">
        <div className="flex flex-col h-full">
          <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6 rounded-t-lg flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">AI Tutor</h3>
              <p className="text-sm text-purple-100">Ask me anything about your studies</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown className="text-sm prose prose-sm max-w-none prose-p:my-2 prose-headings:my-2">
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
                <div className="bg-slate-100 rounded-2xl px-5 py-3">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 border-t border-slate-200 bg-white/50">
            <div className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1 bg-white border-purple-200 focus:border-purple-400"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}