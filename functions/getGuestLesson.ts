import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Reads lesson + exams for guest users using service role
// Security: validates fingerprint owns this lesson via AbuseLog

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
    const { fingerprint, lesson_id, include_exams } = await req.json();

    if (!fingerprint || !lesson_id) {
      return Response.json({ error: 'fingerprint and lesson_id required' }, { status: 400 });
    }

    // Validate fingerprint owns this lesson
    const fpHash = await hashString(fingerprint);
    const guestLogs = await base44.asServiceRole.entities.AbuseLog.filter({
      action_type: 'guest_session'
    });

    const validLog = guestLogs.find(
      log => log.fingerprint === fpHash && !log.blocked && log.metadata?.lesson_id === lesson_id
    );

    if (!validLog) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Load lesson with service role
    const lessons = await base44.asServiceRole.entities.Lesson.filter({ id: lesson_id });
    if (!lessons || lessons.length === 0) {
      return Response.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const result = { lesson: lessons[0] };

    // Optionally load exams
    if (include_exams) {
      const exams = await base44.asServiceRole.entities.Exam.filter({ lesson_id });
      result.exams = exams || [];
    }

    return Response.json(result);
  } catch (error) {
    console.error('Error in getGuestLesson:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});