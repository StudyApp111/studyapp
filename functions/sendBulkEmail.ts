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

        // Get all users using service role
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);

        let sent = 0;
        let failed = 0;

        // Send emails to all users
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

                await base44.asServiceRole.integrations.Core.SendEmail({
                    from_name: 'StudyApp.AI',
                    to: targetUser.email,
                    subject: subject,
                    body: personalizedBody
                });

                sent++;
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