import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Build a proper WAV file from raw PCM bytes (16-bit, mono, 24000 Hz)
function buildWav(pcmBase64) {
  const pcmBytes = Uint8Array.from(atob(pcmBase64), c => c.charCodeAt(0));
  const numChannels = 1;
  const sampleRate = 24000;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = pcmBytes.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const write = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer).set(pcmBytes, 44);

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Split text into chunks at sentence boundaries
// First chunk is smaller (faster time-to-audio), subsequent chunks are larger
function chunkText(text, firstChunkMaxChars = 400, restMaxChars = 1200) {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const chunks = [];
  let current = '';
  const maxChars = chunks.length === 0 ? firstChunkMaxChars : restMaxChars;
  
  for (const sentence of sentences) {
    const limit = chunks.length === 0 ? firstChunkMaxChars : restMaxChars;
    if (current.length + sentence.length > limit && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function generateChunkAudio(text, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" }
            }
          }
        }
      })
    }
  );
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Gemini TTS failed");
  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) throw new Error("No audio content");
  return inlineData.data; // raw PCM base64
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { text, chunk_index } = await req.json();
    if (!text) return Response.json({ error: 'text required' }, { status: 400 });

    // Strip markdown for cleaner speech
    const cleanText = text
      .replace(/#{1,6}\s*/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/---+/g, '')
      .trim();

    const GEMINI_KEY = Deno.env.get('GEMINIAPIKEY');

    // If chunk_index is specified, caller already chunked — generate just that text
    if (chunk_index !== undefined && chunk_index !== null) {
      const pcmBase64 = await generateChunkAudio(cleanText, GEMINI_KEY);
      const wavBase64 = buildWav(pcmBase64);
      return Response.json({ 
        success: true, 
        audio_base64: wavBase64,
        mime_type: 'audio/wav',
        chunk_index
      });
    }

    // Default: chunk the text and return chunk info + first chunk audio
    // First chunk is small (400 chars) for fast initial playback, rest are 1200
    const chunks = chunkText(cleanText, 400, 1200);
    
    // Generate audio for first chunk only (fast response)
    const pcmBase64 = await generateChunkAudio(chunks[0], GEMINI_KEY);
    const wavBase64 = buildWav(pcmBase64);

    return Response.json({ 
      success: true, 
      audio_base64: wavBase64,
      mime_type: 'audio/wav',
      chunk_index: 0,
      total_chunks: chunks.length,
      chunks_text: chunks // send all chunk texts so frontend can request remaining
    });

  } catch (error) {
    console.error("generateLectureSpeech error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});