import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Use service role to fetch all users for leaderboard
        const allUsers = await base44.asServiceRole.entities.User.list('-total_points', 100);
        
        // Fetch learning profiles for each user
        const usersWithProfiles = await Promise.all(
            allUsers.map(async (u) => {
                if (u.learning_profile_id) {
                    const profiles = await base44.asServiceRole.entities.LearningProfile.filter({
                        id: u.learning_profile_id
                    });
                    return {
                        id: u.id,
                        full_name: u.full_name,
                        email: u.email,
                        total_points: u.total_points || 0,
                        level: u.level || 1,
                        city: profiles[0]?.city || null
                    };
                }
                return {
                    id: u.id,
                    full_name: u.full_name,
                    email: u.email,
                    total_points: u.total_points || 0,
                    level: u.level || 1,
                    city: null
                };
            })
        );

        return Response.json({ users: usersWithProfiles });
    } catch (error) {
        console.error('Leaderboard error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});