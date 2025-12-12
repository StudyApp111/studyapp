import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

export default function Analytics() {
  const navigate = useNavigate();
  const [gtmId, setGtmId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [configId, setConfigId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.email !== 'kartikeya2159@gmail.com') {
        navigate(createPageUrl("Home"));
        return;
      }

      const configs = await base44.entities.AppConfiguration.list();
      if (configs.length > 0) {
        setGtmId(configs[0].gtm_container_id || "");
        setConfigId(configs[0].id);
      }
    } catch (err) {
      console.error("Error loading config:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const validateGtmId = (id) => {
    const gtmPattern = /^GTM-[A-Z0-9]{7,}$/;
    return gtmPattern.test(id);
  };

  const handleSave = async () => {
    setError("");
    setSuccess(false);

    if (!gtmId.trim()) {
      setError("Please enter your GTM Container ID");
      return;
    }

    if (!validateGtmId(gtmId.trim())) {
      setError("Invalid GTM ID format. Should be GTM-XXXXXXX");
      return;
    }

    setIsSaving(true);
    try {
      const data = { gtm_container_id: gtmId.trim() };

      if (configId) {
        await base44.entities.AppConfiguration.update(configId, data);
      } else {
        const newConfig = await base44.entities.AppConfiguration.create(data);
        setConfigId(newConfig.id);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError("Failed to save configuration. Please try again.");
      console.error("Error saving config:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (!user || user.email !== 'kartikeya2159@gmail.com') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-4 md:p-10">
      <div className="max-w-4xl mx-auto">
        <Button
          onClick={() => navigate(createPageUrl("Settings"))}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Settings
        </Button>

        <div className="mb-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-yellow-500 p-6 md:p-8 shadow-xl">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -mr-24 -mt-24" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-400/20 rounded-full blur-xl -ml-16 -mb-16" />
            
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Analytics Configuration</h1>
                <p className="text-white/90 text-sm md:text-base">Configure Google Tag Manager for tracking</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="shadow-xl border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Google Tag Manager</CardTitle>
                  <CardDescription>Configure GTM tracking for your app</CardDescription>
                </div>
                {(gtmId && validateGtmId(gtmId)) && (
                  <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {success && (
                <Alert className="bg-emerald-50 border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-700">
                    GTM configuration saved successfully! Changes will take effect on next page load.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="gtmId">GTM Container ID</Label>
                <Input
                  id="gtmId"
                  value={gtmId}
                  onChange={(e) => setGtmId(e.target.value)}
                  placeholder="GTM-XXXXXXX"
                  className="text-base font-mono"
                />
                <p className="text-xs text-slate-500">
                  Format: GTM-XXXXXXX (e.g., GTM-ABC1234)
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-600" />
                  How to get your GTM Container ID
                </h3>
                <div className="text-sm text-slate-600">
                  <ol className="ml-6 list-decimal space-y-1">
                    <li>Go to <a href="https://tagmanager.google.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline inline-flex items-center gap-1">Google Tag Manager <ExternalLink className="w-3 h-3" /></a></li>
                    <li>Create or select your container</li>
                    <li>Find the Container ID in the top right (starts with GTM-)</li>
                    <li>Copy and paste it above</li>
                  </ol>
                </div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  Privacy Notice
                </h3>
                <p className="text-sm text-slate-600">
                  GTM will only load on public user-facing pages. Admin dashboard and settings pages are excluded for privacy.
                </p>
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
              >
                {isSaving ? "Saving..." : "Save Configuration"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}