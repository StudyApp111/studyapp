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
    // Extract client IP from request headers (works in production)
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('cf-connecting-ip') 
      || req.headers.get('x-real-ip')
      || null;

    let userCity = null;
    let userCountry = null;
    let userLat = null;
    let userLon = null;

    try {
      // Use ipapi.co (free tier: 1000/day, supports HTTPS)
      const geoUrl = clientIP ? `https://ipapi.co/${clientIP}/json/` : 'https://ipapi.co/json/';
      const geoResponse = await fetch(geoUrl);
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
      console.log('Geo lookup failed, will use search only:', geoError.message);
    }

    // Count users per school from our database for "classmates" feature
    const allUsers = await base44.asServiceRole.entities.User.list();
    const schoolCounts = {};
    for (const u of allUsers) {
      if (u.learning_profile_id) {
        try {
          const profiles = await base44.asServiceRole.entities.LearningProfile.filter({ id: u.learning_profile_id });
          if (profiles[0]?.school) {
            const school = profiles[0].school.toLowerCase().trim();
            schoolCounts[school] = (schoolCounts[school] || 0) + 1;
          }
        } catch {}
      }
    }

    // Use Overpass API (OpenStreetMap) to find nearby universities/colleges
    let nearbySchools = [];
    
    if (userLat && userLon) {
      try {
        // Search for universities and colleges within 50km radius
        const overpassQuery = `
          [out:json][timeout:10];
          (
            node["amenity"="university"](around:50000,${userLat},${userLon});
            way["amenity"="university"](around:50000,${userLat},${userLon});
            node["amenity"="college"](around:50000,${userLat},${userLon});
            way["amenity"="college"](around:50000,${userLat},${userLon});
          );
          out center tags;
        `;
        
        const overpassResponse = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: overpassQuery
        });

        if (overpassResponse.ok) {
          const overpassData = await overpassResponse.json();
          const elements = overpassData.elements || [];
          
          // Process and deduplicate results
          const seenNames = new Set();
          
          for (const el of elements) {
            const name = el.tags?.name;
            if (!name || seenNames.has(name.toLowerCase())) continue;
            seenNames.add(name.toLowerCase());
            
            // Calculate distance
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;
            let distance = null;
            
            if (lat && lon) {
              const R = 6371; // km
              const dLat = (lat - userLat) * Math.PI / 180;
              const dLon = (lon - userLon) * Math.PI / 180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(userLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              distance = R * c;
            }

            // Get address info
            const address = el.tags?.['addr:street'] || el.tags?.['addr:city'] || userCity || '';
            
            // Get classmates count
            const lowerName = name.toLowerCase().trim();
            const classmates = schoolCounts[lowerName] || 0;

            nearbySchools.push({
              name,
              address: address ? `${address}, ${userCity || ''}`.replace(/, $/, '') : userCity || '',
              classmates,
              distance,
              type: el.tags?.amenity === 'university' ? 'university' : 'college'
            });
          }

          // Sort by distance then by classmates
          nearbySchools.sort((a, b) => {
            // Prioritize schools with classmates
            if (a.classmates > 0 && b.classmates === 0) return -1;
            if (b.classmates > 0 && a.classmates === 0) return 1;
            if (a.classmates !== b.classmates) return b.classmates - a.classmates;
            // Then by distance
            if (a.distance && b.distance) return a.distance - b.distance;
            return 0;
          });
        }
      } catch (overpassError) {
        console.log('Overpass API error:', overpassError.message);
      }
    }

    // If user is searching, filter results
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      nearbySchools = nearbySchools.filter(s => 
        s.name.toLowerCase().includes(query)
      );
    }

    // Limit to top 10 results
    nearbySchools = nearbySchools.slice(0, 10);

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