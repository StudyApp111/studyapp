import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenAI } from 'npm:@google/genai@1.0.0';

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
      return Response.json({ codes: [] });
    }

    const genAI = new GoogleGenAI({ apiKey });

    // Step 1: Use Google Search grounding to find real courses at this school
    let searchContext = '';
    if (school) {
      try {
        const searchResult = await genAI.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: `List the most popular and common undergraduate courses offered at "${school}". Include course codes and names. Focus on high-enrollment first and second year courses.`,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.2,
            maxOutputTokens: 1500
          }
        });
        searchContext = searchResult.text || '';
      } catch (searchErr) {
        console.log('Search step failed:', searchErr.message);
      }
    }

    // Step 2: Use JSON mode to extract exactly 6 course codes
    const prompt = `Based on the following research about courses at "${school || 'a typical university'}", return exactly 6 real, common undergraduate course codes.
${year ? `Focus on courses for year ${year} students.` : 'Include a mix of popular first and second year courses.'}

${searchContext ? `Research:\n${searchContext}` : `List 6 common undergraduate course codes at ${school || 'a typical university'}.`}

Return a JSON object with a "codes" array of exactly 6 course code strings. Use the actual course codes from that school (e.g. "MATH 211", "PSYC 200"). If you can't find real codes, use realistic ones for that type of institution.`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 256
      }
    });

    const text = result.text || '';
    const parsed = JSON.parse(text.trim());
    const codes = parsed.codes || parsed.course_codes || [];

    return Response.json({ codes: codes.slice(0, 6) });

  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ codes: [] });
  }
});