import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Scheduled function: runs every hour.
 * Checks for time-delayed email triggers:
 *  - signup_no_onboarding_4h: signed up 4+ hours ago, never completed onboarding
 *  - signup_no_lesson_24h: completed onboarding 24+ hours ago, never created a lesson
 *  - lesson_no_diagnostic_24h: created first lesson 24+ hours ago, never completed a diagnostic
 *  - diagnostic_no_studyplan_48h: completed first diagnostic 48+ hours ago, no study plan generated
 * Also handles inactivity triggers (3, 7, 14, 30 days).
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const now = new Date();
    let totalSent = 0;
    const results = {};

    // Load all enabled delayed + inactivity triggers in one query
    const allTriggers = await base44.asServiceRole.entities.AutomaticEmail.filter({ enabled: true });
    
    const delayedTypes = [
      'signup_no_onboarding_4h',
      'signup_no_lesson_24h',
      'lesson_no_diagnostic_24h',
      'diagnostic_no_studyplan_48h'
    ];
    const inactivityTypes = ['inactive_3_days', 'inactive_7_days', 'inactive_14_days', 'inactive_30_days'];
    
    const enabledDelayed = allTriggers.filter(t => delayedTypes.includes(t.trigger_type));
    const enabledInactivity = allTriggers.filter(t => inactivityTypes.includes(t.trigger_type));

    if (enabledDelayed.length === 0 && enabledInactivity.length === 0) {
      return Response.json({ message: 'No delayed or inactivity triggers enabled', sent: 0 });
    }

    // Get all users once
    const allUsers = await base44.asServiceRole.entities.User.list();
    console.log(`Processing ${allUsers.length} users for delayed/inactivity triggers`);

    // Helper: hours since a date
    const hoursSince = (dateStr) => {
      if (!dateStr) return Infinity;
      return (now - new Date(dateStr)) / (1000 * 60 * 60);
    };

    // Helper: days since a date
    const daysSince = (dateStr) => {
      if (!dateStr) return Infinity;
      return Math.floor((now - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    };

    // Helper: send email for a trigger type
    const sendTriggerEmail = async (triggerType, userEmail, refId) => {
      try {
        const res = await base44.asServiceRole.functions.invoke('sendResendEmail', {
          trigger_type: triggerType,
          user_email: userEmail,
          context: { reference_id: refId }
        });
        if (res?.data?.sent > 0) {
          totalSent++;
          return true;
        }
      } catch (err) {
        console.error(`[${triggerType}] Error for ${userEmail}:`, err.message);
      }
      return false;
    };

    // ── Process delayed triggers ──
    for (const u of allUsers) {
      if (!u.email) continue;
      const ud = { ...u.data, ...u };
      const onboardingDone = ud.onboarding_completed;
      const signupHours = hoursSince(u.created_date);

      // signup_no_onboarding_4h: signed up 4-48h ago, never completed onboarding
      if (enabledDelayed.some(t => t.trigger_type === 'signup_no_onboarding_4h')) {
        if (!onboardingDone && signupHours >= 4 && signupHours < 48) {
          await sendTriggerEmail('signup_no_onboarding_4h', u.email, `no_onboard_4h_${u.id}`);
        }
      }

      // signup_no_lesson_24h: onboarded 24-72h ago, but total_lessons is 0
      if (enabledDelayed.some(t => t.trigger_type === 'signup_no_lesson_24h')) {
        if (onboardingDone && signupHours >= 24 && signupHours < 72) {
          const totalLessons = ud.total_lessons_created || 0;
          if (totalLessons === 0) {
            await sendTriggerEmail('signup_no_lesson_24h', u.email, `no_lesson_24h_${u.id}`);
          }
        }
      }

      // lesson_no_diagnostic_24h: has lessons but no completed exams, 24-72h after signup
      if (enabledDelayed.some(t => t.trigger_type === 'lesson_no_diagnostic_24h')) {
        const totalLessons = ud.total_lessons_created || 0;
        const totalExams = ud.total_exams_completed || 0;
        if (totalLessons > 0 && totalExams === 0 && signupHours >= 24 && signupHours < 72) {
          await sendTriggerEmail('lesson_no_diagnostic_24h', u.email, `no_diag_24h_${u.id}`);
        }
      }

      // diagnostic_no_studyplan_48h: has completed exams but no study plan tasks completed, 48-120h after signup
      if (enabledDelayed.some(t => t.trigger_type === 'diagnostic_no_studyplan_48h')) {
        const totalExams = ud.total_exams_completed || 0;
        const totalTasks = ud.total_tasks_completed || 0;
        if (totalExams > 0 && totalTasks === 0 && signupHours >= 48 && signupHours < 120) {
          await sendTriggerEmail('diagnostic_no_studyplan_48h', u.email, `no_plan_48h_${u.id}`);
        }
      }
    }

    // ── Process inactivity triggers ──
    const inactivityThresholds = [
      { days: 3, trigger: 'inactive_3_days', maxDays: 7 },
      { days: 7, trigger: 'inactive_7_days', maxDays: 14 },
      { days: 14, trigger: 'inactive_14_days', maxDays: 30 },
      { days: 30, trigger: 'inactive_30_days', maxDays: 60 }
    ];

    for (const u of allUsers) {
      if (!u.email) continue;
      const ud = { ...u.data, ...u };
      const lastActive = ud.last_active_date || u.updated_date || u.created_date;
      if (!lastActive) continue;

      const inactiveDays = daysSince(lastActive);

      for (const threshold of inactivityThresholds) {
        if (!enabledInactivity.some(t => t.trigger_type === threshold.trigger)) continue;
        if (inactiveDays >= threshold.days && inactiveDays < threshold.maxDays) {
          await sendTriggerEmail(threshold.trigger, u.email, `inactivity_${threshold.days}d_${now.toISOString().split('T')[0]}`);
        }
      }
    }

    results.totalSent = totalSent;
    results.usersProcessed = allUsers.length;
    console.log(`Done. Sent ${totalSent} emails across ${allUsers.length} users`);

    return Response.json(results);
  } catch (error) {
    console.error('checkDelayedTriggers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});