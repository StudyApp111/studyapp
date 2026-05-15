import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * sendDesktopLink — emails the authenticated user a one-tap link to continue
 * their StudyApp session on a larger screen (laptop / tablet / desktop).
 *
 * Why this exists:
 *  - The full StudyApp experience (predicted grade chart, custom study plans,
 *    side-by-side document + AI tutor, interactive timeline) is built for
 *    desktop and doesn't fit in a phone form factor.
 *  - When a mobile user reaches a daily feature limit, we offer to email them
 *    a link to pick up exactly where they left off on a bigger device.
 *  - This is positioned as a product/experience continuation — NOT as a
 *    workaround for app-store payment policies.
 *
 * Auth: requires authenticated user (uses base44 SDK auth).
 * Email transport: Resend (RESEND_API_KEY env var).
 */
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

    const { reason } = await req.json().catch(() => ({}));

    const firstName = (user.full_name || user.display_name || '').split(' ')[0] || 'there';
    const desktopUrl = 'https://app.studyappai.com';

    // Reason-aware subject + lead line. Keep messaging product-focused — we
    // talk about the richer experience, not about subscription mechanics.
    const reasonCopy = {
      limit_reached: {
        subject: 'Pick up your StudyApp session on your computer',
        lead: "You've made great progress today on your phone. To keep going without limits, open StudyApp on your computer — that's where the full study experience lives.",
      },
      desktop_features: {
        subject: 'Your StudyApp Predicted Grade dashboard is ready on desktop',
        lead: "Your predicted grade, custom study plan, and side-by-side document view all live on the full desktop experience. Open the link below on your computer to dive in.",
      },
      default: {
        subject: 'Continue StudyApp on your computer',
        lead: "Here's a quick link to open StudyApp on your computer, where you'll find the full study experience — interactive predicted-grade charts, customizable study plans, and the side-by-side document workspace.",
      },
    };
    const copy = reasonCopy[reason] || reasonCopy.default;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${copy.subject}</title></head>
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
            Hey ${firstName}, your full study workspace is one click away
          </h1>
          <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#475569;">
            ${copy.lead}
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
          <a href="${desktopUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;box-shadow:0 4px 12px rgba(124,58,237,0.3);">
            Open StudyApp on my computer
          </a>
        </td></tr>
        <tr><td align="center" style="padding:12px 32px 32px 32px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
            Tip: open this email on your laptop or desktop and click the button above.<br/>
            Or visit <a href="${desktopUrl}" style="color:#7c3aed;text-decoration:none;">app.studyappai.com</a> directly.
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
        subject: copy.subject,
        html,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Resend send failed:', response.status, errText);
      return Response.json({ error: 'Failed to send email' }, { status: 502 });
    }

    return Response.json({ success: true, email: user.email });
  } catch (error) {
    console.error('sendDesktopLink error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});