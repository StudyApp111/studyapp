import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { pre_made_course_id, fingerprint } = await req.json();
        
        if (!pre_made_course_id) {
            return Response.json({ error: 'pre_made_course_id is required' }, { status: 400 });
        }

        let user = null;
        try {
            user = await base44.auth.me();
        } catch (e) {
            // Not authenticated
        }
        
        const entities = base44.asServiceRole.entities;
        
        const courses = await entities.PreMadeCourse.filter({ id: pre_made_course_id });
        const course = courses[0];
        if (!course) {
            return Response.json({ error: 'Course not found' }, { status: 404 });
        }

        let validSession = null;
        if (!user && fingerprint) {
            const fingerprintHash = await hashString(fingerprint);
            const guestLogs = await entities.AbuseLog.filter({ action_type: 'guest_session' });
            validSession = guestLogs.find(log => log.fingerprint === fingerprintHash && !log.blocked);
            
            if (!validSession) {
                return Response.json({ error: 'No valid guest session found' }, { status: 403 });
            }
            
            const existingGuestLessons = guestLogs.filter(
                log => log.fingerprint === fingerprintHash && log.metadata?.lesson_created
            );
            if (existingGuestLessons.length > 0) {
                return Response.json({ error: 'Guest already created a lesson' }, { status: 403 });
            }
        }

        const lessonData = {
            course_name: course.course_name,
            description: course.description,
            input_type: "description",
            extracted_content: course.extracted_content || "Pre-made course content",
            compressed_content: course.compressed_content || "Pre-made course content",
            curriculum_map: course.curriculum_map || {},
            topics: course.topics || [],
            status: "created"
        };

        if (user) {
            lessonData.created_by = user.email;
        }

        const newLesson = await entities.Lesson.create(lessonData);

        if (!user && validSession) {
            await entities.AbuseLog.update(validSession.id, {
                metadata: { 
                    ...validSession.metadata,
                    lesson_created: true, 
                    lesson_id: newLesson.id,
                    lesson_created_at: new Date().toISOString() 
                }
            });
        }

        // Create diagnostic exam
        const examData = {
            lesson_id: newLesson.id,
            exam_type: "official",
            exam_number: 1,
            title: "Diagnostic Assessment",
            questions: course.diagnostic_questions_list || [],
            status: "in_progress",
            completed: false,
            time_taken_seconds: 0,
            question_time_laps: []
        };

        if (user) {
            examData.created_by = user.email;
        }

        await entities.Exam.create(examData);

        return Response.json({ success: true, lesson_id: newLesson.id });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});