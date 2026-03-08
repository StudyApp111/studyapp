import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useSubscription } from './SubscriptionContext';
import posthog from 'posthog-js';

export default function UpgradeModalWrapper() {
  const { showUpgradeModal, setShowUpgradeModal, upgradeReason } = useSubscription();
  const navigate = useNavigate();

  // All users: redirect to pricing page instead of showing modal
  useEffect(() => {
    if (showUpgradeModal) {
      try {
        posthog.capture('paywall_shown', {
          reason: upgradeReason || 'default',
          device_type: window.innerWidth >= 768 ? 'desktop' : 'mobile',
          page: window.location.pathname,
        });
      } catch {}

      setShowUpgradeModal(false);
      navigate(createPageUrl('PricingPlans'));
    }
  }, [showUpgradeModal]);

  return null;
}