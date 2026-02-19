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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_KEY}`,
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
                  voiceName: "Kore"
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
      // Gemini TTS returns raw PCM (signed 16-bit LE, 24kHz, mono)
      // We must wrap it in a proper WAV header for browser playback
      const pcmBytes = Uint8Array.from(atob(inlineData.data), c => c.charCodeAt(0));
      const wavBytes = createWavFromPCM(pcmBytes, 24000, 1, 16);
      const wavBase64 = btoa(String.fromCharCode(...wavBytes));
      
      return Response.json({ 
        success: true, 
        audio_base64: wavBase64,
        mime_type: 'audio/wav'
      });
    }

    throw new Error("No audio content received from Gemini TTS");

  } catch (error) {
    console.error("generateLectureSpeech error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Build a proper WAV file from raw PCM data
function createWavFromPCM(pcmData, sampleRate, numChannels, bitsPerSample) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;
  
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Copy PCM data
  const wavArray = new Uint8Array(buffer);
  wavArray.set(pcmData, headerSize);
  
  return wavArray;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}