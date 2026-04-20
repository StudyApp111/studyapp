import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, Send, Trash2, Edit, AlertTriangle, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TRIGGER_LABELS = {
  signup: "Email 0 — Welcome (instant on signup)",
  onboarding_completed: "Completes Onboarding",
  first_lesson_created: "First Lesson Created",
  first_diagnostic_completed: "First Diagnostic Completed",
  first_studyplan_generated: "First Study Plan Generated",
  first_worksheet_completed: "First Worksheet Completed",
  first_assignment_graded: "First Assignment Graded",
  lesson_all_worksheets_completed: "All Worksheets Completed",
  signup_no_lesson_4h: "Email 1 — Lesson nudge (4h after signup, no lesson)",
  lesson_no_diagnostic_24h: "Email 2 — Quiz nudge (24h after lesson, no quiz)",
  quiz_no_return_24h: "Email 3 — Fear re-engagement (24h after quiz, no return)",
  session_no_followup_24h: "Email 4 — Streak builder (24h after first session, no follow-up)",
  upgrade_momentum: "Email 5 — Upgrade moment (threshold reached, free users)",
  trial_expiring: "Email 6 — Trial expiry (2 days left, pro trial)",
  inactive_3_days: "Inactive 3 Days",
  inactive_7_days: "Inactive 7 Days",
  inactive_14_days: "Inactive 14 Days",
  inactive_30_days: "Inactive 30 Days",
};

export default function TriggerCard({ trigger, allUsers, resendTemplates, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [editData, setEditData] = useState({});

  const handleToggle = (checked) => {
    if (checked) {
      setConfirmEnable(true);
    } else {
      onUpdate(trigger.id, { enabled: false });
    }
  };

  const confirmToggleOn = () => {
    onUpdate(trigger.id, { enabled: true });
    setConfirmEnable(false);
  };

  const handleSaveEdit = () => {
    onUpdate(trigger.id, editData);
    setEditing(false);
    setEditData({});
  };

  const handleSendTest = async () => {
    if (!testRecipient) return;
    setSendingTest(true);
    setTestResult(null);
    try {
      const { data } = await base44.functions.invoke("sendResendEmail", {
        trigger_type: trigger.trigger_type,
        user_email: testRecipient,
        is_test: true,
        context: { template_id: trigger.id }
      });
      setTestResult({ success: true, message: `Sent to ${testRecipient}` });
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setSendingTest(false);
    }
  };

  const startEdit = () => {
    setEditData({
      name: trigger.name,
      trigger_type: trigger.trigger_type,
      resend_template_id: trigger.resend_template_id,
      trigger_config: trigger.trigger_config || {}
    });
    setEditing(true);
  };

  const filteredUsers = testRecipient
    ? allUsers.filter(u =>
        (u.full_name || '').toLowerCase().includes(testRecipient.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(testRecipient.toLowerCase())
      ).slice(0, 5)
    : [];

  const matchedTemplate = resendTemplates.find(t => t.id === trigger.resend_template_id);

  return (
    <>
      <Card className={`${trigger.enabled ? 'border-green-500/40 bg-green-500/5' : ''} transition-all`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className={`w-5 h-5 ${trigger.enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
              <div>
                <CardTitle className="text-base text-foreground">{trigger.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {TRIGGER_LABELS[trigger.trigger_type] || trigger.trigger_type}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={trigger.enabled ? "default" : "secondary"} className="text-xs">
                {trigger.enabled ? 'Active' : 'Off'}
              </Badge>
              <Switch checked={trigger.enabled} onCheckedChange={handleToggle} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Resend Template Info */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">Resend Template</p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-foreground font-medium">
                {matchedTemplate?.name || trigger.resend_template_name || 'Unknown template'}
              </p>
              <a 
                href="https://resend.com/templates" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-500 hover:text-purple-400"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{trigger.resend_template_id}</p>
          </div>

          {/* Trigger config display */}
          {trigger.trigger_config && Object.keys(trigger.trigger_config).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {trigger.trigger_config.plan_filter && trigger.trigger_config.plan_filter !== 'any' && (
                <Badge variant="outline" className="text-[10px]">Plan: {trigger.trigger_config.plan_filter}</Badge>
              )}
              {trigger.trigger_config.condition_field && (
                <Badge variant="outline" className="text-[10px]">
                  {trigger.trigger_config.condition_field} {trigger.trigger_config.condition_operator || '≥'} {trigger.trigger_config.condition_value}
                </Badge>
              )}
              {trigger.trigger_config.delay_hours && (
                <Badge variant="outline" className="text-[10px]">Delay: {trigger.trigger_config.delay_hours}h</Badge>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">Sent: {trigger.send_count || 0} times</p>

          {/* Test Send */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Send Test</Label>
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <Input
                  type="email"
                  placeholder="Search or type email..."
                  value={testRecipient}
                  onChange={e => setTestRecipient(e.target.value)}
                  className="h-8 text-xs pr-2"
                />
                {testRecipient && filteredUsers.length > 0 && !allUsers.some(u => u.email === testRecipient) && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filteredUsers.map(u => (
                      <button
                        key={u.email}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                        onClick={() => setTestRecipient(u.email)}
                      >
                        <span className="font-medium text-foreground">{u.full_name || 'Unknown'}</span>
                        <span className="text-muted-foreground ml-1">({u.email})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSendTest}
                disabled={!testRecipient || sendingTest}
                className="h-8"
              >
                {sendingTest ? "..." : <><Send className="w-3 h-3 mr-1" /> Test</>}
              </Button>
            </div>
          </div>

          {testResult && (
            <p className={`text-xs ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.message}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={startEdit} className="flex-1 h-8">
              <Edit className="w-3 h-3 mr-1" /> Edit
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onDelete(trigger.id)} className="h-8">
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Enable Dialog */}
      <Dialog open={confirmEnable} onOpenChange={setConfirmEnable}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Enable Trigger?
            </DialogTitle>
            <DialogDescription>
              This will automatically send emails via Resend when "{TRIGGER_LABELS[trigger.trigger_type]}" occurs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEnable(false)}>Cancel</Button>
            <Button onClick={confirmToggleOn} className="bg-amber-600 hover:bg-amber-700">Yes, Enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Trigger</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} />
            </div>
            <div>
              <Label>Trigger</Label>
              <Select value={editData.trigger_type || ''} onValueChange={v => setEditData({...editData, trigger_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resend Template</Label>
              <Select value={editData.resend_template_id || ''} onValueChange={v => {
                const t = resendTemplates.find(rt => rt.id === v);
                setEditData({...editData, resend_template_id: v, resend_template_name: t?.name || ''});
              }}>
                <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  {resendTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trigger Config */}
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Trigger Config (optional)</p>
              
              <div>
                <Label className="text-xs">Plan Filter</Label>
                <Select 
                  value={editData.trigger_config?.plan_filter || 'any'} 
                  onValueChange={v => setEditData({...editData, trigger_config: {...(editData.trigger_config || {}), plan_filter: v}})}
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
                    value={editData.trigger_config?.condition_field || ''} 
                    onValueChange={v => setEditData({...editData, trigger_config: {...(editData.trigger_config || {}), condition_field: v}})}
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
                    value={editData.trigger_config?.condition_operator || 'gte'} 
                    onValueChange={v => setEditData({...editData, trigger_config: {...(editData.trigger_config || {}), condition_operator: v}})}
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
                    value={editData.trigger_config?.condition_value ?? ''} 
                    onChange={e => setEditData({...editData, trigger_config: {...(editData.trigger_config || {}), condition_value: parseInt(e.target.value) || 0}})}
                  />
                </div>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}