import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || user.email !== 'kartikeya2159@gmail.com') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { email } = await req.json();

        // Test per-user filtering with service role (after read:true RLS)
        const rawLessons = await base44.asServiceRole.entities.Lesson.filter({ created_by: email });
        const rawExams = await base44.asServiceRole.entities.Exam.filter({ created_by: email });
        const rawPlans = await base44.asServiceRole.entities.StudyPlan.filter({ created_by: email });
        const rawProfiles = await base44.asServiceRole.entities.LearningProfile.filter({ created_by: email });
        
        console.log('rawLessons type:', typeof rawLessons, 'isArray:', Array.isArray(rawLessons));
        if (typeof rawLessons === 'string') {
            console.log('rawLessons first 200 chars:', rawLessons.substring(0, 200));
            console.log('rawLessons length:', rawLessons.length);
        }
        
        const parseSafe = (val) => {
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') {
                try { return JSON.parse(val); } catch (e) { 
                    console.log('Parse error:', e.message, 'for string of length', val.length);
                    return []; 
                }
            }
            return [];
        };
        
        const lessons = parseSafe(rawLessons);
        const exams = parseSafe(rawExams);
        const plans = parseSafe(rawPlans);
        
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