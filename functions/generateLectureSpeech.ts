import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { text } = await req.json();
    if (!text) return Response.json({ error: 'text required' }, { status: 400 });

    // Strip markdown for speech
    const cleanText = text
      .replace(/#{1,6}\s*/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/---+/g, '')
      .trim();

    // Truncate to ~4000 chars for TTS limits
    const truncated = cleanText.length > 4000 ? cleanText.substring(0, 4000) + '...' : cleanText;

    const GEMINI_KEY = Deno.env.get('GEMINIAPIKEY');

    // Use Gemini 2.5 Flash Preview TTS with voice "Algieba" per docs
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-tts:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `Say the following in a clear, engaging, professor-like tone:\n\n${truncated}` }]
          }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Algieba"
                }
              }
            }
          }
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      console.error("Gemini TTS Error:", JSON.stringify(data.error));
      throw new Error(data.error.message || "Gemini TTS failed");
    }

    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    
    if (inlineData?.data) {
      return Response.json({ 
        success: true, 
        audio_base64: inlineData.data,
        mime_type: inlineData.mimeType || 'audio/wav'
      });
    }

    throw new Error("No audio content received from Gemini TTS");

  } catch (error) {
    console.error("generateLectureSpeech error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});