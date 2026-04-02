import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Replace all {{variable}} and {{{variable}}} placeholders in a string
 * with values from the vars object. Unresolved placeholders are removed.
 */
function renderTemplate(str, vars) {
  if (!str) return str;
  let result = str;
  for (const [key, val] of Object.entries(vars)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\{\\{\\{${escaped}\\}\\}\\}`, 'g'), val);
    result = result.replace(new RegExp(`\\{\\{${escaped}\\}\\}`, 'g'), val);
  }
  // Clean up any remaining unresolved placeholders
  result = result.replace(/\{\{\{[^}]+\}\}\}/g, '');
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  return result;
}

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

    // Get user data
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

    // Get most recent lesson for course_name
    let courseName = null;
    try {
      const lessons = await base44.asServiceRole.entities.Lesson.filter(
        { created_by: user_email },
        '-created_date',
        1
      );
      if (lessons.length > 0) courseName = lessons[0].course_name;
    } catch (e) {
      console.warn('Could not fetch lessons for user:', e.message);
    }

    // Get tasks_remaining from active study plan
    let tasksRemaining = null;
    try {
      const plans = await base44.asServiceRole.entities.StudyPlan.filter({
        created_by: user_email,
        status: 'active'
      });
      if (plans.length > 0 && plans[0].tasks) {
        tasksRemaining = plans[0].tasks.filter(t => !t.completed).length;
      }
    } catch (e) {
      console.warn('Could not fetch study plans for user:', e.message);
    }

    // Build name parts
    const fullName = targetUser.display_name || targetUser.full_name || '';
    const firstName = fullName.split(' ')[0] || user_email.split('@')[0];
    const lastName = fullName.split(' ').slice(1).join(' ') || '';

    // Trial-related variables
    const trialEndDate = targetUser.trial_end_date || targetUser.data?.trial_end_date;
    let trialDaysLeft = '';
    let trialEndFormatted = '';
    if (trialEndDate) {
      const endDate = new Date(trialEndDate);
      const daysLeft = Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)));
      trialDaysLeft = String(daysLeft);
      trialEndFormatted = endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    // Build COMPLETE variables object with fallbacks for null values
    const userVars = {
      // Identity
      user_name: fullName || firstName,
      name: fullName || firstName,
      first_name: firstName,
      last_name: lastName,
      email: user_email,
      'contact.first_name': firstName,
      'contact.last_name': lastName,
      'contact.email': user_email,

      // Study progress — with sensible fallbacks
      predicted_grade: targetUser.polly_predicted_grade || 'not yet determined',
      predicted_score: targetUser.polly_predicted_score != null ? String(targetUser.polly_predicted_score) : 'not yet determined',
      mastery_gap: targetUser.polly_mastery_gap || 'key concepts',
      course_name: courseName || 'your course',
      tasks_remaining: tasksRemaining != null ? String(tasksRemaining) : 'several',
      current_streak: String(targetUser.current_streak || 0),

      // Profile
      school: profile?.school || '',
      grade: profile?.grade || '',

      // Gamification
      level: String(targetUser.level || 1),
      total_points: String(targetUser.total_points || 0),
      questions_completed: String(targetUser.questions_completed || 0),

      // Subscription
      plan_type: targetUser.subscription_plan_type || targetUser.data?.subscription_plan_type || 'free',
      trial_days_left: trialDaysLeft || '',
      trial_end_date: trialEndFormatted || ''
    };

    console.log('Template variables built:', JSON.stringify(userVars));

    let sentCount = 0;

    for (const template of templates) {
      // Skip if neither a resend template nor an inline body is configured
      if (!template.resend_template_id && !template.body) continue;

      // Duplicate prevention (skip for test sends)
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

      try {
        let emailPayload;

        if (template.body) {
          // ── INLINE MODE: use subject + body from AutomaticEmail entity ──
          const renderedSubject = renderTemplate(
            template.subject || template.resend_template_name || 'StudyApp.AI',
            userVars
          );
          const renderedBody = renderTemplate(template.body, userVars);

          emailPayload = {
            from: 'StudyApp.AI <updates@updates.studyappai.com>',
            reply_to: 'info@studyappai.com',
            to: [user_email],
            subject: renderedSubject,
            html: renderedBody
          };
        } else if (template.resend_template_id) {
          // ── RESEND TEMPLATE MODE: fetch template HTML and render variables ──
          let templateHtml = null;
          let templateSubject = null;
          try {
            const tmplRes = await fetch(`https://api.resend.com/templates/${template.resend_template_id}`, {
              headers: { 'Authorization': `Bearer ${resendApiKey}` }
            });
            if (tmplRes.ok) {
              const tmplData = await tmplRes.json();
              templateHtml = tmplData.html || null;
              templateSubject = tmplData.subject || null;
            } else {
              console.error('Template fetch error:', tmplRes.status, await tmplRes.text());
            }
          } catch (tmplErr) {
            console.warn('Template fetch failed:', tmplErr.message);
          }

          if (templateHtml) {
            const renderedHtml = renderTemplate(templateHtml, userVars);
            const renderedSubject = renderTemplate(
              templateSubject || template.resend_template_name || 'StudyApp.AI',
              userVars
            );

            emailPayload = {
              from: 'StudyApp.AI <updates@updates.studyappai.com>',
              reply_to: 'info@studyappai.com',
              to: [user_email],
              subject: renderedSubject,
              html: renderedHtml
            };
          } else {
            // Fallback: basic email if template fetch failed
            emailPayload = {
              from: 'StudyApp.AI <updates@updates.studyappai.com>',
              reply_to: 'info@studyappai.com',
              to: [user_email],
              subject: template.resend_template_name || 'StudyApp.AI',
              html: `<p>Hi ${firstName},</p><p>Welcome to StudyApp.AI! We're excited to have you.</p>`
            };
          }
        }

        if (!emailPayload) continue;

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
          console.error('Payload subject:', emailPayload.subject);
        } else {
          console.log('Resend send success:', resBody);
        }

        // Log it (skip for test sends)
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