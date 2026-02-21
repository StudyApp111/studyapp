import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio');
    
    if (!audioFile) {
      return Response.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      return Response.json({ error: 'Service configuration error' }, { status: 500 });
    }

    // Read audio as base64
    const audioBytes = await audioFile.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBytes)));
    const mimeType = audioFile.type || 'audio/webm';

    // Use Gemini to transcribe
    const payload = {
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Audio
            }
          },
          {
            text: "Transcribe the speech in this audio exactly as spoken. Return ONLY the transcribed text, nothing else. If no speech is detected, return an empty string."
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048
      }
    };

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Gemini STT error:', resp.status, errText);
      return Response.json({ error: 'Transcription failed' }, { status: 500 });
    }

    const data = await resp.json();
    const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    return Response.json({ success: true, transcript });
  } catch (error) {
    console.error('Error in speechToText:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});