import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Settings2, FileText, Zap, BookOpen, GraduationCap } from "lucide-react";

const NOTE_TYPES = [
  { id: "Detailed Notes", icon: BookOpen, description: "Comprehensive study materials" },
  { id: "Cheat Sheet", icon: Zap, description: "Quick reference guide" },
  { id: "Short Summary", icon: FileText, description: "Brief overview of main ideas" },
  { id: "Exam Prep", icon: GraduationCap, description: "Test-focused highlights" }
];

export default function NoteSettingsModal({ open, onOpenChange, settings, onSave }) {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, open]);

  const handleSave = () => {
    onSave(localSettings);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Customize Notes</DialogTitle>
          <DialogDescription>
            Choose how you want your study notes to be generated.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Note Type</Label>
            <RadioGroup
              value={localSettings.noteType}
              onValueChange={(value) => setLocalSettings({ ...localSettings, noteType: value })}
              className="grid grid-cols-1 gap-2"
            >
              {NOTE_TYPES.map((type) => (
                <div key={type.id} className={`flex items-center space-x-3 space-y-0 rounded-lg border p-3 cursor-pointer transition-colors ${localSettings.noteType === type.id ? "bg-purple-50 border-purple-200" : "hover:bg-slate-50"}`}>
                  <RadioGroupItem value={type.id} id={type.id} />
                  <Label htmlFor={type.id} className="flex flex-1 items-center cursor-pointer font-normal">
                    <type.icon className={`mr-3 h-5 w-5 ${localSettings.noteType === type.id ? "text-purple-600" : "text-slate-500"}`} />
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{type.id}</span>
                      <span className="text-xs text-slate-500">{type.description}</span>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label htmlFor="instructions" className="text-base font-semibold">
              Custom Instructions <span className="text-xs font-normal text-slate-500">(Optional)</span>
            </Label>
            <Textarea
              id="instructions"
              placeholder="E.g., Focus on dates and names, or Explain like I'm 5..."
              className="resize-none min-h-[100px]"
              maxLength={500}
              value={localSettings.customInstructions}
              onChange={(e) => setLocalSettings({ ...localSettings, customInstructions: e.target.value })}
            />
            <div className="text-xs text-right text-slate-400">
              {localSettings.customInstructions.length}/500
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}