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

    if (action === 'create_guest_lesson') {
      // Create a lesson using service role so it persists in DB for backend functions
      const { lesson_data } = body;
      if (!lesson_data || !lesson_data.course_name) {
        return Response.json({ error: 'lesson_data required' }, { status: 400 });
      }

      const lesson = await base44.asServiceRole.entities.Lesson.create({
        ...lesson_data,
        status: 'created'
      });

      console.log(`✅ GUEST LESSON CREATED: ${lesson.id} (service role)`);
      return Response.json({ success: true, lesson_id: lesson.id });
    }

    if (action === 'transfer') {
      // Transfer guest lesson to authenticated user
      const { lesson_data, user_email, profile_data } = body;
      
      // Verify the caller is authenticated
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ error: 'Must be authenticated to transfer' }, { status: 401 });
      }

      let lessonId = null;

      // Create lesson using USER-scoped client so created_by = user's email (RLS)
      if (lesson_data && lesson_data.course_name) {
        const lesson = await base44.entities.Lesson.create({
          ...lesson_data,
          status: 'created'
        });
        lessonId = lesson.id;
        console.log(`✅ GUEST LESSON TRANSFERRED: ${lessonId} for ${user.email}`);
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

      return Response.json({ success: true, lesson_id: lessonId });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Error in guest eligibility check:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});