import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Users, AlertCircle, CheckCircle, Plus, Download, ExternalLink, RefreshCw, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import TriggerCard from "@/components/email/TriggerCard";
import VariableReference from "@/components/email/VariableReference";

const TRIGGER_LABELS = {
  // ─── Instant Action Triggers ───
  signup: "Email 0 — Welcome (instant on signup)",
  onboarding_completed: "Completes Onboarding",
  first_lesson_created: "First Lesson Created",
  first_diagnostic_completed: "First Diagnostic Completed",
  first_studyplan_generated: "First Study Plan Generated",
  first_worksheet_completed: "First Worksheet Completed",
  first_assignment_graded: "First Assignment Graded",
  lesson_all_worksheets_completed: "All Worksheets Completed",
  // ─── Delayed Follow-Up Triggers ───
  signup_no_lesson_4h: "Email 1 — Lesson nudge (4h after signup, no lesson)",
  lesson_no_diagnostic_24h: "Email 2 — Quiz nudge (24h after lesson, no quiz)",
  quiz_no_return_24h: "Email 3 — Fear re-engagement (24h after quiz, no return)",
  session_no_followup_24h: "Email 4 — Streak builder (24h after first session, no follow-up)",
  // ─── Conditional Triggers ───
  upgrade_momentum: "Email 5 — Upgrade moment (threshold reached, free users)",
  trial_expiring: "Email 6 — Trial expiry (2 days left, pro trial)",
  // ─── Inactivity Triggers ───
  inactive_3_days: "Inactive 3 Days",
  inactive_7_days: "Inactive 7 Days",
  inactive_14_days: "Inactive 14 Days",
  inactive_30_days: "Inactive 30 Days",
};

export default function EmailManager() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [userCount, setUserCount] = useState(0);
  const [allUsers, setAllUsers] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [resendTemplates, setResendTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newTrigger, setNewTrigger] = useState({
    name: "",
    trigger_type: "",
    resend_template_id: "",
    resend_template_name: "",
    trigger_config: {}
  });

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser.role !== 'admin') {
        navigate(createPageUrl("Home"));
        return;
      }
      setUser(currentUser);

      // Load everything in parallel
      const [userData, triggerData] = await Promise.all([
        base44.functions.invoke('getUserCount', {}),
        base44.entities.AutomaticEmail.list()
      ]);

      setUserCount(userData.data.count || 0);
      const sorted = (userData.data.users || []).sort((a, b) =>
        (a.full_name || a.email).localeCompare(b.full_name || b.email)
      );
      setAllUsers(sorted);
      setTriggers(triggerData);

      // Load Resend templates
      loadResendTemplates();

      setLoading(false);
    } catch (err) {
      console.error("Access denied:", err);
      navigate(createPageUrl("Home"));
    }
  };

  const loadResendTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data } = await base44.functions.invoke('listResendTemplates', {});
      setResendTemplates(data.templates || []);
    } catch (err) {
      console.error("Failed to load Resend templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleUpdateTrigger = async (id, updates) => {
    try {
      await base44.entities.AutomaticEmail.update(id, updates);
      setTriggers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      setSuccess("Updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to update");
    }
  };

  const handleDeleteTrigger = async (id) => {
    if (!confirm("Delete this email trigger?")) return;
    try {
      await base44.entities.AutomaticEmail.delete(id);
      setTriggers(prev => prev.filter(t => t.id !== id));
      setSuccess("Deleted");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to delete");
    }
  };

  const handleCreate = async () => {
    if (!newTrigger.name || !newTrigger.trigger_type || !newTrigger.resend_template_id) {
      setError("Name, trigger, and Resend template are required");
      return;
    }
    try {
      const created = await base44.entities.AutomaticEmail.create(newTrigger);
      setTriggers(prev => [...prev, created]);
      setShowCreate(false);
      setNewTrigger({ name: "", trigger_type: "", resend_template_id: "", resend_template_name: "", trigger_config: {} });
      setSuccess("Trigger created");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to create trigger");
    }
  };

  const handleExportUsers = async () => {
    try {
      const response = await base44.functions.invoke('exportUsers', {});
      const csvContent = response.data.csv;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError("Failed to export users");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  // Group triggers by category
  const delayedTypes = ['signup_no_lesson_4h', 'lesson_no_diagnostic_24h', 'quiz_no_return_24h', 'session_no_followup_24h'];
  const conditionalTypes = ['upgrade_momentum', 'trial_expiring'];
  const actionTriggers = triggers.filter(t =>
    !t.trigger_type.startsWith('inactive_') && !delayedTypes.includes(t.trigger_type) && !conditionalTypes.includes(t.trigger_type)
  );
  const delayedTriggers = triggers.filter(t => delayedTypes.includes(t.trigger_type));
  const conditionalTriggers = triggers.filter(t => conditionalTypes.includes(t.trigger_type));
  const inactivityTriggers = triggers.filter(t => t.trigger_type.startsWith('inactive_'));

  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Mail className="w-8 h-8 text-purple-500" />
          <h1 className="text-3xl font-bold text-foreground">Email Manager</h1>
          <Badge variant="destructive" className="ml-2">Admin</Badge>
        </div>
        <p className="text-muted-foreground">
          Connect Resend templates to in-app triggers. Templates are designed in{" "}
          <a href="https://resend.com/templates" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline inline-flex items-center gap-1">
            Resend <ExternalLink className="w-3 h-3" />
          </a>, triggers fire them here.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-7 h-7 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold text-foreground">{userCount}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportUsers} className="gap-1">
                <Download className="w-3 h-3" /> CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Zap className="w-7 h-7 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Active Triggers</p>
                <p className="text-2xl font-bold text-foreground">{triggers.filter(t => t.enabled).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-7 h-7 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Resend Templates</p>
                  <p className="text-2xl font-bold text-foreground">{resendTemplates.length}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={loadResendTemplates} disabled={loadingTemplates} className="gap-1">
                <RefreshCw className={`w-3 h-3 ${loadingTemplates ? 'animate-spin' : ''}`} /> Sync
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Resend Templates */}
      {resendTemplates.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
          <p className="text-xs font-semibold text-purple-600 dark:text-purple-300 mb-2">Available Resend Templates</p>
          <div className="flex flex-wrap gap-2">
            {resendTemplates.map(t => (
              <Badge key={t.id} variant="outline" className="text-xs">
                {t.name}
              </Badge>
            ))}
          </div>
          <VariableReference allUsers={allUsers} />
        </div>
      )}

      {/* Create Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-foreground">Email Triggers</h2>
        <Button onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700 gap-2">
          <Plus className="w-4 h-4" /> New Trigger
        </Button>
      </div>

      {/* Action Triggers */}
      {actionTriggers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Action Triggers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {actionTriggers.map(t => (
              <TriggerCard
                key={t.id}
                trigger={t}
                allUsers={allUsers}
                resendTemplates={resendTemplates}
                onUpdate={handleUpdateTrigger}
                onDelete={handleDeleteTrigger}
              />
            ))}
          </div>
        </div>
      )}

      {/* Delayed Follow-Up Triggers */}
      {delayedTriggers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Delayed Follow-Up Triggers</h3>
          <p className="text-xs text-muted-foreground mb-3">These fire automatically when a user hasn't taken the next step within a time window. Checked hourly.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {delayedTriggers.map(t => (
              <TriggerCard
                key={t.id}
                trigger={t}
                allUsers={allUsers}
                resendTemplates={resendTemplates}
                onUpdate={handleUpdateTrigger}
                onDelete={handleDeleteTrigger}
              />
            ))}
          </div>
        </div>
      )}

      {/* Conditional Triggers */}
      {conditionalTriggers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Conditional Triggers</h3>
          <p className="text-xs text-muted-foreground mb-3">These fire when a user reaches a specific threshold (e.g. 20 questions completed, 5-day streak). Use trigger config to set conditions.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {conditionalTriggers.map(t => (
              <TriggerCard
                key={t.id}
                trigger={t}
                allUsers={allUsers}
                resendTemplates={resendTemplates}
                onUpdate={handleUpdateTrigger}
                onDelete={handleDeleteTrigger}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactivity Triggers */}
      {inactivityTriggers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Inactivity Triggers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inactivityTriggers.map(t => (
              <TriggerCard
                key={t.id}
                trigger={t}
                allUsers={allUsers}
                resendTemplates={resendTemplates}
                onUpdate={handleUpdateTrigger}
                onDelete={handleDeleteTrigger}
              />
            ))}
          </div>
        </div>
      )}

      {triggers.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-2">No email triggers yet</p>
            <p className="text-xs text-muted-foreground mb-4">Create your first trigger to start sending automated emails via Resend</p>
            <Button onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" /> Create First Trigger
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Email Trigger</DialogTitle>
            <DialogDescription>
              Connect an in-app action to a Resend template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name *</Label>
              <Input
                value={newTrigger.name}
                onChange={e => setNewTrigger({ ...newTrigger, name: e.target.value })}
                placeholder="e.g., Welcome Email"
              />
            </div>
            <div>
              <Label>Trigger *</Label>
              <Select value={newTrigger.trigger_type} onValueChange={v => setNewTrigger({ ...newTrigger, trigger_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select trigger" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resend Template *</Label>
              <Select value={newTrigger.resend_template_id} onValueChange={v => {
                const t = resendTemplates.find(rt => rt.id === v);
                setNewTrigger({ ...newTrigger, resend_template_id: v, resend_template_name: t?.name || '' });
              }}>
                <SelectTrigger><SelectValue placeholder="Select Resend template" /></SelectTrigger>
                <SelectContent>
                  {resendTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {resendTemplates.length === 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  No templates found.{" "}
                  <a href="https://resend.com/templates" target="_blank" rel="noopener noreferrer" className="underline">
                    Create one in Resend first
                  </a>.
                </p>
              )}
            </div>

            {/* Trigger Config */}
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Trigger Config (optional)</p>
              
              <div>
                <Label className="text-xs">Plan Filter</Label>
                <Select 
                  value={newTrigger.trigger_config?.plan_filter || 'any'} 
                  onValueChange={v => setNewTrigger({...newTrigger, trigger_config: {...(newTrigger.trigger_config || {}), plan_filter: v}})}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any plan</SelectItem>
                    <SelectItem value="free">Free only</SelectItem>
                    <SelectItem value="pro_trial">Pro trial only</SelectItem>
                    <SelectItem value="pro">Pro only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Condition Field</Label>
                  <Select 
                    value={newTrigger.trigger_config?.condition_field || ''} 
                    onValueChange={v => setNewTrigger({...newTrigger, trigger_config: {...(newTrigger.trigger_config || {}), condition_field: v}})}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="questions_completed">questions_completed</SelectItem>
                      <SelectItem value="current_streak">current_streak</SelectItem>
                      <SelectItem value="total_lessons_created">total_lessons_created</SelectItem>
                      <SelectItem value="total_exams_completed">total_exams_completed</SelectItem>
                      <SelectItem value="session_count">session_count</SelectItem>
                      <SelectItem value="total_logins">total_logins</SelectItem>
                      <SelectItem value="level">level</SelectItem>
                      <SelectItem value="trial_days_left">trial_days_left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Operator</Label>
                  <Select 
                    value={newTrigger.trigger_config?.condition_operator || 'gte'} 
                    onValueChange={v => setNewTrigger({...newTrigger, trigger_config: {...(newTrigger.trigger_config || {}), condition_operator: v}})}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gte">≥</SelectItem>
                      <SelectItem value="lte">≤</SelectItem>
                      <SelectItem value="eq">=</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Value</Label>
                  <Input 
                    type="number" 
                    className="h-8 text-xs"
                    value={newTrigger.trigger_config?.condition_value ?? ''} 
                    onChange={e => setNewTrigger({...newTrigger, trigger_config: {...(newTrigger.trigger_config || {}), condition_value: parseInt(e.target.value) || 0}})}
                  />
                </div>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Trigger</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}