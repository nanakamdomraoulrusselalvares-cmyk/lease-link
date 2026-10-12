"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface AudioPlayerProps {
  src: string;
  durationSeconds?: number | null;
  label?: string;
}

export default function AudioPlayer({ src, durationSeconds, label }: AudioPlayerProps) {
  const { isFrench } = useLanguage();
  const defaultLabel = isFrench ? "Message Vocal" : "Voice Message";
  const displayLabel = label || defaultLabel;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(durationSeconds || 0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync if durationSeconds changes from props
  useEffect(() => {
    if (durationSeconds && durationSeconds > 0) {
      setDuration(durationSeconds);
    }
  }, [durationSeconds]);

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
      <button
        type="button"
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-600/20 transition cursor-pointer"
        title={
          isPlaying
            ? isFrench
              ? "Mettre en pause"
              : "Pause voice note"
            : isFrench
            ? "Écouter le message vocal"
            : "Play voice note"
        }
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5 truncate">
            <Volume2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="truncate">{displayLabel}</span>
          </span>
          <span className="font-mono text-slate-400 shrink-0">
            <span className="text-white font-medium">{formatTime(currentTime)}</span>
            <span className="mx-1 text-slate-600">/</span>
            <span className="text-purple-400 font-bold">{formatTime(duration)}</span>
          </span>
        </div>

        {/* Interactive Scrub Bar */}
        <div
          onClick={handleSeek}
          className="w-full h-2 bg-slate-800 rounded-full overflow-hidden cursor-pointer relative"
          title={isFrench ? "Cliquer pour naviguer" : "Click to seek"}
        >
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all"
            style={{
              width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
            }}
          />
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={(e) => {
          const cur = e.currentTarget.currentTime;
          setCurrentTime(cur);
          // Dynamically adapt duration if audio reading exceeds existing estimate
          if (cur > duration) {
            setDuration(Math.ceil(cur));
          }
        }}
        onEnded={(e) => {
          setIsPlaying(false);
          setCurrentTime(0);
          const finalCur = Math.round(e.currentTarget.currentTime);
          if (finalCur > duration) {
            setDuration(finalCur);
          }
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d) && d > 0) {
            setDuration(Math.round(d));
          }
        }}
        className="hidden"
      />
    </div>
  );
}
