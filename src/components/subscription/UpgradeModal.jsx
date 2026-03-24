import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Gift, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useSubscription } from './SubscriptionContext';
import { useTheme } from '@/components/theme/ThemeProvider';
import posthog from 'posthog-js';

export default function UpgradeModal({ open, onOpenChange, reason = 'default' }) {
  const { refreshUser } = useSubscription();
  const { isDark } = useTheme();
  
  const [isYearly, setIsYearly] = useState(false);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const monthlyPrice = 14.99;
  const yearlyPrice = 10.99;
  const yearlySavings = Math.round(((monthlyPrice * 12 - yearlyPrice * 12) / (monthlyPrice * 12)) * 100);

  const handleStartTrial = async () => {
    setCheckoutLoading(true);
    try {
      const planType = isYearly ? 'yearly' : 'monthly';
      try {
        posthog.capture('checkout_started', {
          plan_type: planType,
          source: 'upgrade_modal',
          device_type: window.innerWidth >= 768 ? 'desktop' : 'mobile',
        });
      } catch {}
      const pricingUrl = `${window.location.origin}/PricingPlans`;
      const response = await base44.functions.invoke('createCheckoutSession', {
        plan_type: planType,
        trial: true,
        success_url: `${pricingUrl}?success=true&plan=${planType}`,
        cancel_url: window.location.href
      });
      
      if (response.data?.url || response.data?.checkout_url) {
        window.location.href = response.data.url || response.data.checkout_url;
      } else if (response.data?.error) {
        console.error('Checkout error:', response.data.error);
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
      const response = await base44.functions.invoke('redeemPromoCode', { code: promoCode.trim() });
      if (response.data?.success) {
        setPromoResult({ success: true, message: response.data.message });
        await refreshUser();
        setTimeout(() => {
          onOpenChange(true);
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

  const features = [
    'Know if you\'ll pass before you study',
    'AI finds exactly what you\'re weak at',
    'Unlimited courses and diagnostics',
    'Study plan built around your gaps',
    'Watch your predicted grade improve',
    '24/7 AI tutor that knows your material'
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-sm p-0 border-0 bg-transparent [&>button]:hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative bg-gradient-to-br from-[#1a1040] via-[#2a1560] to-[#1a1040] rounded-2xl border border-purple-500/40 shadow-2xl shadow-purple-500/20"
        >
          <button 
            onClick={handleClose}
            className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            ✕
          </button>

          <div className="px-4 pt-5 pb-3 text-center">
            <h2 className="text-xl font-black text-white mb-1 leading-tight">
              Know your grade before the exam.
            </h2>
            <p className="text-purple-300 text-xs">7 days free — no credit card needed.</p>
          </div>

          {/* Price display */}
          <div className="px-4 pb-2 text-center">
            <div className="flex items-baseline justify-center gap-1.5">
              {isYearly && <span className="text-purple-400 text-sm line-through">${monthlyPrice}/mo</span>}
              <span className="text-2xl font-black text-white">${isYearly ? yearlyPrice : monthlyPrice}</span>
              <span className="text-purple-300 text-sm">/mo</span>
            </div>
            <p className="text-purple-300/70 text-[11px] mt-0.5">
              Only ${isYearly ? '0.37' : '0.50'}/day · Cancel anytime
            </p>
          </div>
            
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-2 px-4 pb-3">
            <span className={`text-xs font-medium ${!isYearly ? 'text-white' : 'text-white/40'}`}>Monthly</span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-emerald-500 scale-90"
            />
            <span className={`text-xs font-medium ${isYearly ? 'text-white' : 'text-white/40'}`}>Yearly</span>
            {isYearly && <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0">Save {yearlySavings}%</Badge>}
          </div>

          {/* Features */}
          <div className="px-4 pb-3">
            <div className="space-y-1.5">
              {features.map((feature, i) => (
                <div key={i} className="flex items-start gap-2 text-white/90">
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-tight">{feature}</span>
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
              Start My Free 7 Days
            </Button>
            <p className="text-center text-[9px] text-purple-300/60 mt-1.5 leading-tight">
              No credit card required · You won't be charged until the trial ends
            </p>

            {/* Promo Code */}
            <AnimatePresence mode="wait">
              {!showPromoInput ? (
                <motion.button
                  key="promo-trigger"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowPromoInput(true)}
                  className="w-full flex items-center justify-center gap-1 text-[10px] text-purple-300/50 hover:text-purple-200 transition-colors mt-2"
                >
                  <Gift className="w-3 h-3" />
                  Have a promo code?
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