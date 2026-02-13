import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const response = await fetch('https://api.resend.com/templates', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({ error: `Resend API error: ${errorText}` }, { status: 500 });
    }

    const data = await response.json();
    return Response.json({ templates: data.data || [] });

  } catch (error) {
    console.error('listResendTemplates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});