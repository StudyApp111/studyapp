import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Info } from "lucide-react";

export default function DocChat({ contextText }) {
  const [messages, setMessages] = useState([
    { role: "system", content: "AI Tutor ready. (Model and prompt to be configured)", ts: Date.now() },
  ]);
  const [input, setInput] = useState("");

  const onSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: "user", content: input.trim(), ts: Date.now() }]);
    // Placeholder assistant echo (no LLM wired yet)
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "I'll answer based on your document once the model & prompt are set.", ts: Date.now() },
      ]);
    }, 300);
    setInput("");
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl border shadow-sm">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-purple-600" />
        <p className="text-sm font-medium text-slate-800">AI Tutor</p>
        <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
          <Info className="w-3.5 h-3.5" />
          <span>Context loaded ({contextText ? contextText.length : 0} chars)</span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-3">
          {messages.map((m, idx) => (
            <div key={idx} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={
                  "inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm " +
                  (m.role === "user"
                    ? "bg-purple-600 text-white"
                    : m.role === "assistant"
                    ? "bg-slate-100 text-slate-800"
                    : "bg-amber-50 text-amber-900 border border-amber-200")
                }
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <form onSubmit={onSend} className="p-3 border-t flex items-center gap-2">
        <Input
          placeholder="Ask about your document..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="text-sm"
        />
        <Button type="submit" className="gap-2 bg-purple-600 hover:bg-purple-700">
          <Send className="w-4 h-4" />
          Send
        </Button>
      </form>
    </div>
  );
}