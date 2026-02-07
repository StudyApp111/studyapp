import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || user.email !== 'kartikeya2159@gmail.com') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { email } = await req.json();

        // Service role list returns character count (not array) - RLS "read: true" makes
        // service role return raw data differently. Let's use user-scoped calls.
        const userLessons = await base44.entities.Lesson.list('-created_date');
        const userExams = await base44.entities.Exam.list('-created_date');
        const userStudyPlans = await base44.entities.StudyPlan.list('-created_date');
        
        // Parse if string
        const parseSafe = (val) => {
            if (typeof val === 'string') {
                try { return JSON.parse(val); } catch { return []; }
            }
            return Array.isArray(val) ? val : [];
        };
        
        const lessons = parseSafe(userLessons);
        const exams = parseSafe(userExams);
        const plans = parseSafe(userStudyPlans);
        
        return Response.json({
            lessons_count: lessons.length,
            exams_count: exams.length,
            plans_count: plans.length,
            lesson_names: lessons.slice(0, 5).map(l => l.course_name),
            first_exam_grade: exams.length > 0 ? exams[0].predicted_grade : null,
            raw_type_lessons: typeof userLessons,
        });
    } catch (error) {
        console.error('Debug error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});