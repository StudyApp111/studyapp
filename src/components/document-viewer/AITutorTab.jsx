import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function AITutorTab({ lesson, extractedContent }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    initializeConversation();
  }, [lesson?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const initializeConversation = async () => {
    try {
      setIsInitializing(true);
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({
        id: user.learning_profile_id
      });
      const learningProfile = profile[0] || {};

      // Create conversation with context
      const contextMessage = `Student Context:
- School: ${learningProfile.school || "N/A"}
- Grade Level: ${learningProfile.grade || "N/A"}
- Course: ${lesson?.course_name || "N/A"}

Lesson Content (OCR Transcript):
${extractedContent || lesson?.description || "No content available"}

---

Please help the student understand this material. Tailor your responses to their grade level and use the lesson content as your reference.`;

      const conv = await base44.agents.createConversation({
        agent_name: "aiTutor",
        metadata: {
          lesson_id: lesson?.id,
          course_name: lesson?.course_name
        }
      });

      setConversation(conv);

      // Add initial context message (hidden from UI)
      await base44.agents.addMessage(conv, {
        role: "user",
        content: contextMessage
      });

      // Get welcome message
      const welcomeMsg = await base44.agents.addMessage(conv, {
        role: "user",
        content: "Hello! I'm ready to learn."
      });

      setMessages(welcomeMsg.messages.filter(m => m.role === "assistant"));
    } catch (error) {
      console.error("Error initializing conversation:", error);
      setMessages([{
        role: "assistant",
        content: "Hi! I'm your AI tutor. I'm here to help you understand the course material. What would you like to learn about?"
      }]);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !conversation || isLoading) return;

    const userInput = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      const updatedConv = await base44.agents.addMessage(conversation, {
        role: "user",
        content: userInput
      });

      setMessages(updatedConv.messages.filter(m => 
        m.role === "assistant" || m.role === "user"
      ).slice(1)); // Skip the initial context message
      setConversation(updatedConv);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col h-[calc(100vh-200px)] bg-white/90 border border-purple-200 backdrop-blur-xl rounded-xl shadow-xl">
        <div className="border-b border-purple-200 px-6 py-4">
          <div className="flex items-center gap-2 text-slate-900 font-semibold">
            <MessageCircle className="w-5 h-5" />
            AI Tutor
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white/90 border border-purple-200 backdrop-blur-xl rounded-xl shadow-xl">
      <div className="border-b border-purple-200 px-6 py-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold">
          <MessageCircle className="w-5 h-5" />
          AI Tutor
        </div>
      </div>

      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-purple-600 text-white"
                    : "bg-slate-100 text-slate-900"
                }`}
              >
                {message.role === "assistant" ? (
                  <ReactMarkdown className="prose prose-sm prose-slate max-w-none">
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 text-slate-900 rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-purple-200 p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question about your course..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}