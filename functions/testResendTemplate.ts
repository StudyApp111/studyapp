import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { template_id, to_email } = await req.json();
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // First, fetch template info to understand its structure
    const tmplInfoRes = await fetch(`https://api.resend.com/templates/${template_id}`, {
      headers: { 'Authorization': `Bearer ${resendApiKey}` }
    });
    const tmplInfoBody = await tmplInfoRes.text();
    console.log('Template GET response:', tmplInfoRes.status, tmplInfoBody);

    // Test with subject included (Resend requires subject when template doesn't have default)
    const payload = {
      from: 'StudyApp.AI <updates@updates.studyappai.com>',
      to: [to_email || user.email],
      subject: 'Welcome to StudyApp.AI',
      template: {
        id: template_id,
        variables: {}
      }
    };

    console.log('Sending payload:', JSON.stringify(payload));
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.text();
    console.log('Send result:', res.status, body);

    return Response.json({
      template_info: { status: tmplInfoRes.status, body: tmplInfoBody },
      send_result: { status: res.status, body }
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});