import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function parseSafe(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return []; }
    }
    return [];
}

function buildUserEmailData(targetUser, allLessons, allExams, allStudyPlans, allProfiles) {
    const data = {
        name: targetUser.full_name || 'there',
        email: targetUser.email || '',
        school: 'your school',
        grade: 'your grade',
        level: targetUser.level || 1,
        total_points: targetUser.total_points || 0,
        current_streak: targetUser.current_streak || 0,
        questions_completed: targetUser.questions_completed || 0,
        first_lesson_name: 'N/A',
        first_lesson_date: 'N/A',
        first_predicted_grade: 'N/A',
        first_predicted_percentage: 'N/A',
        first_weak_area_count: 0,
        first_task_count: 0,
        first_time_spent_minutes: 0,
        latest_lesson_name: 'N/A',
        latest_predicted_grade: 'N/A',
        latest_predicted_percentage: 'N/A',
        total_lessons: 0,
        total_exams_completed: 0,
        total_time_spent_minutes: 0,
        grade_improvement: 'N/A',
        all_predicted_grades: 'N/A'
    };

    // Learning profile
    if (targetUser.learning_profile_id) {
        const profile = allProfiles.find(p => p.id === targetUser.learning_profile_id);
        if (profile) {
            data.school = profile.school || 'your school';
            data.grade = profile.grade || 'your grade';
        }
    }

    // User's lessons sorted oldest first
    const userLessons = allLessons
        .filter(l => l.created_by === targetUser.email)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    if (userLessons.length === 0) return data;

    data.total_lessons = userLessons.length;

    // Total study time across all lessons
    let totalSeconds = 0;
    for (const lesson of userLessons) {
        totalSeconds += lesson.total_study_time_seconds || 0;
    }
    data.total_time_spent_minutes = Math.round(totalSeconds / 60);

    const firstLesson = userLessons[0];
    const latestLesson = userLessons[userLessons.length - 1];
    const lessonIds = new Set(userLessons.map(l => l.id));

    // First lesson
    data.first_lesson_name = firstLesson.course_name || 'N/A';
    data.first_lesson_date = firstLesson.created_date
        ? new Date(firstLesson.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'N/A';
    data.first_time_spent_minutes = Math.round((firstLesson.total_study_time_seconds || 0) / 60);

    // Exams for first lesson
    const firstLessonExams = allExams
        .filter(e => e.lesson_id === firstLesson.id)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    if (firstLessonExams.length > 0) {
        const firstExam = firstLessonExams[0];
        data.first_predicted_grade = firstExam.predicted_grade || 'N/A';
        data.first_predicted_percentage = firstExam.total_score != null ? Math.round(firstExam.total_score) : 'N/A';
    }

    // Study plans for first lesson
    const firstLessonPlans = allStudyPlans
        .filter(p => p.lesson_id === firstLesson.id)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    if (firstLessonPlans.length > 0) {
        data.first_weak_area_count = firstLessonPlans[0].weak_competencies?.length || 0;
        data.first_task_count = firstLessonPlans[0].tasks?.length || 0;
    }

    // Latest lesson
    data.latest_lesson_name = latestLesson.course_name || 'N/A';

    const latestLessonExams = allExams
        .filter(e => e.lesson_id === latestLesson.id)
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    if (latestLessonExams.length > 0) {
        data.latest_predicted_grade = latestLessonExams[0].predicted_grade || 'N/A';
        data.latest_predicted_percentage = latestLessonExams[0].total_score != null ? Math.round(latestLessonExams[0].total_score) : 'N/A';
    }

    // Grade improvement (first vs latest)
    if (typeof data.first_predicted_percentage === 'number' && typeof data.latest_predicted_percentage === 'number') {
        const diff = data.latest_predicted_percentage - data.first_predicted_percentage;
        data.grade_improvement = diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : 'No change';
    }

    // All completed exams across all lessons
    const userExams = allExams
        .filter(e => lessonIds.has(e.lesson_id) && e.completed)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    data.total_exams_completed = userExams.length;

    if (userExams.length > 0) {
        const grades = userExams.filter(e => e.predicted_grade).map(e => e.predicted_grade);
        data.all_predicted_grades = grades.length > 0 ? grades.join(' → ') : 'N/A';
    }

    return data;
}

function replaceDynamicFields(text, data) {
    if (!text) return text;
    return text
        .replace(/\{\{name\}\}/g, String(data.name))
        .replace(/\{\{email\}\}/g, String(data.email))
        .replace(/\{\{school\}\}/g, String(data.school))
        .replace(/\{\{grade\}\}/g, String(data.grade))
        .replace(/\{\{level\}\}/g, String(data.level))
        .replace(/\{\{total_points\}\}/g, String(data.total_points))
        .replace(/\{\{current_streak\}\}/g, String(data.current_streak))
        .replace(/\{\{questions_completed\}\}/g, String(data.questions_completed))
        .replace(/\{\{first_lesson_name\}\}/g, String(data.first_lesson_name))
        .replace(/\{\{first_lesson_date\}\}/g, String(data.first_lesson_date))
        .replace(/\{\{first_predicted_grade\}\}/g, String(data.first_predicted_grade))
        .replace(/\{\{first_predicted_percentage\}\}/g, String(data.first_predicted_percentage))
        .replace(/\{\{first_weak_area_count\}\}/g, String(data.first_weak_area_count))
        .replace(/\{\{first_task_count\}\}/g, String(data.first_task_count))
        .replace(/\{\{first_time_spent_minutes\}\}/g, String(data.first_time_spent_minutes))
        .replace(/\{\{latest_lesson_name\}\}/g, String(data.latest_lesson_name))
        .replace(/\{\{latest_predicted_grade\}\}/g, String(data.latest_predicted_grade))
        .replace(/\{\{latest_predicted_percentage\}\}/g, String(data.latest_predicted_percentage))
        .replace(/\{\{total_lessons\}\}/g, String(data.total_lessons))
        .replace(/\{\{total_exams_completed\}\}/g, String(data.total_exams_completed))
        .replace(/\{\{total_time_spent_minutes\}\}/g, String(data.total_time_spent_minutes))
        .replace(/\{\{grade_improvement\}\}/g, String(data.grade_improvement))
        .replace(/\{\{all_predicted_grades\}\}/g, String(data.all_predicted_grades));
}

function wrapEmailTemplate(bodyHtml) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#7c3aed;padding:28px 24px;text-align:center;">
<img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/6afa508f0_LogoOnly.png" alt="StudyApp" width="44" height="44" style="display:inline-block;border-radius:8px;" />
<div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:10px;">StudyApp</div>
</td></tr>
<tr><td style="padding:32px 28px;font-size:15px;line-height:1.65;color:#1a1a2e;">
<style>
p{margin:0 0 15px 0}
h1{font-size:1.8em;font-weight:600;margin:0.5em 0;color:#1a1a2e}
h2{font-size:1.4em;font-weight:600;margin:0.5em 0;color:#1a1a2e}
h3{font-size:1.15em;font-weight:600;margin:0.5em 0;color:#1a1a2e}
ul,ol{margin:0 0 15px 0;padding-left:24px}
li{margin:4px 0}
a{color:#7c3aed;text-decoration:underline}
blockquote{border-left:4px solid #7c3aed;margin:0 0 15px;padding:8px 16px;background:#f8f5ff;border-radius:0 8px 8px 0}
.ql-size-small{font-size:0.75em}
.ql-size-large{font-size:1.5em}
.ql-size-huge{font-size:2.5em}
.ql-align-center{text-align:center}
.ql-align-right{text-align:right}
.ql-align-justify{text-align:justify}
.ql-indent-1{padding-left:3em}
.ql-indent-2{padding-left:6em}
.ql-indent-3{padding-left:9em}
img{max-width:100%;height:auto;border-radius:8px}
</style>
${bodyHtml}
</td></tr>
<tr><td style="padding:20px 28px;text-align:center;background:#f8f9fa;border-top:1px solid #e9ecef;">
<p style="color:#6b7280;font-size:12px;margin:0 0 4px;">StudyApp.AI — Your AI Study Partner</p>
<p style="font-size:12px;margin:0 0 4px;"><a href="https://studyappai.com" style="color:#7c3aed;text-decoration:none;">studyappai.com</a> &bull; <a href="mailto:info@studyappai.com" style="color:#7c3aed;text-decoration:none;">info@studyappai.com</a></p>
<p style="color:#9ca3af;font-size:11px;margin:12px 0 0;">If you no longer wish to receive these emails, reply with "unsubscribe".</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user || user.email !== 'kartikeya2159@gmail.com') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { recipient, subject, body } = await req.json();

        if (!recipient || !subject || !body) {
            return Response.json({ error: 'Recipient, subject, and body are required' }, { status: 400 });
        }

        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (!resendApiKey) {
            return Response.json({ error: 'Resend API key not configured' }, { status: 500 });
        }

        // Get the target user
        const targetUsers = await base44.asServiceRole.entities.User.filter({ email: recipient });
        if (targetUsers.length === 0) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }
        const targetUser = targetUsers[0];

        // Pre-fetch all data in parallel using filter by user email for proper scoping
        const [rawLessons, rawExams, rawStudyPlans, rawProfiles] = await Promise.all([
            base44.asServiceRole.entities.Lesson.filter({ created_by: targetUser.email }),
            base44.asServiceRole.entities.Exam.filter({ created_by: targetUser.email }),
            base44.asServiceRole.entities.StudyPlan.filter({ created_by: targetUser.email }),
            base44.asServiceRole.entities.LearningProfile.filter({ created_by: targetUser.email })
        ]);

        // SDK may return strings instead of arrays - parse safely
        const allLessons = parseSafe(rawLessons);
        const allExams = parseSafe(rawExams);
        const allStudyPlans = parseSafe(rawStudyPlans);
        const allProfiles = parseSafe(rawProfiles);

        console.log(`Data for ${targetUser.email}: ${allLessons.length} lessons, ${allExams.length} exams, ${allStudyPlans.length} plans, ${allProfiles.length} profiles`);

        // Build comprehensive user data
        const userData = buildUserEmailData(targetUser, allLessons, allExams, allStudyPlans, allProfiles);
        console.log('User email data:', JSON.stringify(userData));

        // Personalize subject and body
        const personalizedSubject = replaceDynamicFields(subject, userData);
        const personalizedBody = replaceDynamicFields(body, userData);

        // Send via Resend
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'StudyApp.AI <updates@updates.studyappai.com>',
                reply_to: 'info@studyappai.com',
                to: recipient,
                subject: personalizedSubject,
                html: wrapEmailTemplate(personalizedBody)
            })
        });

        if (!resendResponse.ok) {
            const errorText = await resendResponse.text();
            throw new Error(`Resend API error: ${errorText}`);
        }

        return Response.json({
            success: true,
            message: `Test email sent to ${recipient}`
        });
    } catch (error) {
        console.error('Test email error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});