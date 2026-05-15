import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * sendDesktopLink — emails the authenticated user a one-tap link to continue
 * their StudyApp session on a larger screen (laptop / tablet / desktop).
 *
 * Source of truth for copy:
 *   AutomaticEmail record with trigger_type = "desktop_link_request".
 *   Admins edit subject + body in the Email Manager dashboard.
 *   Supported placeholders in subject + body:
 *     {{name}}         — user's full name (or "there")
 *     {{first_name}}   — user's first name (or "there")
 *     {{desktop_url}}  — https://app.studyappai.com
 *
 * If no AutomaticEmail record is found, we fall back to the built-in default
 * copy below so the feature never breaks even on a fresh database.
 *
 * Auth: requires authenticated user.
 * Transport: Resend (RESEND_API_KEY env var).
 */

const DESKTOP_URL = 'https://app.studyappai.com';

// Built-in fallback template. Kept identical in spirit to the original
// hardcoded copy so behaviour is unchanged for installs that haven't seeded
// the AutomaticEmail row yet.
const DEFAULT_SUBJECT = 'Continue StudyApp on your computer';
const DEFAULT_BODY = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{{subject}}</title></head>
<body style="margin:0;padding:0;background:#f6f5fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e1b2e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5fb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(80,40,160,0.08);">
        <tr><td style="padding:32px 32px 8px 32px;">
          <div style="font-size:26px;font-weight:900;letter-spacing:-0.02em;">
            <span style="background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Study</span><span style="color:#1e1b2e;">App</span>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px 8px 32px;">
          <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:800;line-height:1.3;color:#1e1b2e;">
            Hey {{first_name}}, your full study workspace is one click away
          </h1>
          <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#475569;">
            Here's a quick link to open StudyApp on your computer, where you'll find the full study experience — interactive predicted-grade charts, customizable study plans, and the side-by-side document workspace.
          </p>
          <div style="background:#faf7ff;border:1px solid #ede4ff;border-radius:12px;padding:16px 18px;margin:0 0 24px 0;">
            <p style="margin:0 0 10px 0;font-size:13px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:0.05em;">
              What you'll see on desktop
            </p>
            <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#334155;">
              <li><strong>Predicted Grade Dashboard</strong> — see where you stand and how each session moves the needle</li>
              <li><strong>Custom Study Plans</strong> — full editor to rebuild around your weak spots</li>
              <li><strong>Side-by-side workspace</strong> — your document, your notes, and the AI tutor on one screen</li>
            </ul>
          </div>
        </td></tr>
        <tr><td align="center" style="padding:0 32px 8px 32px;">
          <a href="{{desktop_url}}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;box-shadow:0 4px 12px rgba(124,58,237,0.3);">
            Open StudyApp on my computer
          </a>
        </td></tr>
        <tr><td align="center" style="padding:12px 32px 32px 32px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
            Tip: open this email on your laptop or desktop and click the button above.<br/>
            Or visit <a href="{{desktop_url}}" style="color:#7c3aed;text-decoration:none;">app.studyappai.com</a> directly.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 32px 32px;border-top:1px solid #f1f5f9;">
          <p style="margin:24px 0 0 0;font-size:11px;color:#94a3b8;line-height:1.5;">
            You're receiving this because you requested a desktop link from inside StudyApp.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

// Replace {{var}} placeholders in a string. Simple, no regex foot-guns.
function applyVars(template, vars) {
  if (!template) return '';
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v ?? '');
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return Response.json({ error: 'Email service not configured' }, { status: 500 });
    }

    // Load the admin-editable record (service role — admins set RLS to admin-only).
    let template = null;
    try {
      const matches = await base44.asServiceRole.entities.AutomaticEmail.filter({
        trigger_type: 'desktop_link_request',
      });
      if (Array.isArray(matches) && matches.length > 0) {
        template = matches[0];
      }
    } catch (e) {
      console.warn('sendDesktopLink: could not load AutomaticEmail record, using fallback', e?.message);
    }

    const firstName = (user.full_name || user.display_name || '').split(' ')[0] || 'there';
    const fullName = user.full_name || user.display_name || 'there';

    const vars = {
      name: fullName,
      first_name: firstName,
      desktop_url: DESKTOP_URL,
    };

    // Prefer admin-edited copy; fall back to built-in default.
    const rawSubject = (template?.subject && template.subject.trim()) || DEFAULT_SUBJECT;
    const rawBody    = (template?.body    && template.body.trim())    || DEFAULT_BODY;

    const subject = applyVars(rawSubject, vars);
    // Inject the rendered subject so {{subject}} placeholder in the default
    // template's <title> tag resolves nicely.
    const html = applyVars(rawBody, { ...vars, subject });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'StudyApp.AI <updates@updates.studyappai.com>',
        reply_to: 'info@studyappai.com',
        to: [user.email],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Resend send failed:', response.status, errText);
      return Response.json({ error: 'Failed to send email' }, { status: 502 });
    }

    // Bump send_count for admin visibility (best-effort, never blocks the send).
    if (template?.id) {
      try {
        await base44.asServiceRole.entities.AutomaticEmail.update(template.id, {
          send_count: (template.send_count || 0) + 1,
        });
      } catch (e) {
        console.warn('sendDesktopLink: could not increment send_count', e?.message);
      }
    }

    return Response.json({ success: true, email: user.email, source: template ? 'dashboard' : 'fallback' });
  } catch (error) {
    console.error('sendDesktopLink error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});