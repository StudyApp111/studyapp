import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, Check, X, Zap, Skull, Crown, Sparkles, 
  Infinity, Lock, Brain, Target, FileText, MessageSquare,
  Loader2, CheckCircle2
} from "lucide-react";
import { motion } from "framer-motion";

export default function PricingPlans() {
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();

    // Check for success parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setShowSuccess(true);
      // Clear the URL parameter
      window.history.replaceState({}, '', createPageUrl("PricingPlans"));
    }
  }, []);

  const isPro = user?.subscription_tier === 'pro' && user?.subscription_status === 'active';

  const monthlyPrice = 6.99;
  const yearlyPrice = 4.99;
  const yearlyTotal = yearlyPrice * 12;
  const yearlySavings = Math.round(((monthlyPrice * 12 - yearlyTotal) / (monthlyPrice * 12)) * 100);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('createCheckoutSession', {
        plan_type: isYearly ? 'yearly' : 'monthly',
        success_url: `${window.location.origin}${createPageUrl("PricingPlans")}?success=true`,
        cancel_url: `${window.location.origin}${createPageUrl("PricingPlans")}?canceled=true`
      });

      if (response.data?.checkout_url) {
        window.location.href = response.data.checkout_url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setLoading(false);
    }
  };

  // Success state
  if (showSuccess || isPro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">You're Locked In! 🔥</h1>
          <p className="text-slate-600 mb-6">
            Welcome to the pro squad. You now have unlimited access to everything.
          </p>
          <div className="flex items-center justify-center gap-2 mb-6">
            <Crown className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-purple-700">Locked In Member</span>
          </div>
          <Button
            onClick={() => navigate(createPageUrl("Home"))}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 py-6 text-lg"
          >
            Start Studying
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 text-white/70 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
              Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study Mode</span>
            </h1>
            <p className="text-purple-200 text-lg max-w-xl mx-auto">
              Are you here to wing it or win it?
            </p>
          </motion.div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm font-medium ${!isYearly ? 'text-white' : 'text-white/50'}`}>Monthly</span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-purple-500"
            />
            <span className={`text-sm font-medium ${isYearly ? 'text-white' : 'text-white/50'}`}>
              Yearly
              <Badge className="ml-2 bg-emerald-500 text-white text-xs">Save {yearlySavings}%</Badge>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          
          {/* Free Tier - Good Luck */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="relative bg-slate-800/50 backdrop-blur-sm rounded-3xl p-6 border border-slate-700"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-700 flex items-center justify-center">
                <Skull className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Good Luck 💀</h2>
                <p className="text-slate-400 text-sm">Free forever</p>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-black text-white">$0</span>
              <span className="text-slate-400 text-sm">/month</span>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-3 text-slate-300">
                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3 h-3 text-slate-400" />
                </div>
                <span className="text-sm">2 documents / week</span>
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <Target className="w-3 h-3 text-slate-400" />
                </div>
                <span className="text-sm">1 study task / day</span>
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-3 h-3 text-slate-400" />
                </div>
                <span className="text-sm">10 AI messages / day</span>
              </li>
              <li className="flex items-center gap-3 text-slate-400">
                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-3 h-3 text-slate-500" />
                </div>
                <span className="text-sm">Basic grade prediction</span>
              </li>
              <li className="flex items-center gap-3 text-slate-500">
                <div className="w-5 h-5 rounded-full bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                  <X className="w-3 h-3 text-slate-600" />
                </div>
                <span className="text-sm line-through">AI forensics & roadmap</span>
              </li>
            </ul>

            <Button
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 py-5"
              disabled
            >
              Current Plan
            </Button>
          </motion.div>

          {/* Pro Tier - Locked In */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="relative bg-gradient-to-br from-purple-600/30 to-indigo-600/30 backdrop-blur-sm rounded-3xl p-6 border-2 border-purple-500 shadow-2xl shadow-purple-500/20"
          >
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-4 py-1 text-xs font-bold shadow-lg">
                🔥 MOST POPULAR
              </Badge>
            </div>

            <div className="flex items-center gap-3 mb-4 mt-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Locked In ⚡</h2>
                <p className="text-purple-300 text-sm">For serious students</p>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-black text-white">
                ${isYearly ? yearlyPrice : monthlyPrice}
              </span>
              <span className="text-purple-300 text-sm">/month</span>
              {isYearly && (
                <p className="text-emerald-400 text-xs mt-1">
                  Billed ${yearlyTotal.toFixed(2)} yearly
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-3 text-white">
                <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <Infinity className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium">Unlimited uploads</span>
              </li>
              <li className="flex items-center gap-3 text-white">
                <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <Infinity className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium">Unlimited study tasks</span>
              </li>
              <li className="flex items-center gap-3 text-white">
                <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <Infinity className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium">Unlimited AI messages</span>
              </li>
              <li className="flex items-center gap-3 text-white">
                <div className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium">Advanced AI forensics</span>
              </li>
              <li className="flex items-center gap-3 text-white">
                <div className="w-5 h-5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium">Personalized study roadmap</span>
              </li>
            </ul>

            <Button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-6 text-base shadow-xl shadow-purple-500/30"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Get Locked In
                </>
              )}
            </Button>

            <p className="text-center text-purple-300 text-xs mt-3">
              Cancel anytime • 7-day money back guarantee
            </p>
          </motion.div>
        </div>

        {/* FAQ or Trust badges */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm">
            Trusted by 10,000+ students worldwide 🌍
          </p>
          <div className="flex items-center justify-center gap-6 mt-4 opacity-50">
            <span className="text-white text-xs">🔒 Secure checkout</span>
            <span className="text-white text-xs">💳 Stripe powered</span>
            <span className="text-white text-xs">🚫 No hidden fees</span>
          </div>
        </div>
      </div>
    </div>
  );
}