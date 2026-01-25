import React from 'react';
import { useSubscription } from './SubscriptionContext';
import UpgradeModal from './UpgradeModal';

export default function UpgradeModalWrapper() {
  const { showUpgradeModal, setShowUpgradeModal, upgradeReason } = useSubscription();

  return (
    <UpgradeModal 
      open={showUpgradeModal} 
      onOpenChange={setShowUpgradeModal} 
      reason={upgradeReason}
    />
  );
}