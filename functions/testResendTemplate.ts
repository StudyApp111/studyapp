import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { template_id, to_email, variables } = await req.json();
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Test 1: With variables
    const payload1 = {
      from: 'StudyApp.AI <updates@updates.studyappai.com>',
      to: [to_email || user.email],
      template: {
        id: template_id,
        variables: variables || {}
      }
    };

    console.log('Test 1 payload:', JSON.stringify(payload1));
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

    // Test 2: No variables
    const payload2 = {
      from: 'StudyApp.AI <updates@updates.studyappai.com>',
      to: [to_email || user.email],
      template: {
        id: template_id,
        variables: {}
      }
    };

    console.log('Test 2 payload:', JSON.stringify(payload2));
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

    // Test 3: Plain HTML (no template)
    const payload3 = {
      from: 'StudyApp.AI <updates@updates.studyappai.com>',
      to: [to_email || user.email],
      subject: 'Test Email - No Template',
      html: '<h1>Hello!</h1><p>This is a test without template.</p>'
    };

    const res3 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload3)
    });
    const body3 = await res3.text();
    console.log('Test 3 result:', res3.status, body3);

    return Response.json({
      test1_with_vars: { status: res1.status, body: body1 },
      test2_empty_vars: { status: res2.status, body: body2 },
      test3_plain_html: { status: res3.status, body: body3 }
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});