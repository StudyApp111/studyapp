import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Save, Loader2, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export default function GroupWhiteboard({ group, user }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState("");

  const { data: whiteboard, isLoading } = useQuery({
    queryKey: ['group-whiteboard', group.id],
    queryFn: async () => {
      const boards = await base44.entities.GroupWhiteboard.filter({ group_id: group.id });
      if (boards.length === 0) {
        // Create default whiteboard
        const newBoard = await base44.entities.GroupWhiteboard.create({
          group_id: group.id,
          title: "Shared Notes",
          content: "# Shared Notes\n\nStart collaborating here! Add notes, links, and ideas.\n\n---\n\n",
          last_edited_by: user.email,
          last_edited_at: new Date().toISOString()
        });
        return newBoard;
      }
      return boards[0];
    }
  });

  useEffect(() => {
    if (whiteboard?.content) {
      setContent(whiteboard.content);
    }
  }, [whiteboard]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.GroupWhiteboard.update(whiteboard.id, {
        content,
        last_edited_by: user.email,
        last_edited_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-whiteboard', group.id] });
      setIsEditing(false);
      toast.success("Notes saved!");
    }
  });

  const getEditorName = () => {
    if (!whiteboard?.last_edited_by) return null;
    const member = group.member_progress?.find(m => m.email === whiteboard.last_edited_by);
    return member?.name || whiteboard.last_edited_by.split('@')[0];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-600" />
          Shared Notes
        </h3>
        <div className="flex items-center gap-2">
          {whiteboard?.last_edited_at && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <User className="w-3 h-3" />
              {getEditorName()}
              <Clock className="w-3 h-3 ml-1" />
              {new Date(whiteboard.last_edited_at).toLocaleDateString()}
            </span>
          )}
          {isEditing ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="bg-purple-600"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Write your notes in Markdown..."
          />
          <p className="text-xs text-slate-400">
            Supports Markdown formatting: **bold**, *italic*, # headings, - lists, [links](url)
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl p-6 min-h-[200px] prose prose-sm prose-slate max-w-none">
          <ReactMarkdown>{content || "*No notes yet. Click Edit to start!*"}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}