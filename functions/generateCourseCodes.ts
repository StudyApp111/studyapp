import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { school, year } = await req.json();

    const apiKey = Deno.env.get("API_KEY");
    if (!apiKey) {
      return Response.json({ error: 'Service configuration error' }, { status: 500 });
    }

    const prompt = `List 6 common undergraduate course codes at ${school || 'a typical North American university'}.
${year ? `Focus on courses typical for year ${year} students.` : ''}

Return ONLY a JSON array of 6 course codes like ["ECON 203", "PSYC 200", "MATH 101", "BIOL 241", "CHEM 201", "POLI 200"].
No explanation, just the array.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 256
          }
        })
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return Response.json({ codes: [] });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON array
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      try {
        const codes = JSON.parse(match[0]);
        return Response.json({ codes: codes.slice(0, 6) });
      } catch {
        return Response.json({ codes: [] });
      }
    }

    return Response.json({ codes: [] });

  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ codes: [] });
  }
});