import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchQuery } = await req.json();

    // Get user's approximate location from IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('cf-connecting-ip') 
      || req.headers.get('x-real-ip')
      || null;

    let userCity = null;
    let userCountry = null;
    let userLat = null;
    let userLon = null;

    // Quick geo lookup with 3s timeout
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
          userCountry = geoData.country_name;
          userLat = geoData.latitude;
          userLon = geoData.longitude;
        }
      }
    } catch (geoError) {
      console.log('Geo lookup failed:', geoError.message);
    }

    let nearbySchools = [];
    
    if (userLat && userLon) {
      try {
        // Search for universities, colleges AND high schools within 30km radius
        // Use a simpler, faster query
        const overpassQuery = `
          [out:json][timeout:5];
          (
            node["amenity"="university"](around:30000,${userLat},${userLon});
            node["amenity"="college"](around:30000,${userLat},${userLon});
            node["amenity"="school"]["school:level"="secondary"](around:30000,${userLat},${userLon});
            node["amenity"="school"]["isced:level"~"3"](around:30000,${userLat},${userLon});
            way["amenity"="university"](around:30000,${userLat},${userLon});
            way["amenity"="college"](around:30000,${userLat},${userLon});
          );
          out center tags 20;
        `;
        
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
            
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;
            let distance = null;
            
            if (lat && lon) {
              const R = 6371;
              const dLat = (lat - userLat) * Math.PI / 180;
              const dLon = (lon - userLon) * Math.PI / 180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(userLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              distance = R * c;
            }

            const amenity = el.tags?.amenity;
            let type = 'school';
            if (amenity === 'university') type = 'university';
            else if (amenity === 'college') type = 'college';
            else type = 'high_school';

            nearbySchools.push({
              name,
              address: userCity || '',
              classmates: 0,
              distance,
              type
            });
          }

          nearbySchools.sort((a, b) => {
            if (a.distance && b.distance) return a.distance - b.distance;
            return 0;
          });
        }
      } catch (overpassError) {
        console.log('Overpass API error:', overpassError.message);
      }
    }

    // Filter by search query
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      nearbySchools = nearbySchools.filter(s => 
        s.name.toLowerCase().includes(query)
      );
    }

    nearbySchools = nearbySchools.slice(0, 15);

    return Response.json({
      success: true,
      location: {
        city: userCity,
        country: userCountry
      },
      schools: nearbySchools
    });

  } catch (error) {
    console.error('Error in getNearbySchools:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});