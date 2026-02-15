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

    // Search for nearby schools using Nominatim geocoding
    if (userLat && userLon) {
      const isTextSearch = searchQuery?.trim()?.length >= 2;
      
      try {
        let searchUrl;
        if (isTextSearch) {
          // Text search — append "university" to improve results
          const q = searchQuery.trim();
          const hasEduKeyword = /university|college|school|institute|academy/i.test(q);
          const finalQuery = hasEduKeyword ? q : q + ' university';
          searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(finalQuery)}&format=json&limit=12&addressdetails=1&extratags=1`;
        } else {
          // Nearby search — find universities near user coordinates
          // Use reverse geocode first, then search by city name
          const cityName = userCity || '';
          searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent('university ' + cityName)}&format=json&limit=15&addressdetails=1&extratags=1`;
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const response = await fetch(searchUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'StudyApp/1.0' }
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const results = await response.json();
          const seenNames = new Set();
          
          for (const place of results) {
            // Extract clean name
            let name = place.display_name?.split(',')[0]?.trim();
            if (!name || seenNames.has(name.toLowerCase())) continue;
            
            // Filter to educational institutions
            const fullText = (place.type || '') + ' ' + (place.class || '') + ' ' + (place.display_name || '');
            const isSchool = /university|college|school|institute|academy|polytechnic|campus/i.test(fullText);
            if (!isSchool) continue;
            
            seenNames.add(name.toLowerCase());
            
            const elLat = parseFloat(place.lat);
            const elLon = parseFloat(place.lon);
            let distance = null;
            
            if (elLat && elLon && userLat && userLon) {
              const R = 6371;
              const dLat = (elLat - userLat) * Math.PI / 180;
              const dLon = (elLon - userLon) * Math.PI / 180;
              const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(userLat * Math.PI / 180) * Math.cos(elLat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              distance = R * c;
            }
            
            nearbySchools.push({ name, address: userCity || '', distance, type: 'university' });
          }
          
          nearbySchools.sort((a, b) => (a.distance || 999) - (b.distance || 999));
        }
      } catch (searchError) {
        console.log('Nominatim search failed:', searchError.message);
      }
    }

    // Filter by search query if provided (only for Overpass results, Nominatim already filtered)
    if (searchQuery?.trim() && nearbySchools.length > 12) {
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