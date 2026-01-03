import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Target, Plus, Search, Users, Calendar, Trophy,
  ArrowRight, Copy, Check, Loader2, TrendingUp,
  CheckSquare, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import GroupTasks from "@/components/collaborate/GroupTasks";
import GroupWhiteboard from "@/components/collaborate/GroupWhiteboard";
import GroupCalendar from "@/components/collaborate/GroupCalendar";

export default function StudyGroupsTab({ user }) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['study-groups'],
    queryFn: async () => {
      const publicGroups = await base44.entities.StudyGroup.filter({ is_public: true });
      const allGroups = await base44.entities.StudyGroup.list('-created_date', 100);
      
      const myGroups = allGroups.filter(g => 
        g.member_emails?.includes(user?.email) || g.created_by === user?.email
      );
      
      const combined = [...publicGroups, ...myGroups];
      return combined.filter((g, idx, arr) => arr.findIndex(x => x.id === g.id) === idx);
    }
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data) => {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      return base44.entities.StudyGroup.create({
        ...data,
        invite_code: inviteCode,
        member_emails: [user.email],
        member_progress: [{
          email: user.email,
          name: user.full_name || "You",
          progress: 0,
          last_active: new Date().toISOString()
        }]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-groups'] });
      setShowCreateModal(false);
    }
  });

  const joinGroupMutation = useMutation({
    mutationFn: async (group) => {
      if (group.member_emails?.includes(user.email)) return group;
      
      await base44.entities.StudyGroup.update(group.id, {
        member_emails: [...(group.member_emails || []), user.email],
        member_progress: [
          ...(group.member_progress || []),
          {
            email: user.email,
            name: user.full_name || "Member",
            progress: 0,
            last_active: new Date().toISOString()
          }
        ]
      });
      return group;
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['study-groups'] });
      setActiveGroup(group);
      toast.success("Joined group!");
    }
  });

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;
    const found = groups.find(g => g.invite_code === joinCode.toUpperCase());
    if (found) {
      joinGroupMutation.mutate(found);
      setJoinCode("");
    } else {
      const allGroups = await base44.entities.StudyGroup.filter({ invite_code: joinCode.toUpperCase() });
      if (allGroups.length > 0) {
        joinGroupMutation.mutate(allGroups[0]);
        setJoinCode("");
      } else {
        toast.error("Group not found");
      }
    }
  };

  const filteredGroups = groups.filter(g =>
    g.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.subject?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (activeGroup) {
    return (
      <GroupDetail
        group={activeGroup}
        user={user}
        onBack={() => {
          setActiveGroup(null);
          queryClient.invalidateQueries({ queryKey: ['study-groups'] });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="w-20 text-sm"
          />
          <Button variant="outline" size="sm" onClick={handleJoinByCode} disabled={!joinCode}>
            Join
          </Button>
          <Button onClick={() => setShowCreateModal(true)} size="sm" className="bg-purple-600 hover:bg-purple-700 flex-1 sm:flex-none">
            <Plus className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Create</span>
          </Button>
        </div>
      </div>

      {/* Groups Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border">
          <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">No study groups yet</h3>
          <p className="text-sm text-slate-500 mb-4">Create one to study with friends!</p>
          <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600">
            <Plus className="w-4 h-4 mr-2" />
            Create Group
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group, idx) => {
            const avgProgress = group.member_progress?.length 
              ? Math.round(group.member_progress.reduce((sum, m) => sum + (m.progress || 0), 0) / group.member_progress.length)
              : 0;
            
            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-xl border hover:shadow-lg transition-all p-5 cursor-pointer group"
                onClick={() => {
                  if (group.member_emails?.includes(user?.email) || group.is_public) {
                    joinGroupMutation.mutate(group);
                  }
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    {group.member_emails?.length || 1}
                  </Badge>
                </div>
                <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-purple-700 transition-colors">
                  {group.name}
                </h3>
                {group.subject && (
                  <Badge variant="outline" className="text-xs mb-2">{group.subject}</Badge>
                )}
                {group.goal && (
                  <p className="text-sm text-slate-500 line-clamp-2 mb-3">{group.goal}</p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Group Progress</span>
                    <span className="font-medium text-purple-600">{avgProgress}%</span>
                  </div>
                  <Progress value={avgProgress} className="h-2" />
                </div>
                {group.target_date && (
                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-3">
                    <Calendar className="w-3 h-3" />
                    Target: {new Date(group.target_date).toLocaleDateString()}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSubmit={(data) => createGroupMutation.mutate(data)}
        isLoading={createGroupMutation.isPending}
      />
    </div>
  );
}

function GroupDetail({ group, user, onBack }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [myProgress, setMyProgress] = useState(
    group.member_progress?.find(m => m.email === user?.email)?.progress || 0
  );

  const isLeader = group.created_by === user?.email;

  const updateProgressMutation = useMutation({
    mutationFn: async (newProgress) => {
      const updatedMembers = group.member_progress?.map(m =>
        m.email === user?.email 
          ? { ...m, progress: newProgress, last_active: new Date().toISOString() }
          : m
      ) || [];
      
      await base44.entities.StudyGroup.update(group.id, {
        member_progress: updatedMembers
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-groups'] });
      toast.success("Progress updated!");
    }
  });

  const copyInviteCode = () => {
    navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    toast.success("Invite code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const sortedMembers = [...(group.member_progress || [])].sort((a, b) => 
    (b.progress || 0) - (a.progress || 0)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowRight className="w-4 h-4 rotate-180" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {isLeader && <Badge className="bg-amber-100 text-amber-700">Leader</Badge>}
          <Button variant="outline" onClick={copyInviteCode} className="gap-2">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {group.invite_code}
          </Button>
        </div>
      </div>

      {/* Group Header */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shrink-0">
            <Target className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900 mb-1">{group.name}</h2>
            {group.subject && <Badge className="mb-2">{group.subject}</Badge>}
            {group.goal && <p className="text-slate-600">{group.goal}</p>}
            {group.target_date && (
              <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                <Calendar className="w-4 h-4" />
                Target: {new Date(group.target_date).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full bg-white border">
          <TabsTrigger value="overview" className="gap-1 text-xs sm:text-sm">
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1 text-xs sm:text-sm">
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1 text-xs sm:text-sm">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Notes</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1 text-xs sm:text-sm">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Update Your Progress */}
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Update Your Progress</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  type="range"
                  min="0"
                  max="100"
                  value={myProgress}
                  onChange={(e) => setMyProgress(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="font-bold text-purple-600 w-12">{myProgress}%</span>
              </div>
              <Button 
                onClick={() => updateProgressMutation.mutate(myProgress)}
                disabled={updateProgressMutation.isPending}
                className="bg-purple-600"
              >
                {updateProgressMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Progress
              </Button>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="bg-white rounded-2xl border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900">Group Leaderboard</h3>
            </div>
            <div className="space-y-3">
              {sortedMembers.map((member, idx) => (
                <div 
                  key={member.email}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    member.email === user?.email ? 'bg-purple-50 ring-1 ring-purple-200' : 'bg-slate-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0 ? 'bg-amber-100 text-amber-700' :
                    idx === 1 ? 'bg-slate-200 text-slate-700' :
                    idx === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      {member.name || "Member"}
                      {member.email === user?.email && <span className="text-purple-600 ml-1">(You)</span>}
                    </div>
                    <Progress value={member.progress || 0} className="h-1.5 mt-1" />
                  </div>
                  <span className="font-bold text-purple-600">{member.progress || 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <div className="bg-white rounded-2xl border p-6">
            <GroupTasks group={group} user={user} isLeader={isLeader} />
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <div className="bg-white rounded-2xl border p-6">
            <GroupWhiteboard group={group} user={user} />
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <div className="bg-white rounded-2xl border p-6">
            <GroupCalendar group={group} user={user} isLeader={isLeader} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateGroupModal({ open, onOpenChange, onSubmit, isLoading }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [goal, setGoal] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ name, subject, goal, target_date: targetDate, is_public: isPublic });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Study Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Group Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Finals Study Squad"
              required
            />
          </div>
          <div>
            <Label>Subject (optional)</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Chemistry"
            />
          </div>
          <div>
            <Label>Goal</Label>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What are you trying to achieve?"
              rows={2}
            />
          </div>
          <div>
            <Label>Target Date (optional)</Label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Public Group</Label>
              <p className="text-xs text-slate-500">Anyone can find and join</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <Button type="submit" className="w-full bg-purple-600" disabled={!name || isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Group
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}