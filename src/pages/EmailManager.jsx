import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Send, Clock, Users, AlertCircle, CheckCircle, Zap, Edit, AlertTriangle, Plus, Trash2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function EmailManager() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [quillRef, setQuillRef] = useState(null);
  
  // Manual email state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [userCount, setUserCount] = useState(0);
  
  // Test email state
  const [testRecipient, setTestRecipient] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  
  // Automatic email state
  const [automaticEmails, setAutomaticEmails] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [confirmEnableId, setConfirmEnableId] = useState(null);
  const [testingAutoEmail, setTestingAutoEmail] = useState(null);
  const [autoTestRecipient, setAutoTestRecipient] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    trigger_type: "",
    subject: "",
    body: "",
    trigger_config: {}
  });
  const [autoQuillRef, setAutoQuillRef] = useState(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (user) {
      loadAutomaticEmails();
      
      // Refresh user count every 10 seconds
      const interval = setInterval(async () => {
        try {
          const { data } = await base44.functions.invoke('getUserCount', {});
          setUserCount(data.count || 0);
          setAllUsers(data.users || []);
        } catch (error) {
          console.error("Error refreshing user count:", error);
        }
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [user]);

  const checkAdminAccess = async () => {
    try {
      const currentUser = await base44.auth.me();
      
      if (currentUser.role !== 'admin') {
        navigate(createPageUrl("Home"));
        return;
      }
      
      setUser(currentUser);
      
      // Get user count and all users
      const { data } = await base44.functions.invoke('getUserCount', {});
      setUserCount(data.count || 0);
      setAllUsers(data.users || []);
      
      setLoading(false);
    } catch (error) {
      console.error("Access denied:", error);
      navigate(createPageUrl("Home"));
    }
  };

  const loadAutomaticEmails = async () => {
    try {
      const templates = await base44.entities.AutomaticEmail.list();
      
      // Initialize templates if none exist
      if (templates.length === 0) {
        await base44.functions.invoke('initializeAutomaticEmails', {});
        const newTemplates = await base44.entities.AutomaticEmail.list();
        setAutomaticEmails(newTemplates);
      } else {
        setAutomaticEmails(templates);
      }
    } catch (error) {
      console.error("Error loading automatic emails:", error);
    }
  };

  const handleSendEmail = async () => {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required");
      return;
    }

    setSendingBulk(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await base44.functions.invoke('sendBulkEmail', {
        subject,
        body
      });

      setSuccess(`Email sent successfully to ${data.sent} users!`);
      setSubject("");
      setBody("");
    } catch (err) {
      setError(err.message || "Failed to send email");
    } finally {
      setSendingBulk(false);
    }
  };

  const insertDynamicField = (field) => {
    if (quillRef) {
      const editor = quillRef.getEditor();
      const cursorPosition = editor.getSelection()?.index || editor.getLength();
      editor.insertText(cursorPosition, `{{${field}}}`);
      editor.setSelection(cursorPosition + field.length + 4);
    } else {
      setBody(body + `{{${field}}}`);
    }
  };

  const handleSendTestEmail = async () => {
    if (!subject.trim() || !body.trim() || !testRecipient) {
      setError("Subject, body, and recipient are required for test email");
      return;
    }

    setSendingTest(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await base44.functions.invoke('sendTestEmail', {
        recipient: testRecipient,
        subject,
        body
      });

      setSuccess(`Test email sent successfully to ${testRecipient}!`);
    } catch (err) {
      setError(err.message || "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  const handleToggleAutomaticEmail = async (templateId, enabled) => {
    if (enabled) {
      setConfirmEnableId(templateId);
      return;
    }
    
    try {
      await base44.entities.AutomaticEmail.update(templateId, { enabled });
      setAutomaticEmails(prev => 
        prev.map(email => email.id === templateId ? { ...email, enabled } : email)
      );
      setSuccess(`Email disabled successfully`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError("Failed to update email status");
    }
  };

  const confirmEnableEmail = async () => {
    try {
      await base44.entities.AutomaticEmail.update(confirmEnableId, { enabled: true });
      setAutomaticEmails(prev => 
        prev.map(email => email.id === confirmEnableId ? { ...email, enabled: true } : email)
      );
      setSuccess(`Email enabled successfully`);
      setTimeout(() => setSuccess(""), 3000);
      setConfirmEnableId(null);
    } catch (error) {
      setError("Failed to enable email");
      setConfirmEnableId(null);
    }
  };

  const handleSendAutoTestEmail = async (template) => {
    if (!autoTestRecipient) {
      setError("Please select a recipient for test email");
      return;
    }

    setTestingAutoEmail(template.id);
    setError("");
    setSuccess("");

    try {
      const { data } = await base44.functions.invoke('sendTestEmail', {
        recipient: autoTestRecipient,
        subject: template.subject,
        body: template.body
      });

      setSuccess(`Test email sent successfully to ${autoTestRecipient}!`);
      setAutoTestRecipient("");
    } catch (err) {
      setError(err.message || "Failed to send test email");
    } finally {
      setTestingAutoEmail(null);
    }
  };

  const insertAutoDynamicField = (field) => {
    if (editingTemplate) {
      if (autoQuillRef) {
        const editor = autoQuillRef.getEditor();
        const cursorPosition = editor.getSelection()?.index || editor.getLength();
        editor.insertText(cursorPosition, `{{${field}}}`);
        editor.setSelection(cursorPosition + field.length + 4);
      } else {
        setEditingTemplate({
          ...editingTemplate,
          body: editingTemplate.body + `{{${field}}}`
        });
      }
    } else if (showCreateDialog) {
      setNewTemplate({
        ...newTemplate,
        body: newTemplate.body + `{{${field}}}`
      });
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.trigger_type || !newTemplate.subject || !newTemplate.body) {
      setError("All fields are required");
      return;
    }

    try {
      const created = await base44.entities.AutomaticEmail.create(newTemplate);
      setAutomaticEmails(prev => [...prev, created]);
      setSuccess("Email template created successfully");
      setTimeout(() => setSuccess(""), 3000);
      setShowCreateDialog(false);
      setNewTemplate({
        name: "",
        trigger_type: "",
        subject: "",
        body: "",
        trigger_config: {}
      });
    } catch (error) {
      setError("Failed to create template");
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm("Are you sure you want to delete this email template?")) return;
    
    try {
      await base44.entities.AutomaticEmail.delete(templateId);
      setAutomaticEmails(prev => prev.filter(email => email.id !== templateId));
      setSuccess("Email template deleted successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError("Failed to delete template");
    }
  };

  const handleUpdateTemplate = async (templateId, updates) => {
    try {
      await base44.entities.AutomaticEmail.update(templateId, updates);
      setAutomaticEmails(prev => 
        prev.map(email => email.id === templateId ? { ...email, ...updates } : email)
      );
      setEditingTemplate(null);
      setSuccess("Template updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError("Failed to update template");
    }
  };

  const handleExportUsers = async () => {
    try {
      const { data } = await base44.functions.invoke('exportUsers', {});
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setSuccess("Users exported successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
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

  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Mail className="w-8 h-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-slate-900">Email Manager</h1>
          <Badge variant="destructive" className="ml-2">Admin Only</Badge>
        </div>
        <p className="text-slate-600">Send and manage emails to your users</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-slate-600">Total Users</p>
                  <p className="text-2xl font-bold text-slate-900">{userCount}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportUsers}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="manual" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="manual">
            <Send className="w-4 h-4 mr-2" />
            Manual Email
          </TabsTrigger>
          <TabsTrigger value="automatic">
            <Clock className="w-4 h-4 mr-2" />
            Automatic
          </TabsTrigger>
        </TabsList>

        {/* Manual Email Tab */}
        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle>Compose Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-50 text-green-900 border-green-200">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              {/* Dynamic Fields Helper */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-blue-900 mb-2">User Profile</p>
                  <div className="flex flex-wrap gap-2">
                    {['name', 'email', 'school', 'grade', 'level', 'total_points', 'current_streak', 'questions_completed'].map(field => (
                      <Button
                        key={field}
                        size="sm"
                        variant="outline"
                        onClick={() => insertDynamicField(field)}
                        className="text-xs"
                      >
                        {`{{${field}}}`}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-semibold text-blue-900 mb-2">First Lesson Data</p>
                  <div className="flex flex-wrap gap-2">
                    {['first_lesson_name', 'first_lesson_date', 'first_predicted_grade', 'first_predicted_percentage', 'first_weak_area_count', 'first_task_count', 'first_time_spent_minutes'].map(field => (
                      <Button
                        key={field}
                        size="sm"
                        variant="outline"
                        onClick={() => insertDynamicField(field)}
                        className="text-xs"
                      >
                        {`{{${field}}}`}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-semibold text-blue-900 mb-2">Latest Lesson Data</p>
                  <div className="flex flex-wrap gap-2">
                    {['latest_lesson_name', 'latest_predicted_grade', 'latest_predicted_percentage'].map(field => (
                      <Button
                        key={field}
                        size="sm"
                        variant="outline"
                        onClick={() => insertDynamicField(field)}
                        className="text-xs"
                      >
                        {`{{${field}}}`}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-semibold text-blue-900 mb-2">Overall Progress</p>
                  <div className="flex flex-wrap gap-2">
                    {['total_lessons', 'total_exams_completed', 'total_time_spent_minutes', 'grade_improvement', 'all_predicted_grades'].map(field => (
                      <Button
                        key={field}
                        size="sm"
                        variant="outline"
                        onClick={() => insertDynamicField(field)}
                        className="text-xs"
                      >
                        {`{{${field}}}`}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject..."
                  disabled={sendingTest || sendingBulk}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Email Body *</Label>
                <div className="border rounded-lg overflow-hidden">
                  <ReactQuill
                    ref={(el) => setQuillRef(el)}
                    theme="snow"
                    value={body}
                    onChange={setBody}
                    placeholder="Write your email here... Use {{name}}, {{school}}, {{grade}}, etc. for dynamic content"
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        [{ 'size': ['small', false, 'large', 'huge'] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'indent': '-1'}, { 'indent': '+1' }],
                        [{ 'align': [] }],
                        ['link', 'image'],
                        ['clean']
                      ]
                    }}
                    style={{ minHeight: '300px', background: 'white' }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Emails will be sent to all {userCount} users
                </p>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="testRecipient">Test Email (Optional)</Label>
                  <Select value={testRecipient} onValueChange={setTestRecipient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user to test email" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers.map(u => (
                        <SelectItem key={u.email} value={u.email}>
                          {u.full_name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSendTestEmail}
                  disabled={sendingTest || sendingBulk || !subject.trim() || !body.trim() || !testRecipient}
                  variant="outline"
                  className="border-purple-300"
                >
                  {sendingTest ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Test Email
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSendEmail}
                  disabled={sendingTest || sendingBulk || !subject.trim() || !body.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {sendingBulk ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send to All {userCount} Users
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automatic Email Tab */}
        <TabsContent value="automatic">
          <div className="mb-4">
            <Button onClick={() => setShowCreateDialog(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Create New Automatic Email
            </Button>
          </div>
          <div className="space-y-4">
            {automaticEmails.map(email => (
              <Card key={email.id} className={email.enabled ? 'border-green-300' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap className={`w-5 h-5 ${email.enabled ? 'text-green-600' : 'text-slate-400'}`} />
                      <div>
                        <CardTitle className="text-lg">{email.name}</CardTitle>
                        <p className="text-sm text-slate-500 mt-1">
                          Trigger: {email.trigger_type.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={email.enabled ? "default" : "secondary"}>
                        {email.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                      <Switch
                        checked={email.enabled}
                        onCheckedChange={(checked) => handleToggleAutomaticEmail(email.id, checked)}
                        disabled={confirmEnableId === email.id}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingTemplate?.id === email.id ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                        <div>
                          <p className="text-xs font-semibold text-blue-900 mb-1">User Profile</p>
                          <div className="flex flex-wrap gap-1">
                            {['name', 'email', 'school', 'grade', 'level', 'total_points', 'current_streak', 'questions_completed'].map(field => (
                              <Button
                                key={field}
                                size="sm"
                                variant="outline"
                                onClick={() => insertAutoDynamicField(field)}
                                className="text-xs"
                              >
                                {`{{${field}}}`}
                              </Button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-xs font-semibold text-blue-900 mb-1">First Lesson</p>
                          <div className="flex flex-wrap gap-1">
                            {['first_lesson_name', 'first_predicted_grade', 'first_predicted_percentage', 'first_weak_area_count', 'first_task_count', 'first_time_spent_minutes'].map(field => (
                              <Button
                                key={field}
                                size="sm"
                                variant="outline"
                                onClick={() => insertAutoDynamicField(field)}
                                className="text-xs"
                              >
                                {`{{${field}}}`}
                              </Button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-xs font-semibold text-blue-900 mb-1">Progress</p>
                          <div className="flex flex-wrap gap-1">
                            {['latest_predicted_grade', 'total_lessons', 'total_exams_completed', 'grade_improvement', 'all_predicted_grades'].map(field => (
                              <Button
                                key={field}
                                size="sm"
                                variant="outline"
                                onClick={() => insertAutoDynamicField(field)}
                                className="text-xs"
                              >
                                {`{{${field}}}`}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Trigger Type</Label>
                        <Select 
                          value={editingTemplate.trigger_type} 
                          onValueChange={(value) => setEditingTemplate({...editingTemplate, trigger_type: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="onboarding_completed">User Completes Onboarding</SelectItem>
                            <SelectItem value="first_lesson_created">User Creates First Lesson</SelectItem>
                            <SelectItem value="first_diagnostic_completed">User Completes First Diagnostic</SelectItem>
                            <SelectItem value="first_worksheet_created">User Creates First Worksheet</SelectItem>
                            <SelectItem value="first_worksheet_completed">User Completes First Worksheet</SelectItem>
                            <SelectItem value="lesson_all_worksheets_completed">User Completes All 6 Worksheets</SelectItem>
                            <SelectItem value="first_assignment_created">User Creates First Assignment</SelectItem>
                            <SelectItem value="first_assignment_graded">User Completes First Graded Assignment</SelectItem>
                            <SelectItem value="level_milestone">User Reaches Level Milestone</SelectItem>
                            <SelectItem value="badge_earned">User Earns First Badge</SelectItem>
                            <SelectItem value="streak_milestone">User Reaches Streak Milestone</SelectItem>
                            <SelectItem value="streak_broken">User Breaks Streak</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(editingTemplate.trigger_type === 'level_milestone' || editingTemplate.trigger_type === 'streak_milestone') && (
                        <div className="space-y-2">
                          <Label>Milestone Value</Label>
                          <Input
                            type="number"
                            value={editingTemplate.trigger_config?.milestone_value || ''}
                            onChange={(e) => setEditingTemplate({
                              ...editingTemplate,
                              trigger_config: { milestone_value: parseInt(e.target.value) || 0 }
                            })}
                            placeholder="e.g., 5 for level 5, or 7 for 7-day streak"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Subject</Label>
                        <Input
                          value={editingTemplate.subject}
                          onChange={(e) => setEditingTemplate({...editingTemplate, subject: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Body</Label>
                        <div className="border rounded-lg overflow-hidden">
                          <ReactQuill
                            ref={(el) => setAutoQuillRef(el)}
                            theme="snow"
                            value={editingTemplate.body}
                            onChange={(value) => setEditingTemplate({...editingTemplate, body: value})}
                            modules={{
                              toolbar: [
                                [{ 'header': [1, 2, 3, false] }],
                                [{ 'size': ['small', false, 'large', 'huge'] }],
                                ['bold', 'italic', 'underline', 'strike'],
                                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                [{ 'indent': '-1'}, { 'indent': '+1' }],
                                [{ 'align': [] }],
                                ['link', 'image'],
                                ['clean']
                              ]
                            }}
                            style={{ minHeight: '200px', background: 'white' }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdateTemplate(email.id, {
                            trigger_type: editingTemplate.trigger_type,
                            trigger_config: editingTemplate.trigger_config,
                            subject: editingTemplate.subject,
                            body: editingTemplate.body
                          })}
                        >
                          Save Changes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingTemplate(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">Subject:</p>
                        <p className="text-sm text-slate-600">{email.subject}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">Body Preview:</p>
                        <div 
                          className="text-sm text-slate-600 line-clamp-4 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: email.body }}
                        />
                      </div>
                      <div className="space-y-3 pt-2">
                        <p className="text-xs text-slate-500">
                          Sent: {email.send_count || 0} times
                        </p>
                        
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs">Test Email</Label>
                          <div className="flex gap-2">
                            <Select 
                              value={autoTestRecipient} 
                              onValueChange={setAutoTestRecipient}
                              disabled={testingAutoEmail === email.id}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select user" />
                              </SelectTrigger>
                              <SelectContent>
                                {allUsers.map(u => (
                                  <SelectItem key={u.email} value={u.email}>
                                    {u.full_name} ({u.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendAutoTestEmail(email)}
                              disabled={!autoTestRecipient || testingAutoEmail === email.id}
                            >
                              {testingAutoEmail === email.id ? "Sending..." : "Send Test"}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingTemplate({...email})}
                            className="flex-1"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteTemplate(email.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmEnableId} onOpenChange={() => setConfirmEnableId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Enable Automatic Email?
            </DialogTitle>
            <DialogDescription>
              This will automatically send emails to users based on the trigger conditions. 
              Are you sure you want to enable this automated email?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEnableId(null)}>
              Cancel
            </Button>
            <Button onClick={confirmEnableEmail} className="bg-amber-600 hover:bg-amber-700">
              Yes, Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Email Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Automatic Email</DialogTitle>
            <DialogDescription>
              Set up a new automated email that will be sent when specific triggers occur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
              <div>
                <p className="text-xs font-semibold text-blue-900 mb-1">User Profile</p>
                <div className="flex flex-wrap gap-1">
                  {['name', 'email', 'school', 'grade', 'level', 'total_points', 'current_streak', 'questions_completed'].map(field => (
                    <Button
                      key={field}
                      size="sm"
                      variant="outline"
                      onClick={() => insertAutoDynamicField(field)}
                      className="text-xs"
                    >
                      {`{{${field}}}`}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-xs font-semibold text-blue-900 mb-1">First Lesson</p>
                <div className="flex flex-wrap gap-1">
                  {['first_lesson_name', 'first_predicted_grade', 'first_predicted_percentage', 'first_weak_area_count', 'first_task_count', 'first_time_spent_minutes'].map(field => (
                    <Button
                      key={field}
                      size="sm"
                      variant="outline"
                      onClick={() => insertAutoDynamicField(field)}
                      className="text-xs"
                    >
                      {`{{${field}}}`}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-xs font-semibold text-blue-900 mb-1">Progress</p>
                <div className="flex flex-wrap gap-1">
                  {['latest_predicted_grade', 'total_lessons', 'total_exams_completed', 'grade_improvement', 'all_predicted_grades'].map(field => (
                    <Button
                      key={field}
                      size="sm"
                      variant="outline"
                      onClick={() => insertAutoDynamicField(field)}
                      className="text-xs"
                    >
                      {`{{${field}}}`}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                placeholder="e.g., Welcome Email"
              />
            </div>

            <div className="space-y-2">
              <Label>Trigger Type *</Label>
              <Select 
                value={newTemplate.trigger_type} 
                onValueChange={(value) => setNewTemplate({...newTemplate, trigger_type: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onboarding_completed">User Completes Onboarding</SelectItem>
                  <SelectItem value="first_lesson_created">User Creates First Lesson</SelectItem>
                  <SelectItem value="first_diagnostic_completed">User Completes First Diagnostic</SelectItem>
                  <SelectItem value="first_worksheet_created">User Creates First Worksheet</SelectItem>
                  <SelectItem value="first_worksheet_completed">User Completes First Worksheet</SelectItem>
                  <SelectItem value="lesson_all_worksheets_completed">User Completes All 6 Worksheets</SelectItem>
                  <SelectItem value="first_assignment_created">User Creates First Assignment</SelectItem>
                  <SelectItem value="first_assignment_graded">User Completes First Graded Assignment</SelectItem>
                  <SelectItem value="level_milestone">User Reaches Level Milestone</SelectItem>
                  <SelectItem value="badge_earned">User Earns First Badge</SelectItem>
                  <SelectItem value="streak_milestone">User Reaches Streak Milestone</SelectItem>
                  <SelectItem value="streak_broken">User Breaks Streak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(newTemplate.trigger_type === 'level_milestone' || newTemplate.trigger_type === 'streak_milestone') && (
              <div className="space-y-2">
                <Label>Milestone Value</Label>
                <Input
                  type="number"
                  value={newTemplate.trigger_config?.milestone_value || ''}
                  onChange={(e) => setNewTemplate({
                    ...newTemplate,
                    trigger_config: { milestone_value: parseInt(e.target.value) || 0 }
                  })}
                  placeholder="e.g., 5 for level 5, or 7 for 7-day streak"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                value={newTemplate.subject}
                onChange={(e) => setNewTemplate({...newTemplate, subject: e.target.value})}
                placeholder="Email subject..."
              />
            </div>

            <div className="space-y-2">
              <Label>Body *</Label>
              <div className="border rounded-lg overflow-hidden">
                <ReactQuill
                  theme="snow"
                  value={newTemplate.body}
                  onChange={(value) => setNewTemplate({...newTemplate, body: value})}
                  placeholder="Write your email here..."
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      [{ 'size': ['small', false, 'large', 'huge'] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      [{ 'indent': '-1'}, { 'indent': '+1' }],
                      [{ 'align': [] }],
                      ['link', 'image'],
                      ['clean']
                    ]
                  }}
                  style={{ minHeight: '200px', background: 'white' }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate}>
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}