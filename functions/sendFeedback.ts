import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Resend } from 'npm:resend';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { name, email, message } = await req.json();

        if (!email || !message) {
            return Response.json({ error: 'Email and message are required' }, { status: 400 });
        }

        const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

        const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #9333ea 0%, #fbbf24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">📬 New Feedback Received</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="margin-bottom: 20px;">
      <div style="font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">FROM</div>
      <div style="margin-top: 5px; padding: 12px; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">${name || "Anonymous User"}</div>
    </div>
    
    <div style="margin-bottom: 20px;">
      <div style="font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">EMAIL</div>
      <div style="margin-top: 5px; padding: 12px; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">${email}</div>
    </div>
    
    <div style="margin-bottom: 20px;">
      <div style="font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">MESSAGE</div>
      <div style="margin-top: 5px; padding: 12px; background: white; border-radius: 6px; border: 1px solid #e5e7eb; white-space: pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
    Sent via StudyApp.AI Feedback System
  </div>
</div>
        `;

        await resend.emails.send({
            from: 'StudyApp.AI Feedback <no-reply@studyappai.com>',
            to: 'info@studyappai.com',
            subject: `New Feedback from ${name || email}`,
            html: htmlBody
        });

        return Response.json({ success: true });

    } catch (error) {
        console.error('Error sending feedback:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});