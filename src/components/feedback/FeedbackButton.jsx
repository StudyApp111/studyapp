import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setEmail(user.email || "");
        setName(user.full_name || "");
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    
    if (isOpen) {
      loadUser();
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);

    try {
      await base44.functions.invoke('sendFeedback', {
        name,
        email,
        message
      });

      setSent(true);
      setTimeout(() => {
        setIsOpen(false);
        setSent(false);
        setMessage("");
      }, 2000);
    } catch (error) {
      console.error("Error sending feedback:", error);
      alert("Failed to send feedback. Please try again.");
    }

    setIsSending(false);
  };

  return (
    <>
      {/* Floating Feedback Button - Positioned to avoid mobile nav */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50"
      >
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          className="h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 transition-all hover:scale-110 border-2 border-white"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      </motion.div>

      {/* Feedback Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <MessageCircle className="w-5 h-5 text-purple-600" />
              Send Feedback
            </DialogTitle>
            <DialogDescription>
              We'd love to hear your thoughts! Send us your feedback or suggestions.
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Feedback Sent!
                </h3>
                <p className="text-slate-600 text-sm">
                  Thank you for helping us improve StudyApp.AI
                </p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Name (Optional)</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Your Feedback *</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what you think or suggest improvements..."
                    className="min-h-[120px]"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    disabled={isSending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSending || !email || !message}
                    className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
                  >
                    {isSending ? (
                      <>
                        <Send className="w-4 h-4 mr-2 animate-pulse" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Feedback
                      </>
                    )}
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}