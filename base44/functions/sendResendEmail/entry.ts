import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Replace all {{variable}} and {{{variable}}} placeholders in a string
 * with values from the vars object. Unresolved placeholders are removed.
 */
function renderTemplate(str, vars) {
  if (!str) return str;
  let result = str;
  for (const [key, val] of Object.entries(vars)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\{\\{\\{${escaped}\\}\\}\\}`, 'g'), val);
    result = result.replace(new RegExp(`\\{\\{${escaped}\\}\\}`, 'g'), val);
  }
  // Clean up any remaining unresolved placeholders
  result = result.replace(/\{\{\{[^}]+\}\}\}/g, '');
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { trigger_type, user_email, context, is_test, dry_run } = await req.json();

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    // For test sends or dry runs, admin must be authenticated
    if (is_test || dry_run) {
      const admin = await base44.auth.me();
      if (admin?.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!trigger_type || !user_email) {
      return Response.json({ error: 'trigger_type and user_email required' }, { status: 400 });
    }

    // Get enabled templates for this trigger (or specific template for test)
    let templates;
    if (is_test && context?.template_id) {
      const allTemplates = await base44.asServiceRole.entities.AutomaticEmail.filter({
        trigger_type
      });
      templates = allTemplates.filter(t => t.id === context.template_id);
    } else {
      templates = await base44.asServiceRole.entities.AutomaticEmail.filter({
        trigger_type,
        enabled: true
      });
    }

    if (templates.length === 0 && !dry_run) {
      return Response.json({ message: 'No templates for this trigger', sent: 0 });
    }

    // Get user data
    const users = await base44.asServiceRole.entities.User.filter({ email: user_email });
    if (users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    const targetUser = users[0];

    // Merge top-level user fields with data object for unified access
    // User entity stores custom fields inside targetUser.data, built-ins at top level
    const ud = { ...targetUser.data, ...targetUser };

    // ── Fetch related data ──
    // Learning profile: first try filter as service role, then fall back to user-cached fields on User entity
    let profileData = { school: '', grade: '', city: '', country: '', study_type: '' };
    try {
      const profiles = await base44.asServiceRole.entities.LearningProfile.filter({ created_by: user_email });
      if (profiles.length > 0) {
        const p = profiles[0];
        profileData = {
          school: p.school || p.data?.school || '',
          grade: p.grade || p.data?.grade || '',
          city: p.city || p.data?.city || '',
          country: p.country || p.data?.country || '',
          study_type: p.study_type || p.data?.study_type || '',
        };
      }
    } catch (e) { console.error('[LP]', e.message); }
    // Fallback: if profile query returned empty, use User entity cached fields
    if (!profileData.school) profileData.school = ud.school || '';
    if (!profileData.city) profileData.city = ud.city || '';
    if (!profileData.country) profileData.country = ud.country || '';
    if (!profileData.grade) profileData.grade = ud.grade || '';
    if (!profileData.study_type) profileData.study_type = ud.study_type || '';

    // Lessons, exams, study plans — fetch in parallel for speed
    let lessons = [];
    let exams = [];
    let plans = [];
    let assignments = [];
    const [lessonsRes, examsRes, plansRes, assignmentsRes] = await Promise.allSettled([
      base44.asServiceRole.entities.Lesson.filter({ created_by: user_email }, 'created_date', 50),
      base44.asServiceRole.entities.Exam.filter({ created_by: user_email, completed: true }),
      base44.asServiceRole.entities.StudyPlan.filter({ created_by: user_email, status: 'active' }),
      base44.asServiceRole.entities.GradedAssignment.filter({ created_by: user_email, completed: true }),
    ]);
    if (lessonsRes.status === 'fulfilled') lessons = lessonsRes.value;
    if (examsRes.status === 'fulfilled') exams = examsRes.value;
    if (plansRes.status === 'fulfilled') plans = plansRes.value;
    if (assignmentsRes.status === 'fulfilled') assignments = assignmentsRes.value;

    console.log(`[DATA] lessons=${lessons.length}, exams=${exams.length}, plans=${plans.length}, assignments=${assignments.length}`);

    // Compute derived values
    let completedExams = exams.length || ud.total_exams_completed || 0;
    let bestGrade = '';
    let bestScore = 0;
    for (const ex of exams) {
      const score = ex.total_score ?? ex.data?.total_score ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestGrade = ex.predicted_grade || ex.data?.predicted_grade || '';
      }
    }
    // Fallback to User entity aggregate if entity query returned 0 exams
    if (exams.length === 0 && ud.total_exams_completed) {
      completedExams = ud.total_exams_completed;
    }

    let gradedAssignments = assignments.length;
    let tasksRemaining = null;
    let activePlanCompetencies = [];
    if (plans.length > 0) {
      const plan = plans[0];
      const tasks = plan.tasks || plan.data?.tasks;
      if (tasks) tasksRemaining = tasks.filter(t => !t.completed).length;
      const wc = plan.weak_competencies || plan.data?.weak_competencies;
      if (wc?.length > 0) activePlanCompetencies = wc;
    }

    // Build name parts
    const fullName = ud.display_name || ud.full_name || '';
    const firstName = fullName.split(' ')[0] || user_email.split('@')[0];
    const lastName = fullName.split(' ').slice(1).join(' ') || '';

    // Trial-related variables
    const trialEndDate = ud.trial_end_date;
    let trialDaysLeft = '';
    let trialEndFormatted = '';
    if (trialEndDate) {
      const endDate = new Date(trialEndDate);
      const daysLeft = Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)));
      trialDaysLeft = String(daysLeft);
      trialEndFormatted = endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    // Lesson names (chronological — first-ever, second, third)
    // Entity fields may be at top level OR nested inside .data depending on SDK behavior
    const getLessonName = (l) => l?.course_name || l?.data?.course_name || '';
    const lessonName1 = lessons.length >= 1 ? getLessonName(lessons[0]) : '';
    const lessonName2 = lessons.length >= 2 ? getLessonName(lessons[1]) : '';
    const lessonName3 = lessons.length >= 3 ? getLessonName(lessons[2]) : '';
    const latestLesson = lessons.length > 0 ? getLessonName(lessons[lessons.length - 1]) : '';

    // Format dates nicely
    const fmtDate = (d) => {
      if (!d) return '';
      try {
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch { return ''; }
    };

    // Format study time
    const totalStudyMinutes = Math.round((ud.time_spent_seconds || 0) / 60);
    const totalStudyHours = (totalStudyMinutes / 60).toFixed(1);

    // Days since signup
    const signupDate = ud.created_date ? new Date(ud.created_date) : null;
    const daysSinceSignup = signupDate ? Math.floor((Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // Days inactive
    const lastActive = ud.last_active_date ? new Date(ud.last_active_date) : null;
    const daysInactive = lastActive ? Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // Build COMPLETE variables object — every value is a string, empty string if unavailable
    const userVars = {
      // ─── Identity ───
      name: fullName || firstName,
      first_name: firstName,
      last_name: lastName,
      email: user_email,

      // ─── Learning Profile ───
      school: profileData.school,
      grade: profileData.grade,
      city: profileData.city,
      country: profileData.country,
      study_type: profileData.study_type,

      // ─── Lesson / Course Names ───
      lesson_name_1: lessonName1,
      lesson_name_2: lessonName2,
      lesson_name_3: lessonName3,
      latest_lesson: latestLesson,
      total_lessons: String(lessons.length),
      course_name: latestLesson || 'your course',

      // ─── Study Progress ───
      predicted_grade: ud.polly_predicted_grade || '',
      predicted_score: ud.polly_predicted_score != null ? String(Math.round(ud.polly_predicted_score)) : '',
      mastery_gap: (ud.polly_mastery_gap || '').substring(0, 150),
      weak_competencies: activePlanCompetencies.slice(0, 3).join(', '),
      tasks_remaining: tasksRemaining != null ? String(tasksRemaining) : '',
      completed_exams: String(completedExams),
      best_grade: bestGrade,
      best_score: bestScore > 0 ? String(Math.round(bestScore)) : '',
      graded_assignments: String(gradedAssignments),

      // ─── Gamification ───
      level: String(ud.level || 1),
      total_points: String(ud.total_points || 0),
      current_streak: String(ud.current_streak || 0),
      longest_streak: String(ud.longest_streak || 0),
      questions_completed: String(ud.questions_completed || 0),
      total_quizzes_taken: String(ud.total_quizzes_taken || 0),
      average_score: String(Math.round(ud.average_score || 0)),

      // ─── Engagement ───
      total_study_minutes: String(totalStudyMinutes),
      total_study_hours: totalStudyHours,
      session_count: String(ud.session_count || 0),
      total_logins: String(ud.total_logins || 0),
      days_since_signup: String(daysSinceSignup),
      days_inactive: String(daysInactive),
      signup_date: fmtDate(ud.created_date),
      last_active_date: fmtDate(ud.last_active_date),
      first_visit_date: fmtDate(ud.first_visit_date),

      // ─── Device & Context ───
      device_type: ud.device_type || '',
      app_type: ud.app_type || '',
      operating_system: ud.operating_system || '',
      browser: ud.browser || '',
      timezone: ud.timezone || '',
      language: ud.language || '',

      // ─── Subscription ───
      plan_type: ud.subscription_plan_type || 'free',
      trial_days_left: trialDaysLeft,
      trial_end_date: trialEndFormatted,
    };

    // Log each variable for debugging — makes test sends fully verifiable
    console.log('=== EMAIL TEMPLATE VARIABLES ===');
    for (const [k, v] of Object.entries(userVars)) {
      console.log(`  ${k}: "${v}"`);
    }
    console.log('================================');

    // Dry run mode: return all resolved variables without sending any email
    if (dry_run) {
      return Response.json({ variables: userVars, user_email });
    }

    let sentCount = 0;

    for (const template of templates) {
      // Skip if neither a resend template nor an inline body is configured
      if (!template.resend_template_id && !template.body) continue;

      // Duplicate prevention (skip for test sends)
      if (!is_test) {
        const existingLogs = await base44.asServiceRole.entities.EmailLog.filter({
          user_email,
          email_template_id: template.id,
          trigger_type
        });
        if (existingLogs.length > 0) continue;

        // Milestone checks
        if (template.trigger_type === 'level_milestone') {
          const mv = template.trigger_config?.milestone_value || 5;
          if (ud.level !== mv) continue;
        }
        if (template.trigger_type === 'streak_milestone') {
          const mv = template.trigger_config?.milestone_value || 7;
          if (ud.current_streak !== mv) continue;
        }
      }

      try {
        let emailPayload;

        if (template.body) {
          // ── INLINE MODE: use subject + body from AutomaticEmail entity ──
          const renderedSubject = renderTemplate(
            template.subject || template.resend_template_name || 'StudyApp.AI',
            userVars
          );
          const renderedBody = renderTemplate(template.body, userVars);

          emailPayload = {
            from: 'StudyApp.AI <updates@updates.studyappai.com>',
            reply_to: 'info@studyappai.com',
            to: [user_email],
            subject: renderedSubject,
            html: renderedBody
          };
        } else if (template.resend_template_id) {
          // ── RESEND TEMPLATE MODE: fetch template HTML and render variables ──
          let templateHtml = null;
          let templateSubject = null;
          try {
            const tmplRes = await fetch(`https://api.resend.com/templates/${template.resend_template_id}`, {
              headers: { 'Authorization': `Bearer ${resendApiKey}` }
            });
            if (tmplRes.ok) {
              const tmplData = await tmplRes.json();
              templateHtml = tmplData.html || null;
              templateSubject = tmplData.subject || null;
            } else {
              console.error('Template fetch error:', tmplRes.status, await tmplRes.text());
            }
          } catch (tmplErr) {
            console.warn('Template fetch failed:', tmplErr.message);
          }

          if (templateHtml) {
            const renderedHtml = renderTemplate(templateHtml, userVars);
            const renderedSubject = renderTemplate(
              templateSubject || template.resend_template_name || 'StudyApp.AI',
              userVars
            );

            emailPayload = {
              from: 'StudyApp.AI <updates@updates.studyappai.com>',
              reply_to: 'info@studyappai.com',
              to: [user_email],
              subject: renderedSubject,
              html: renderedHtml
            };
          } else {
            // Fallback: basic email if template fetch failed
            emailPayload = {
              from: 'StudyApp.AI <updates@updates.studyappai.com>',
              reply_to: 'info@studyappai.com',
              to: [user_email],
              subject: template.resend_template_name || 'StudyApp.AI',
              html: `<p>Hi ${firstName},</p><p>Welcome to StudyApp.AI! We're excited to have you.</p>`
            };
          }
        }

        if (!emailPayload) continue;

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        });

        const resBody = await response.text();
        const success = response.ok;
        if (!success) {
          console.error('Resend send error:', response.status, resBody);
          console.error('Payload subject:', emailPayload.subject);
        } else {
          console.log('Resend send success:', resBody);
        }

        // Log it (skip for test sends)
        if (!is_test) {
          await base44.asServiceRole.entities.EmailLog.create({
            user_email,
            email_template_id: template.id,
            trigger_type,
            trigger_reference_id: context?.reference_id || null,
            sent_at: new Date().toISOString(),
            success
          });

          if (success) {
            await base44.asServiceRole.entities.AutomaticEmail.update(template.id, {
              send_count: (template.send_count || 0) + 1
            });
          }
        }

        if (success) sentCount++;
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
      }
    }

    return Response.json({ message: `Sent ${sentCount} email(s)`, sent: sentCount });

  } catch (error) {
    console.error('sendResendEmail error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});