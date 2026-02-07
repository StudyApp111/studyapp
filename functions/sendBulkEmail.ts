import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify admin access
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { subject, body } = await req.json();

        if (!subject || !body) {
            return Response.json({ error: 'Subject and body are required' }, { status: 400 });
        }

        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (!resendApiKey) {
            return Response.json({ error: 'Resend API key not configured' }, { status: 500 });
        }

        // Fetch ALL data ONCE upfront (not per-user)
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date');
        const allLessons = await base44.asServiceRole.entities.Lesson.list('-created_date');
        const allExams = await base44.asServiceRole.entities.Exam.list('-created_date');
        const allStudyPlans = await base44.asServiceRole.entities.StudyPlan.list('-created_date');

        // Pre-index learning profiles we'll need
        const profileIds = [...new Set(allUsers.map(u => u.learning_profile_id).filter(Boolean))];
        const profileMap = {};
        if (profileIds.length > 0) {
            const allProfiles = await base44.asServiceRole.entities.LearningProfile.list();
            for (const p of allProfiles) {
                profileMap[p.id] = p;
            }
        }

        let sent = 0;
        let failed = 0;

        for (const targetUser of allUsers) {
            try {
                // Build user data from pre-fetched entities
                const userData = buildUserData(targetUser, allLessons, allExams, allStudyPlans);

                // Add learning profile
                if (targetUser.learning_profile_id && profileMap[targetUser.learning_profile_id]) {
                    const profile = profileMap[targetUser.learning_profile_id];
                    userData.school = profile.school || 'your school';
                    userData.grade = profile.grade || 'your grade';
                }

                // Replace all dynamic fields
                const personalizedBody = replaceFields(body, userData);
                const personalizedSubject = replaceFields(subject, userData);

                const resendResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resendApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: 'StudyApp.AI <updates@updates.studyappai.com>',
                        reply_to: 'info@studyappai.com',
                        to: targetUser.email,
                        subject: personalizedSubject,
                        html: wrapInTemplate(personalizedBody)
                    })
                });

                if (resendResponse.ok) {
                    sent++;
                } else {
                    console.error(`Resend failed for ${targetUser.email}:`, await resendResponse.text());
                    failed++;
                }
            } catch (emailError) {
                console.error(`Failed to send to ${targetUser.email}:`, emailError);
                failed++;
            }
        }

        return Response.json({ success: true, sent, failed, total: allUsers.length });
    } catch (error) {
        console.error('Bulk email error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function buildUserData(targetUser, allLessons, allExams, allStudyPlans) {
    const data = {
        name: targetUser.full_name || 'there',
        first_name: (targetUser.full_name || 'there').split(' ')[0],
        email: targetUser.email,
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
        all_predicted_grades: 'N/A',
        best_grade: 'N/A',
        worst_grade: 'N/A',
        all_course_names: 'N/A',
        mastery_gap: 'N/A',
        weak_areas: 'N/A'
    };

    const userLessons = allLessons.filter(l => l.created_by === targetUser.email);
    if (userLessons.length === 0) return data;

    userLessons.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    data.total_lessons = userLessons.length;
    
    const lessonIds = userLessons.map(l => l.id);
    const userExams = allExams.filter(e => lessonIds.includes(e.lesson_id));
    const userPlans = allStudyPlans.filter(p => lessonIds.includes(p.lesson_id));

    let totalSeconds = 0;
    for (const lesson of userLessons) {
        totalSeconds += lesson.total_study_time_seconds || 0;
    }
    data.total_time_spent_minutes = Math.round(totalSeconds / 60);

    const courseNames = [...new Set(userLessons.map(l => l.course_name).filter(Boolean))];
    data.all_course_names = courseNames.join(', ') || 'N/A';

    const firstLesson = userLessons[0];
    data.first_lesson_name = firstLesson.course_name || 'N/A';
    data.first_lesson_date = new Date(firstLesson.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    data.first_time_spent_minutes = Math.round((firstLesson.total_study_time_seconds || 0) / 60);

    const firstLessonExams = userExams
        .filter(e => e.lesson_id === firstLesson.id)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    
    if (firstLessonExams.length > 0) {
        data.first_predicted_grade = firstLessonExams[0].predicted_grade || 'N/A';
        data.first_predicted_percentage = firstLessonExams[0].total_score ? `${Math.round(firstLessonExams[0].total_score)}%` : 'N/A';
    }

    const firstLessonPlans = userPlans
        .filter(p => p.lesson_id === firstLesson.id)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    
    if (firstLessonPlans.length > 0) {
        data.first_weak_area_count = firstLessonPlans[0].weak_competencies?.length || 0;
        data.first_task_count = firstLessonPlans[0].tasks?.length || 0;
        data.mastery_gap = firstLessonPlans[0].mastery_gap || 'N/A';
        data.weak_areas = (firstLessonPlans[0].weak_competencies || []).join(', ') || 'N/A';
    }

    const latestLesson = userLessons[userLessons.length - 1];
    data.latest_lesson_name = latestLesson.course_name || 'N/A';

    const completedExams = userExams
        .filter(e => e.completed && e.predicted_grade)
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    
    if (completedExams.length > 0) {
        data.latest_predicted_grade = completedExams[0].predicted_grade || 'N/A';
        data.latest_predicted_percentage = completedExams[0].total_score ? `${Math.round(completedExams[0].total_score)}%` : 'N/A';
    }

    data.total_exams_completed = completedExams.length;

    if (completedExams.length > 0) {
        const allGrades = completedExams.map(e => e.predicted_grade).filter(Boolean);
        const allScores = completedExams.map(e => e.total_score).filter(s => s != null);
        
        const chronoGrades = [...completedExams].reverse().map(e => e.predicted_grade).filter(Boolean);
        data.all_predicted_grades = chronoGrades.join(' → ') || 'N/A';

        if (allScores.length > 0) {
            const bestIdx = allScores.indexOf(Math.max(...allScores));
            const worstIdx = allScores.indexOf(Math.min(...allScores));
            data.best_grade = allGrades[bestIdx] || 'N/A';
            data.worst_grade = allGrades[worstIdx] || 'N/A';
        }

        if (completedExams.length >= 2) {
            const oldest = [...completedExams].reverse()[0];
            const newest = completedExams[0];
            if (oldest.total_score != null && newest.total_score != null) {
                const improvement = Math.round(newest.total_score - oldest.total_score);
                if (improvement > 0) data.grade_improvement = `+${improvement}%`;
                else if (improvement < 0) data.grade_improvement = `${improvement}%`;
                else data.grade_improvement = 'No change';
            }
        }
    }

    const activePlans = userPlans.filter(p => p.status === 'active');
    if (activePlans.length > 0) {
        const latestPlan = activePlans.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
        if (latestPlan.mastery_gap) data.mastery_gap = latestPlan.mastery_gap;
        if (latestPlan.weak_competencies?.length > 0) data.weak_areas = latestPlan.weak_competencies.join(', ');
    }

    return data;
}

function replaceFields(text, data) {
    let result = text;
    for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }
    return result;
}

function wrapInTemplate(bodyHtml) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f1fa; color: #1a1a2e; }
  .email-wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .email-header { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4f46e5 100%); padding: 32px 32px 28px; text-align: center; }
  .email-header img { width: 48px; height: 48px; margin-bottom: 8px; }
  .email-header h1 { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.3px; }
  .email-body { padding: 32px; font-size: 15px; line-height: 1.7; color: #334155; }
  .email-body p { margin: 0 0 16px; }
  .email-body h1 { font-size: 24px; font-weight: 700; color: #1e1b4b; margin: 0 0 16px; }
  .email-body h2 { font-size: 20px; font-weight: 700; color: #1e1b4b; margin: 0 0 14px; }
  .email-body h3 { font-size: 17px; font-weight: 600; color: #1e1b4b; margin: 0 0 12px; }
  .email-body a { color: #7c3aed; text-decoration: underline; }
  .email-body ul, .email-body ol { margin: 0 0 16px; padding-left: 24px; }
  .email-body li { margin-bottom: 6px; }
  .email-body strong { color: #1e1b4b; }
  .email-body img { max-width: 100%; height: auto; border-radius: 8px; }
  .ql-size-small { font-size: 0.8em; }
  .ql-size-large { font-size: 1.4em; }
  .ql-size-huge { font-size: 2em; }
  .email-footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
  .email-footer p { margin: 0 0 6px; font-size: 12px; color: #94a3b8; }
  .email-footer a { color: #7c3aed; text-decoration: none; }
  .cta-button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #ffffff !important; text-decoration: none !important; border-radius: 12px; font-weight: 700; font-size: 15px; margin: 8px 0; }
  @media (max-width: 640px) {
    .email-wrapper { margin: 0; border-radius: 0; }
    .email-body { padding: 24px 20px; }
    .email-header { padding: 24px 20px; }
  }
</style>
</head>
<body>
<div style="padding: 24px 16px; background-color: #f4f1fa;">
  <div class="email-wrapper">
    <div class="email-header">
      <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/ab568e731_LogoOnly.png" alt="StudyApp" />
      <h1>StudyApp</h1>
    </div>
    <div class="email-body">
      ${bodyHtml}
    </div>
    <div class="email-footer">
      <p>Made with 💜 by <a href="https://studyappai.com">StudyApp.AI</a></p>
      <p>Questions? Reply to this email or reach out at <a href="mailto:info@studyappai.com">info@studyappai.com</a></p>
    </div>
  </div>
</div>
</body>
</html>`;
}