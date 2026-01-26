import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skull, Zap, X, Check, Sparkles, Lock, Infinity, Gift, Loader2, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useSubscription } from './SubscriptionContext';
import { useTheme } from '@/components/theme/ThemeProvider';

const LIMIT_MESSAGES = {
  uploads: {
    title: "Weekly Upload Limit Reached",
    description: "Free users can upload 2 documents per week.",
    icon: "📄"
  },
  upload: {
    title: "Weekly Upload Limit Reached",
    description: "Free users can upload 2 documents per week.",
    icon: "📄"
  },
  tasks: {
    title: "Daily Task Limit Reached", 
    description: "Free users can complete 1 study task per day.",
    icon: "📝"
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
  const { refreshUser } = useSubscription();
  const { isDark } = useTheme();
  const limitInfo = LIMIT_MESSAGES[reason] || LIMIT_MESSAGES.default;
  
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleSelectPlan = async () => {
    setCheckoutLoading(true);
    try {
      const response = await base44.functions.invoke('createCheckoutSession', {
        plan_type: selectedPlan
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
        // Close modal after success
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
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 bg-transparent">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          {/* Close button */}
          <button 
            onClick={handleClose}
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
          <div className={`p-6 -mt-4 rounded-t-3xl relative ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
            {/* Plan Selection */}
            <div className="space-y-3 mb-6">
              {/* Yearly Plan */}
              <button
                onClick={() => setSelectedPlan('yearly')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left relative ${
                  selectedPlan === 'yearly'
                    ? 'border-purple-500 bg-purple-500/10'
                    : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                  SAVE 50%
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPlan === 'yearly' ? 'border-purple-500 bg-purple-500' : isDark ? 'border-white/30' : 'border-slate-300'
                    }`}>
                      {selectedPlan === 'yearly' && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Annual</p>
                      <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Billed yearly</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>$4.99<span className="text-xs font-normal">/mo</span></p>
                    <p className={`text-[10px] line-through ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>$9.99/mo</p>
                  </div>
                </div>
              </button>

              {/* Monthly Plan */}
              <button
                onClick={() => setSelectedPlan('monthly')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  selectedPlan === 'monthly'
                    ? 'border-purple-500 bg-purple-500/10'
                    : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPlan === 'monthly' ? 'border-purple-500 bg-purple-500' : isDark ? 'border-white/30' : 'border-slate-300'
                    }`}>
                      {selectedPlan === 'monthly' && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Monthly</p>
                      <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Billed monthly</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>$9.99<span className="text-xs font-normal">/mo</span></p>
                  </div>
                </div>
              </button>
            </div>

            {/* Features */}
            <div className={`rounded-xl p-3 mb-4 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>What you get</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <Infinity className="w-3 h-3 text-purple-500" />
                  <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Unlimited uploads</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Infinity className="w-3 h-3 text-purple-500" />
                  <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Unlimited tasks</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Infinity className="w-3 h-3 text-purple-500" />
                  <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Unlimited AI</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>AI Forensics</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Button
              onClick={handleSelectPlan}
              disabled={checkoutLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-6 text-base rounded-xl shadow-lg shadow-purple-500/30"
            >
              {checkoutLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Zap className="w-5 h-5 mr-2" />
              )}
              Select Plan
            </Button>

            <p className={`text-center text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Cancel anytime • Secure checkout
            </p>

            {/* Promo Code Section */}
            <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
              <AnimatePresence mode="wait">
                {!showPromoInput ? (
                  <motion.button
                    key="promo-trigger"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowPromoInput(true)}
                    className={`w-full flex items-center justify-center gap-2 text-sm transition-colors py-2 ${isDark ? 'text-slate-400 hover:text-purple-400' : 'text-slate-500 hover:text-purple-600'}`}
                  >
                    <Gift className="w-4 h-4" />
                    Have a promo code?
                  </motion.button>
                ) : (
                  <motion.div
                    key="promo-input"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter promo code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handlePromoSubmit()}
                        className="flex-1 uppercase"
                        disabled={promoLoading}
                        maxLength={20}
                      />
                      <Button
                        onClick={handlePromoSubmit}
                        disabled={promoLoading || !promoCode.trim()}
                        className="bg-purple-600 hover:bg-purple-700 px-4"
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
                        className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                          promoResult.success 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {promoResult.success ? (
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
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