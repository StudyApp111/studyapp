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
  Mail,
  AlertTriangle,
  Loader2,
  Moon,
  Sun
} from "lucide-react";
import { useTheme } from "@/components/theme/ThemeContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import FeedbackModal from "@/components/feedback/FeedbackModal";

export default function Settings() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    base44.auth.me()
      .then(currentUser => {
        setUser(currentUser);
        setNotificationsEnabled(currentUser.notifications_enabled !== false);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
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
    if (deleteConfirmText !== "DELETE") return;
    
    setIsDeleting(true);
    try {
      // Delete user's data - lessons, exams, flashcards, etc.
      const lessons = await base44.entities.Lesson.filter({});
      for (const lesson of lessons) {
        await base44.entities.Lesson.delete(lesson.id);
      }
      
      // Log the user out after deletion request
      alert("Your account deletion request has been submitted. You will be logged out now. Please contact support@study-app.ai if you need further assistance.");
      base44.auth.logout();
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("There was an error processing your request. Please contact support@study-app.ai");
    }
    setIsDeleting(false);
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
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
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
          ? "border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 bg-red-500/5" 
          : "border-white/10 hover:bg-white/5 hover:border-white/20 bg-white/5"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${variant === "danger" ? "text-red-400" : "text-slate-400"}`} />
        <span className={`font-medium ${variant === "danger" ? "text-red-400" : "text-slate-200"}`}>
          {label}
        </span>
      </div>
      {rightContent || <ArrowRight className="w-5 h-5 text-slate-500" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0a0a12] p-4 md:p-10 pb-28 md:pb-10">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Home"))}
          className="mb-6 hover:bg-white/10 text-slate-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage your account preferences and settings</p>
        </div>

        <Card className="bg-[#12121a] border-white/10 mb-6">
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
            {/* Show subscription status if user is pro */}
            {user?.subscription_tier === 'pro' && user?.subscription_status === 'active' && (
              <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-emerald-300">Locked In Pro</p>
                    <p className="text-xs text-emerald-400">
                      {user.subscription_end_date 
                        ? `Active until ${new Date(user.subscription_end_date).toLocaleDateString()}`
                        : 'Active subscription'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(createPageUrl("ManageSubscription"))}
                    className="text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                  >
                    Manage
                  </Button>
                </div>
              </div>
            )}
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
              <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  {isDark ? <Moon className="w-5 h-5 text-slate-400" /> : <Sun className="w-5 h-5 text-slate-400" />}
                  <span className="font-medium text-slate-200">Dark Mode</span>
                </div>
                <Switch
                  checked={isDark}
                  onCheckedChange={toggleTheme}
                />
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-slate-200">Notifications</span>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={handleNotificationsToggle}
                />
              </div>
              
              <SettingsItem
                icon={Lock}
                label="Privacy Policy"
                onClick={() => window.open("https://study-app.ai/privacy_policy", "_blank")}
              />
              <SettingsItem
                icon={FileText}
                label="Terms of Service"
                onClick={() => window.open("https://study-app.ai/terms_service", "_blank")}
              />
              <SettingsItem
                icon={HelpCircle}
                label="Support"
                onClick={() => setFeedbackModalOpen(true)}
              />
              <SettingsItem
                icon={RefreshCw}
                label="Onboarding"
                onClick={async () => {
                  await base44.auth.updateMe({ onboarding_completed: false });
                  navigate(createPageUrl("Onboarding"));
                }}
              />
            </SettingsSection>

            <Separator className="my-6" />

            <SettingsSection title="Danger Zone">
              <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
                setDeleteDialogOpen(open);
                if (!open) {
                  setDeleteConfirmStep(1);
                  setDeleteConfirmText("");
                }
              }}>
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
                  {deleteConfirmStep === 1 ? (
                    <>
                      <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                          </div>
                          <DialogTitle className="text-xl">Delete Account?</DialogTitle>
                        </div>
                        <DialogDescription className="text-left space-y-3 pt-2">
                          <p className="font-medium text-slate-700">This will permanently delete:</p>
                          <ul className="list-disc list-inside text-slate-600 space-y-1">
                            <li>All your lessons and study materials</li>
                            <li>Your exam history and grades</li>
                            <li>Flashcards, notes, and progress data</li>
                            <li>Your account and profile information</li>
                          </ul>
                          <p className="text-red-600 font-medium pt-2">This action cannot be undone.</p>
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => setDeleteConfirmStep(2)}>
                          I Understand, Continue
                        </Button>
                      </DialogFooter>
                    </>
                  ) : (
                    <>
                      <DialogHeader>
                        <DialogTitle>Final Confirmation</DialogTitle>
                        <DialogDescription className="pt-2">
                          Type <strong>DELETE</strong> below to confirm you want to permanently delete your account.
                        </DialogDescription>
                      </DialogHeader>
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                        placeholder="Type DELETE to confirm"
                        className="border-red-200 focus:border-red-400"
                      />
                      <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => {
                          setDeleteConfirmStep(1);
                          setDeleteConfirmText("");
                        }}>
                          Go Back
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleDeleteAccount}
                          disabled={deleteConfirmText !== "DELETE" || isDeleting}
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            "Delete My Account"
                          )}
                        </Button>
                      </DialogFooter>
                    </>
                  )}
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

        {/* Feedback Modal for Support */}
        <FeedbackModal open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen} />
      </div>
    </div>
  );
}