import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skull, Zap, X, Check, Sparkles, Lock, Infinity } from 'lucide-react';
import { motion } from 'framer-motion';

const LIMIT_MESSAGES = {
  upload: {
    title: "Weekly Upload Limit Reached",
    description: "Free users can upload 2 documents per week.",
    icon: "📄"
  },
  task: {
    title: "Daily Task Limit Reached", 
    description: "Free users can complete 1 study task per day.",
    icon: "📝"
  },
  ai_message: {
    title: "Daily AI Message Limit Reached",
    description: "Free users can send 10 AI messages per day.",
    icon: "💬"
  },
  polly: {
    title: "Advanced Grade Prediction Locked",
    description: "Unlock AI-powered grade forensics and personalized roadmaps.",
    icon: "🔮"
  },
  default: {
    title: "Upgrade to Locked In",
    description: "Unlock unlimited access to all features.",
    icon: "🚀"
  }
};

export default function UpgradeModal({ open, onOpenChange, reason = 'default' }) {
  const navigate = useNavigate();
  const limitInfo = LIMIT_MESSAGES[reason] || LIMIT_MESSAGES.default;

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate(createPageUrl("PricingPlans"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 bg-transparent">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          {/* Close button */}
          <button 
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header - Gradient */}
          <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 p-6 pb-8">
            <div className="text-center">
              <div className="text-5xl mb-3">{limitInfo.icon}</div>
              <h2 className="text-xl font-bold text-white mb-2">{limitInfo.title}</h2>
              <p className="text-purple-200 text-sm">{limitInfo.description}</p>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white p-6 -mt-4 rounded-t-3xl relative">
            {/* Comparison */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {/* Free Tier */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <Skull className="w-5 h-5 text-slate-500" />
                  <span className="font-bold text-slate-700 text-sm">Good Luck</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="text-slate-400">2</span> uploads/week
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-slate-400">1</span> task/day
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-slate-400">10</span> AI msgs/day
                  </li>
                  <li className="flex items-center gap-2 text-slate-400">
                    <Lock className="w-3 h-3" /> Basic prediction
                  </li>
                </ul>
              </div>

              {/* Pro Tier */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border-2 border-purple-300 relative">
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                  BEST
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-purple-600" />
                  <span className="font-bold text-purple-700 text-sm">Locked In</span>
                </div>
                <ul className="space-y-2 text-xs text-purple-700">
                  <li className="flex items-center gap-2">
                    <Infinity className="w-3 h-3 text-purple-500" /> Unlimited uploads
                  </li>
                  <li className="flex items-center gap-2">
                    <Infinity className="w-3 h-3 text-purple-500" /> Unlimited tasks
                  </li>
                  <li className="flex items-center gap-2">
                    <Infinity className="w-3 h-3 text-purple-500" /> Unlimited AI
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-purple-500" /> AI Forensics
                  </li>
                </ul>
              </div>
            </div>

            {/* CTA */}
            <Button
              onClick={handleUpgrade}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-6 text-base rounded-xl shadow-lg shadow-purple-500/30"
            >
              <Zap className="w-5 h-5 mr-2" />
              Upgrade to Locked In
            </Button>

            <p className="text-center text-xs text-slate-400 mt-3">
              Starting at $4.99/mo • Cancel anytime
            </p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}