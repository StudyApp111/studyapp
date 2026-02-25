import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const now = new Date();
    let totalSent = 0;

    // Check which trial triggers are enabled
    const [day3Templates, expiringTemplates] = await Promise.all([
      base44.asServiceRole.entities.AutomaticEmail.filter({ trigger_type: 'trial_day_3', enabled: true }),
      base44.asServiceRole.entities.AutomaticEmail.filter({ trigger_type: 'trial_expiring', enabled: true })
    ]);

    if (day3Templates.length === 0 && expiringTemplates.length === 0) {
      return Response.json({ message: 'No trial email triggers enabled', sent: 0 });
    }

    // Get all trialing users
    const trialingUsers = await base44.asServiceRole.entities.User.filter({
      subscription_status: 'trialing'
    });

    console.log(`Found ${trialingUsers.length} trialing users`);

    for (const u of trialingUsers) {
      if (!u.email || !u.trial_end_date) continue;

      const trialEnd = new Date(u.trial_end_date);
      const daysUntilExpiry = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      const trialStartDate = u.subscription_start_date ? new Date(u.subscription_start_date) : null;
      const daysIntoTrial = trialStartDate ? Math.floor((now - trialStartDate) / (1000 * 60 * 60 * 24)) : -1;

      // Day 3 reminder: user is 3 days into trial (days 3-4 window)
      if (day3Templates.length > 0 && daysIntoTrial >= 3 && daysIntoTrial < 5) {
        try {
          const result = await base44.asServiceRole.functions.invoke('sendResendEmail', {
            trigger_type: 'trial_day_3',
            user_email: u.email,
            context: { reference_id: `trial_day3_${u.id}` }
          });
          if (result?.data?.sent > 0) totalSent++;
        } catch (err) {
          console.error(`Trial day 3 email error for ${u.email}:`, err.message);
        }
      }

      // Expiring: trial ends today or tomorrow (0-1 days left)
      if (expiringTemplates.length > 0 && daysUntilExpiry >= 0 && daysUntilExpiry <= 1) {
        try {
          const result = await base44.asServiceRole.functions.invoke('sendResendEmail', {
            trigger_type: 'trial_expiring',
            user_email: u.email,
            context: { reference_id: `trial_expiring_${u.id}` }
          });
          if (result?.data?.sent > 0) totalSent++;
        } catch (err) {
          console.error(`Trial expiring email error for ${u.email}:`, err.message);
        }
      }
    }

    return Response.json({ message: `Processed trial email checks`, sent: totalSent, trialing_users: trialingUsers.length });
  } catch (error) {
    console.error('checkTrialEmails error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});