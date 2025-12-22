import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Calendar, Plus, Clock, Users, Video, Loader2, 
  Check, X, ChevronLeft, ChevronRight, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from "date-fns";

export default function GroupCalendar({ group, user, isLeader }) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['group-sessions', group.id],
    queryFn: () => base44.entities.GroupSession.filter({ group_id: group.id })
  });

  const createSessionMutation = useMutation({
    mutationFn: (data) => base44.entities.GroupSession.create({
      ...data,
      group_id: group.id,
      attendees: [user.email]
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-sessions', group.id] });
      setShowCreateModal(false);
      toast.success("Session scheduled!");
    }
  });

  const toggleAttendanceMutation = useMutation({
    mutationFn: async (session) => {
      const isAttending = session.attendees?.includes(user.email);
      await base44.entities.GroupSession.update(session.id, {
        attendees: isAttending
          ? session.attendees.filter(e => e !== user.email)
          : [...(session.attendees || []), user.email]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-sessions', group.id] });
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id) => base44.entities.GroupSession.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-sessions', group.id] });
      toast.success("Session deleted");
    }
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getSessionsForDay = (date) => {
    return sessions.filter(s => 
      isSameDay(new Date(s.scheduled_date), date)
    );
  };

  const upcomingSessions = sessions
    .filter(s => new Date(s.scheduled_date) >= new Date())
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-600" />
          Study Sessions
        </h3>
        {isLeader && (
          <Button size="sm" onClick={() => setShowCreateModal(true)} className="bg-purple-600">
            <Plus className="w-4 h-4 mr-1" />
            Schedule
          </Button>
        )}
      </div>

      {/* Mini Calendar */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-slate-100 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-medium">{format(currentMonth, 'MMMM yyyy')}</span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-slate-100 rounded">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-slate-400 font-medium py-1">{d}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {Array(monthStart.getDay()).fill(null).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {daysInMonth.map(day => {
            const daySessions = getSessionsForDay(day);
            const hasSession = daySessions.length > 0;
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(isSameDay(selectedDate, day) ? null : day)}
                className={`p-1.5 text-sm rounded-lg transition-all relative ${
                  isToday(day) ? 'font-bold text-purple-600' : ''
                } ${
                  selectedDate && isSameDay(selectedDate, day) 
                    ? 'bg-purple-600 text-white' 
                    : hasSession 
                      ? 'bg-purple-100 hover:bg-purple-200' 
                      : 'hover:bg-slate-100'
                }`}
              >
                {format(day, 'd')}
                {hasSession && !isSameDay(selectedDate, day) && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-purple-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Sessions */}
      {selectedDate && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-700">
            {format(selectedDate, 'EEEE, MMMM d')}
          </div>
          {getSessionsForDay(selectedDate).length === 0 ? (
            <p className="text-sm text-slate-400">No sessions scheduled</p>
          ) : (
            getSessionsForDay(selectedDate).map(session => (
              <SessionCard 
                key={session.id} 
                session={session} 
                user={user}
                isLeader={isLeader}
                members={group.member_progress}
                onToggle={() => toggleAttendanceMutation.mutate(session)}
                onDelete={() => deleteSessionMutation.mutate(session.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Upcoming Sessions */}
      {!selectedDate && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-700">Upcoming Sessions</div>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            </div>
          ) : upcomingSessions.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 rounded-xl">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No upcoming sessions</p>
            </div>
          ) : (
            upcomingSessions.map(session => (
              <SessionCard 
                key={session.id} 
                session={session} 
                user={user}
                isLeader={isLeader}
                members={group.member_progress}
                onToggle={() => toggleAttendanceMutation.mutate(session)}
                onDelete={() => deleteSessionMutation.mutate(session.id)}
              />
            ))
          )}
        </div>
      )}

      <CreateSessionModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSubmit={(data) => createSessionMutation.mutate(data)}
        isLoading={createSessionMutation.isPending}
      />
    </div>
  );
}

function SessionCard({ session, user, isLeader, members, onToggle, onDelete }) {
  const isAttending = session.attendees?.includes(user.email);
  const sessionDate = new Date(session.scheduled_date);
  const isPast = sessionDate < new Date();

  return (
    <div className={`p-4 rounded-xl border ${isPast ? 'bg-slate-50 opacity-60' : 'bg-white'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-medium text-slate-900">{session.title}</div>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(sessionDate, 'MMM d, h:mm a')}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {session.attendees?.length || 0} attending
            </span>
            {session.duration_minutes && (
              <Badge variant="outline" className="text-xs">
                {session.duration_minutes}min
              </Badge>
            )}
          </div>
          {session.description && (
            <p className="text-sm text-slate-500 mt-2">{session.description}</p>
          )}
          {session.meeting_link && (
            <a 
              href={session.meeting_link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-purple-600 mt-2 hover:underline"
            >
              <Video className="w-3 h-3" />
              Join Meeting
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isPast && (
            <Button 
              size="sm" 
              variant={isAttending ? "default" : "outline"}
              onClick={onToggle}
              className={isAttending ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {isAttending ? <Check className="w-4 h-4 mr-1" /> : null}
              {isAttending ? "Going" : "RSVP"}
            </Button>
          )}
          {isLeader && (
            <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateSessionModal({ open, onOpenChange, onSubmit, isLoading }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("14:00");
  const [duration, setDuration] = useState("60");
  const [meetingLink, setMeetingLink] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    onSubmit({
      title,
      description,
      scheduled_date: dateTime.toISOString(),
      duration_minutes: parseInt(duration),
      meeting_link: meetingLink || null
    });
    setTitle("");
    setDescription("");
    setScheduledDate("");
    setScheduledTime("14:00");
    setDuration("60");
    setMeetingLink("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Study Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Session Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Chapter 5 Review Session"
              required
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will you cover?"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Time</Label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="15"
              max="240"
            />
          </div>
          <div>
            <Label>Meeting Link (optional)</Label>
            <Input
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="Zoom/Google Meet link"
            />
          </div>
          <Button type="submit" className="w-full bg-purple-600" disabled={!title || !scheduledDate || isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Schedule Session
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}