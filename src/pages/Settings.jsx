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
  Sun,
  Gift,
  Sparkles
} from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
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
import PromoCodeGenerator from "@/components/admin/PromoCodeGenerator";
import PromoCodeRedeem from "@/components/subscription/PromoCodeRedeem";
import { useSubscription } from "@/components/subscription/SubscriptionContext";

export default function Settings() {
  const navigate = useNavigate();
  const { refreshUser, getPromoRemainingDays } = useSubscription();
  const [user, setUser] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setNotificationsEnabled(currentUser.notifications_enabled !== false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromoRedeemed = async () => {
    await refreshUser();
    await loadUser();
  };

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
    if (deleteConfirmText.toUpperCase() !== "DELETE") return;
    
    setIsDeleting(true);
    try {
      // Delete all user data
      const [lessons, exams, flashcards, studyPlans, annotations, notes, teachItCards, assignments, courses] = await Promise.all([
        base44.entities.Lesson.list(),
        base44.entities.Exam.list(),
        base44.entities.Flashcard.list(),
        base44.entities.StudyPlan.list(),
        base44.entities.Annotation.list(),
        base44.entities.LessonNote.list(),
        base44.entities.TeachItCard.list(),
        base44.entities.GradedAssignment.list(),
        base44.entities.Course.list()
      ]);
      
      // Delete all entities
      const deletePromises = [
        ...lessons.map(l => base44.entities.Lesson.delete(l.id)),
        ...exams.map(e => base44.entities.Exam.delete(e.id)),
        ...flashcards.map(f => base44.entities.Flashcard.delete(f.id)),
        ...studyPlans.map(sp => base44.entities.StudyPlan.delete(sp.id)),
        ...annotations.map(a => base44.entities.Annotation.delete(a.id)),
        ...notes.map(n => base44.entities.LessonNote.delete(n.id)),
        ...teachItCards.map(t => base44.entities.TeachItCard.delete(t.id)),
        ...assignments.map(a => base44.entities.GradedAssignment.delete(a.id)),
        ...courses.map(c => base44.entities.Course.delete(c.id))
      ];
      
      await Promise.all(deletePromises);
      
      // Reset user data and log out
      await base44.auth.updateMe({ 
        onboarding_completed: false,
        display_name: null,
        daily_xp: 0,
        current_streak: 0,
        session_count: 0
      });
      
      base44.auth.logout("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("There was an error deleting your data. Please contact info@studyappai.com");
      setIsDeleting(false);
    }
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
          : isDark ? "border-white/10 hover:bg-white/5 hover:border-white/20 bg-white/5" : "border-slate-200 hover:bg-slate-50 hover:border-slate-300 bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${variant === "danger" ? "text-red-400" : isDark ? "text-slate-400" : "text-slate-600"}`} />
        <span className={`font-medium ${variant === "danger" ? "text-red-400" : isDark ? "text-slate-200" : "text-slate-900"}`}>
          {label}
        </span>
      </div>
      {rightContent || <ArrowRight className={`w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />}
    </button>
  );

  return (
    <div className={`min-h-screen w-full max-w-full ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'} p-4 md:p-10 pb-28 md:pb-10`} style={{ overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div className="max-w-full md:max-w-3xl mx-auto" style={{ boxSizing: 'border-box' }}>
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Home"))}
          className={`mb-6 ${isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-700'}`}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="mb-8">
          <h1 className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-2`}>Settings</h1>
          <p className="text-slate-400">Manage your account preferences and settings</p>
        </div>

        <Card className={`${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'} mb-6`}>
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
            
            {/* Promo Access Status - Show if active */}
            {(() => {
              const promoEndDate = user?.promo_access_until ? new Date(user.promo_access_until) : null;
              const now = new Date();
              const hasActivePromo = promoEndDate && promoEndDate > now && user?.subscription_tier === 'pro';
              const promoDaysLeft = getPromoRemainingDays?.();
              
              if (hasActivePromo && promoDaysLeft !== null) {
                return (
                  <div className="p-4 rounded-lg border-2 border-purple-400 bg-gradient-to-br from-purple-100 to-pink-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                        <Gift className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-purple-900">Promo Access Active</p>
                        <p className="text-sm text-purple-700">
                          {promoDaysLeft > 0 
                            ? `${promoDaysLeft} day${promoDaysLeft !== 1 ? 's' : ''} remaining`
                            : 'Expires today'}
                        </p>
                        <p className="text-xs text-purple-600 mt-0.5">
                          Until {promoEndDate.toLocaleDateString()}
                        </p>
                      </div>
                      <Sparkles className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                );
              }
            })()}
            
            {/* Standard subscription status */}
            {(() => {
              const isActivePro = user?.subscription_tier === 'pro' && user?.subscription_status === 'active';
              const isCancelled = user?.subscription_status === 'cancelled';
              const endDate = user?.subscription_end_date ? new Date(user.subscription_end_date) : null;
              const promoEndDate = user?.promo_access_until ? new Date(user.promo_access_until) : null;
              const now = new Date();
              const hasGracePeriod = isCancelled && endDate && endDate > now;
              const isExpired = (endDate && endDate < now) || (promoEndDate && promoEndDate < now && !endDate);
              
              // Only show paid subscription status if no active promo
              const hasActivePromo = promoEndDate && promoEndDate > now;
              
              // Cancelled but still has access (grace period)
              if (isCancelled && hasGracePeriod && !hasActivePromo) {
                return (
                  <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-amber-300">Cancelled - Ends {endDate.toLocaleDateString()}</p>
                        <p className="text-xs text-amber-400">
                          Pro access until then, no future billing
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(createPageUrl("ManageSubscription"))}
                        className="text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                );
              }
              
              if (isActivePro && !isExpired && !hasActivePromo) {
                return (
                  <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-emerald-300">Pro Active</p>
                        <p className="text-xs text-emerald-400">
                          {endDate ? `${user.subscription_plan_type === 'yearly' ? 'Yearly' : 'Monthly'} • Renews ${endDate.toLocaleDateString()}` : 'Active subscription'}
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
                );
              } else if ((isCancelled && !hasGracePeriod) || isExpired) {
                return (
                  <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-red-300">Subscription Expired</p>
                        <p className="text-xs text-red-400">
                          Your Pro access has ended
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => navigate(createPageUrl("PricingPlans"))}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        Renew
                      </Button>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            <SettingsItem
              icon={History}
              label="History"
              onClick={() => navigate(createPageUrl("LessonHistory"))}
            />
            
            {/* Promo Code Redemption - For all users */}
            {user?.subscription_tier !== 'pro' && (
              <div className="mt-4">
                <PromoCodeRedeem onSuccess={handlePromoRedeemed} />
              </div>
            )}
            </SettingsSection>

            <Separator className="my-6" />

            {user?.role === 'admin' && (
              <>
                <SettingsSection title="Admin">
                  <SettingsItem
                    icon={Mail}
                    label="Email Manager"
                    onClick={() => navigate(createPageUrl("EmailManager"))}
                  />
                  
                  {/* Promo Code Generator */}
                  <div className="mt-4">
                    <PromoCodeGenerator />
                  </div>
                </SettingsSection>
                <Separator className="my-6" />
              </>
            )}

            <SettingsSection title="Others">
              <div className={`flex items-center justify-between p-4 rounded-lg border ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <Bell className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                  <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Notifications</span>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={handleNotificationsToggle}
                />
              </div>

              <div className={`flex items-center justify-between p-4 rounded-lg border ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  {isDark ? <Moon className="w-5 h-5 text-slate-400" /> : <Sun className="w-5 h-5 text-slate-600" />}
                  <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Dark Mode</span>
                </div>
                <Switch
                  checked={isDark}
                  onCheckedChange={toggleTheme}
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
                  window.location.href = createPageUrl("Home") + "?onboarding=true";
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
                  <button className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${isDark ? 'border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50' : 'border-red-200 hover:bg-red-50 hover:border-red-300'}`}>
                    <div className="flex items-center gap-3">
                      <Trash2 className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                      <span className={`font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>Delete Account</span>
                    </div>
                    <ArrowRight className={`w-5 h-5 ${isDark ? 'text-red-500' : 'text-red-400'}`} />
                  </button>
                </DialogTrigger>
                <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
                  {deleteConfirmStep === 1 ? (
                    <>
                      <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                            <AlertTriangle className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                          </div>
                          <DialogTitle className="text-xl">Delete Account?</DialogTitle>
                        </div>
                        <DialogDescription className="text-left space-y-3 pt-2">
                          <p className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>This will permanently delete:</p>
                          <ul className={`list-disc list-inside space-y-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            <li>All your lessons and study materials</li>
                            <li>Your exam history and grades</li>
                            <li>Flashcards, notes, and progress data</li>
                            <li>Your account and profile information</li>
                          </ul>
                          <p className="text-red-500 font-medium pt-2">This action cannot be undone.</p>
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
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="Type DELETE to confirm"
                        className={`flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 ${isDark ? 'bg-white/5 border-red-500/30 text-white' : 'bg-transparent border-red-200 text-slate-900'}`}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
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
                          disabled={deleteConfirmText.toUpperCase() !== "DELETE" || isDeleting}
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