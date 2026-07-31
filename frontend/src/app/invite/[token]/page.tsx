"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Play, Mic, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VoiceRecorderDialog } from "@/components/shared/VoiceRecorderDialog";
import { createClient } from "@/lib/supabase/client";

export default function InviteLandingPage() {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState<"welcome" | "signup" | "reply">("welcome");
  
  // 가입 폼 상태
  const [name, setName] = useState("");
  
  // 첫 답장 상태
  const [replyText, setReplyText] = useState("");
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState(false);

  const handlePlayMessage = () => {
    setIsPlaying(true);
    // In a real app, this would play an audio element
    setTimeout(() => setIsPlaying(false), 3000);
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setStep("reply");
  };

  const handleTextReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    
    toast.success("텍스트 답장이 전송되었습니다! 앨범방에 입장합니다.");
    router.push("/");
  };

  const handleVoiceReplySubmit = async (duration: number, audioBlob: Blob) => {
    try {
      const supabase = createClient();
      const fileName = `${Math.random()}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(`audio/${fileName}`, audioBlob);
        
      if (uploadError) throw uploadError;

      setIsVoiceRecorderOpen(false);
      toast.success("음성 답장이 전송되었습니다! 앨범방에 입장합니다.");
      setTimeout(() => {
        router.push("/");
      }, 500);
    } catch (error) {
      console.error(error);
      toast.error("업로드에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f2f4f6] flex flex-col items-center justify-center p-5">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/15 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md z-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-white shadow-sm text-primary mb-2">
            <Heart className="w-8 h-8 fill-primary/20" />
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-ink">오늘도 사랑해</h1>
          <p className="text-muted-foreground font-medium text-[15px]">
            가족 앨범방으로 초대받았어요!
          </p>
        </div>

        <Card className="border-none shadow-[0_8px_30px_rgba(0,0,0,0.08)] rounded-[24px] overflow-hidden bg-white">
          {step === "welcome" && (
            <CardContent className="p-8 text-center space-y-8">
              <Avatar className="w-[88px] h-[88px] mx-auto border-4 border-white shadow-sm rounded-[24px]">
                <AvatarImage src="https://i.pravatar.cc/150?u=1" className="object-cover" />
                <AvatarFallback className="rounded-[24px]">가족</AvatarFallback>
              </Avatar>
              
              <div className="space-y-2">
                <h2 className="text-[20px] font-extrabold text-ink tracking-tight">초대 메시지가 도착했어요</h2>
                <p className="text-[14px] text-muted-foreground font-medium">메시지를 확인하고 앨범방에 입장해보세요.</p>
              </div>

              <div className="bg-[#f2f4f6] rounded-[20px] p-6">
                <Button 
                  onClick={handlePlayMessage} 
                  variant="outline" 
                  className={`w-16 h-16 rounded-full border-none shadow-sm bg-white hover:bg-gray-50 transition-all ${isPlaying ? 'animate-pulse shadow-md ring-4 ring-primary/20' : ''}`}
                >
                  <Play className={`w-6 h-6 ml-1 ${isPlaying ? 'text-primary fill-primary' : 'text-ink fill-ink'}`} />
                </Button>
                <p className="mt-4 text-[14px] font-bold text-ink">
                  {isPlaying ? "재생 중..." : "음성 메시지 듣기"}
                </p>
              </div>

              <Button onClick={() => setStep("signup")} className="w-full h-14 rounded-2xl text-[17px] font-bold shadow-sm">
                시작하기
              </Button>
            </CardContent>
          )}

          {step === "signup" && (
            <CardContent className="p-8 space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-[20px] font-extrabold text-ink tracking-tight">어떻게 불러드릴까요?</h2>
                <p className="text-[14px] text-muted-foreground font-medium">앨범방에서 사용할 이름을 알려주세요.</p>
              </div>

              <form onSubmit={handleSignupSubmit} className="space-y-6">
                <div className="space-y-3 text-left">
                  <label className="text-[15px] font-bold text-ink ml-1">이름 (닉네임)</label>
                  <Input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예) 아빠, 첫째딸"
                    className="h-14 rounded-2xl bg-secondary/50 border-transparent focus-visible:border-primary/30 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-primary/10 text-[16px] px-4 font-medium transition-all"
                  />
                </div>
                
                <Button type="submit" className="w-full h-14 rounded-2xl text-[17px] font-bold shadow-sm" disabled={!name.trim()}>
                  다음으로
                </Button>
              </form>
            </CardContent>
          )}

          {step === "reply" && (
            <CardContent className="p-8 space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-[20px] font-extrabold text-ink tracking-tight">첫 답장을 남겨주세요</h2>
                <p className="text-[14px] text-muted-foreground font-medium">
                  답장을 남기면 가족 앨범방 입장이 완료됩니다.
                </p>
              </div>

              <div className="bg-[#f2f4f6] rounded-[20px] p-5 text-[15px] text-ink font-medium leading-relaxed relative">
                <div className="absolute -top-3 left-6 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[16px] border-l-transparent border-r-transparent border-b-[#f2f4f6]" />
                &quot;아빠 요즘 바쁘지? 건강 조심하고 우리 곧 만나자~ ❤️&quot;
              </div>

              <div className="space-y-4">
                <div className="flex w-full items-center gap-2">
                  <Button 
                    size="icon" 
                    variant="secondary"
                    className="rounded-full shrink-0 h-12 w-12 text-muted-foreground hover:text-ink transition-colors bg-[#f2f4f6] hover:bg-[#e5e8eb]" 
                    onClick={() => setIsVoiceRecorderOpen(true)}
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                  <Input 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="마음을 담아 답장하기..."
                    className="h-12 rounded-full border-none bg-[#f2f4f6] flex-1 px-5 text-[15px] focus-visible:ring-0 focus-visible:bg-[#e5e8eb] transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleTextReplySubmit(e)}
                  />
                  <Button 
                    size="icon" 
                    onClick={handleTextReplySubmit} 
                    disabled={!replyText.trim()}
                    className="rounded-full shrink-0 h-12 w-12 shadow-sm"
                  >
                    <Send className="w-5 h-5 ml-0.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      <VoiceRecorderDialog 
        open={isVoiceRecorderOpen} 
        onOpenChange={setIsVoiceRecorderOpen} 
        onSend={handleVoiceReplySubmit}
        title="음성으로 첫 답장 남기기"
        description="가족의 초대에 반가운 목소리로 답해주세요."
      />
    </div>
  );
}
