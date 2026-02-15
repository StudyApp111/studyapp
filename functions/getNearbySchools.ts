import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // No auth check — this is called during onboarding before user is authenticated

    const { searchQuery, lat, lon } = await req.json();

    let userCity = null;
    let userCountry = null;
    let userLat = lat || null;
    let userLon = lon || null;

    // If no coords from client, try IP-based geo as fallback
    if (!userLat || !userLon) {
      const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('cf-connecting-ip')
        || req.headers.get('x-real-ip')
        || null;

      try {
        const geoUrl = clientIP ? `https://ipapi.co/${clientIP}/json/` : 'https://ipapi.co/json/';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const geoResponse = await fetch(geoUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (!geoData.error) {
            userCity = geoData.city;
            userCountry = geoData.country_name || geoData.country;
            if (!userLat) userLat = geoData.latitude;
            if (!userLon) userLon = geoData.longitude;
          }
        }
      } catch (geoError) {
        console.log('Geo lookup failed:', geoError.message);
      }
    }

    // If we got coords from client but no city, do reverse geocode
    if (userLat && userLon && !userCity) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const revGeo = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${userLat}&lon=${userLon}&format=json&zoom=10`,
          { signal: controller.signal, headers: { 'User-Agent': 'StudyApp/1.0' } }
        );
        clearTimeout(timeoutId);
        if (revGeo.ok) {
          const revData = await revGeo.json();
          userCity = revData.address?.city || revData.address?.town || revData.address?.state;
          userCountry = revData.address?.country;
        }
      } catch (e) {
        console.log('Reverse geocode failed:', e.message);
      }
    }

    let nearbySchools = [];

    // Only try Overpass if we have coordinates
    if (userLat && userLon) {
      try {
        const overpassQuery = `[out:json][timeout:5];
(
  node["amenity"="university"](around:50000,${userLat},${userLon});
  node["amenity"="college"](around:50000,${userLat},${userLon});
  way["amenity"="university"](around:50000,${userLat},${userLon});
  way["amenity"="college"](around:50000,${userLat},${userLon});
);
out center tags 15;`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const overpassResponse = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: overpassQuery,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (overpassResponse.ok) {
          const overpassData = await overpassResponse.json();
          const elements = overpassData.elements || [];

          const seenNames = new Set();

          for (const el of elements) {
            const name = el.tags?.name;
            if (!name || seenNames.has(name.toLowerCase())) continue;
            seenNames.add(name.toLowerCase());

            const elLat = el.lat || el.center?.lat;
            const elLon = el.lon || el.center?.lon;
            let distance = null;

            if (elLat && elLon) {
              const R = 6371;
              const dLat = (elLat - userLat) * Math.PI / 180;
              const dLon = (elLon - userLon) * Math.PI / 180;
              const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(userLat * Math.PI / 180) * Math.cos(elLat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              distance = R * c;
            }

            nearbySchools.push({
              name,
              address: userCity || '',
              distance,
              type: el.tags?.amenity === 'university' ? 'university' : 'college'
            });
          }

          nearbySchools.sort((a, b) => (a.distance || 999) - (b.distance || 999));
        }
      } catch (overpassError) {
        console.log('Overpass skipped:', overpassError.message);
      }
    }

    // Filter by search query if provided
    if (searchQuery?.trim()) {
      const query = searchQuery.toLowerCase().trim();
      nearbySchools = nearbySchools.filter(s =>
        s.name.toLowerCase().includes(query)
      );
    }

    return Response.json({
      success: true,
      location: { city: userCity, country: userCountry },
      schools: nearbySchools.slice(0, 12)
    });

  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({
      success: true,
      schools: [],
      location: {}
    });
  }
});