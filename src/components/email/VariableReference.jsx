import React, { useState } from "react";
import { ChevronDown, ChevronRight, Copy, CheckCircle, FlaskConical, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const VARIABLE_GROUPS = [
  {
    label: "Identity",
    vars: [
      { name: "name", desc: "Full name" },
      { name: "first_name", desc: "First name" },
      { name: "last_name", desc: "Last name" },
      { name: "email", desc: "Email address" },
    ]
  },
  {
    label: "Learning Profile",
    vars: [
      { name: "school", desc: "School name" },
      { name: "grade", desc: "Grade level" },
      { name: "city", desc: "City" },
      { name: "country", desc: "Country" },
      { name: "study_type", desc: "e.g. university, high_school, med_school" },
    ]
  },
  {
    label: "Courses / Lessons",
    vars: [
      { name: "lesson_name_1", desc: "1st lesson ever created" },
      { name: "lesson_name_2", desc: "2nd lesson created" },
      { name: "lesson_name_3", desc: "3rd lesson created" },
      { name: "latest_lesson", desc: "Most recent lesson" },
      { name: "total_lessons", desc: "Total lessons created" },
      { name: "course_name", desc: "Alias of latest_lesson" },
    ]
  },
  {
    label: "Study Progress",
    vars: [
      { name: "predicted_grade", desc: "AI predicted letter grade" },
      { name: "predicted_score", desc: "AI predicted score %" },
      { name: "mastery_gap", desc: "Weakest competency" },
      { name: "weak_competencies", desc: "Top 3 weak areas, comma-separated" },
      { name: "tasks_remaining", desc: "Incomplete study plan tasks" },
      { name: "completed_exams", desc: "Total completed exams" },
      { name: "best_grade", desc: "Best letter grade achieved" },
      { name: "best_score", desc: "Best exam score %" },
      { name: "graded_assignments", desc: "Total graded assignments" },
    ]
  },
  {
    label: "Gamification",
    vars: [
      { name: "level", desc: "Current level" },
      { name: "total_points", desc: "Total XP" },
      { name: "current_streak", desc: "Current day streak" },
      { name: "longest_streak", desc: "Longest ever streak" },
      { name: "questions_completed", desc: "Total questions answered" },
      { name: "total_quizzes_taken", desc: "Total quizzes taken" },
      { name: "average_score", desc: "Average score %" },
    ]
  },
  {
    label: "Engagement",
    vars: [
      { name: "total_study_minutes", desc: "Total minutes studied" },
      { name: "total_study_hours", desc: "Total hours (e.g. 2.5)" },
      { name: "session_count", desc: "Total sessions" },
      { name: "total_logins", desc: "Total logins" },
      { name: "days_since_signup", desc: "Days since account created" },
      { name: "days_inactive", desc: "Days since last activity" },
      { name: "signup_date", desc: "Account creation date" },
      { name: "last_active_date", desc: "Last activity date" },
      { name: "first_visit_date", desc: "First visit date" },
    ]
  },
  {
    label: "Device & Context",
    vars: [
      { name: "device_type", desc: "mobile, desktop, tablet" },
      { name: "app_type", desc: "ios_app, android_app, mobile_web, desktop_web" },
      { name: "operating_system", desc: "iOS, Android, Windows, MacOS" },
      { name: "browser", desc: "Chrome, Safari, etc." },
      { name: "timezone", desc: "e.g. America/Edmonton" },
      { name: "language", desc: "Browser language" },
    ]
  },
  {
    label: "Subscription",
    vars: [
      { name: "plan_type", desc: "free, monthly, yearly" },
      { name: "trial_days_left", desc: "Days left in trial" },
      { name: "trial_end_date", desc: "Trial expiration date" },
    ]
  },
];

function VariableTester({ allUsers }) {
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);

  const handleTest = async () => {
    if (!testEmail) return;
    setTesting(true);
    setResults(null);
    try {
      const { data } = await base44.functions.invoke('sendResendEmail', {
        trigger_type: 'signup',
        user_email: testEmail,
        dry_run: true
      });
      setResults(data.variables || data);
    } catch (err) {
      setResults({ error: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-3 p-3 rounded-lg border border-dashed border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/20">
      <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-300 mb-2 flex items-center gap-1">
        <FlaskConical className="w-3 h-3" /> Test Variables for a User
      </p>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Select value={testEmail} onValueChange={setTestEmail}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select user to inspect..." />
            </SelectTrigger>
            <SelectContent>
              {(allUsers || []).map(u => (
                <SelectItem key={u.email} value={u.email}>
                  {u.full_name || 'Unknown'} ({u.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={handleTest} disabled={!testEmail || testing} className="h-8 text-xs gap-1">
          {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />}
          Inspect
        </Button>
      </div>
      {results && !results.error && (
        <div className="mt-2 max-h-60 overflow-y-auto rounded bg-slate-900 p-2 text-[11px] font-mono">
          {Object.entries(results).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-purple-400 flex-shrink-0">{k}:</span>
              <span className={v ? 'text-green-400' : 'text-slate-500'}>{v || '(empty)'}</span>
            </div>
          ))}
        </div>
      )}
      {results?.error && (
        <p className="mt-2 text-xs text-red-500">{results.error}</p>
      )}
    </div>
  );
}

export default function VariableReference({ allUsers }) {
  const [expanded, setExpanded] = useState(false);
  const [copiedVar, setCopiedVar] = useState(null);

  const copyVar = (varName) => {
    navigator.clipboard.writeText(`{{${varName}}}`);
    setCopiedVar(varName);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  const allVarNames = VARIABLE_GROUPS.flatMap(g => g.vars.map(v => v.name));

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {allVarNames.length} template variables available — use <code className="mx-1 bg-purple-100 dark:bg-purple-900/40 px-1 rounded">{"{{variable_name}}"}</code> in Resend templates
      </button>

      {!expanded && (
        <div className="flex flex-wrap gap-1 mt-2">
          {['first_name', 'lesson_name_1', 'latest_lesson', 'predicted_grade', 'current_streak', 'plan_type', 'days_inactive'].map(v => (
            <Badge key={v} variant="secondary" className="text-[10px] font-mono cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40" onClick={() => copyVar(v)}>
              {`{{${v}}}`}
            </Badge>
          ))}
          <span className="text-[10px] text-muted-foreground self-center">+ {allVarNames.length - 7} more…</span>
        </div>
      )}

      {expanded && (
        <div className="mt-3 space-y-3">
          {VARIABLE_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{group.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {group.vars.map(v => (
                  <button
                    key={v.name}
                    onClick={() => copyVar(v.name)}
                    className="flex items-center gap-2 text-left px-2 py-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group"
                  >
                    <code className="text-[11px] font-mono text-purple-600 dark:text-purple-400 flex-shrink-0">
                      {`{{${v.name}}}`}
                    </code>
                    <span className="text-[10px] text-muted-foreground truncate">{v.desc}</span>
                    {copiedVar === v.name ? (
                      <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 ml-auto" />
                    ) : (
                      <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <VariableTester allUsers={allUsers} />

          <p className="text-[10px] text-muted-foreground italic mt-2">
            Click any variable to copy. Empty values are stripped from the email.
          </p>
        </div>
      )}
    </div>
  );
}