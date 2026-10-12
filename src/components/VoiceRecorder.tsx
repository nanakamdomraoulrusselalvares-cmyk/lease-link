"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Trash2, Play, Pause, AlertCircle, Volume2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface VoiceRecorderProps {
  onAudioReady: (audioDataUrl: string, durationSeconds: number) => void;
  onAudioCleared: () => void;
  existingAudioUrl?: string | null;
  existingDuration?: number | null;
}

export default function VoiceRecorder({
  onAudioReady,
  onAudioCleared,
  existingAudioUrl,
  existingDuration,
}: VoiceRecorderProps) {
  const { isFrench } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingAudioUrl || null);
  const [duration, setDuration] = useState<number>(existingDuration || 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const exactDurationRef = useRef<number>(existingDuration || 0);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Sync if existing audio prop updates
  useEffect(() => {
    if (existingAudioUrl && existingAudioUrl !== audioUrl) {
      setAudioUrl(existingAudioUrl);
      const d = existingDuration || 0;
      setDuration(d);
      exactDurationRef.current = d;
    }
  }, [existingAudioUrl, existingDuration, audioUrl]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (totalSeconds: number) => {
    if (!isFinite(totalSeconds) || isNaN(totalSeconds) || totalSeconds < 0) {
      return "00:00";
    }
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    setErrorMsg(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg(
        isFrench
          ? "L'enregistrement vocal n'est pas supporté par ce navigateur. Vous pouvez importer un fichier audio."
          : "Voice recording is not supported on this browser. You can upload an audio file instead."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Detect best supported audio mime type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "";

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Calculate true duration from real elapsed milliseconds
        const elapsedMs = Date.now() - startTimeRef.current;
        const computedSeconds = Math.max(1, Math.round(elapsedMs / 1000));
        const finalDuration = exactDurationRef.current > 0 ? exactDurationRef.current : computedSeconds;

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          setAudioUrl(base64Data);
          setDuration(finalDuration);
          exactDurationRef.current = finalDuration;
          onAudioReady(base64Data, finalDuration);
        };

        // Stop all audio hardware tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      // Set timestamp and start
      startTimeRef.current = Date.now();
      exactDurationRef.current = 0;
      setRecordingSeconds(0);
      setIsRecording(true);

      recorder.start(250);

      // High-precision live timer based on real timestamp difference
      timerIntervalRef.current = setInterval(() => {
        if (startTimeRef.current > 0) {
          const elapsed = Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
          setRecordingSeconds(elapsed);
          exactDurationRef.current = elapsed;
        }
      }, 200);
    } catch (err: unknown) {
      console.warn("Microphone access failed:", err);
      setErrorMsg(
        isFrench
          ? "L'accès au micro a été refusé. Veuillez autoriser l'accès au micro dans votre navigateur."
          : "Microphone access was denied. Please allow microphone permissions in your browser."
      );
    }
  };

  const stopRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (startTimeRef.current > 0) {
      const finalSecs = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
      exactDurationRef.current = finalSecs;
      setRecordingSeconds(finalSecs);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  }, []);

  const deleteRecording = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    setAudioUrl(null);
    setDuration(0);
    exactDurationRef.current = 0;
    setIsPlaying(false);
    setPlaybackTime(0);
    setRecordingSeconds(0);
    onAudioCleared();
  };

  const togglePlayback = () => {
    if (!audioElementRef.current) return;

    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioElementRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * duration;
    audioElementRef.current.currentTime = newTime;
    setPlaybackTime(newTime);
  };

  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const objectUrl = URL.createObjectURL(file);
    const tempAudio = new Audio(objectUrl);

    tempAudio.onloadedmetadata = () => {
      const detectedDuration = isFinite(tempAudio.duration) && tempAudio.duration > 0
        ? Math.round(tempAudio.duration)
        : 10;

      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        setAudioUrl(base64Data);
        setDuration(detectedDuration);
        exactDurationRef.current = detectedDuration;
        onAudioReady(base64Data, detectedDuration);
        URL.revokeObjectURL(objectUrl);
      };
      reader.readAsDataURL(file);
    };

    tempAudio.onerror = () => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        setAudioUrl(base64Data);
        setDuration(15);
        exactDurationRef.current = 15;
        onAudioReady(base64Data, 15);
        URL.revokeObjectURL(objectUrl);
      };
      reader.readAsDataURL(file);
    };
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <Mic className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-white block">
              {isFrench ? "Explication Vocale (Message Vocal)" : "Voice Note Explanation"}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {isFrench
                ? "Expliquez le problème librement — la durée s'adapte en temps réel"
                : "Speak freely to explain the issue — recording duration adapts in real time"}
            </span>
          </div>
        </div>

        {audioUrl && !isRecording && (
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
            <span>{formatTime(duration)}</span>
            <span>{isFrench ? "Enregistré" : "Recorded"}</span>
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STATE 1: Ready to Record */}
      {!isRecording && !audioUrl && (
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={startRecording}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{isFrench ? "Commencer l'enregistrement vocal" : "Start Voice Recording"}</span>
          </button>

          <span className="text-[11px] text-slate-500">{isFrench ? "ou" : "or"}</span>

          <label className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer font-medium hover:underline inline-flex items-center gap-1">
            <span>{isFrench ? "Importer un fichier audio" : "Upload audio file"}</span>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleAudioFileSelect}
            />
          </label>
        </div>
      )}

      {/* STATE 2: Actively Recording (Live real-time timer) */}
      {isRecording && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/30 border border-purple-500/40">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <div className="font-mono text-base font-black text-white tracking-wider">
              {formatTime(recordingSeconds)}
            </div>
            <span className="text-[11px] text-purple-300 animate-pulse hidden sm:inline">
              {isFrench ? "Vous parlez... Enregistrement vocal en direct" : "Speaking... Recording your voice note live"}
            </span>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>
              {isFrench ? "Arrêter & Enregistrer" : "Stop & Save"} ({formatTime(recordingSeconds)})
            </span>
          </button>
        </div>
      )}

      {/* STATE 3: Audio Ready for Preview & Playback */}
      {audioUrl && !isRecording && (
        <div className="space-y-2 p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={togglePlayback}
              className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-600/20 transition cursor-pointer"
              title={isPlaying ? (isFrench ? "Pause" : "Pause") : (isFrench ? "Lire" : "Play")}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-mono text-white font-semibold">
                  {formatTime(playbackTime)}
                </span>
                <span className="font-mono text-purple-400 font-bold">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Interactive Scrub Bar */}
              <div
                onClick={handleSeek}
                className="w-full h-2 bg-slate-800 rounded-full overflow-hidden cursor-pointer relative"
                title={isFrench ? "Cliquer pour naviguer" : "Click anywhere to jump/seek"}
              >
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all"
                  style={{
                    width: `${duration > 0 ? Math.min(100, (playbackTime / duration) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={deleteRecording}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
              title={isFrench ? "Supprimer et réenregistrer un message vocal" : "Delete and record a new voice message"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <audio
            ref={audioElementRef}
            src={audioUrl}
            onTimeUpdate={(e) => {
              const cur = e.currentTarget.currentTime;
              setPlaybackTime(cur);
              // If audio reading continues beyond recorded estimate, dynamically adapt duration
              if (cur > duration) {
                const newDuration = Math.ceil(cur);
                setDuration(newDuration);
                exactDurationRef.current = newDuration;
                onAudioReady(audioUrl, newDuration);
              }
            }}
            onEnded={(e) => {
              setIsPlaying(false);
              setPlaybackTime(0);
              const finalCur = Math.round(e.currentTarget.currentTime);
              if (finalCur > duration) {
                setDuration(finalCur);
                exactDurationRef.current = finalCur;
                onAudioReady(audioUrl, finalCur);
              }
            }}
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (isFinite(d) && d > 0) {
                const rounded = Math.round(d);
                setDuration(rounded);
                exactDurationRef.current = rounded;
                onAudioReady(audioUrl, rounded);
              }
            }}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
