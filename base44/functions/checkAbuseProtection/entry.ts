import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Hash IP for privacy compliance
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// STRICT LIMITS - Goal: Show value, get signups, zero tolerance for abuse
const LIMITS = {
  ocr_upload: {
    ip_limit_24h: 2,        // Max 2 uploads per IP in 24h
    fingerprint_limit_24h: 2, // Max 2 uploads per fingerprint in 24h
    combined_limit_24h: 1   // If BOTH IP+fingerprint match, only 1 allowed
  },
  diagnostic_exam: {
    ip_limit_24h: 1,        // Max 1 exam per IP in 24h
    fingerprint_limit_24h: 1, // Max 1 exam per fingerprint in 24h
    combined_limit_24h: 1   // Strict: only 1 exam per device
  },
  report_view: {
    ip_limit_24h: 3,        // Can view report 3 times (in case they refresh)
    fingerprint_limit_24h: 3,
    combined_limit_24h: 2
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action_type, fingerprint, honeypot_value } = body;

    // HONEYPOT CHECK - Instant block if filled
    if (honeypot_value && honeypot_value.trim() !== '') {
      console.log('🚫 HONEYPOT TRIGGERED - Bot detected');
      
      const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                       req.headers.get('x-real-ip') || 
                       'unknown';
      const ipHash = await hashString(ipAddress);
      
      // Log the honeypot trigger
      await base44.asServiceRole.entities.AbuseLog.create({
        ip_address: ipHash,
        fingerprint: fingerprint || 'none',
        action_type,
        user_agent: req.headers.get('user-agent') || 'unknown',
        blocked: true,
        blocked_reason: 'honeypot',
        honeypot_triggered: true,
        metadata: { honeypot_value }
      });

      return Response.json({ 
        allowed: false, 
        reason: 'Invalid request detected',
        remaining_attempts: 0
      });
    }

    // Get IP address from headers
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const ipHash = await hashString(ipAddress);
    const fingerprintHash = fingerprint ? await hashString(fingerprint) : 'none';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Get limits for this action type
    const limits = LIMITS[action_type];
    if (!limits) {
      return Response.json({ error: 'Invalid action_type' }, { status: 400 });
    }

    // Check logs from last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Query recent abuse logs using service role (no auth required)
    const recentLogs = await base44.asServiceRole.entities.AbuseLog.filter({
      created_date: { $gte: twentyFourHoursAgo }
    });

    // Filter logs for this action type
    const relevantLogs = recentLogs.filter(log => log.action_type === action_type);

    // Count by IP
    const ipCount = relevantLogs.filter(log => log.ip_address === ipHash).length;
    
    // Count by fingerprint
    const fingerprintCount = relevantLogs.filter(log => log.fingerprint === fingerprintHash).length;
    
    // Count by BOTH IP + fingerprint (same device/location)
    const combinedCount = relevantLogs.filter(log => 
      log.ip_address === ipHash && log.fingerprint === fingerprintHash
    ).length;

    // Check if any limit exceeded
    let blocked = false;
    let blockedReason = '';

    if (combinedCount >= limits.combined_limit_24h) {
      blocked = true;
      blockedReason = 'combined_abuse';
    } else if (ipCount >= limits.ip_limit_24h) {
      blocked = true;
      blockedReason = 'rate_limit_ip';
    } else if (fingerprintCount >= limits.fingerprint_limit_24h) {
      blocked = true;
      blockedReason = 'rate_limit_fingerprint';
    }

    // Log this attempt
    await base44.asServiceRole.entities.AbuseLog.create({
      ip_address: ipHash,
      fingerprint: fingerprintHash,
      action_type,
      user_agent: userAgent,
      blocked,
      blocked_reason: blocked ? blockedReason : null,
      honeypot_triggered: false,
      metadata: { 
        ip_count: ipCount,
        fingerprint_count: fingerprintCount,
        combined_count: combinedCount
      }
    });

    if (blocked) {
      console.log(`🚫 BLOCKED: ${action_type} - ${blockedReason} (IP: ${ipCount}/${limits.ip_limit_24h}, FP: ${fingerprintCount}/${limits.fingerprint_limit_24h}, Combined: ${combinedCount}/${limits.combined_limit_24h})`);
      
      return Response.json({ 
        allowed: false, 
        reason: 'Usage limit reached. Please sign in to continue for free.',
        remaining_attempts: 0,
        limit_type: blockedReason
      });
    }

    // Calculate remaining attempts (most restrictive limit)
    const remainingIP = limits.ip_limit_24h - ipCount;
    const remainingFingerprint = limits.fingerprint_limit_24h - fingerprintCount;
    const remainingCombined = limits.combined_limit_24h - combinedCount;
    const remaining = Math.min(remainingIP, remainingFingerprint, remainingCombined);

    console.log(`✅ ALLOWED: ${action_type} (Remaining: ${remaining})`);

    return Response.json({ 
      allowed: true, 
      remaining_attempts: remaining,
      limits: {
        ip_remaining: remainingIP,
        fingerprint_remaining: remainingFingerprint,
        combined_remaining: remainingCombined
      }
    });

  } catch (error) {
    console.error("Error in abuse protection check:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});