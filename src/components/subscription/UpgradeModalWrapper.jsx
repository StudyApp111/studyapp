import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useSubscription } from './SubscriptionContext';
import UpgradeModal from './UpgradeModal';

export default function UpgradeModalWrapper() {
  const { showUpgradeModal, setShowUpgradeModal, upgradeReason, upgradeCallback, setUpgradeCallback } = useSubscription();
  const navigate = useNavigate();

  // Desktop users: redirect to pricing page instead of showing modal
  useEffect(() => {
    if (showUpgradeModal && window.innerWidth >= 768) {
      setShowUpgradeModal(false);
      navigate(createPageUrl('PricingPlans'));
    }
  }, [showUpgradeModal]);

  const handleClose = (success = false) => {
    setShowUpgradeModal(false);
    if (success && upgradeCallback) {
      upgradeCallback();
      setUpgradeCallback(null);
    }
  };

  // Only render modal for mobile
  return (
    <UpgradeModal 
      open={showUpgradeModal} 
      onOpenChange={handleClose} 
      reason={upgradeReason}
    />
  );
}