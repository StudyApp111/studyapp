import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Settings2, FileText, Zap, BookOpen, GraduationCap, Sparkles, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeContext";

const NOTE_TYPES = [
  { 
    id: "Detailed Notes", 
    icon: BookOpen, 
    description: "Deep dive into every concept",
    lightColor: "bg-blue-50 border-blue-200 text-blue-700",
    darkColor: "bg-blue-500/20 border-blue-500/30 text-blue-300",
    iconColor: "text-blue-600 dark:text-blue-400"
  },
  { 
    id: "Cheat Sheet", 
    icon: Zap, 
    description: "Quick reference for formulas & key terms",
    lightColor: "bg-amber-50 border-amber-200 text-amber-700",
    darkColor: "bg-amber-500/20 border-amber-500/30 text-amber-300",
    iconColor: "text-amber-600 dark:text-amber-400"
  },
  { 
    id: "Short Summary", 
    icon: FileText, 
    description: "High-level overview in minutes",
    lightColor: "bg-emerald-50 border-emerald-200 text-emerald-700",
    darkColor: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300",
    iconColor: "text-emerald-600 dark:text-emerald-400"
  },
  { 
    id: "Exam Prep", 
    icon: GraduationCap, 
    description: "Targeted study guide for tests",
    lightColor: "bg-purple-50 border-purple-200 text-purple-700",
    darkColor: "bg-purple-500/20 border-purple-500/30 text-purple-300",
    iconColor: "text-purple-600 dark:text-purple-400"
  }
];

export default function NoteSettingsModal({ open, onOpenChange, settings, onSave }) {
  const { isDark } = useTheme();
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
      <DialogContent className={`sm:max-w-[600px] max-h-[90vh] p-0 gap-0 overflow-y-auto rounded-2xl ${isDark ? 'bg-[#12121a] border-white/10' : ''}`}>
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-xl font-bold text-white">Customize Your Notes</DialogTitle>
          </div>
          <DialogDescription className="text-violet-100">
            Tell our AI exactly how you want your study materials formatted.
          </DialogDescription>
        </div>

        <div className={`p-6 space-y-6 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50/50'}`}>
          <div className="space-y-3">
            <Label className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Choose Style</Label>
            <RadioGroup
              value={localSettings.noteType}
              onValueChange={(value) => setLocalSettings({ ...localSettings, noteType: value })}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {NOTE_TYPES.map((type) => {
                const isSelected = localSettings.noteType === type.id;
                const colorClass = isDark ? type.darkColor : type.lightColor;
                return (
                  <div key={type.id} className="relative">
                    <RadioGroupItem value={type.id} id={type.id} className="peer sr-only" />
                    <Label 
                      htmlFor={type.id} 
                      className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                        isSelected 
                          ? `${colorClass} ring-2 ring-offset-2 ${isDark ? 'ring-offset-[#0a0a12]' : 'ring-offset-white'} ring-violet-500 shadow-md` 
                          : isDark 
                            ? "bg-white/5 border-white/10 hover:border-white/20 text-slate-300 hover:bg-white/10"
                            : "bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <type.icon className={`h-6 w-6 ${isSelected ? "opacity-100" : "opacity-50 grayscale"}`} />
                        {isSelected && <CheckCircle2 className="h-5 w-5 opacity-50" />}
                      </div>
                      <div>
                        <span className="font-bold block mb-0.5">{type.id}</span>
                        <span className="text-xs opacity-80 font-medium leading-tight block">
                          {type.description}
                        </span>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label htmlFor="instructions" className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Custom Instructions <span className={`text-xs font-normal normal-case ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>(Optional)</span>
            </Label>
            <div className="relative">
              <Textarea
                id="instructions"
                placeholder="E.g., 'Focus on key dates and definitions', 'Use simple language', or 'Format as bullet points only'..."
                className={`resize-none min-h-[100px] focus:border-violet-500 focus:ring-violet-500 rounded-xl p-4 text-sm shadow-sm ${
                  isDark ? 'bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-200'
                }`}
                maxLength={500}
                value={localSettings.customInstructions}
                onChange={(e) => setLocalSettings({ ...localSettings, customInstructions: e.target.value })}
              />
              <div className={`absolute bottom-3 right-3 text-xs font-medium px-1 ${isDark ? 'text-slate-500 bg-[#0a0a12]' : 'text-slate-400 bg-white'}`}>
                {localSettings.customInstructions.length}/500
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className={`p-6 border-t flex-col sm:flex-row gap-3 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-100'}`}>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/30 rounded-xl px-8"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}