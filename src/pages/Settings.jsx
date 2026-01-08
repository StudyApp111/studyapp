import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Key,
  CreditCard,
  History,
  Bell,
  Lock,
  FileText,
  HelpCircle,
  RefreshCw,
  Trash2,
  LogOut,
  ArrowRight,
  ArrowLeft,
  BarChart3,
  Mail
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setNotificationsEnabled(currentUser.notifications_enabled !== false);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
      setIsLoading(false);
    };
    
    fetchUser();
  }, []);

  const handleNotificationsToggle = async (enabled) => {
    setNotificationsEnabled(enabled);
    try {
      await base44.auth.updateMe({ notifications_enabled: enabled });
    } catch (error) {
      console.error("Error updating notifications:", error);
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  const handleDeleteAccount = async () => {
    // TODO: Implement account deletion
    alert("Account deletion would be implemented here. Please contact support.");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  const SettingsSection = ({ title, children }) => (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
        {title}
      </h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );

  const SettingsItem = ({ icon: Icon, label, onClick, variant = "default", rightContent }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${
        variant === "danger" 
          ? "border-red-200 hover:bg-red-50 hover:border-red-300" 
          : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${variant === "danger" ? "text-red-600" : "text-slate-600"}`} />
        <span className={`font-medium ${variant === "danger" ? "text-red-600" : "text-slate-700"}`}>
          {label}
        </span>
      </div>
      {rightContent || <ArrowRight className="w-5 h-5 text-slate-400" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Home"))}
          className="mb-6 hover:bg-purple-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Settings</h1>
          <p className="text-slate-600">Manage your account preferences and settings</p>
        </div>

        <Card className="shadow-xl border-0 mb-6">
          <CardContent className="p-6">
            <SettingsSection title="Account">
              <SettingsItem
                icon={User}
                label="Profile Information"
                onClick={() => navigate(createPageUrl("ProfileInformation"))}
              />
              <SettingsItem
                icon={Key}
                label="Change Password"
                onClick={() => navigate(createPageUrl("ChangePassword"))}
              />
            </SettingsSection>

            <Separator className="my-6" />

            <SettingsSection title="Plans & History">
              <SettingsItem
                icon={CreditCard}
                label="Pricing Plans"
                onClick={() => navigate(createPageUrl("PricingPlans"))}
              />
              <SettingsItem
                icon={History}
                label="History"
                onClick={() => navigate(createPageUrl("LessonHistory"))}
              />
            </SettingsSection>

            <Separator className="my-6" />

            {user?.email === 'kartikeya2159@gmail.com' && (
              <>
                <SettingsSection title="Admin">
                  <SettingsItem
                    icon={Mail}
                    label="Email Manager"
                    onClick={() => navigate(createPageUrl("EmailManager"))}
                  />
                </SettingsSection>
                <Separator className="my-6" />
              </>
            )}

            <SettingsSection title="Others">
              <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-slate-600" />
                  <span className="font-medium text-slate-700">Notifications</span>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={handleNotificationsToggle}
                />
              </div>
              
              <SettingsItem
                icon={Lock}
                label="Privacy Policy"
                onClick={() => window.open("https://studyapp.ai/privacy", "_blank")}
              />
              <SettingsItem
                icon={FileText}
                label="Terms of Service"
                onClick={() => window.open("https://studyapp.ai/terms", "_blank")}
              />
              <SettingsItem
                icon={HelpCircle}
                label="Support"
                onClick={() => window.open("mailto:support@studyapp.ai", "_blank")}
              />
              <SettingsItem
                icon={RefreshCw}
                label="Onboarding"
                onClick={() => navigate(createPageUrl("Onboarding"))}
              />
            </SettingsSection>

            <Separator className="my-6" />

            <SettingsSection title="Danger Zone">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="w-full flex items-center justify-between p-4 rounded-lg border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all">
                    <div className="flex items-center gap-3">
                      <Trash2 className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-red-600">Delete Account</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-red-400" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Account</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button variant="destructive" onClick={handleDeleteAccount}>
                      Delete Account
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <SettingsItem
                icon={LogOut}
                label="Log Out"
                onClick={handleLogout}
                variant="danger"
              />
            </SettingsSection>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}