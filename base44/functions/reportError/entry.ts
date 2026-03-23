import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
    const page = context?.pageName || context?.page || 'Unknown';
    const url = context?.url || (typeof location !== 'undefined' ? location.href : '');
    const step = context?.step || context?.appStep || 'Unknown';
    const lastAction = context?.lastAction || {};
    const errorCode = context?.error_code || 'N/A';

    const emailSubject = `[${severity.toUpperCase()}][${errorCode}][${errorId}] ${subject}`;
    const emailBody = [
      `Error ID: ${errorId}`,
      `Severity: ${severity}`,
      `User: ${user.email}`,
      `Time: ${new Date().toISOString()}`,
      `Page: ${page}`,
      `URL: ${url}`,
      `Step: ${step}`,
      `Last Action: ${lastAction.type || 'n/a'} | Label: ${(lastAction.label || '').slice(0,120)} | id: ${lastAction.id || ''} | role: ${lastAction.role || ''} | href: ${lastAction.href || ''}`,
      `Error Code: ${errorCode}`,
      '',
      'Message:',
      String(messageBody || '').slice(0, 4000),
      '',
      'Context:',
      JSON.stringify(context || {}, null, 2).slice(0, 6000)
    ].join('\n');

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