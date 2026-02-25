import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || null;

    let city = null;
    let country = null;

    try {
      const geoUrl = clientIP ? `https://ipapi.co/${clientIP}/json/` : 'https://ipapi.co/json/';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const geoResponse = await fetch(geoUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        if (!geoData.error) {
          city = geoData.city || null;
          country = geoData.country_name || geoData.country || null;
        }
      }
    } catch (geoError) {
      console.log('Geo lookup failed:', geoError.message);
    }

    if (!city && !country) {
      return Response.json({ success: true, skipped: true, reason: 'no_geo_data' });
    }

    const profiles = await base44.entities.LearningProfile.filter({ created_by: user.email });
    
    if (profiles.length === 0) {
      return Response.json({ success: true, skipped: true, reason: 'no_profile' });
    }

    const profile = profiles[0];
    const updates = {};

    if (!profile.city && city) updates.city = city;
    if (!profile.country && country) updates.country = country;

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: true, skipped: true, reason: 'already_filled' });
    }

    await base44.entities.LearningProfile.update(profile.id, updates);
    console.log(`Enriched profile for ${user.email}: ${JSON.stringify(updates)}`);

    return Response.json({ success: true, city, country, updates });

  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});