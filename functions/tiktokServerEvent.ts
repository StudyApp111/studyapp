import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TIKTOK_ACCESS_TOKEN = Deno.env.get('TIKTOK_ACCESS_TOKEN');
const TIKTOK_PIXEL_ID = Deno.env.get('TIKTOK_PIXEL_ID');

// SHA256 hash function for PII data (TikTok requires hashed emails/phones)
async function sha256Hash(text) {
  if (!text) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      event_name, // "Subscribe", "CompleteRegistration", "ViewContent", "SubmitApplication"
      value,
      currency = "USD",
      content_id,
      content_type = "product",
      content_name,
      event_id, // unique event ID for deduplication
      url,
      referrer,
      // User data (will be hashed)
      email,
      phone,
      external_id,
      ip,
      user_agent,
      ttclid, // TikTok click ID from URL param
      ttp, // TikTok cookie _ttp
      test_event_code // For testing in TikTok Events Manager
    } = await req.json();

    if (!event_name) {
      return Response.json({ error: 'event_name is required' }, { status: 400 });
    }

    // Hash PII data as required by TikTok
    const [hashedEmail, hashedPhone, hashedExternalId] = await Promise.all([
      sha256Hash(email || user.email),
      sha256Hash(phone),
      sha256Hash(external_id || user.id)
    ]);

    const eventPayload = {
      event_source: "web",
      event_source_id: TIKTOK_PIXEL_ID,
      ...(test_event_code && { test_event_code }),
      data: [
        {
          event: event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: event_id || `${event_name}_${user.id}_${Date.now()}`,
          user: {
            email: hashedEmail,
            phone: hashedPhone,
            external_id: hashedExternalId,
            ttclid: ttclid || null,
            ttp: ttp || null,
            ip: ip || null,
            user_agent: user_agent || null
          },
          properties: {
            value: value || null,
            currency: currency,
            content_id: content_id || null,
            content_type: content_type,
            content_name: content_name || null
          },
          page: {
            url: url || null,
            referrer: referrer || null
          }
        }
      ]
    };

    // Send to TikTok Events API
    const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: {
        'Access-Token': TIKTOK_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventPayload)
    });

    const result = await response.json();

    if (result.code !== 0) {
      console.error('TikTok Events API error:', result);
      return Response.json({ 
        success: false, 
        error: result.message,
        tiktok_response: result 
      }, { status: 400 });
    }

    return Response.json({ 
      success: true, 
      message: `${event_name} event sent successfully`,
      tiktok_response: result
    });

  } catch (error) {
    console.error('TikTok server event error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});