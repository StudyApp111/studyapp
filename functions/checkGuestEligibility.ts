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
    const body = await req.json();
    const { fingerprint, action } = body;

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const ipHash = await hashString(ipAddress);
    const fingerprintHash = fingerprint ? await hashString(fingerprint) : 'none';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (action === 'check') {
      // Check if this IP or fingerprint has EVER used a guest session
      const allGuestLogs = await base44.asServiceRole.entities.AbuseLog.filter({
        action_type: 'guest_session'
      });

      const ipUsed = allGuestLogs.some(log => log.ip_address === ipHash && !log.blocked);
      const fpUsed = allGuestLogs.some(log => log.fingerprint === fingerprintHash && !log.blocked);

      if (ipUsed || fpUsed) {
        console.log(`🚫 GUEST BLOCKED: IP used=${ipUsed}, FP used=${fpUsed}`);
        return Response.json({ 
          allowed: false, 
          reason: 'Guest session already used. Please sign in to continue.' 
        });
      }

      return Response.json({ allowed: true });
    }

    if (action === 'claim') {
      // Double-check before claiming
      const allGuestLogs = await base44.asServiceRole.entities.AbuseLog.filter({
        action_type: 'guest_session'
      });

      const ipUsed = allGuestLogs.some(log => log.ip_address === ipHash && !log.blocked);
      const fpUsed = allGuestLogs.some(log => log.fingerprint === fingerprintHash && !log.blocked);

      if (ipUsed || fpUsed) {
        return Response.json({ 
          allowed: false, 
          reason: 'Guest session already used.' 
        });
      }

      // Record the guest session claim
      await base44.asServiceRole.entities.AbuseLog.create({
        ip_address: ipHash,
        fingerprint: fingerprintHash,
        action_type: 'guest_session',
        user_agent: userAgent,
        blocked: false,
        blocked_reason: null,
        honeypot_triggered: false,
        metadata: { claimed_at: new Date().toISOString() }
      });

      console.log(`✅ GUEST SESSION CLAIMED: IP=${ipHash.slice(0,8)}..., FP=${fingerprintHash.slice(0,8)}...`);
      return Response.json({ allowed: true, claimed: true });
    }

    if (action === 'transfer') {
      // Transfer guest lesson to authenticated user
      const { lesson_data, user_email, profile_data } = body;
      
      // Verify the caller is authenticated
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ error: 'Must be authenticated to transfer' }, { status: 401 });
      }

      // IDEMPOTENCY GUARD: Check if this guest lesson was already transferred
      // Prevents duplicate lessons when transfer is called from multiple places
      if (lesson_data?.id) {
        const fpHash = fingerprint ? await hashString(fingerprint) : 'none';
        const allGuestLogs = await base44.asServiceRole.entities.AbuseLog.filter({
          action_type: 'guest_session'
        });
        const sessionLog = allGuestLogs.find(log => log.fingerprint === fpHash && !log.blocked);
        if (sessionLog?.metadata?.transferred_lesson_id) {
          console.log(`⚠️ TRANSFER ALREADY DONE: returning existing lesson ${sessionLog.metadata.transferred_lesson_id}`);
          return Response.json({ 
            success: true, 
            lesson_id: sessionLog.metadata.transferred_lesson_id,
            exam_id: sessionLog.metadata.transferred_exam_id || null,
            already_transferred: true
          });
        }
      }

      let lessonId = null;
      let transferredExamId = null;

      // Check if there's an existing lesson from guest session (by fingerprint)
      if (lesson_data?.id) {
        // Guest may have created a real lesson via createGuestLesson service role
        // Transfer it by finding any exams associated with it
        const guestLessonId = lesson_data.id;
        
        // Look for the guest's lesson and exams using service role
        const guestLessons = await base44.asServiceRole.entities.Lesson.filter({ id: guestLessonId });
        const guestExams = await base44.asServiceRole.entities.Exam.filter({ lesson_id: guestLessonId });
        
        if (guestLessons.length > 0) {
          const guestLesson = guestLessons[0];
          
          // Create a new lesson for the authenticated user with the guest's data
          const newLesson = await base44.entities.Lesson.create({
            course_name: guestLesson.course_name,
            description: guestLesson.description,
            file_url: guestLesson.file_url,
            file_urls: guestLesson.file_urls,
            input_type: guestLesson.input_type,
            extracted_content: guestLesson.extracted_content,
            compressed_content: guestLesson.compressed_content,
            topics: guestLesson.topics,
            topic_suggestions: guestLesson.topic_suggestions,
            selected_topics: guestLesson.selected_topics,
            curriculum_map: guestLesson.curriculum_map,
            status: 'diagnostic_completed'
          });
          lessonId = newLesson.id;
          console.log(`✅ GUEST LESSON TRANSFERRED: ${lessonId} for ${user.email}`);
          
          // Transfer exams to the new lesson
          for (const guestExam of guestExams) {
            const newExam = await base44.entities.Exam.create({
              lesson_id: lessonId,
              exam_type: guestExam.exam_type,
              exam_number: guestExam.exam_number,
              title: guestExam.title,
              questions: guestExam.questions,
              feedback: guestExam.feedback,
              predicted_grade: guestExam.predicted_grade,
              total_score: guestExam.total_score,
              prediction_confidence: guestExam.prediction_confidence,
              confidence_level: guestExam.confidence_level,
              mastery_gap: guestExam.mastery_gap,
              ai_feedback: guestExam.ai_feedback,
              time_taken_seconds: guestExam.time_taken_seconds,
              status: guestExam.status,
              completed: guestExam.completed
            });
            transferredExamId = newExam.id;
            console.log(`✅ GUEST EXAM TRANSFERRED: ${newExam.id} for ${user.email}`);
          }
          
          // Clean up guest data using service role
          for (const guestExam of guestExams) {
            await base44.asServiceRole.entities.Exam.delete(guestExam.id);
          }
          await base44.asServiceRole.entities.Lesson.delete(guestLessonId);
        }
      } else if (lesson_data && lesson_data.course_name) {
        // Fallback: create lesson from scratch (old flow)
        const lesson = await base44.entities.Lesson.create({
          ...lesson_data,
          status: 'created'
        });
        lessonId = lesson.id;
        console.log(`✅ GUEST LESSON CREATED: ${lessonId} for ${user.email}`);
      }

      // Create learning profile using user-scoped client
      if (profile_data && (profile_data.school || profile_data.name)) {
        const existingProfiles = await base44.entities.LearningProfile.filter({});
        if (existingProfiles.length === 0 && profile_data.school) {
          await base44.entities.LearningProfile.create({
            school: profile_data.school
          });
        }
      }

      // Update user's display name if guest set one
      if (profile_data?.name) {
        await base44.auth.updateMe({ display_name: profile_data.name });
      }

      // Mark onboarding as completed for new user
      await base44.auth.updateMe({ onboarding_completed: true });

      // Mark the transfer in the abuse log so it won't be repeated
      if (lessonId && fingerprint) {
        const fpHash2 = await hashString(fingerprint);
        const allGuestLogs2 = await base44.asServiceRole.entities.AbuseLog.filter({
          action_type: 'guest_session'
        });
        const sessionLog2 = allGuestLogs2.find(log => log.fingerprint === fpHash2 && !log.blocked);
        if (sessionLog2) {
          await base44.asServiceRole.entities.AbuseLog.update(sessionLog2.id, {
            metadata: {
              ...sessionLog2.metadata,
              transferred: true,
              transferred_lesson_id: lessonId,
              transferred_exam_id: transferredExamId,
              transferred_at: new Date().toISOString(),
              transferred_to: user.email
            }
          });
        }
      }

      // Transfer study plans from guest lesson to new lesson
      if (lessonId && transferredExamId && lesson_data?.id) {
        try {
          const guestPlans = await base44.asServiceRole.entities.StudyPlan.filter({ lesson_id: lesson_data.id });
          if (guestPlans.length > 0) {
            const guestPlan = guestPlans[0];
            await base44.entities.StudyPlan.create({
              lesson_id: lessonId,
              generated_from_exam_id: transferredExamId,
              cycle_number: guestPlan.cycle_number,
              initial_predicted_grade: guestPlan.initial_predicted_grade,
              initial_score: guestPlan.initial_score,
              initial_confidence: guestPlan.initial_confidence,
              current_predicted_grade: guestPlan.current_predicted_grade,
              current_score: guestPlan.current_score,
              current_confidence: guestPlan.current_confidence,
              mastery_gap: guestPlan.mastery_gap,
              weak_competencies: guestPlan.weak_competencies,
              suggested_tasks: guestPlan.suggested_tasks,
              tasks: guestPlan.tasks,
              plan_rationale: guestPlan.plan_rationale,
              priority_focus: guestPlan.priority_focus,
              insights_panel: guestPlan.insights_panel,
              behavioral_insights: guestPlan.behavioral_insights,
              status: 'active'
            });
            console.log('✅ GUEST STUDY PLAN TRANSFERRED');
            // Clean up guest study plans
            for (const p of guestPlans) {
              await base44.asServiceRole.entities.StudyPlan.delete(p.id);
            }
          } else {
            // No existing plan - generate one
            await base44.functions.invoke('generateStudyPlan', { 
              exam_id: transferredExamId, 
              lesson_id: lessonId 
            });
          }
        } catch (planErr) {
          console.warn('Study plan transfer/generation failed:', planErr.message);
        }
      }

      return Response.json({ success: true, lesson_id: lessonId, exam_id: transferredExamId });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Error in guest eligibility check:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});