import React, { useEffect } from 'react';
import { useSubscription } from './SubscriptionContext';
import UpgradeModal from './UpgradeModal';
import posthog from 'posthog-js';
import { detectDeviceInfo } from '@/components/utils/userTracking';

export default function UpgradeModalWrapper() {
  const { showUpgradeModal, setShowUpgradeModal, upgradeReason } = useSubscription();

  // Fire analytics whenever the soft-gate modal is shown.
  useEffect(() => {
    if (!showUpgradeModal) return;
    try {
      const deviceInfo = detectDeviceInfo();
      posthog.capture('paywall_shown', {
        reason: upgradeReason || 'default',
        device_type: deviceInfo.device_type,
        app_type: deviceInfo.app_type,
        page: window.location.pathname,
      });
    } catch {}
  }, [showUpgradeModal, upgradeReason]);

  return (
    <UpgradeModal
      open={showUpgradeModal}
      onOpenChange={setShowUpgradeModal}
      reason={upgradeReason}
    />
  );
}