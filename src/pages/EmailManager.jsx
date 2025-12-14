import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Send, Clock, Users, AlertCircle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function EmailManager() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Manual email state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const currentUser = await base44.auth.me();
      
      if (currentUser.email !== 'kartikeya2159@gmail.com') {
        navigate(createPageUrl("Home"));
        return;
      }
      
      setUser(currentUser);
      
      // Get user count
      const { data } = await base44.functions.invoke('getUserCount', {});
      setUserCount(data.count || 0);
      
      setLoading(false);
    } catch (error) {
      console.error("Access denied:", error);
      navigate(createPageUrl("Home"));
    }
  };

  const handleSendEmail = async () => {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required");
      return;
    }

    setSending(true);
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
      setSending(false);
    }
  };

  const insertDynamicField = (field) => {
    setBody(body + `{{${field}}}`);
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
                  {['name', 'level', 'total_points', 'current_streak', 'questions_completed'].map(field => (
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
                  disabled={sending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Email Body *</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your email here... Use {{name}}, {{level}}, etc. for dynamic content"
                  className="min-h-[300px] font-mono text-sm"
                  disabled={sending}
                />
                <p className="text-xs text-slate-500">
                  Emails will be sent to all {userCount} users
                </p>
              </div>

              <Button
                onClick={handleSendEmail}
                disabled={sending || !subject.trim() || !body.trim()}
                className="w-full md:w-auto bg-purple-600 hover:bg-purple-700"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send to All Users
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automatic Email Tab */}
        <TabsContent value="automatic">
          <Card>
            <CardContent className="p-12 text-center">
              <Clock className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Coming Soon</h3>
              <p className="text-slate-500">Automatic milestone-based emails will be available here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}