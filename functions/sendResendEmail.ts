import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { trigger_type, user_email, context, is_test } = await req.json();

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    // For test sends, admin must be authenticated
    if (is_test) {
      const admin = await base44.auth.me();
      if (admin?.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!trigger_type || !user_email) {
      return Response.json({ error: 'trigger_type and user_email required' }, { status: 400 });
    }

    // Get enabled templates for this trigger (or specific template for test)
    let templates;
    if (is_test && context?.template_id) {
      // For test: get the specific template regardless of enabled status
      const allTemplates = await base44.asServiceRole.entities.AutomaticEmail.filter({
        trigger_type
      });
      templates = allTemplates.filter(t => t.id === context.template_id);
    } else {
      templates = await base44.asServiceRole.entities.AutomaticEmail.filter({
        trigger_type,
        enabled: true
      });
    }

    if (templates.length === 0) {
      return Response.json({ message: 'No templates for this trigger', sent: 0 });
    }

    // Get user data for variables
    const users = await base44.asServiceRole.entities.User.filter({ email: user_email });
    if (users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    const targetUser = users[0];

    // Get learning profile
    let profile = null;
    const profiles = await base44.asServiceRole.entities.LearningProfile.filter({
      created_by: user_email
    });
    if (profiles.length > 0) profile = profiles[0];

    // Build user variables to pass to Resend template
    // Resend reserves FIRST_NAME, LAST_NAME, EMAIL, UNSUBSCRIBE_URL — we provide both formats
    const fullName = targetUser.full_name || 'there';
    const firstName = fullName.split(' ')[0];
    const lastName = fullName.split(' ').slice(1).join(' ') || '';
    
    const userVars = {
      // Resend reserved variable names (uppercase)
      FIRST_NAME: firstName,
      LAST_NAME: lastName,
      EMAIL: targetUser.email,
      // Custom variables (lowercase)
      user_name: fullName,
      user_first_name: firstName,
      user_email: targetUser.email,
      name: fullName,
      first_name: firstName,
      school: profile?.school || '',
      grade: profile?.grade || '',
      level: String(targetUser.level || 1),
      total_points: String(targetUser.total_points || 0),
      current_streak: String(targetUser.current_streak || 0),
      questions_completed: String(targetUser.questions_completed || 0)
    };

    let sentCount = 0;

    for (const template of templates) {
      if (!template.resend_template_id) continue;

      // Duplicate prevention: check EmailLog (skip for test sends)
      if (!is_test) {
        const existingLogs = await base44.asServiceRole.entities.EmailLog.filter({
          user_email,
          email_template_id: template.id,
          trigger_type
        });
        if (existingLogs.length > 0) continue;

        // Milestone checks
        if (template.trigger_type === 'level_milestone') {
          const mv = template.trigger_config?.milestone_value || 5;
          if (targetUser.level !== mv) continue;
        }
        if (template.trigger_type === 'streak_milestone') {
          const mv = template.trigger_config?.milestone_value || 7;
          if (targetUser.current_streak !== mv) continue;
        }
      }

      // Send via Resend Emails API using template
      try {
        const emailPayload = {
          from: 'StudyApp.AI <updates@updates.studyappai.com>',
          reply_to: 'info@studyappai.com',
          to: [user_email],
          subject: template.name || 'StudyApp.AI',
          template: {
            id: template.resend_template_id,
            variables: userVars
          }
        };

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        });

        const resBody = await response.text();
        const success = response.ok;
        if (!success) {
          console.error('Resend send error:', response.status, resBody);
          console.error('Payload sent:', JSON.stringify(emailPayload));
        } else {
          console.log('Resend send success:', resBody);
        }

        // Log it (skip logging for test sends)
        if (!is_test) {
          await base44.asServiceRole.entities.EmailLog.create({
            user_email,
            email_template_id: template.id,
            trigger_type,
            trigger_reference_id: context?.reference_id || null,
            sent_at: new Date().toISOString(),
            success
          });

          if (success) {
            await base44.asServiceRole.entities.AutomaticEmail.update(template.id, {
              send_count: (template.send_count || 0) + 1
            });
          }
        }

        if (success) sentCount++;
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
      }
    }

    return Response.json({ message: `Sent ${sentCount} email(s)`, sent: sentCount });

  } catch (error) {
    console.error('sendResendEmail error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});