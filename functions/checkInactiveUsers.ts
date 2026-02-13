import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const thresholds = [
      { days: 3, trigger: 'inactive_3_days' },
      { days: 7, trigger: 'inactive_7_days' },
      { days: 14, trigger: 'inactive_14_days' }
    ];

    // Check which inactivity triggers are enabled
    const enabledTriggers = [];
    for (const t of thresholds) {
      const templates = await base44.asServiceRole.entities.AutomaticEmail.filter({
        trigger_type: t.trigger,
        enabled: true
      });
      if (templates.length > 0) {
        enabledTriggers.push({ ...t, templates });
      }
    }

    if (enabledTriggers.length === 0) {
      return Response.json({ message: 'No inactivity triggers enabled', sent: 0 });
    }

    // Get all users
    const allUsers = await base44.asServiceRole.entities.User.list();
    let totalSent = 0;

    for (const u of allUsers) {
      if (!u.email) continue;

      const lastActive = u.last_active_date || u.updated_date || u.created_date;
      if (!lastActive) continue;

      const daysSinceActive = Math.floor((now - new Date(lastActive)) / (1000 * 60 * 60 * 24));

      for (const trigger of enabledTriggers) {
        // Match the exact threshold (e.g., 3 days means between 3 and 6)
        const nextThreshold = thresholds.find(t => t.days > trigger.days);
        const maxDays = nextThreshold ? nextThreshold.days : Infinity;

        if (daysSinceActive >= trigger.days && daysSinceActive < maxDays) {
          // Send via the main sendResendEmail function
          try {
            await base44.asServiceRole.functions.invoke('sendResendEmail', {
              trigger_type: trigger.trigger,
              user_email: u.email,
              context: { reference_id: `inactivity_${trigger.days}d_${now.toISOString().split('T')[0]}` }
            });
            totalSent++;
          } catch (err) {
            console.error(`Inactivity email error for ${u.email}:`, err.message);
          }
        }
      }
    }

    return Response.json({ message: `Processed inactivity checks`, sent: totalSent });
  } catch (error) {
    console.error('checkInactiveUsers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});