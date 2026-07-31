"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WaveformProps {
  duration: number; // in seconds
}

export function Waveform({ duration }: WaveformProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const NUM_BARS = 40;

  // Generate random heights for the waveform once
  const [heights] = useState(() => {
    return Array.from({ length: NUM_BARS }).map(() => Math.max(0.2, Math.random()));
  });

  useEffect(() => {
    if (isPlaying) {
      const intervalMs = 50; // Update 20 times a second for smooth progress
      const progressIncrement = intervalMs / (duration * 1000);
      
      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev + progressIncrement >= 1) {
            setIsPlaying(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return 1;
          }
          return prev + progressIncrement;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, duration]);

  const togglePlay = () => {
    if (progress >= 1) {
      setProgress(0); // Restart if finished
    }
    setIsPlaying(!isPlaying);
  };

  const handleBarClick = (index: number) => {
    const newProgress = index / NUM_BARS;
    setProgress(newProgress);
    setIsPlaying(true); // Auto-play when clicking a segment
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentSeconds = progress * duration;

  return (
    <div className="flex flex-col items-center w-full space-y-4">
      <div className="flex items-center gap-4 w-full">
        <Button 
          onClick={togglePlay} 
          variant="outline" 
          size="icon" 
          className="rounded-full shrink-0 w-12 h-12 border-border text-ink hover:text-primary hover:border-primary hover:bg-primary/5"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
        </Button>
        
        <div className="flex-1 flex items-center justify-between gap-[2px] h-12 cursor-pointer group">
          {heights.map((height, i) => {
            const barProgress = i / NUM_BARS;
            const isPlayed = barProgress <= progress;
            return (
              <div 
                key={i}
                onClick={() => handleBarClick(i)}
                className="flex-1 rounded-full transition-all duration-75 hover:scale-110 hover:opacity-100"
                style={{
                  height: `${height * 100}%`,
                  backgroundColor: isPlayed ? 'var(--color-brand-primary)' : 'var(--color-brand-hairline)',
                  opacity: isPlayed ? 1 : 0.6,
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="flex justify-between w-full text-xs font-medium text-muted-foreground font-mono px-1">
        <span>{formatTime(currentSeconds)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
