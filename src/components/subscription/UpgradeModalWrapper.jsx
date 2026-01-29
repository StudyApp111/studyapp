import React from 'react';
import { useSubscription } from './SubscriptionContext';
import UpgradeModal from './UpgradeModal';

export default function UpgradeModalWrapper() {
  const { showUpgradeModal, setShowUpgradeModal, upgradeReason, upgradeCallback, setUpgradeCallback } = useSubscription();

  const handleClose = (success = false) => {
    setShowUpgradeModal(false);
    if (success && upgradeCallback) {
      upgradeCallback();
      setUpgradeCallback(null);
    }
  };

  return (
    <UpgradeModal 
      open={showUpgradeModal} 
      onOpenChange={handleClose} 
      reason={upgradeReason}
    />
  );
}