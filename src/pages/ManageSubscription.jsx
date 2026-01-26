import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CreditCard,
  Calendar,
  AlertTriangle,
  Loader2,
  CheckCircle,
  ExternalLink
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ManageSubscription() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      const response = await base44.functions.invoke('cancelSubscription', {});
      
      if (response.data.success) {
        setCancelSuccess(true);
        // Refresh user data
        const updatedUser = await base44.auth.me();
        setUser(updatedUser);
      } else {
        alert(response.data.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Cancel error:', error);
      alert('Failed to cancel subscription. Please contact support.');
    }
    setIsCancelling(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const isPro = user?.subscription_tier === 'pro' && user?.subscription_status === 'active';
  const isCancelled = user?.subscription_status === 'cancelled';

  return (
    <div className="min-h-screen dark:bg-gradient-to-br dark:from-purple-900/20 dark:via-purple-800/10 dark:to-purple-900/20 bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-4 md:p-10 pb-28 md:pb-10">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Settings"))}
          className="mb-6 dark:hover:bg-white/10 hover:bg-purple-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Settings
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold dark:text-slate-100 text-slate-900 mb-2">Manage Subscription</h1>
          <p className="dark:text-slate-300 text-slate-600">View and manage your subscription details</p>
        </div>

        <Card className="shadow-xl border-0 dark:bg-[#12121a] mb-6">
          <CardContent className="p-6">
            {/* Current Plan */}
            <div className="flex items-start gap-4 mb-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isPro ? 'bg-emerald-100' : 'dark:bg-white/10 bg-slate-100'
              }`}>
                <CreditCard className={`w-6 h-6 ${isPro ? 'text-emerald-600' : 'dark:text-slate-300 text-slate-600'}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold dark:text-slate-100 text-slate-900">
                  {isPro ? 'Pro Plan' : 'Free Plan'}
                </h2>
                <p className="dark:text-slate-300 text-slate-600">
                  {isPro 
                    ? 'Unlimited access to all features' 
                    : 'Limited access with daily quotas'}
                </p>
              </div>
              {isPro && (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                  Active
                </span>
              )}
              {isCancelled && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                  Cancelling
                </span>
              )}
            </div>

            {isPro && (
              <>
                {/* Subscription Details */}
                <div className="dark:bg-white/5 bg-slate-50 rounded-xl p-4 mb-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 dark:text-slate-300 text-slate-600">
                      <Calendar className="w-4 h-4" />
                      <span>Next billing date</span>
                    </div>
                    <span className="font-medium dark:text-slate-100 text-slate-900">
                      {user.subscription_end_date 
                        ? new Date(user.subscription_end_date).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : 'Not available'}
                    </span>
                  </div>
                  
                  {user.stripe_customer_id && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 dark:text-slate-300 text-slate-600">
                        <CreditCard className="w-4 h-4" />
                        <span>Payment method</span>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-purple-600 p-0 h-auto"
                        onClick={async () => {
                          try {
                            const response = await base44.functions.invoke('createBillingPortalSession', {});
                            if (response.data.url) {
                              window.open(response.data.url, '_blank');
                            }
                          } catch (e) {
                            alert('Unable to open billing portal. Please contact support.');
                          }
                        }}
                      >
                        Update <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Cancel Button */}
                {!isCancelled && (
                  <Button
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    Cancel Subscription
                  </Button>
                )}

                {isCancelled && (
                  <div className="dark:bg-amber-500/10 dark:border-amber-500/30 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium dark:text-amber-300 text-amber-800">Subscription Cancelled</p>
                        <p className="text-sm dark:text-amber-200 text-amber-700 mt-1">
                          Your subscription will remain active until {user.subscription_end_date 
                            ? new Date(user.subscription_end_date).toLocaleDateString() 
                            : 'the end of your billing period'}. 
                          After that, you'll be moved to the free plan.
                        </p>
                        <Button
                          variant="link"
                          className="dark:text-amber-300 text-amber-700 p-0 h-auto mt-2"
                          onClick={() => navigate(createPageUrl("PricingPlans"))}
                        >
                          Resubscribe →
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {!isPro && !isCancelled && (
              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                onClick={() => navigate(createPageUrl("PricingPlans"))}
              >
                Upgrade to Pro
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Cancel Confirmation Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            {cancelSuccess ? (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                    <DialogTitle className="text-xl">Subscription Cancelled</DialogTitle>
                  </div>
                  <DialogDescription className="text-left pt-2">
                    Your subscription has been cancelled. You'll continue to have Pro access until the end of your current billing period.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={() => {
                    setCancelDialogOpen(false);
                    setCancelSuccess(false);
                  }}>
                    Got it
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                    </div>
                    <DialogTitle className="text-xl">Cancel Subscription?</DialogTitle>
                  </div>
                  <DialogDescription className="text-left space-y-3 pt-2">
                    <p>If you cancel, you'll lose access to:</p>
                    <ul className="list-disc list-inside text-slate-600 space-y-1">
                      <li>Unlimited document uploads</li>
                      <li>Unlimited AI study sessions</li>
                      <li>Unlimited practice exams</li>
                      <li>Priority support</li>
                    </ul>
                    <p className="text-slate-700 pt-2">
                      You'll still have Pro access until <strong>{user?.subscription_end_date 
                        ? new Date(user.subscription_end_date).toLocaleDateString() 
                        : 'the end of your billing period'}</strong>.
                    </p>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                    Keep Subscription
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancelSubscription}
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      'Yes, Cancel'
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}