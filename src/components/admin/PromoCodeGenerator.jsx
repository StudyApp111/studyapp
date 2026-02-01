import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function PromoCodeGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [formData, setFormData] = useState({
    duration: "30",
    durationUnit: "days",
    customCode: "",
    maxUses: "1",
    notes: ""
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedCode(null);

    try {
      // Convert duration to days
      let durationInDays = parseInt(formData.duration);
      if (formData.durationUnit === "weeks") {
        durationInDays = durationInDays * 7;
      } else if (formData.durationUnit === "months") {
        durationInDays = durationInDays * 30;
      }

      const payload = {
        type: "free_access",
        duration_days: durationInDays,
        max_uses: parseInt(formData.maxUses) || 1,
        notes: formData.notes || null,
        custom_code: formData.customCode || undefined
      };

      const { data } = await base44.functions.invoke('createPromoCode', payload);

      if (data?.success) {
        setGeneratedCode({
          code: data.promo_code,
          durationDays: data.duration_days,
          maxUses: data.max_uses,
          expiresAt: data.expires_at
        });
        toast.success("Promo code created successfully!");
        
        // Reset form
        setFormData({
          duration: "30",
          durationUnit: "days",
          customCode: "",
          maxUses: "1",
          notes: ""
        });
      } else {
        throw new Error(data?.error || "Failed to create promo code");
      }
    } catch (error) {
      console.error("Error generating promo code:", error);
      toast.error(error.message || "Failed to create promo code");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyCode = () => {
    if (generatedCode?.code) {
      navigator.clipboard.writeText(generatedCode.code);
      toast.success("Promo code copied to clipboard!");
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Generate Promo Code</h3>
            <p className="text-xs text-slate-600">Create free access codes for users</p>
          </div>
        </div>

        {generatedCode ? (
          <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-emerald-900">Code Generated!</span>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-emerald-200 mb-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-2xl font-black text-purple-600">
                  {generatedCode.code}
                </div>
                <Button onClick={copyCode} size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Copy className="w-4 h-4 mr-1.5" />
                  Copy
                </Button>
              </div>
            </div>
            
            <div className="text-sm space-y-1">
              <p className="text-slate-700">
                <span className="font-semibold">Duration:</span> {generatedCode.durationDays} days
              </p>
              <p className="text-slate-700">
                <span className="font-semibold">Max Uses:</span> {generatedCode.maxUses}
              </p>
              <p className="text-amber-700 font-medium mt-2 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Save this code now - it cannot be retrieved later!</span>
              </p>
            </div>
            
            <Button 
              onClick={() => setGeneratedCode(null)}
              variant="outline"
              className="w-full mt-4 border-purple-300 hover:bg-purple-100"
            >
              Generate Another
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {/* Duration */}
            <div>
              <Label className="text-sm font-semibold text-slate-700 mb-2">Access Duration</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="flex-1"
                />
                <Select value={formData.durationUnit} onValueChange={(val) => setFormData({ ...formData, durationUnit: val })}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Total: {formData.durationUnit === "weeks" ? parseInt(formData.duration) * 7 : formData.durationUnit === "months" ? parseInt(formData.duration) * 30 : formData.duration} days
              </p>
            </div>

            {/* Max Uses */}
            <div>
              <Label className="text-sm font-semibold text-slate-700 mb-2">Maximum Uses</Label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">How many people can use this code</p>
            </div>

            {/* Custom Code (Optional) */}
            <div>
              <Label className="text-sm font-semibold text-slate-700 mb-2">Custom Code (Optional)</Label>
              <Input
                placeholder="e.g., WELCOME2024"
                value={formData.customCode}
                onChange={(e) => setFormData({ ...formData, customCode: e.target.value.toUpperCase() })}
                className="uppercase"
              />
              <p className="text-xs text-slate-500 mt-1">Leave empty to auto-generate</p>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-sm font-semibold text-slate-700 mb-2">Internal Notes (Optional)</Label>
              <Textarea
                placeholder="For which campaign/user..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="h-20"
              />
            </div>
          </div>
        )}

        {!generatedCode && (
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !formData.duration || parseInt(formData.duration) < 1}
            className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Promo Code
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}