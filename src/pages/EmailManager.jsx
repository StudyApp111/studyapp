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
import { Mail, Send, Clock, Users, AlertCircle, CheckCircle, Zap, Edit } from "lucide-react";
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

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (user) {
      loadAutomaticEmails();
    }
  }, [user]);

  const checkAdminAccess = async () => {
    try {
      const currentUser = await base44.auth.me();
      
      if (currentUser.email !== 'kartikeya2159@gmail.com') {
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
    try {
      await base44.entities.AutomaticEmail.update(templateId, { enabled });
      setAutomaticEmails(prev => 
        prev.map(email => email.id === templateId ? { ...email, enabled } : email)
      );
      setSuccess(`Email ${enabled ? 'enabled' : 'disabled'} successfully`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError("Failed to update email status");
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
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-slate-600">Total Users</p>
                <p className="text-2xl font-bold text-slate-900">{userCount}</p>
              </div>
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
            Automatic (Coming Soon)
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
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-900 mb-2">Dynamic Fields:</p>
                <div className="flex flex-wrap gap-2">
                  {['name', 'school', 'grade', 'level', 'total_points', 'current_streak', 'questions_completed'].map(field => (
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
                <p className="text-xs text-blue-700 mt-2">Click to insert into email body</p>
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
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingTemplate?.id === email.id ? (
                    <div className="space-y-4">
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
                            theme="snow"
                            value={editingTemplate.body}
                            onChange={(value) => setEditingTemplate({...editingTemplate, body: value})}
                            modules={{
                              toolbar: [
                                [{ 'header': [1, 2, 3, false] }],
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
                      <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-slate-500">
                          Sent: {email.send_count || 0} times
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingTemplate({...email})}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit Template
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}