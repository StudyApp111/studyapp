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
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-tts:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `Read this lecture aloud naturally as if you were a professor:\n\n${truncated}` }]
          }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'audio/mp3'
          }
        })
      }
    );

    // Check if Gemini returned audio
    const data = await response.json();
    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    
    if (inlineData?.data) {
      // Return base64 audio
      return Response.json({ 
        success: true, 
        audio_base64: inlineData.data,
        mime_type: inlineData.mimeType || 'audio/mp3'
      });
    }

    // Fallback: Use Web Speech API on the client side
    return Response.json({ 
      success: true, 
      audio_base64: null,
      fallback_text: truncated,
      message: 'Use browser TTS as fallback'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});