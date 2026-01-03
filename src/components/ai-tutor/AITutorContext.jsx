import React, { createContext, useContext, useState } from "react";

const AITutorContext = createContext(null);

export function AITutorProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState(null);
  const [messages, setMessages] = useState([]);

  const openWithContext = (newContext) => {
    setContext(newContext);
    setMessages([]); // Reset messages for new context
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  const clearContext = () => {
    setContext(null);
    setMessages([]);
  };

  return (
    <AITutorContext.Provider value={{ 
      isOpen, 
      setIsOpen,
      context, 
      setContext,
      messages,
      setMessages,
      openWithContext, 
      close,
      clearContext
    }}>
      {children}
    </AITutorContext.Provider>
  );
}

export function useAITutor() {
  const context = useContext(AITutorContext);
  if (!context) {
    throw new Error("useAITutor must be used within AITutorProvider");
  }
  return context;
}