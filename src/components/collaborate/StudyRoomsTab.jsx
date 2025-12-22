import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Plus, Search, Globe, Lock, MessageCircle, 
  ArrowRight, X, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import StudyRoomChat from "./StudyRoomChat";

export default function StudyRoomsTab({ user }) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeRoom, setActiveRoom] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['study-rooms'],
    queryFn: async () => {
      const publicRooms = await base44.entities.StudyRoom.filter({ is_public: true, is_active: true });
      const myRooms = user?.email 
        ? await base44.entities.StudyRoom.filter({ is_active: true })
        : [];
      
      const myPrivateRooms = myRooms.filter(r => 
        !r.is_public && r.member_emails?.includes(user?.email)
      );
      
      const allRooms = [...publicRooms, ...myPrivateRooms];
      const uniqueRooms = allRooms.filter((room, idx, arr) => 
        arr.findIndex(r => r.id === room.id) === idx
      );
      
      return uniqueRooms.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: true
  });

  const createRoomMutation = useMutation({
    mutationFn: async (roomData) => {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      return base44.entities.StudyRoom.create({
        ...roomData,
        invite_code: inviteCode,
        member_emails: [user.email],
        member_count: 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] });
      setShowCreateModal(false);
    }
  });

  const joinRoomMutation = useMutation({
    mutationFn: async (room) => {
      if (!room.member_emails?.includes(user.email)) {
        await base44.entities.StudyRoom.update(room.id, {
          member_emails: [...(room.member_emails || []), user.email],
          member_count: (room.member_count || 1) + 1
        });
      }
      return room;
    },
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] });
      setActiveRoom(room);
    }
  });

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;
    const found = rooms.find(r => r.invite_code === joinCode.toUpperCase());
    if (found) {
      joinRoomMutation.mutate(found);
      setJoinCode("");
    } else {
      const allRooms = await base44.entities.StudyRoom.filter({ invite_code: joinCode.toUpperCase() });
      if (allRooms.length > 0) {
        joinRoomMutation.mutate(allRooms[0]);
        setJoinCode("");
      }
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.subject?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (activeRoom) {
    return (
      <StudyRoomChat 
        room={activeRoom} 
        user={user} 
        onBack={() => setActiveRoom(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Join code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="w-28"
          />
          <Button variant="outline" onClick={handleJoinByCode} disabled={!joinCode}>
            Join
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Room
          </Button>
        </div>
      </div>

      {/* Rooms Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">No rooms yet</h3>
          <p className="text-sm text-slate-500 mb-4">Create the first study room!</p>
          <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600">
            <Plus className="w-4 h-4 mr-2" />
            Create Room
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room, idx) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-xl border hover:shadow-lg transition-all p-5 cursor-pointer group"
              onClick={() => joinRoomMutation.mutate(room)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <Badge variant={room.is_public ? "secondary" : "outline"} className="text-xs">
                  {room.is_public ? <Globe className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                  {room.is_public ? "Public" : "Private"}
                </Badge>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-purple-700 transition-colors">
                {room.name}
              </h3>
              {room.subject && (
                <Badge variant="outline" className="text-xs mb-2">{room.subject}</Badge>
              )}
              <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                {room.description || "No description"}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {room.member_count || 1} members
                </span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Room Modal */}
      <CreateRoomModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSubmit={(data) => createRoomMutation.mutate(data)}
        isLoading={createRoomMutation.isPending}
      />
    </div>
  );
}

function CreateRoomModal({ open, onOpenChange, onSubmit, isLoading }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ name, description, subject, is_public: isPublic });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Study Room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Room Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Biology Study Group"
              required
            />
          </div>
          <div>
            <Label>Subject (optional)</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Biology 101"
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this room about?"
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Public Room</Label>
              <p className="text-xs text-slate-500">Anyone can join</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <Button type="submit" className="w-full bg-purple-600" disabled={!name || isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Room
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}