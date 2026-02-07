import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || user.email !== 'kartikeya2159@gmail.com') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { email } = await req.json();

        // Try multiple approaches
        const listResult = await base44.asServiceRole.entities.Lesson.list('-created_date');
        const filterAll = await base44.asServiceRole.entities.Lesson.filter({});
        const filterByEmail = await base44.asServiceRole.entities.Lesson.filter({ created_by: email });
        
        // Also try user-scoped (not service role)
        let userScoped = [];
        try {
            userScoped = await base44.entities.Lesson.list('-created_date');
        } catch (e) {
            console.log('User scoped error:', e.message);
        }
        
        console.log('list() count:', listResult.length);
        console.log('filter({}) count:', filterAll.length);
        console.log('filter by email count:', filterByEmail.length);
        console.log('user scoped count:', userScoped.length);
        
        if (userScoped.length > 0) {
            console.log('User scoped sample:', JSON.stringify(userScoped[0]).substring(0, 300));
        }
        
        return Response.json({
            list_count: listResult.length,
            filter_all_count: filterAll.length,
            filter_by_email_count: filterByEmail.length,
            user_scoped_count: Array.isArray(userScoped) ? userScoped.length : 'not array',
            user_scoped_type: typeof userScoped,
            user_scoped_sample: Array.isArray(userScoped) ? userScoped.slice(0, 2).map(l => l.course_name) : JSON.stringify(userScoped).substring(0, 200),
        });
    } catch (error) {
        console.error('Debug error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});