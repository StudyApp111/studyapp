import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * sendDesktopLink — emails the authenticated user a one-tap link to continue
 * their StudyApp session on a larger screen (laptop / tablet / desktop).
 *
 * Source of truth for copy:
 *   AutomaticEmail record with trigger_type = "desktop_link_request" and an
 *   attached Resend template (resend_template_id). Admins design the template
 *   in Resend and select it in the Email Manager dashboard.
 *
 *   Available placeholders in the Resend template (resolved by sendResendEmail):
 *     {{first_name}}, {{name}}, {{email}}, {{desktop_url}}, plus all standard
 *     user-context variables (school, predicted_grade, latest_lesson, etc.)
 *
 * Auth: requires authenticated user.
 * Transport: delegates to sendResendEmail (Resend templates + var substitution).
 */

const DESKTOP_URL = 'https://app.studyappai.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delegate to sendResendEmail. It resolves the AutomaticEmail row by
    // trigger_type, fetches the Resend template, substitutes variables, sends,
    // logs, and bumps send_count — single source of truth for all email sends.
    const { data, error } = await base44.functions.invoke('sendResendEmail', {
      trigger_type: 'desktop_link_request',
      user_email: user.email,
      context: {
        desktop_url: DESKTOP_URL,
      },
    });

    if (error) {
      console.error('sendDesktopLink: sendResendEmail returned error', error);
      return Response.json({ error: 'Failed to send email' }, { status: 502 });
    }

    if (!data || data.sent === 0) {
      return Response.json(
        { error: 'No active Resend template configured for desktop_link_request' },
        { status: 503 }
      );
    }

    return Response.json({ success: true, email: user.email, sent: data.sent });
  } catch (error) {
    console.error('sendDesktopLink error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});