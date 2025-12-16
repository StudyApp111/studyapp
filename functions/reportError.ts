import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized', code: 'AUTH_001' }, { status: 401 });
    }

    const method = req.method || 'POST';
    if (method !== 'POST') {
      return Response.json({ status: 'ok' });
    }

    const body = await req.json();
    const {
      subject = 'App Error Report',
      body: messageBody = '',
      severity = 'error',
      context = {}
    } = body || {};

    // Create a lightweight error id for correlation
    const errorId = `ERR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    // Compose email
    const emailSubject = `[${severity.toUpperCase()}][${errorId}] ${subject}`;
    const emailBody = `Error ID: ${errorId}\n` +
      `User: ${user.email}\n` +
      `Time: ${new Date().toISOString()}\n` +
      `\nMessage:\n${messageBody}\n` +
      `\nContext:\n${JSON.stringify(context || {}, null, 2)}`;

    // Send email to support
    await base44.integrations.Core.SendEmail({
      to: 'support@study-app.ai',
      subject: emailSubject,
      body: emailBody,
    });

    // Persist to ErrorLog as well
    try {
      await base44.entities.ErrorLog.create({
        error_type: 'support_report',
        error_message: subject,
        error_stack: messageBody?.slice(0, 5000) || '',
        context: { ...context, error_id: errorId },
        user_email: user.email,
        resolved: false,
      });
    } catch (_) {
      // ignore persist errors
    }

    return Response.json({ success: true, error_id: errorId });
  } catch (error) {
    return Response.json({ error: 'Failed to report error', code: 'INTERNAL_001', details: error.message }, { status: 500 });
  }
});