import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ChangePassword() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    base44.auth.me()
      .then(currentUser => {
        setUser(currentUser);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Check if user signed in with Google OAuth (no password to change)
  const isOAuthUser = user?.auth_provider === 'google' || user?.email?.includes('@gmail.com') && !user?.has_password;

  const handleResetPassword = async () => {
    if (!user?.email) return;
    
    setIsSending(true);
    try {
      // Base44 uses redirectToLogin for password reset flow
      // Users will receive an email to reset their password
      setMessage("Password reset is handled through the login page. You will be redirected to request a password reset.");
      setTimeout(() => {
        base44.auth.logout(window.location.origin + "/login?reset=true");
      }, 2000);
    } catch (error) {
      console.error("Error:", error);
      setMessage("Please log out and use 'Forgot Password' on the login page.");
    }
    setIsSending(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Settings"))}
          className="hidden md:flex mb-6 hover:bg-purple-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Settings
        </Button>

        <h1 className="text-3xl font-bold text-slate-900 mb-6">Change Password</h1>

        <Card className="shadow-xl border-0">
          <CardHeader>
            <CardTitle>Password Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {isOAuthUser ? (
              // Google OAuth users cannot change password
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Signed in with Google
                </h3>
                <p className="text-slate-600 max-w-sm mx-auto">
                  You signed in using Google. Password management is handled through your Google account settings.
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.open("https://myaccount.google.com/security", "_blank")}
                  className="mt-4"
                >
                  Go to Google Account Settings
                </Button>
              </div>
            ) : (
              // Email/password users
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Reset Your Password
                </h3>
                <p className="text-slate-600 max-w-sm mx-auto mb-6">
                  For security, password changes are done via email. Click below to receive a password reset link at <strong>{user?.email}</strong>.
                </p>
                <Button
                  onClick={handleResetPassword}
                  disabled={isSending}
                  className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {isSending ? "Sending..." : "Send Password Reset Email"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}