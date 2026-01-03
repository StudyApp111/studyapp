import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Validate authenticated user
        const authenticatedUser = await base44.auth.me();
        if (!authenticatedUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const { trigger_type, context } = await req.json();
        
        // Use authenticated user's email - don't allow triggering for other users
        const user_email = authenticatedUser.email;

        if (!trigger_type) {
            return Response.json({ error: 'trigger_type required' }, { status: 400 });
        }

        // Get enabled automatic emails for this trigger
        const templates = await base44.asServiceRole.entities.AutomaticEmail.filter({
            trigger_type,
            enabled: true
        });

        if (templates.length === 0) {
            return Response.json({ message: 'No enabled templates for this trigger' });
        }

        // Get user data
        const users = await base44.asServiceRole.entities.User.filter({ email: user_email });
        if (users.length === 0) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }
        const user = users[0];

        // Get learning profile
        let profile = null;
        if (user.learning_profile_id) {
            const profiles = await base44.asServiceRole.entities.LearningProfile.filter({
                id: user.learning_profile_id
            });
            if (profiles.length > 0) {
                profile = profiles[0];
            }
        }

        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (!resendApiKey) {
            return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
        }

        let sentCount = 0;

        for (const template of templates) {
            // Check if already sent to this user for this trigger
            const existingLogs = await base44.asServiceRole.entities.EmailLog.filter({
                user_email,
                email_template_id: template.id,
                trigger_type,
                ...(context?.reference_id ? { trigger_reference_id: context.reference_id } : {})
            });

            // Skip if already sent for this specific trigger instance
            if (existingLogs.length > 0) {
                continue;
            }

            // Check milestone triggers
            if (template.trigger_type === 'level_milestone') {
                const milestoneValue = template.trigger_config?.milestone_value || 5;
                if (user.level !== milestoneValue) {
                    continue;
                }
            }

            if (template.trigger_type === 'streak_milestone') {
                const milestoneValue = template.trigger_config?.milestone_value || 7;
                if (user.current_streak !== milestoneValue) {
                    continue;
                }
            }

            // Personalize email content
            let personalizedSubject = template.subject;
            let personalizedBody = template.body;

            const replacements = {
                '{{name}}': user.full_name || 'there',
                '{{school}}': profile?.school || 'your school',
                '{{grade}}': profile?.grade || 'your grade',
                '{{level}}': user.level?.toString() || '1',
                '{{total_points}}': user.total_points?.toString() || '0',
                '{{current_streak}}': user.current_streak?.toString() || '0',
                '{{questions_completed}}': user.questions_completed?.toString() || '0'
            };

            for (const [placeholder, value] of Object.entries(replacements)) {
                personalizedSubject = personalizedSubject.replace(new RegExp(placeholder, 'g'), value);
                personalizedBody = personalizedBody.replace(new RegExp(placeholder, 'g'), value);
            }

            // Send email via Resend
            try {
                const response = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resendApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: 'StudyApp.AI <updates@updates.studyappai.com>',
                        reply_to: 'info@studyappai.com',
                        to: user.email,
                        subject: personalizedSubject,
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

                const success = response.ok;

                // Log the email
                await base44.asServiceRole.entities.EmailLog.create({
                    user_email,
                    email_template_id: template.id,
                    trigger_type,
                    trigger_reference_id: context?.reference_id || null,
                    sent_at: new Date().toISOString(),
                    success
                });

                if (success) {
                    // Update send count
                    await base44.asServiceRole.entities.AutomaticEmail.update(template.id, {
                        send_count: (template.send_count || 0) + 1
                    });
                    sentCount++;
                }
            } catch (emailError) {
                console.error('Error sending email:', emailError);
                // Log failed attempt
                await base44.asServiceRole.entities.EmailLog.create({
                    user_email,
                    email_template_id: template.id,
                    trigger_type,
                    trigger_reference_id: context?.reference_id || null,
                    sent_at: new Date().toISOString(),
                    success: false
                });
            }
        }

        return Response.json({ 
            message: `Sent ${sentCount} email(s)`,
            sent: sentCount
        });

    } catch (error) {
        console.error('Error in triggerAutomaticEmails:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});