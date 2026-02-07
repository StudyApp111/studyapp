import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || user.email !== 'kartikeya2159@gmail.com') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { email } = await req.json();

        // Test different approaches to get lessons
        const allLessons = await base44.asServiceRole.entities.Lesson.list();
        
        // Log a sample lesson to see the structure
        if (allLessons.length > 0) {
            const sample = allLessons[0];
            console.log('Sample lesson keys:', Object.keys(sample));
            console.log('Sample lesson created_by:', sample.created_by);
            console.log('Sample lesson course_name:', sample.course_name);
            console.log('Full sample:', JSON.stringify(sample).substring(0, 500));
        }

        const userLessons = allLessons.filter(l => l.created_by === email);
        
        // Also try filter method
        const filteredLessons = await base44.asServiceRole.entities.Lesson.filter({ created_by: email });
        
        return Response.json({
            total_lessons_in_db: allLessons.length,
            user_lessons_by_filter_js: userLessons.length,
            user_lessons_by_sdk_filter: filteredLessons.length,
            target_email: email,
            sample_created_by: allLessons.length > 0 ? allLessons[0].created_by : 'no lessons',
            filtered_names: filteredLessons.map(l => l.course_name)
        });
    } catch (error) {
        console.error('Debug error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});