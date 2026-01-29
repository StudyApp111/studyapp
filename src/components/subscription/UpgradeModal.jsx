import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
  
  const [isYearly, setIsYearly] = useState(true); // Default to yearly
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const monthlyPrice = 6.99;
  const yearlyPrice = 4.99;
  const yearlySavings = 29;

  const handleStartTrial = async () => {
    setCheckoutLoading(true);
    try {
      const planType = isYearly ? 'yearly' : 'monthly';
      console.log('Starting checkout with plan_type:', planType);
      
      const response = await base44.functions.invoke('createCheckoutSession', {
        plan_type: planType,
        trial: true
      });
      
      console.log('Checkout response:', response);
      
      if (response.data?.url || response.data?.checkout_url) {
        window.location.href = response.data.url || response.data.checkout_url;
      } else if (response.data?.error) {
        console.error('Checkout error:', response.data.error, response.data.details);
        alert(`Error: ${response.data.error}${response.data.details ? ` (${response.data.details})` : ''}`);
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
      <DialogContent className="max-w-[calc(100vw-24px)] sm:max-w-sm p-0 overflow-hidden border-0 bg-transparent max-h-[85vh] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative bg-gradient-to-br from-purple-600/20 to-indigo-600/20 backdrop-blur-sm rounded-2xl border border-purple-500/50 shadow-2xl shadow-purple-500/20"
        >
          {/* Close button */}
          <button 
            onClick={handleClose}
            className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Header - More compact */}
          <div className="p-4 pb-3 text-center">
            {/* Trial badge */}
            <Badge className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white px-3 py-0.5 text-[10px] font-bold mb-3">
              🎉 7-DAY FREE TRIAL
            </Badge>
            
            <h2 className="text-lg font-black text-white mb-1">Locked In ⚡</h2>
            <p className="text-purple-200 text-xs mb-3">Start free, cancel anytime</p>
            
            {/* Price display */}
            <div className="mb-3">
              <span className="text-3xl font-black text-white">${isYearly ? yearlyPrice : monthlyPrice}</span>
              <span className="text-purple-300 text-sm">/mo</span>
              {isYearly && (
                <p className="text-emerald-400 text-[10px] mt-0.5">
                  Billed ${(yearlyPrice * 12).toFixed(2)}/year
                </p>
              )}
            </div>
            
            {/* Billing Toggle - Compact */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className={`text-[10px] font-medium ${!isYearly ? 'text-white' : 'text-white/50'}`}>Monthly</span>
              <Switch
                checked={isYearly}
                onCheckedChange={setIsYearly}
                className="data-[state=checked]:bg-emerald-500 scale-90"
              />
              <span className={`text-[10px] font-medium ${isYearly ? 'text-white' : 'text-white/50'}`}>
                Yearly
                {isYearly && <Badge className="ml-1 bg-emerald-500 text-white text-[8px] px-1 py-0">-{yearlySavings}%</Badge>}
              </span>
            </div>
          </div>

          {/* Features - Ultra compact */}
          <div className="px-4 pb-3">
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              {[
                'Unlimited everything',
                'Grade predictions', 
                'AI study coach',
                'Study roadmaps'
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-1 text-white/90">
                  <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="px-4 pb-4">
            <Button
              onClick={handleStartTrial}
              disabled={checkoutLoading}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3 text-sm rounded-xl shadow-lg shadow-purple-500/30"
            >
              {checkoutLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Start Free Trial
            </Button>
            <p className="text-center text-[9px] text-purple-300/70 mt-1.5">
              No charge for 7 days • Cancel anytime
            </p>

            {/* Promo Code - Minimal */}
            <AnimatePresence mode="wait">
              {!showPromoInput ? (
                <motion.button
                  key="promo-trigger"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowPromoInput(true)}
                  className="w-full flex items-center justify-center gap-1 text-[10px] text-purple-300/60 hover:text-purple-200 transition-colors mt-2"
                >
                  <Gift className="w-3 h-3" />
                  Promo code?
                </motion.button>
              ) : (
                <motion.div
                  key="promo-input"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-1.5"
                >
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="CODE"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handlePromoSubmit()}
                      className="flex-1 uppercase text-xs h-8 bg-white/10 border-purple-500/30 text-white placeholder:text-purple-300/50"
                      disabled={promoLoading}
                      maxLength={20}
                    />
                    <Button
                      onClick={handlePromoSubmit}
                      disabled={promoLoading || !promoCode.trim()}
                      className="bg-purple-600 hover:bg-purple-500 px-3 h-8 text-xs"
                    >
                      {promoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                  {promoResult && (
                    <div className={`flex items-center gap-1.5 text-[10px] p-1.5 rounded ${
                      promoResult.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                    }`}>
                      {promoResult.success ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      <span>{promoResult.message}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}