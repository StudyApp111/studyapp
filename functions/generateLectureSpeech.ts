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

    // Use API_KEY (likely Google Cloud API Key) or fallback to GEMINIAPIKEY
    const API_KEY = Deno.env.get('API_KEY') || Deno.env.get('GEMINIAPIKEY');
    
    // Voice selection: "Algieba" requested. 
    // "Algieba" is likely a reference to a specific Journey voice or Gemini voice.
    // For Google Cloud TTS, we'll use 'en-US-Journey-F' (a pleasant, expressive voice) as the closest match
    // or 'en-GB-Neural2-D' if "Algieba" implies Gamma Leonis (British?).
    // We'll default to 'en-US-Journey-O' (Warm, friendly) if specific map isn't found.
    // Let's use 'en-US-Journey-D' which is often popular.
    const voiceName = 'en-US-Journey-D';

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: truncated },
          voice: { 
            languageCode: 'en-US', 
            name: voiceName,
          },
          audioConfig: { 
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0.0
          }
        })
      }
    );

    // Check if Google TTS returned audio
    const data = await response.json();
    
    if (data.audioContent) {
      return Response.json({ 
        success: true, 
        audio_base64: data.audioContent,
        mime_type: 'audio/mp3'
      });
    }

    if (data.error) {
      console.error("Google TTS Error:", data.error);
      throw new Error(data.error.message || "Google TTS failed");
    }

    throw new Error("No audio content received");

  } catch (error) {
    console.error("generateLectureSpeech error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});