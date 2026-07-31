"use client";

import { useState, useEffect } from "react";
import { User, Bell, Shield, LogOut, ChevronRight, Edit2 } from "lucide-react";
import { toast } from "sonner";

import { useStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function MyPage() {
  const currentUser = useStore((state) => state.currentUser);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [newName, setNewName] = useState(currentUser.name);
  const [isMounted, setIsMounted] = useState(false);

  // Mock settings state
  const [pushEnabled, setPushEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    if (!/^[a-zA-Z0-9가-힣]{2,10}$/.test(newName.trim())) {
      toast.error("닉네임은 특수문자 없이 한글, 영문, 숫자를 조합해 2~10자로 적어주세요.");
      return;
    }
    
    // In a real app, this would update the store/backend
    toast.success("프로필이 성공적으로 변경되었습니다.");
    setIsEditOpen(false);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast("로그아웃 되었습니다.");
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 pb-24">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink mb-8">마이페이지</h1>

      {/* Profile Section */}
      <Card className="border-border/50 shadow-sm rounded-2xl mb-8 overflow-hidden bg-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-border shadow-sm">
              <AvatarImage src={currentUser.profileUrl} />
              <AvatarFallback>{currentUser.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-ink">{currentUser.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">user123@example.com</p>
            </div>
            
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogTrigger render={
                <Button variant="outline" size="sm" className="rounded-full gap-2">
                  <Edit2 className="w-4 h-4" />
                  <span className="hidden sm:inline">프로필 수정</span>
                </Button>
              } />
              <DialogContent className="sm:max-w-md rounded-2xl bg-white">
                <DialogHeader>
                  <DialogTitle>프로필 수정</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveProfile} className="space-y-4 mt-4">
                  <div className="flex flex-col items-center gap-4 mb-6">
                    <Avatar className="h-24 w-24 border">
                      <AvatarImage src={currentUser.profileUrl} />
                      <AvatarFallback>{currentUser.name[0]}</AvatarFallback>
                    </Avatar>
                    <Button type="button" variant="outline" size="sm" className="rounded-full">
                      사진 변경
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">닉네임</label>
                    <Input 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="새 닉네임 입력"
                      className="rounded-lg h-12"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1 px-1">
                      * 한글, 영문, 숫자를 조합해 2자 이상 10자 이하로 적어주세요. (특수문자 불가)
                    </p>
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-lg text-base" disabled={!newName.trim()}>
                    저장하기
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Settings Section */}
      <h3 className="text-lg font-bold text-ink mb-4 px-1">설정</h3>
      <Card className="border-border/50 shadow-sm rounded-2xl mb-8 bg-white">
        <div className="flex flex-col divide-y divide-border/50">
          <div className="flex items-center justify-between p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-lg text-muted-foreground">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-ink">푸시 알림</p>
                <p className="text-xs text-muted-foreground">가족의 새로운 추억과 답장 알림을 받습니다.</p>
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
          
          <div className="flex items-center justify-between p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-lg text-muted-foreground">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-ink">마케팅 정보 수신</p>
                <p className="text-xs text-muted-foreground">이벤트 및 혜택 정보를 받습니다.</p>
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
      </Card>

      {/* Account Actions Section */}
      <h3 className="text-lg font-bold text-ink mb-4 px-1">계정 관리</h3>
      <Card className="border-border/50 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="flex flex-col divide-y divide-border/50">
          <button className="flex items-center justify-between p-4 sm:p-5 w-full hover:bg-secondary/50 transition-colors text-left">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-lg text-muted-foreground">
                <User className="w-5 h-5" />
              </div>
              <p className="font-medium text-ink">개인정보 처리방침</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          
          <button 
            onClick={handleLogout}
            className="flex items-center justify-between p-4 sm:p-5 w-full hover:bg-red-50 transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg text-red-600 group-hover:bg-red-200 transition-colors">
                <LogOut className="w-5 h-5" />
              </div>
              <p className="font-medium text-red-600">로그아웃</p>
            </div>
          </button>
        </div>
      </Card>
      
      <div className="mt-8 text-center">
        <button className="text-sm text-muted-foreground underline underline-offset-4 hover:text-ink transition-colors">
          회원 탈퇴하기
        </button>
      </div>
    </div>
  );
}
