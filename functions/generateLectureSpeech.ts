import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Build a proper WAV file from raw PCM bytes (16-bit, mono, 24000 Hz)
function buildWav(pcmBytes) {
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

  return new Uint8Array(buffer);
}

function base64ToBytes(b64) {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Split text into chunks at sentence boundaries, each ≤ maxLen chars
function chunkText(text, maxLen = 2000) {
  if (text.length <= maxLen) return [text];
  
  const chunks = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Find last sentence boundary within maxLen
    let cutPoint = remaining.lastIndexOf('. ', maxLen);
    if (cutPoint < maxLen * 0.3) cutPoint = remaining.lastIndexOf('! ', maxLen);
    if (cutPoint < maxLen * 0.3) cutPoint = remaining.lastIndexOf('? ', maxLen);
    if (cutPoint < maxLen * 0.3) cutPoint = remaining.lastIndexOf('\n', maxLen);
    if (cutPoint < maxLen * 0.3) cutPoint = maxLen; // hard cut as fallback
    
    chunks.push(remaining.substring(0, cutPoint + 1).trim());
    remaining = remaining.substring(cutPoint + 1).trim();
  }
  
  return chunks.filter(c => c.length > 0);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { text, chunkIndex } = await req.json();
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

    // If chunkIndex is provided, split and generate only that chunk
    // If not provided (legacy), generate the first chunk and return total count
    const chunks = chunkText(cleanText, 2000);
    const idx = chunkIndex ?? 0;
    
    if (idx >= chunks.length) {
      return Response.json({ error: 'Chunk index out of range' }, { status: 400 });
    }

    const chunkToSpeak = chunks[idx];
    const GEMINI_KEY = Deno.env.get('GEMINIAPIKEY');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: chunkToSpeak }] }],
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
    
    if (data.error) {
      console.error("Gemini TTS Error:", JSON.stringify(data.error));
      throw new Error(data.error.message || "Gemini TTS failed");
    }

    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    
    if (inlineData?.data) {
      const pcmBytes = base64ToBytes(inlineData.data);
      const wavBytes = buildWav(pcmBytes);
      const wavBase64 = bytesToBase64(wavBytes);
      
      return Response.json({ 
        success: true, 
        audio_base64: wavBase64,
        mime_type: 'audio/wav',
        totalChunks: chunks.length,
        chunkIndex: idx
      });
    }

    throw new Error("No audio content received from Gemini TTS");

  } catch (error) {
    console.error("generateLectureSpeech error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});