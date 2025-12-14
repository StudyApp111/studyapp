import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify admin access
        const user = await base44.auth.me();
        if (!user || user.email !== 'kartikeya2159@gmail.com') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { subject, body } = await req.json();

        if (!subject || !body) {
            return Response.json({ error: 'Subject and body are required' }, { status: 400 });
        }

        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (!resendApiKey) {
            return Response.json({ error: 'Resend API key not configured' }, { status: 500 });
        }

        // Get all users using service role
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);

        let sent = 0;
        let failed = 0;

        // Send emails to all users via Resend
        for (const targetUser of allUsers) {
            try {
                // Get learning profile for school and grade
                let learningProfile = null;
                if (targetUser.learning_profile_id) {
                    const profiles = await base44.asServiceRole.entities.LearningProfile.filter({
                        id: targetUser.learning_profile_id
                    });
                    if (profiles.length > 0) {
                        learningProfile = profiles[0];
                    }
                }

                // Replace dynamic fields
                let personalizedBody = body
                    .replace(/\{\{name\}\}/g, targetUser.full_name || 'there')
                    .replace(/\{\{school\}\}/g, learningProfile?.school || 'your school')
                    .replace(/\{\{grade\}\}/g, learningProfile?.grade || 'your grade')
                    .replace(/\{\{level\}\}/g, targetUser.level || 1)
                    .replace(/\{\{total_points\}\}/g, targetUser.total_points || 0)
                    .replace(/\{\{current_streak\}\}/g, targetUser.current_streak || 0)
                    .replace(/\{\{questions_completed\}\}/g, targetUser.questions_completed || 0);

                // Send via Resend API
                const resendResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resendApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: 'StudyApp.AI <updates@updates.studyappai.com>',
                        reply_to: 'info@studyappai.com',
                        to: targetUser.email,
                        subject: subject,
                        html: `<style>
                            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #000; }
                            p { margin: 0 0 15px 0; }
                            h1 { font-size: 2em; font-weight: normal; margin: 0.67em 0; }
                            h2 { font-size: 1.5em; font-weight: normal; margin: 0.75em 0; }
                            h3 { font-size: 1.17em; font-weight: normal; margin: 0.83em 0; }
                            h4, h5, h6 { font-weight: normal; margin: 1em 0; }
                            .ql-size-small { font-size: 0.75em; }
                            .ql-size-large { font-size: 1.5em; }
                            .ql-size-huge { font-size: 2.5em; }
                        </style>${personalizedBody}`
                    })
                });

                if (resendResponse.ok) {
                    sent++;
                } else {
                    console.error(`Resend failed for ${targetUser.email}:`, await resendResponse.text());
                    failed++;
                }
            } catch (emailError) {
                console.error(`Failed to send to ${targetUser.email}:`, emailError);
                failed++;
            }
        }

        return Response.json({ 
            success: true, 
            sent, 
            failed,
            total: allUsers.length 
        });
    } catch (error) {
        console.error('Bulk email error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});