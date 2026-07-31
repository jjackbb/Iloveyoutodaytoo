"use client";

import { useState } from "react";
import { User, Bell, Shield, LogOut, ChevronRight, Edit2 } from "lucide-react";
import { toast } from "sonner";

import { useStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function MyPage() {
  const currentUser = useStore((state) => state.currentUser);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [newName, setNewName] = useState(currentUser.name);

  // Mock settings state
  const [pushEnabled, setPushEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    if (!/^[a-zA-Z0-9가-힣]{2,10}$/.test(newName.trim())) {
      toast.error("닉네임은 특수문자 없이 한글, 영문, 숫자를 조합해 2~10자로 적어주세요.");
      return;
    }
    
    toast.success("프로필이 성공적으로 변경되었습니다.");
    setIsEditOpen(false);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast("로그아웃 되었습니다.");
  };

  return (
    <div className="min-h-[100dvh] bg-[#f2f4f6]">
      <div className="max-w-md mx-auto pt-8 px-5 pb-32">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-8">마이페이지</h1>

        {/* Profile Section */}
        <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-[72px] w-[72px] border-2 border-border/30 rounded-[20px]">
              <AvatarImage src={currentUser.profileUrl} className="rounded-[18px]" />
              <AvatarFallback className="rounded-[18px] text-lg">{currentUser.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-[20px] font-extrabold text-ink truncate">{currentUser.name}</h2>
              <p className="text-[14px] text-muted-foreground font-medium mt-0.5 truncate">user123@example.com</p>
            </div>
            
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogTrigger render={
                <Button variant="outline" size="sm" className="rounded-2xl gap-1.5 border-transparent bg-secondary/60 hover:bg-secondary text-ink font-bold h-10 px-3 shrink-0">
                  <Edit2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">수정</span>
                </Button>
              } />
              <DialogContent className="!fixed !bottom-0 !top-auto !translate-y-0 !translate-x-[-50%] sm:max-w-md w-full !rounded-t-[32px] !rounded-b-none bg-white p-6 pb-10 border-none shadow-[0_-4px_24px_rgba(0,0,0,0.08)] !duration-300 data-[state=open]:!animate-in data-[state=closed]:!animate-out data-[state=closed]:!fade-out-0 data-[state=open]:!fade-in-0 data-[state=closed]:!slide-out-to-bottom-full data-[state=open]:!slide-in-from-bottom-full">
                <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6 opacity-40"></div>
                <DialogHeader className="mb-4 text-left">
                  <DialogTitle className="text-[22px] font-extrabold tracking-tight text-ink">프로필 수정</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="flex flex-col items-center gap-4 mb-2">
                    <Avatar className="h-24 w-24 rounded-[24px] border-2 border-border/30">
                      <AvatarImage src={currentUser.profileUrl} className="rounded-[22px]" />
                      <AvatarFallback className="rounded-[22px] text-2xl">{currentUser.name[0]}</AvatarFallback>
                    </Avatar>
                    <Button type="button" variant="outline" size="sm" className="rounded-full font-bold text-[13px] h-9 px-4">
                      사진 변경
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[15px] font-bold text-ink ml-1">닉네임</label>
                    <Input 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="새 닉네임 입력"
                      className="rounded-2xl h-14 bg-secondary/50 border-transparent focus-visible:border-primary/30 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-primary/10 text-[16px] px-4 font-medium transition-all"
                    />
                    <p className="text-[12px] text-muted-foreground mt-1 px-1 font-medium">
                      한글, 영문, 숫자를 조합해 2자 이상 10자 이하로 적어주세요. 특수문자는 사용할 수 없어요.
                    </p>
                  </div>
                  <Button type="submit" className="w-full h-14 rounded-2xl text-[17px] font-bold shadow-sm" disabled={!newName.trim()}>
                    저장하기
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Settings Section */}
        <h3 className="text-[14px] font-bold text-ink/70 mb-3 px-1">설정</h3>
        <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-6 overflow-hidden">
          <div className="flex flex-col divide-y divide-secondary">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-secondary/60 rounded-[14px]">
                  <Bell className="w-5 h-5 text-ink/70" />
                </div>
                <div>
                  <p className="font-bold text-[15px] text-ink">푸시 알림</p>
                  <p className="text-[13px] text-muted-foreground font-medium mt-0.5">새로운 추억과 답장 알림을 받아요.</p>
                </div>
              </div>
              <Switch 
                checked={pushEnabled} 
                onCheckedChange={(val) => {
                  setPushEnabled(val);
                  toast(val ? "푸시 알림이 설정되었습니다." : "푸시 알림이 해제되었습니다.");
                }} 
              />
            </div>
            
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-secondary/60 rounded-[14px]">
                  <Shield className="w-5 h-5 text-ink/70" />
                </div>
                <div>
                  <p className="font-bold text-[15px] text-ink">마케팅 정보 수신</p>
                  <p className="text-[13px] text-muted-foreground font-medium mt-0.5">이벤트 및 혜택 정보를 받아요.</p>
                </div>
              </div>
              <Switch 
                checked={marketingEnabled} 
                onCheckedChange={(val) => {
                  setMarketingEnabled(val);
                  toast(val ? "마케팅 수신이 동의되었습니다." : "마케팅 수신이 거절되었습니다.");
                }} 
              />
            </div>
          </div>
        </div>

        {/* Account Actions Section */}
        <h3 className="text-[14px] font-bold text-ink/70 mb-3 px-1">계정 관리</h3>
        <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="flex flex-col divide-y divide-secondary">
            <button className="flex items-center justify-between p-5 w-full hover:bg-secondary/30 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-secondary/60 rounded-[14px]">
                  <User className="w-5 h-5 text-ink/70" />
                </div>
                <p className="font-bold text-[15px] text-ink">개인정보 처리방침</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/40" />
            </button>
            
            <button 
              onClick={handleLogout}
              className="flex items-center justify-between p-5 w-full hover:bg-red-50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-100 rounded-[14px] group-hover:bg-red-200 transition-colors">
                  <LogOut className="w-5 h-5 text-red-500" />
                </div>
                <p className="font-bold text-[15px] text-red-500">로그아웃</p>
              </div>
            </button>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <button className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-ink transition-colors font-medium">
            회원 탈퇴하기
          </button>
        </div>
      </div>
    </div>
  );
}
