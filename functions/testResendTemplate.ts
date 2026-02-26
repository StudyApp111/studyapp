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

    // Test 1: template as nested object (current approach)
    const payload1 = {
      from: 'StudyApp.AI <updates@updates.studyappai.com>',
      to: [to_email || user.email],
      subject: 'Welcome to StudyApp.AI',
      template: {
        id: template_id,
        variables: {}
      }
    };

    console.log('Test 1 - nested template object:', JSON.stringify(payload1));
    const res1 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload1)
    });
    const body1 = await res1.text();
    console.log('Test 1 result:', res1.status, body1);

    // Test 2: template_id as top-level field (alternative format)
    const payload2 = {
      from: 'StudyApp.AI <updates@updates.studyappai.com>',
      to: [to_email || user.email],
      subject: 'Welcome to StudyApp.AI',
      template_id: template_id
    };

    console.log('Test 2 - template_id top-level:', JSON.stringify(payload2));
    const res2 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload2)
    });
    const body2 = await res2.text();
    console.log('Test 2 result:', res2.status, body2);

    return Response.json({
      test1_nested: { status: res1.status, body: body1 },
      test2_toplevel: { status: res2.status, body: body2 }
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});