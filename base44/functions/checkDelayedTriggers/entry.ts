import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Scheduled function: runs every hour.
 * Handles three categories of triggers:
 *
 * DELAYED (time-based, fire once per user):
 *  - signup_no_lesson_4h: 4h after signup, no lesson created
 *  - lesson_no_diagnostic_24h: 24h after first lesson, no quiz completed
 *  - quiz_no_return_24h: 24h after first quiz, no login/session since
 *  - session_no_followup_24h: 24h after first practice session, no session today
 *
 * CONDITIONAL (threshold-based, fire once per user):
 *  - upgrade_momentum: questions_completed >= X OR current_streak >= Y, free users only
 *  - trial_expiring: trial_days_left = 2, pro trial users only
 *
 * INACTIVITY (fire once per window):
 *  - inactive_3_days, inactive_7_days, inactive_14_days, inactive_30_days
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

    // Load all enabled triggers in one query
    const allTriggers = await base44.asServiceRole.entities.AutomaticEmail.filter({ enabled: true });

    const delayedTypes = ['signup_no_lesson_4h', 'lesson_no_diagnostic_24h', 'quiz_no_return_24h', 'session_no_followup_24h'];
    const conditionalTypes = ['upgrade_momentum', 'trial_expiring'];
    const inactivityTypes = ['inactive_3_days', 'inactive_7_days', 'inactive_14_days', 'inactive_30_days'];

    const enabledDelayed = allTriggers.filter(t => delayedTypes.includes(t.trigger_type));
    const enabledConditional = allTriggers.filter(t => conditionalTypes.includes(t.trigger_type));
    const enabledInactivity = allTriggers.filter(t => inactivityTypes.includes(t.trigger_type));

    if (enabledDelayed.length === 0 && enabledConditional.length === 0 && enabledInactivity.length === 0) {
      return Response.json({ message: 'No delayed, conditional, or inactivity triggers enabled', sent: 0 });
    }

    // Get all users once
    const allUsers = await base44.asServiceRole.entities.User.list();
    console.log(`Processing ${allUsers.length} users`);

    // Helpers
    const hoursSince = (dateStr) => {
      if (!dateStr) return Infinity;
      return (now - new Date(dateStr)) / (1000 * 60 * 60);
    };
    const daysSince = (dateStr) => {
      if (!dateStr) return Infinity;
      return Math.floor((now - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    };

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

    // Helper: check plan filter
    const matchesPlanFilter = (ud, planFilter) => {
      if (!planFilter || planFilter === 'any') return true;
      const userPlan = ud.subscription_plan_type || 'free';
      if (planFilter === 'free') return userPlan === 'free';
      if (planFilter === 'pro_trial') return userPlan === 'pro_trial';
      if (planFilter === 'pro') return userPlan === 'pro';
      return true;
    };

    // Helper: check condition from trigger_config
    const matchesCondition = (ud, config) => {
      if (!config?.condition_field || config.condition_field === 'none') return true;
      const field = config.condition_field;
      let userVal;
      
      // Special handling for trial_days_left (computed, not stored directly)
      if (field === 'trial_days_left') {
        const trialEnd = ud.trial_end_date;
        if (!trialEnd) return false;
        userVal = Math.max(0, Math.ceil((new Date(trialEnd) - now) / (1000 * 60 * 60 * 24)));
      } else {
        userVal = Number(ud[field] || 0);
      }

      const threshold = config.condition_value ?? 0;
      const op = config.condition_operator || 'gte';
      if (op === 'gte') return userVal >= threshold;
      if (op === 'lte') return userVal <= threshold;
      if (op === 'eq') return userVal === threshold;
      return false;
    };

    // ── DELAYED TRIGGERS ──
    for (const u of allUsers) {
      if (!u.email) continue;
      const ud = { ...u.data, ...u };
      const signupHours = hoursSince(u.created_date);

      // Email 1: signup_no_lesson_4h
      // 4h after signup, no lesson created. Window: 4-48h.
      if (enabledDelayed.some(t => t.trigger_type === 'signup_no_lesson_4h')) {
        const totalLessons = ud.total_lessons_created || 0;
        if (totalLessons === 0 && signupHours >= 4 && signupHours < 48) {
          const trigger = enabledDelayed.find(t => t.trigger_type === 'signup_no_lesson_4h');
          if (matchesPlanFilter(ud, trigger?.trigger_config?.plan_filter)) {
            await sendTriggerEmail('signup_no_lesson_4h', u.email, `no_lesson_4h_${u.id}`);
          }
        }
      }

      // Email 2: lesson_no_diagnostic_24h
      // 24h after first lesson created, no quiz completed. 
      // We use `first_lesson_date` on user or fallback to checking lesson entity dates.
      if (enabledDelayed.some(t => t.trigger_type === 'lesson_no_diagnostic_24h')) {
        const totalLessons = ud.total_lessons_created || 0;
        const totalExams = ud.total_exams_completed || 0;
        const firstLessonDate = ud.first_lesson_date || ud.first_lesson_created_date;
        if (totalLessons > 0 && totalExams === 0) {
          const lessonHours = firstLessonDate ? hoursSince(firstLessonDate) : signupHours;
          if (lessonHours >= 24 && lessonHours < 96) {
            const trigger = enabledDelayed.find(t => t.trigger_type === 'lesson_no_diagnostic_24h');
            if (matchesPlanFilter(ud, trigger?.trigger_config?.plan_filter)) {
              await sendTriggerEmail('lesson_no_diagnostic_24h', u.email, `no_diag_24h_${u.id}`);
            }
          }
        }
      }

      // Email 3: quiz_no_return_24h
      // 24h after first quiz completed, user hasn't logged in / had a session since.
      // We check: first_exam_completed_date exists, 24h+ ago, last_active_date <= first_exam_completed_date (no return).
      if (enabledDelayed.some(t => t.trigger_type === 'quiz_no_return_24h')) {
        const totalExams = ud.total_exams_completed || 0;
        const firstExamDate = ud.first_exam_completed_date;
        if (totalExams > 0 && firstExamDate) {
          const examHours = hoursSince(firstExamDate);
          const lastActive = ud.last_active_date ? new Date(ud.last_active_date) : null;
          const examDate = new Date(firstExamDate);
          // User hasn't returned if last_active is within 1 hour of exam completion (same session)
          const hasNotReturned = !lastActive || (lastActive.getTime() - examDate.getTime()) < (60 * 60 * 1000);
          if (examHours >= 24 && examHours < 96 && hasNotReturned) {
            const trigger = enabledDelayed.find(t => t.trigger_type === 'quiz_no_return_24h');
            if (matchesPlanFilter(ud, trigger?.trigger_config?.plan_filter)) {
              await sendTriggerEmail('quiz_no_return_24h', u.email, `no_return_24h_${u.id}`);
            }
          }
        }
      }

      // Email 4: session_no_followup_24h
      // 24h after first practice session completed, no session today.
      // "First practice session" = first study plan task completed (total_tasks_completed >= 1).
      if (enabledDelayed.some(t => t.trigger_type === 'session_no_followup_24h')) {
        const totalTasks = ud.total_tasks_completed || 0;
        const firstTaskDate = ud.first_task_completed_date;
        if (totalTasks >= 1 && firstTaskDate) {
          const taskHours = hoursSince(firstTaskDate);
          const lastActive = ud.last_active_date;
          const lastActiveDate = lastActive ? new Date(lastActive).toISOString().split('T')[0] : null;
          const today = now.toISOString().split('T')[0];
          const noSessionToday = lastActiveDate !== today;
          if (taskHours >= 24 && taskHours < 72 && noSessionToday) {
            const trigger = enabledDelayed.find(t => t.trigger_type === 'session_no_followup_24h');
            if (matchesPlanFilter(ud, trigger?.trigger_config?.plan_filter)) {
              await sendTriggerEmail('session_no_followup_24h', u.email, `no_followup_24h_${u.id}`);
            }
          }
        }
      }
    }

    // ── CONDITIONAL TRIGGERS ──
    for (const trigger of enabledConditional) {
      for (const u of allUsers) {
        if (!u.email) continue;
        const ud = { ...u.data, ...u };

        // Check plan filter
        if (!matchesPlanFilter(ud, trigger.trigger_config?.plan_filter)) continue;
        // Check condition
        if (!matchesCondition(ud, trigger.trigger_config)) continue;

        // Send (dedup handled inside sendResendEmail via EmailLog)
        await sendTriggerEmail(trigger.trigger_type, u.email, `${trigger.trigger_type}_${u.id}`);
      }
    }

    // ── INACTIVITY TRIGGERS ──
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