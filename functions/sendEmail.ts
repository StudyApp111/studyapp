import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, html, from = "StudyApp.AI <noreply@studyapp.ai>" } = await req.json();

    if (!to || !subject || !html) {
      return Response.json({ 
        error: 'Missing required fields: to, subject, html' 
      }, { status: 400 });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json({ 
        error: 'Failed to send email',
        details: data 
      }, { status: response.status });
    }

    return Response.json({ 
      success: true,
      emailId: data.id,
      message: 'Email sent successfully'
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});