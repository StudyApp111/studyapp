import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  CheckSquare, Plus, Calendar, User, Flag, Loader2, 
  Check, Circle, Clock, Trash2 
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function GroupTasks({ group, user, isLeader }) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['group-tasks', group.id],
    queryFn: () => base44.entities.GroupTask.filter({ group_id: group.id })
  });

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.GroupTask.create({
      ...data,
      group_id: group.id,
      completed_by: []
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-tasks', group.id] });
      setShowCreateModal(false);
      toast.success("Task created!");
    }
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: async (task) => {
      const isCompleted = task.completed_by?.includes(user.email);
      const newCompletedBy = isCompleted
        ? task.completed_by.filter(e => e !== user.email)
        : [...(task.completed_by || []), user.email];
      
      await base44.entities.GroupTask.update(task.id, {
        completed_by: newCompletedBy,
        status: newCompletedBy.length === task.assigned_to?.length ? 'completed' : 
                newCompletedBy.length > 0 ? 'in_progress' : 'pending'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-tasks', group.id] });
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId) => base44.entities.GroupTask.delete(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-tasks', group.id] });
      toast.success("Task deleted");
    }
  });

  const priorityColors = {
    low: "bg-slate-100 text-slate-600",
    medium: "bg-amber-100 text-amber-700",
    high: "bg-red-100 text-red-700"
  };

  const statusIcons = {
    pending: <Circle className="w-4 h-4 text-slate-400" />,
    in_progress: <Clock className="w-4 h-4 text-amber-500" />,
    completed: <Check className="w-4 h-4 text-green-500" />
  };

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-purple-600" />
          Tasks & Challenges
        </h3>
        {isLeader && (
          <Button size="sm" onClick={() => setShowCreateModal(true)} className="bg-purple-600">
            <Plus className="w-4 h-4 mr-1" />
            Add Task
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl">
          <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No tasks yet</p>
          {isLeader && (
            <Button size="sm" variant="link" onClick={() => setShowCreateModal(true)}>
              Create the first task
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {pendingTasks.map(task => (
            <TaskCard 
              key={task.id} 
              task={task} 
              user={user}
              isLeader={isLeader}
              priorityColors={priorityColors}
              statusIcons={statusIcons}
              onToggle={() => toggleCompleteMutation.mutate(task)}
              onDelete={() => deleteTaskMutation.mutate(task.id)}
            />
          ))}
          
          {completedTasks.length > 0 && (
            <>
              <div className="text-xs text-slate-400 font-medium pt-2">Completed</div>
              {completedTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  user={user}
                  isLeader={isLeader}
                  priorityColors={priorityColors}
                  statusIcons={statusIcons}
                  onToggle={() => toggleCompleteMutation.mutate(task)}
                  onDelete={() => deleteTaskMutation.mutate(task.id)}
                />
              ))}
            </>
          )}
        </div>
      )}

      <CreateTaskModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        members={group.member_progress || []}
        onSubmit={(data) => createTaskMutation.mutate(data)}
        isLoading={createTaskMutation.isPending}
      />
    </div>
  );
}

function TaskCard({ task, user, isLeader, priorityColors, statusIcons, onToggle, onDelete }) {
  const isAssignedToMe = !task.assigned_to?.length || task.assigned_to.includes(user.email);
  const completedByMe = task.completed_by?.includes(user.email);

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      task.status === 'completed' ? 'bg-slate-50 opacity-60' : 'bg-white hover:shadow-sm'
    }`}>
      <div className="flex items-start gap-3">
        {isAssignedToMe && (
          <button
            onClick={onToggle}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              completedByMe 
                ? 'bg-green-500 border-green-500 text-white' 
                : 'border-slate-300 hover:border-purple-400'
            }`}
          >
            {completedByMe && <Check className="w-3 h-3" />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-medium ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
              {task.title}
            </span>
            <Badge className={`text-xs ${priorityColors[task.priority]}`}>
              {task.priority}
            </Badge>
          </div>
          {task.description && (
            <p className="text-sm text-slate-500 mb-2">{task.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {task.due_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {task.assigned_to?.length > 0 && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {task.assigned_to.length} assigned
              </span>
            )}
            <span className="flex items-center gap-1">
              {statusIcons[task.status]}
              {task.completed_by?.length || 0}/{task.assigned_to?.length || 'All'} done
            </span>
          </div>
        </div>
        {isLeader && (
          <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function CreateTaskModal({ open, onOpenChange, members, onSubmit, isLoading }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignAll, setAssignAll] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      due_date: dueDate || null,
      priority,
      assigned_to: assignAll ? members.map(m => m.email) : []
    });
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("medium");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Task Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Complete Chapter 5 review"
              required
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={assignAll} 
              onChange={(e) => setAssignAll(e.target.checked)}
              className="rounded"
            />
            <Label className="text-sm">Assign to all members</Label>
          </div>
          <Button type="submit" className="w-full bg-purple-600" disabled={!title || isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Create Task
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}