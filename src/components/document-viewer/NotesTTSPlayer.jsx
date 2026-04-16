import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Play, Pause, Loader2, Volume2, Gauge, X, SkipBack, SkipForward } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

// Split markdown into clean, readable sentences (for TTS + highlighting)
function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/---+/g, '')
    .replace(/>\s*/g, '')
    .replace(/\|/g, ' ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIntoSentences(cleanText) {
  const matches = cleanText.match(/[^.!?]+[.!?]+[\s]*/g);
  if (!matches) return cleanText ? [cleanText] : [];
  return matches.map(s => s.trim()).filter(Boolean);
}

// Group sentences into chunks (first smaller for fast start, rest bigger)
function groupSentencesIntoChunks(sentences, firstMax = 400, restMax = 1200) {
  const chunks = []; // each chunk = { text, sentenceStart, sentenceEnd }
  let current = '';
  let startIdx = 0;
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const limit = chunks.length === 0 ? firstMax : restMax;
    if (current.length + sentence.length > limit && current.length > 0) {
      chunks.push({ text: current.trim(), sentenceStart: startIdx, sentenceEnd: i - 1 });
      current = sentence + ' ';
      startIdx = i;
    } else {
      current += sentence + ' ';
    }
  }
  if (current.trim()) {
    chunks.push({ text: current.trim(), sentenceStart: startIdx, sentenceEnd: sentences.length - 1 });
  }
  return chunks;
}

export default function NotesTTSPlayer({ noteContent, onClose, onSentenceActive }) {
  const { isDark } = useTheme();
  const audioRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentChunkIdx, setCurrentChunkIdx] = useState(0);
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [chunkDurations, setChunkDurations] = useState({}); // { chunkIdx: durationSeconds }
  const [chunkAudioCache, setChunkAudioCache] = useState({}); // { chunkIdx: blobUrl }
  const [currentTime, setCurrentTime] = useState(0); // total elapsed seconds across chunks
  const [hasInteracted, setHasInteracted] = useState(false);

  // Compute clean sentences + chunk grouping once
  const { sentences, chunks } = useMemo(() => {
    const clean = stripMarkdown(noteContent || '');
    const sents = splitIntoSentences(clean);
    const ch = groupSentencesIntoChunks(sents);
    return { sentences: sents, chunks: ch };
  }, [noteContent]);

  // Initial load: fetch first chunk
  useEffect(() => {
    if (!chunks.length) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await base44.functions.invoke('generateLectureSpeech', {
          text: chunks[0].text,
          chunk_index: 0
        });
        if (cancelled) return;
        if (!data?.audio_base64) throw new Error('No audio returned');
        const blobUrl = base64ToBlobUrl(data.audio_base64, data.mime_type || 'audio/wav');
        setChunkAudioCache(prev => ({ ...prev, 0: blobUrl }));
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('TTS initial load failed:', err);
          setLoadError(err.message || 'Failed to load audio');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [chunks]);

  // Prefetch next chunk while current is playing
  useEffect(() => {
    const nextIdx = currentChunkIdx + 1;
    if (nextIdx >= chunks.length) return;
    if (chunkAudioCache[nextIdx]) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await base44.functions.invoke('generateLectureSpeech', {
          text: chunks[nextIdx].text,
          chunk_index: nextIdx
        });
        if (cancelled || !data?.audio_base64) return;
        const blobUrl = base64ToBlobUrl(data.audio_base64, data.mime_type || 'audio/wav');
        setChunkAudioCache(prev => ({ ...prev, [nextIdx]: blobUrl }));
      } catch (err) {
        console.warn(`Prefetch chunk ${nextIdx} failed:`, err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [currentChunkIdx, chunks, chunkAudioCache]);

  // Apply playback speed whenever changed
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, currentChunkIdx]);

  // Emit active sentence to parent for scroll/highlight
  useEffect(() => {
    if (onSentenceActive) onSentenceActive(activeSentenceIdx, sentences[activeSentenceIdx]);
  }, [activeSentenceIdx, sentences, onSentenceActive]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(chunkAudioCache).forEach(url => {
        try { URL.revokeObjectURL(url); } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const base64ToBlobUrl = (base64, mime) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  };

  // Total estimated duration
  const totalDuration = useMemo(() => {
    // Use known durations; for unknown chunks, estimate from text length (≈ 15 chars/sec)
    let total = 0;
    chunks.forEach((ch, idx) => {
      if (chunkDurations[idx]) total += chunkDurations[idx];
      else total += ch.text.length / 15;
    });
    return total / speed;
  }, [chunks, chunkDurations, speed]);

  // Elapsed time including previous chunks
  const elapsedBeforeCurrent = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < currentChunkIdx; i++) {
      sum += chunkDurations[i] || chunks[i].text.length / 15;
    }
    return sum / speed;
  }, [currentChunkIdx, chunkDurations, chunks, speed]);

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setChunkDurations(prev => ({ ...prev, [currentChunkIdx]: audioRef.current.duration }));
      audioRef.current.playbackRate = speed;
    }
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    setCurrentTime(elapsedBeforeCurrent + t / speed);

    // Figure out which sentence is active within current chunk
    const chunk = chunks[currentChunkIdx];
    if (!chunk) return;
    const chunkDur = chunkDurations[currentChunkIdx] || audioRef.current.duration || 1;
    const sentenceCount = chunk.sentenceEnd - chunk.sentenceStart + 1;
    const relative = Math.min(t / chunkDur, 1);
    const sIdx = chunk.sentenceStart + Math.floor(relative * sentenceCount);
    const clamped = Math.min(Math.max(sIdx, chunk.sentenceStart), chunk.sentenceEnd);
    if (clamped !== activeSentenceIdx) setActiveSentenceIdx(clamped);
  };

  const handleAudioEnded = () => {
    const next = currentChunkIdx + 1;
    if (next < chunks.length) {
      setCurrentChunkIdx(next);
      setActiveSentenceIdx(chunks[next].sentenceStart);
    } else {
      setPlaying(false);
      setActiveSentenceIdx(0);
      setCurrentChunkIdx(0);
      setCurrentTime(0);
    }
  };

  // Play/pause toggle
  const togglePlay = async () => {
    setHasInteracted(true);
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch (err) {
        console.error('Play failed:', err);
      }
    }
  };

  // When chunk changes, load new audio and autoplay if already playing
  useEffect(() => {
    if (!audioRef.current || !chunkAudioCache[currentChunkIdx]) return;
    audioRef.current.src = chunkAudioCache[currentChunkIdx];
    audioRef.current.playbackRate = speed;
    if (playing || hasInteracted) {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChunkIdx, chunkAudioCache[currentChunkIdx]]);

  // Seek to a specific sentence (click-to-seek)
  const seekToSentence = useCallback(async (sentenceIdx) => {
    // Find the chunk containing this sentence
    const chunkIdx = chunks.findIndex(c => sentenceIdx >= c.sentenceStart && sentenceIdx <= c.sentenceEnd);
    if (chunkIdx < 0) return;

    setHasInteracted(true);

    // If chunk not yet loaded, load it
    if (!chunkAudioCache[chunkIdx]) {
      try {
        const { data } = await base44.functions.invoke('generateLectureSpeech', {
          text: chunks[chunkIdx].text,
          chunk_index: chunkIdx
        });
        if (!data?.audio_base64) return;
        const blobUrl = base64ToBlobUrl(data.audio_base64, data.mime_type || 'audio/wav');
        setChunkAudioCache(prev => ({ ...prev, [chunkIdx]: blobUrl }));
      } catch (err) {
        console.error('Seek load failed:', err);
        return;
      }
    }

    setCurrentChunkIdx(chunkIdx);
    setActiveSentenceIdx(sentenceIdx);

    // Wait a tick then seek within the new audio
    setTimeout(() => {
      if (!audioRef.current) return;
      const chunk = chunks[chunkIdx];
      const chunkDur = chunkDurations[chunkIdx] || audioRef.current.duration || 1;
      const sentenceCount = chunk.sentenceEnd - chunk.sentenceStart + 1;
      const offsetRatio = (sentenceIdx - chunk.sentenceStart) / sentenceCount;
      audioRef.current.currentTime = offsetRatio * chunkDur;
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }, 150);
  }, [chunks, chunkAudioCache, chunkDurations]);

  // Expose seek function to parent so clicking highlighted text can jump
  useEffect(() => {
    window.__notesTTSSeek = seekToSentence;
    return () => { if (window.__notesTTSSeek === seekToSentence) delete window.__notesTTSSeek; };
  }, [seekToSentence]);

  const handleProgressBarClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const targetSentence = Math.floor(ratio * sentences.length);
    seekToSentence(Math.min(targetSentence, sentences.length - 1));
  };

  const skipSeconds = (delta) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + delta);
  };

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
  };

  const fmt = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progressPct = totalDuration > 0 ? Math.min((currentTime / totalDuration) * 100, 100) : 0;

  if (!chunks.length) return null;

  return (
    <div className={`sticky top-0 z-20 border-b ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'} shadow-sm`}>
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          disabled={loading || !!loadError}
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all disabled:opacity-50 ${
            isDark ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
          }`}
          title={playing ? 'Pause' : 'Play'}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* Skip back 10s */}
        <button
          onClick={() => skipSeconds(-10)}
          disabled={loading}
          className={`hidden sm:flex flex-shrink-0 w-8 h-8 rounded-full items-center justify-center transition-colors disabled:opacity-40 ${
            isDark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Back 10s"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Progress + time */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`text-[10px] font-mono tabular-nums flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {fmt(currentTime)}
          </span>
          <div
            onClick={handleProgressBarClick}
            className={`flex-1 h-1.5 rounded-full cursor-pointer group relative ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}
            title="Click to seek"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow border border-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progressPct}% - 6px)` }}
            />
          </div>
          <span className={`text-[10px] font-mono tabular-nums flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {fmt(totalDuration)}
          </span>
        </div>

        {/* Skip fwd 10s */}
        <button
          onClick={() => skipSeconds(10)}
          disabled={loading}
          className={`hidden sm:flex flex-shrink-0 w-8 h-8 rounded-full items-center justify-center transition-colors disabled:opacity-40 ${
            isDark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Forward 10s"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Speed */}
        <button
          onClick={cycleSpeed}
          className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
            isDark ? 'bg-white/10 text-slate-200 hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          title="Playback speed"
        >
          <Gauge className="w-3 h-3" />
          {speed}×
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isDark ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Close player"
        >
          <X className="w-4 h-4" />
        </button>

        <audio
          ref={audioRef}
          onLoadedMetadata={handleAudioLoadedMetadata}
          onTimeUpdate={handleAudioTimeUpdate}
          onEnded={handleAudioEnded}
          preload="auto"
          className="hidden"
        />
      </div>
      {loadError && (
        <div className="px-4 pb-2 text-xs text-red-500">
          {loadError}. Try again later.
        </div>
      )}
    </div>
  );
}