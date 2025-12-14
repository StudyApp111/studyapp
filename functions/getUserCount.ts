import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify admin access
        const user = await base44.auth.me();
        if (!user || user.email !== 'kartikeya2159@gmail.com') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user count using service role
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);

        return Response.json({ 
            count: allUsers.length,
            users: allUsers.map(u => ({
                email: u.email,
                full_name: u.full_name,
                id: u.id
            }))
        });
    } catch (error) {
        console.error('Get user count error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});