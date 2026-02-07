import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

export default function UserSearchSelect({ users, value, onChange, placeholder = "Search users...", disabled = false }) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const sortedUsers = [...users].sort((a, b) => {
    const nameA = (a.full_name || '').toLowerCase();
    const nameB = (b.full_name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const filtered = sortedUsers.filter(u => {
    const q = search.toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedUser = users.find(u => u.email === value);

  return (
    <div ref={wrapperRef} className="relative">
      {value && selectedUser ? (
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white min-h-[40px]">
          <div className="flex-1 truncate">
            <span className="font-medium text-sm text-slate-900">{selectedUser.full_name}</span>
            <span className="text-xs text-slate-500 ml-2">{selectedUser.email}</span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); }}
            disabled={disabled}
            className="p-1 hover:bg-slate-100 rounded"
          >
            <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="pl-9"
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      )}

      {isOpen && !value && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-slate-500 text-center">No users found</div>
          ) : (
            filtered.map(u => (
              <button
                key={u.email}
                type="button"
                onClick={() => { onChange(u.email); setSearch(""); setIsOpen(false); }}
                className="w-full text-left px-3 py-2.5 hover:bg-purple-50 transition-colors border-b border-slate-100 last:border-0"
              >
                <div className="font-medium text-sm text-slate-900">{u.full_name || 'Unknown'}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}