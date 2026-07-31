"use client";

import { useEffect, useState, useRef } from "react";
import { Mic, Square, Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Waveform } from "@/components/shared/Waveform";

type RecordState = "idle" | "recording" | "preview";

interface VoiceRecorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (duration: number, audioBlob: Blob) => void;
  title?: string;
  description?: string;
  trigger?: React.ReactElement;
  customContent?: React.ReactNode; // For things like target selection
}

export function VoiceRecorderDialog({
  open,
  onOpenChange,
  onSend,
  title = "음성 메시지 녹음",
  description = "따뜻한 진심을 담아 음성으로 기록해주세요.",
  trigger,
  customContent
}: VoiceRecorderDialogProps) {
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [finalDuration, setFinalDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setAudioBlob(null);

      if (timerRef.current) clearInterval(timerRef.current);
      setTimeout(() => {
        setRecordState("idle");
        setRecordingTime(0);
      }, 0);
    }
  }, [open]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop()); // Stop microphone
      };

      mediaRecorder.start();
      setRecordState("recording");
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error("마이크 접근 권한이 필요합니다.");
      console.error(error);
    }
  };

  const handleStopRecording = () => {
    if (recordingTime < 3) {
      toast.error("최소 3초 이상 녹음해주세요.");
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      
      setAudioBlob(null);
      audioChunksRef.current = [];
      setRecordState("idle");
      setRecordingTime(0);
      return;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    
    if (timerRef.current) clearInterval(timerRef.current);
    setFinalDuration(recordingTime);
    setRecordState("preview");
  };
  
  const handleResetRecording = () => {
    setAudioBlob(null);
    audioChunksRef.current = [];
    setRecordState("idle");
    setRecordingTime(0);
  };

  const handleSend = () => {
    if (audioBlob) {
      onSend(finalDuration, audioBlob);
    }
    // Modal will be closed by parent usually, but we clean up anyway
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="!fixed !bottom-0 !top-auto !translate-y-0 !translate-x-[-50%] sm:max-w-md w-full !rounded-t-[32px] !rounded-b-none bg-white p-6 pb-10 border-none shadow-[0_-4px_24px_rgba(0,0,0,0.08)] !duration-300 data-[state=open]:!animate-in data-[state=closed]:!animate-out data-[state=closed]:!fade-out-0 data-[state=open]:!fade-in-0 data-[state=closed]:!slide-out-to-bottom-full data-[state=open]:!slide-in-from-bottom-full">
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6 opacity-40"></div>
        <DialogHeader className="mb-2 text-left">
          <DialogTitle className="text-[22px] font-extrabold tracking-tight text-ink">{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4 flex flex-col space-y-6">
          
          {customContent && (
            <div className="space-y-2">
              {customContent}
            </div>
          )}

          <div className="flex flex-col items-center justify-center space-y-6 py-4 bg-secondary/30 rounded-2xl border border-border/50">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                {recordState === "preview" 
                  ? "녹음된 음성을 확인하고 전송해보세요." 
                  : description}
              </p>
              {recordState !== "preview" && (
                <p className="text-xs font-medium text-primary">
                  * 최소 3초 이상 녹음해야 전송할 수 있습니다.
                </p>
              )}
            </div>
            
            {recordState === "idle" && (
              <button 
                onClick={handleStartRecording}
                className="w-24 h-24 rounded-full flex items-center justify-center bg-secondary hover:bg-primary/10 border border-border hover:border-primary transition-colors group"
              >
                <Mic className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            )}

            {recordState === "recording" && (
              <div className="flex flex-col items-center space-y-4 w-full">
                <div className="text-2xl font-bold font-mono text-ink tracking-widest animate-pulse">
                  {formatTime(recordingTime)}
                </div>
                <Button 
                  onClick={handleStopRecording}
                  className={`h-14 px-8 rounded-full shadow-sm transition-all text-base font-bold ${
                    recordingTime < 3 
                      ? "bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed opacity-50" 
                      : "bg-ink text-white hover:bg-ink/90 animate-in zoom-in"
                  }`}
                >
                  <Square className="w-4 h-4 mr-2 fill-current" />
                  녹음 완료
                </Button>
              </div>
            )}

            {recordState === "preview" && (
              <div className="flex flex-col w-full px-6 space-y-8 animate-in fade-in zoom-in-95">
                <Waveform duration={finalDuration} />
                
                <div className="flex items-center gap-3 w-full">
                  <Button 
                    onClick={handleResetRecording}
                    variant="outline"
                    className="flex-1 h-12 rounded-xl text-ink font-medium"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    다시 녹음
                  </Button>
                  <Button 
                    onClick={handleSend}
                    className="flex-1 h-12 rounded-xl text-white bg-primary hover:bg-primary-active font-bold shadow-sm"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    전송하기
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
