import React, { useRef, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, FileText, HelpCircle, List, Lightbulb, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { useSubscription } from "@/components/subscription/SubscriptionContext";
import { renderMathContent } from "@/components/utils/MathRenderer";
import { useTheme } from "@/components/theme/ThemeProvider";

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
      
      setMessages([{
        role: "assistant",
        content: `👋 Hey there! I'm **Polly**, your personal AI study assistant for **${courseName}**.${pollyInsight}

---

### 🎯 Your first step: Take the Diagnostic Quiz

Head over to the **Practice** tab and complete the **5-question diagnostic**. Don't worry if you don't know the answers — that's the whole point!

I use your responses to **predict your grade** and pinpoint exactly where you need to focus.

---

### ✨ Once you finish, here's what unlocks:

- 📊 A **custom Study Plan** built around your weak spots
- 🃏 **AI Flashcards** that target what you need to memorize
- 🧠 **Feynman Cards** to test if you *truly* understand concepts
- 📝 **Practice Quizzes** with instant feedback
- 📖 **Smart Notes** & **Voice Lectures** generated from your materials

---

I'll be right here to explain anything, quiz you, or help you study. **Let's start with the diagnostic — tap the Practice tab!** 🚀`
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

    // Check AI message limit BEFORE sending
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

  return (
    <div className={`flex-1 rounded-xl shadow-xl border flex flex-col overflow-hidden relative z-10 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-purple-200'}`} style={{ height: '100%' }}>
      {/* Header */}
      <div className={`rounded-t-xl px-4 py-3 flex items-center gap-3 shadow-lg flex-shrink-0 relative z-20 ${isDark ? 'bg-gradient-to-r from-purple-700 to-purple-800' : 'bg-gradient-to-r from-purple-600 to-indigo-600'}`}>
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">Polly</h3>
          <p className="text-xs text-white/80">Your AI study buddy</p>
        </div>
      </div>

      {/* Quick Actions - Always visible above input as pills */}

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-3 space-y-2.5 ${isDark ? 'bg-gradient-to-b from-purple-900/10 to-[#12121a]' : 'bg-slate-50'}`}>
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-md'
                  : isDark ? 'bg-[#1a1a2e] text-slate-200 shadow-sm border border-white/10' : 'bg-white text-slate-800 shadow-sm border border-slate-200'
              }`}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown 
                  className="text-[13px] leading-relaxed prose prose-sm max-w-none [&>p]:my-1 [&>ul]:my-1.5 [&>ul]:ml-3 [&>ol]:my-1.5 [&>ol]:ml-3 [&>li]:my-0.5"
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input with Quick Action Pills */}
      <div className={`p-3 border-t rounded-b-xl flex-shrink-0 space-y-2 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'}`}>
        {/* Quick Actions Pills - Always visible */}
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleSend(action.prompt)}
              disabled={isLoading}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all text-[11px] font-medium whitespace-nowrap ${isDark ? 'bg-purple-600/20 border-purple-500/30 hover:bg-purple-600/30 hover:border-purple-500/50 text-purple-300' : 'bg-purple-100 border-purple-200 hover:bg-purple-200 text-purple-700'}`}
            >
              <action.icon className="w-3 h-3" />
              {action.label}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={hasDocument ? "Ask about your document..." : "Ask me anything..."}
            disabled={isLoading}
            className={`flex-1 focus-visible:ring-purple-500 text-[13px] rounded-xl h-10 ${isDark ? 'bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
          />
          <Button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded-xl shadow-md h-9 w-9"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}