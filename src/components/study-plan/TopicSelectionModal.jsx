import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Check, X, ChevronDown, ChevronRight, FolderOpen, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function TopicSelectionModal({ open, onOpenChange, lesson, onConfirm }) {
  const { isDark } = useTheme();
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open || !lesson?.id) return;
    const t = lesson?.topics || [];
    setTopics(t);

    // Load saved selection or default to all selected
    const saved = lesson?.selected_topics;
    if (saved?.length > 0) {
      setSelectedTopics(saved);
    } else {
      // Default: all selected
      const all = [];
      t.forEach(topic => {
        all.push(topic.title);
        topic.subtopics?.forEach(st => all.push(st.title));
      });
      setSelectedTopics(all);
    }

    // Expand all by default
    const map = {};
    t.forEach(topic => { map[topic.title] = true; });
    setExpandedGroups(map);
  }, [open, lesson?.id]);

  const getAllTitles = () => {
    const titles = [];
    topics.forEach(t => {
      titles.push(t.title);
      t.subtopics?.forEach(st => titles.push(st.title));
    });
    return titles;
  };

  const allTitles = getAllTitles();
  const totalCount = allTitles.length;
  const selectedCount = selectedTopics.length;

  const toggleTopic = (title) => {
    setSelectedTopics(prev => 
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  const toggleGroup = (parentTitle, subtopics) => {
    const groupTitles = [parentTitle, ...(subtopics || []).map(st => st.title)];
    const allSelected = groupTitles.every(t => selectedTopics.includes(t));
    if (allSelected) {
      setSelectedTopics(prev => prev.filter(t => !groupTitles.includes(t)));
    } else {
      setSelectedTopics(prev => [...new Set([...prev, ...groupTitles])]);
    }
  };

  const handleSelectAll = () => setSelectedTopics([...allTitles]);
  const handleDeselectAll = () => setSelectedTopics([]);

  const handleConfirm = async () => {
    // Save selection to lesson entity
    await base44.entities.Lesson.update(lesson.id, { selected_topics: selectedTopics });
    onConfirm(selectedTopics);
    onOpenChange(false);
  };

  const filteredTopics = topics.filter(t => {
    const q = searchQuery.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.subtopics?.some(st => st.title.toLowerCase().includes(q));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[500px] max-h-[85vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
        <DialogTitle className="sr-only">Select Topics</DialogTitle>
        <DialogDescription className="sr-only">Choose which sections and topics to include in your study plan</DialogDescription>

        {/* Header */}
        <div className={`px-5 pt-5 pb-3 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <Filter className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Select Your Topics
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {selectedCount} of {totalCount} topics selected — only selected topics will appear in your study plan
              </p>
            </div>
            <button onClick={() => onOpenChange(false)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
              <X className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics..."
                className={`pl-9 h-9 text-sm rounded-lg ${isDark ? 'bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500' : ''}`}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={selectedCount === totalCount ? handleDeselectAll : handleSelectAll}
              className={`text-xs h-9 px-3 whitespace-nowrap ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/10' : ''}`}
            >
              {selectedCount === totalCount ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </div>

        {/* Topic List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {filteredTopics.map((topic) => {
            const hasSubtopics = topic.subtopics?.length > 0;
            const isExpanded = expandedGroups[topic.title];
            const isParentSelected = selectedTopics.includes(topic.title);
            const groupTitles = [topic.title, ...(topic.subtopics || []).map(st => st.title)];
            const allGroupSelected = groupTitles.every(t => selectedTopics.includes(t));

            return (
              <div key={topic.title}>
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                  isParentSelected
                    ? isDark ? 'bg-purple-600/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'
                    : isDark ? 'bg-white/5 border border-white/5 hover:bg-white/10' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'
                }`}>
                  {hasSubtopics && (
                    <button onClick={() => setExpandedGroups(prev => ({ ...prev, [topic.title]: !prev[topic.title] }))} className="p-0.5 flex-shrink-0">
                      {isExpanded
                        ? <ChevronDown className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                        : <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                      }
                    </button>
                  )}
                  {hasSubtopics && <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />}
                  <span
                    onClick={() => hasSubtopics ? toggleGroup(topic.title, topic.subtopics) : toggleTopic(topic.title)}
                    className={`flex-1 text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
                  >
                    {topic.title}
                  </span>
                  <button
                    onClick={() => hasSubtopics ? toggleGroup(topic.title, topic.subtopics) : toggleTopic(topic.title)}
                    className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                      (hasSubtopics ? allGroupSelected : isParentSelected)
                        ? 'bg-purple-600 text-white'
                        : isDark ? 'border border-white/20 bg-white/5' : 'border border-slate-300 bg-white'
                    }`}
                  >
                    {(hasSubtopics ? allGroupSelected : isParentSelected) && <Check className="w-4 h-4" />}
                  </button>
                </div>

                {hasSubtopics && isExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {topic.subtopics
                      .filter(st => !searchQuery || st.title.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((st) => {
                        const isSubSelected = selectedTopics.includes(st.title);
                        return (
                          <div
                            key={st.title}
                            onClick={() => toggleTopic(st.title)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                              isSubSelected
                                ? isDark ? 'bg-purple-600/15 border border-purple-500/20' : 'bg-purple-50/80 border border-purple-200/60'
                                : isDark ? 'bg-white/[0.03] border border-transparent hover:bg-white/5' : 'bg-white/50 border border-transparent hover:bg-slate-50'
                            }`}
                          >
                            <span className={`flex-1 text-sm truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{st.title}</span>
                            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all ${
                              isSubSelected ? 'bg-purple-600 text-white' : isDark ? 'border border-white/20 bg-white/5' : 'border border-slate-300 bg-white'
                            }`}>
                              {isSubSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <Button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="w-full h-11 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-xl"
          >
            <Check className="w-4 h-4 mr-2" />
            Confirm Selection
            {selectedCount > 0 && selectedCount < totalCount && (
              <span className="ml-2 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{selectedCount}/{totalCount}</span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}