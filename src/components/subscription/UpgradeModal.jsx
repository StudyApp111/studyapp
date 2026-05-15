import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Gift, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useSubscription, FEATURE_LABELS, FREE_DAILY_LIMITS } from './SubscriptionContext';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import ContinueOnDesktopCard from './ContinueOnDesktopCard';
import posthog from 'posthog-js';

export default function UpgradeModal({ open, onOpenChange, reason = 'default' }) {
  const { refreshUser, user } = useSubscription();
  const { isDark } = useTheme();
  const isMobile = useIsMobile();
  
  const [isYearly, setIsYearly] = useState(true);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const monthlyPrice = 14.99;
  const yearlyPrice = 10.99;
  const yearlySavings = Math.round(((monthlyPrice * 12 - yearlyPrice * 12) / (monthlyPrice * 12)) * 100);

  // Context-aware headline based on what the user just hit.
  // `reason` is the feature key passed to triggerUpgradeModal().
  const featureLabel = FEATURE_LABELS[reason];
  const dailyLimit = FREE_DAILY_LIMITS[reason];
  const headline = featureLabel
    ? `Unlock unlimited ${featureLabel.toLowerCase()}`
    : 'Know your grade before the exam.';
  const subhead = featureLabel && dailyLimit
    ? `You've used your ${dailyLimit} free ${featureLabel.toLowerCase()} today. Upgrade for unlimited access — cancel anytime.`
    : 'Unlimited access — cancel anytime.';

  const handleStartTrial = async () => {
    setCheckoutLoading(true);
    try {
      const planType = isYearly ? 'yearly' : 'monthly';
      try {
        posthog.capture('checkout_started', {
          plan_type: planType,
          source: 'upgrade_modal',
          reason,
          device_type: window.innerWidth >= 768 ? 'desktop' : 'mobile',
        });
      } catch {}
      const pricingUrl = `${window.location.origin}/PricingPlans`;
      const response = await base44.functions.invoke('createCheckoutSession', {
        plan_type: planType,
        trial: false,
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
          onOpenChange(false);
          setPromoCode('');
          setPromoResult(null);
          setShowPromoInput(false);
        }, 1500);
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

  // -----------------------------------------------------------------------
  // Theme tokens — keeps the rest of the JSX clean.
  // -----------------------------------------------------------------------
  const t = isDark
    ? {
        surface: 'bg-gradient-to-br from-[#1a1040] via-[#2a1560] to-[#1a1040] border border-purple-500/40',
        heading: 'text-white',
        sub: 'text-purple-300',
        priceMain: 'text-white',
        priceSub: 'text-purple-300',
        priceMuted: 'text-purple-300/70',
        toggleActive: 'text-white',
        toggleIdle: 'text-white/40',
        featureText: 'text-white/90',
        check: 'text-emerald-400',
        closeBtn: 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white',
        promoBtn: 'text-purple-300/60 hover:text-purple-200',
        promoInputWrap: 'bg-white/10 border-purple-500/30 text-white placeholder:text-purple-300/50',
        promoOk: 'bg-emerald-500/20 text-emerald-300',
        promoErr: 'bg-red-500/20 text-red-300',
        shadow: 'shadow-2xl shadow-purple-500/20'
      }
    : {
        surface: 'bg-white border border-slate-200',
        heading: 'text-slate-900',
        sub: 'text-slate-500',
        priceMain: 'text-slate-900',
        priceSub: 'text-slate-500',
        priceMuted: 'text-slate-400',
        toggleActive: 'text-slate-900',
        toggleIdle: 'text-slate-400',
        featureText: 'text-slate-700',
        check: 'text-emerald-600',
        closeBtn: 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700',
        promoBtn: 'text-slate-400 hover:text-slate-600',
        promoInputWrap: 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400',
        promoOk: 'bg-emerald-50 text-emerald-700',
        promoErr: 'bg-red-50 text-red-700',
        shadow: 'shadow-2xl'
      };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="
          p-0 border-0 bg-transparent overflow-hidden [&>button]:hidden
          w-screen max-w-none h-[100dvh] rounded-none
          sm:w-[calc(100vw-24px)] sm:max-w-sm sm:h-auto sm:rounded-2xl
        "
        style={{
          // Respect iOS safe area on the full-screen mobile sheet.
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`relative ${t.surface} ${t.shadow} h-full sm:h-auto rounded-none sm:rounded-2xl flex flex-col sm:block overflow-y-auto sm:overflow-visible`}
        >
          {/* Close — 44×44 tap target, positioned outside iOS gesture zone */}
          <button 
            onClick={handleClose}
            aria-label="Close"
            className={`absolute top-3 right-3 z-20 w-11 h-11 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors ${t.closeBtn}`}
          >
            <X className="w-5 h-5" />
          </button>

          {/* ── MOBILE PATH ──────────────────────────────────────────────
             On a phone, we don't surface in-app subscription mechanics.
             Instead we offer to email the user a link to continue their
             StudyApp session on a computer — that's where the full
             experience (predicted grade dashboard, custom study plans,
             side-by-side workspace) actually lives.
             This is product/experience messaging, NOT a "buy elsewhere"
             pitch, which keeps us aligned with App Store / Play Store
             review guidelines. */}
          {isMobile ? (
            <>
              <div className="flex-1 sm:flex-none" />
              <div className="px-5 pt-10 pb-3 text-center">
                <h2 className={`text-2xl font-black mb-2 leading-tight ${t.heading}`}>
                  You've made great progress today
                </h2>
                <p className={`text-sm ${t.sub}`}>
                  {featureLabel
                    ? `You've used your free ${featureLabel.toLowerCase()} for today. The full StudyApp study experience lives on your computer — let's get you there.`
                    : 'The full StudyApp study experience lives on your computer — let\'s get you there.'}
                </p>
              </div>
              <div className="px-5 pb-5">
                <ContinueOnDesktopCard
                  reason="limit_reached"
                  variant="modal"
                  userEmail={user?.email}
                />
                <p className={`text-center text-[11px] mt-4 leading-relaxed ${t.priceMuted}`}>
                  Keep exploring StudyApp here on your phone — you can come back tomorrow when your daily activities reset.
                </p>
              </div>
              <div className="flex-1 sm:flex-none" />
            </>
          ) : (
            <>
          {/* Spacer on mobile so content centers nicely */}
          <div className="flex-1 sm:flex-none" />

          <div className="px-5 pt-7 sm:pt-5 pb-3 text-center">
            <h2 className={`text-2xl sm:text-xl font-black mb-1.5 leading-tight ${t.heading}`}>
              {headline}
            </h2>
            <p className={`text-xs ${t.sub}`}>{subhead}</p>
          </div>

          {/* Price display */}
          <div className="px-5 pb-2 text-center">
            <div className="flex items-baseline justify-center gap-1.5">
              {isYearly && <span className={`text-sm line-through ${t.priceSub}`}>${monthlyPrice}/mo</span>}
              <span className={`text-3xl sm:text-2xl font-black ${t.priceMain}`}>${isYearly ? yearlyPrice : monthlyPrice}</span>
              <span className={`text-sm ${t.priceSub}`}>/mo</span>
            </div>
            <p className={`text-[11px] mt-0.5 ${t.priceMuted}`}>
              Only ${isYearly ? '0.37' : '0.50'}/day · Cancel anytime
            </p>
          </div>
            
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-2 px-5 pb-3">
            <span className={`text-xs font-medium ${!isYearly ? t.toggleActive : t.toggleIdle}`}>Monthly</span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-emerald-500 scale-90"
            />
            <span className={`text-xs font-medium ${isYearly ? t.toggleActive : t.toggleIdle}`}>Yearly</span>
            {isYearly && <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0">Save {yearlySavings}%</Badge>}
          </div>

          {/* Features */}
          <div className="px-5 pb-3">
            <div className="space-y-2 sm:space-y-1.5">
              {features.map((feature, i) => (
                <div key={i} className={`flex items-start gap-2 ${t.featureText}`}>
                  <Check className={`w-4 h-4 sm:w-3.5 sm:h-3.5 flex-shrink-0 mt-0.5 ${t.check}`} />
                  <span className="text-xs sm:text-[11px] leading-snug">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="px-5 pb-5 sm:pb-4">
            <Button
              onClick={handleStartTrial}
              disabled={checkoutLoading}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-4 sm:py-3 text-base sm:text-sm rounded-xl shadow-lg shadow-purple-500/30 min-h-[52px] sm:min-h-0"
            >
              {checkoutLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Upgrade to Pro
            </Button>
            <p className={`text-center text-[10px] mt-2 leading-tight ${t.priceMuted}`}>
              Cancel anytime
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
                  className={`w-full flex items-center justify-center gap-1 text-[11px] transition-colors mt-2 py-2 ${t.promoBtn}`}
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
                      className={`flex-1 uppercase text-xs h-9 ${t.promoInputWrap}`}
                      disabled={promoLoading}
                      maxLength={20}
                    />
                    <Button
                      onClick={handlePromoSubmit}
                      disabled={promoLoading || !promoCode.trim()}
                      className="bg-purple-600 hover:bg-purple-500 px-3 h-9 text-xs"
                    >
                      {promoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                  {promoResult && (
                    <div className={`flex items-center gap-1.5 text-[10px] p-2 rounded ${
                      promoResult.success ? t.promoOk : t.promoErr
                    }`}>
                      {promoResult.success ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      <span>{promoResult.message}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom spacer on mobile */}
          <div className="flex-1 sm:flex-none" />
            </>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}