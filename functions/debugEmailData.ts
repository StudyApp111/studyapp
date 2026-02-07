import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { email } = await req.json();
        
        // Test 1: list all lessons via service role
        const allLessonsService = await base44.asServiceRole.entities.Lesson.list('-created_date', 10);
        
        // Test 2: filter lessons via service role
        let filteredLessonsService = [];
        try {
            filteredLessonsService = await base44.asServiceRole.entities.Lesson.filter({ created_by: email }, '-created_date', 10);
        } catch (e) {
            filteredLessonsService = ['FILTER_ERROR: ' + e.message];
        }

        // Test 3: list lessons as the requesting user (will use RLS)
        const userLessons = await base44.entities.Lesson.list('-created_date', 10);

        // Test 4: Get exams
        const allExamsService = await base44.asServiceRole.entities.Exam.list('-created_date', 5);
        
        // Show just the key fields
        const simplify = (items) => {
            if (!Array.isArray(items)) return items;
            return items.map(item => ({
                id: item.id,
                created_by: item.created_by,
                course_name: item.course_name,
                lesson_id: item.lesson_id,
                predicted_grade: item.predicted_grade,
                completed: item.completed,
            }));
        };

        return Response.json({
            target_email: email,
            test1_serviceRole_list: {
                count: allLessonsService.length,
                sample: simplify(allLessonsService.slice(0, 3)),
                first_created_by: allLessonsService[0]?.created_by,
                first_keys: allLessonsService[0] ? Object.keys(allLessonsService[0]) : []
            },
            test2_serviceRole_filter: {
                count: Array.isArray(filteredLessonsService) ? filteredLessonsService.length : 'error',
                sample: simplify(Array.isArray(filteredLessonsService) ? filteredLessonsService.slice(0, 3) : filteredLessonsService)
            },
            test3_userRLS_list: {
                count: userLessons.length,
                sample: simplify(userLessons.slice(0, 3)),
                first_created_by: userLessons[0]?.created_by
            },
            test4_exams: {
                count: allExamsService.length,
                sample: simplify(allExamsService.slice(0, 3))
            }
        });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});