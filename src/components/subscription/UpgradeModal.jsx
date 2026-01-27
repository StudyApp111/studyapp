import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Check, Zap, Gift, Loader2, CheckCircle2, AlertCircle, Calendar, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useSubscription } from './SubscriptionContext';
import { useTheme } from '@/components/theme/ThemeProvider';

const LIMIT_MESSAGES = {
  uploads: {
    title: "Start Your Free Trial",
    description: "Upload unlimited study materials with Pro.",
    icon: "📄"
  },
  upload: {
    title: "Start Your Free Trial",
    description: "Upload unlimited study materials with Pro.",
    icon: "📄"
  },
  tasks: {
    title: "Start Your Free Trial", 
    description: "Complete unlimited study tasks with Pro.",
    icon: "📝"
  },
  task: {
    title: "Start Your Free Trial", 
    description: "Complete unlimited study tasks with Pro.",
    icon: "📝"
  },
  ai_message: {
    title: "Daily AI Message Limit Reached",
    description: "Free users can send 10 AI messages per day.",
    icon: "💬"
  },
  assignments: {
    title: "Start Your Free Trial",
    description: "Grade unlimited assignments with Pro.",
    icon: "📝"
  },
  polly: {
    title: "Start Your Free Trial",
    description: "Unlock AI-powered grade forensics and personalized roadmaps.",
    icon: "🔮"
  },
  default: {
    title: "Start Your 7-Day Free Trial",
    description: "Unlock unlimited access to all features.",
    icon: "🚀"
  }
};

export default function UpgradeModal({ open, onOpenChange, reason = 'default' }) {
  const { refreshUser } = useSubscription();
  const { isDark } = useTheme();
  const limitInfo = LIMIT_MESSAGES[reason] || LIMIT_MESSAGES.default;
  
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleStartTrial = async () => {
    setCheckoutLoading(true);
    try {
      const response = await base44.functions.invoke('createCheckoutSession', {
        plan_type: 'monthly',
        trial: true
      });
      
      if (response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePromoSubmit = async () => {
    if (!promoCode.trim()) return;
    
    setPromoLoading(true);
    setPromoResult(null);
    
    try {
      const response = await base44.functions.invoke('redeemPromoCode', {
        code: promoCode.trim()
      });
      
      if (response.data?.success) {
        setPromoResult({ success: true, message: response.data.message });
        await refreshUser();
        setTimeout(() => {
          onOpenChange(false);
          setPromoCode('');
          setPromoResult(null);
          setShowPromoInput(false);
        }, 2000);
      } else {
        setPromoResult({ success: false, message: response.data?.error || 'Invalid code' });
      }
    } catch (error) {
      setPromoResult({ success: false, message: 'Something went wrong. Try again.' });
    } finally {
      setPromoLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setPromoCode('');
    setPromoResult(null);
    setShowPromoInput(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-md p-0 overflow-hidden border-0 bg-transparent max-h-[90vh] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          {/* Close button */}
          <button 
            onClick={handleClose}
            className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header - Gradient - Compact on mobile */}
          <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 p-4 sm:p-6 pb-6 sm:pb-8">
            <div className="text-center">
              <div className="text-4xl sm:text-5xl mb-2">{limitInfo.icon}</div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-1">{limitInfo.title}</h2>
              <p className="text-purple-200 text-xs sm:text-sm mb-2">{limitInfo.description}</p>
              
              {/* Trial Badge */}
              <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-yellow-300" />
                <span className="text-white font-bold text-xs sm:text-sm">7 Days Free</span>
                <span className="text-white/70 text-xs">• $6.99/mo</span>
              </div>
            </div>
          </div>

          {/* Content - Compact on mobile */}
          <div className={`p-4 sm:p-6 -mt-3 rounded-t-2xl relative ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
            {/* What you get - Condensed */}
            <div className={`rounded-xl p-3 mb-4 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
              <p className={`text-[9px] font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>What you get with Pro</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Unlimited uploads</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Unlimited tasks</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Unlimited AI chat</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Unlimited grading</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Grade predictions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Study roadmaps</span>
                </div>
              </div>
            </div>

            {/* Trial Info Box - Compact */}
            <div className={`rounded-xl p-3 mb-4 border border-dashed ${isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className={`font-bold text-xs ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>How it works</p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Try free for 7 days • Cancel anytime • $6.99/mo after</p>
                </div>
              </div>
            </div>

            {/* CTA - Slightly smaller on mobile */}
            <Button
              onClick={handleStartTrial}
              disabled={checkoutLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-4 sm:py-5 text-sm sm:text-base rounded-xl shadow-lg shadow-purple-500/30"
            >
              {checkoutLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Start 7-Day Free Trial
            </Button>

            <p className={`text-center text-[10px] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Cancel anytime • No charge for 7 days
            </p>

            {/* Promo Code Section - Compact */}
            <div className={`mt-3 pt-3 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
              <AnimatePresence mode="wait">
                {!showPromoInput ? (
                  <motion.button
                    key="promo-trigger"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowPromoInput(true)}
                    className={`w-full flex items-center justify-center gap-1.5 text-xs transition-colors py-1.5 ${isDark ? 'text-slate-400 hover:text-purple-400' : 'text-slate-500 hover:text-purple-600'}`}
                  >
                    <Gift className="w-3.5 h-3.5" />
                    Have a promo code?
                  </motion.button>
                ) : (
                  <motion.div
                    key="promo-input"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter promo code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handlePromoSubmit()}
                        className="flex-1 uppercase text-sm h-9"
                        disabled={promoLoading}
                        maxLength={20}
                      />
                      <Button
                        onClick={handlePromoSubmit}
                        disabled={promoLoading || !promoCode.trim()}
                        className="bg-purple-600 hover:bg-purple-700 px-3 h-9"
                      >
                        {promoLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Apply'
                        )}
                      </Button>
                    </div>
                    
                    {promoResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
                          promoResult.success 
                            ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
                            : (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-700')
                        }`}
                      >
                        {promoResult.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        )}
                        <span>{promoResult.message}</span>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}