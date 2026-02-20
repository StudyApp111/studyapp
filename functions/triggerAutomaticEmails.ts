import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// This function is a thin wrapper that forwards trigger calls to sendResendEmail.
// Existing in-app code calls triggerAutomaticEmails — this routes to the new Resend-based system.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Forward directly to sendResendEmail
    const result = await base44.functions.invoke('sendResendEmail', payload);
    // result is an axios-like response {data, status, headers} — return just the data
    return Response.json(result.data || result);

  } catch (error) {
    console.error('triggerAutomaticEmails error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});