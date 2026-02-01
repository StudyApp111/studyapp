import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Gift } from "lucide-react";
import { toast } from "sonner";

export default function PromoCodeRedeem({ onSuccess }) {
  const [code, setCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      toast.error("Please enter a promo code");
      return;
    }

    setIsRedeeming(true);

    try {
      const { data } = await base44.functions.invoke('redeemPromoCode', {
        code: code.trim().toUpperCase()
      });

      if (data?.success) {
        toast.success(data.message || "Promo code activated!");
        setCode("");
        
        // Trigger global refresh
        window.dispatchEvent(new Event('userSubscriptionUpdated'));
        
        if (onSuccess) onSuccess();
      } else {
        toast.error(data?.error || "Invalid promo code");
      }
    } catch (error) {
      console.error("Error redeeming promo code:", error);
      toast.error("Failed to redeem code. Please try again.");
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
            <Gift className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Have a Promo Code?</h3>
            <p className="text-xs text-slate-600">Unlock premium features for free</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Enter code..."
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
            className="uppercase font-mono text-base"
            disabled={isRedeeming}
          />
          <Button
            onClick={handleRedeem}
            disabled={!code.trim() || isRedeeming}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6"
          >
            {isRedeeming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1.5" />
                Redeem
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}