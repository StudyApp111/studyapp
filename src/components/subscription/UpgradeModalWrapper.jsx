import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useSubscription } from './SubscriptionContext';
import posthog from 'posthog-js';
import { detectDeviceInfo } from '@/components/utils/userTracking';

export default function UpgradeModalWrapper() {
  const { showUpgradeModal, setShowUpgradeModal, upgradeReason } = useSubscription();
  const navigate = useNavigate();

  // All users: redirect to pricing page instead of showing modal
  useEffect(() => {
    if (showUpgradeModal) {
      try {
        const deviceInfo = detectDeviceInfo();
        posthog.capture('paywall_shown', {
          reason: upgradeReason || 'default',
          device_type: deviceInfo.device_type,
          app_type: deviceInfo.app_type,
          page: window.location.pathname,
        });
      } catch {}

      setShowUpgradeModal(false);
      navigate(createPageUrl('PricingPlans'));
    }
  }, [showUpgradeModal]);

  return null;
}