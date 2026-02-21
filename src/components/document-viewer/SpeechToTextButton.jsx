import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useTheme } from "@/components/theme/ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";

export default function SpeechToTextButton({ onTranscript, disabled }) {
  const { isDark } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        
        if (chunksRef.current.length === 0) {
          setIsRecording(false);
          return;
        }

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);

        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');
          
          const { data } = await base44.functions.invoke('speechToText', formData);
          
          if (data?.transcript) {
            onTranscript(data.transcript);
          }
        } catch (error) {
          console.error('Transcription error:', error);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access error:', error);
      alert('Could not access microphone. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={disabled || isTranscribing}
        className={`relative h-10 px-3 rounded-xl border-2 transition-all ${
          isRecording
            ? 'border-red-400 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/20 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/30'
            : isTranscribing
              ? 'border-purple-300 bg-purple-50 dark:bg-purple-500/20 dark:border-purple-500/50'
              : `${isDark ? 'border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-600/10 text-purple-400' : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50 text-purple-600'}`
        }`}
      >
        {isTranscribing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
        <span className="ml-1.5 text-xs font-medium">
          {isTranscribing ? 'Transcribing...' : isRecording ? 'Stop' : 'Dictate'}
        </span>
      </Button>

      {/* Recording pulse indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -top-1 -right-1 w-3 h-3"
          >
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}