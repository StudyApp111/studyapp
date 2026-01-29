import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Popular universities as fallback (covers major regions)
const FALLBACK_SCHOOLS = [
  { name: "University of Toronto", type: "university" },
  { name: "University of British Columbia", type: "university" },
  { name: "McGill University", type: "university" },
  { name: "University of Alberta", type: "university" },
  { name: "University of Calgary", type: "university" },
  { name: "Harvard University", type: "university" },
  { name: "Stanford University", type: "university" },
  { name: "MIT", type: "university" },
  { name: "UCLA", type: "university" },
  { name: "University of Michigan", type: "university" },
  { name: "Oxford University", type: "university" },
  { name: "Cambridge University", type: "university" },
  { name: "University of Sydney", type: "university" },
  { name: "University of Melbourne", type: "university" }
];

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

    // Quick geo lookup with 3s timeout - try multiple providers
    const geoProviders = [
      clientIP ? `https://ipapi.co/${clientIP}/json/` : 'https://ipapi.co/json/',
      `http://ip-api.com/json/${clientIP || ''}`
    ];

    for (const geoUrl of geoProviders) {
      if (userLat && userLon) break;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const geoResponse = await fetch(geoUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (!geoData.error && !geoData.status === 'fail') {
            userCity = geoData.city;
            userCountry = geoData.country_name || geoData.country;
            userLat = geoData.latitude || geoData.lat;
            userLon = geoData.longitude || geoData.lon;
          }
        }
      } catch (geoError) {
        console.log('Geo provider failed:', geoError.message);
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

            nearbySchools.push({
              name,
              address: userCity || '',
              classmates: 0,
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

    // Use fallback schools if no results found
    if (nearbySchools.length === 0) {
      nearbySchools = FALLBACK_SCHOOLS.map(s => ({
        ...s,
        address: '',
        classmates: 0,
        distance: null
      }));
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
    // Return fallback schools even on error
    return Response.json({ 
      success: true, 
      schools: FALLBACK_SCHOOLS.slice(0, 10).map(s => ({ ...s, address: '', classmates: 0, distance: null })), 
      location: {} 
    });
  }
});