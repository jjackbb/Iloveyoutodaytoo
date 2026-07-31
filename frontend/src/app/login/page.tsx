"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const validateNickname = (nickname: string) => {
    return /^[a-zA-Z0-9가-힣]{2,10}$/.test(nickname);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    if (!isLoginMode) {
      if (!name) return;
      if (!validateNickname(name)) {
        toast.error("닉네임은 특수문자 없이 한글, 영문, 숫자를 조합해 2~10자로 적어주세요.");
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isLoginMode) {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        
        toast.success("로그인 성공!");
        router.push("/");
      } else {
        // Sign up
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
            }
          }
        });

        if (authError) throw authError;

        // Create user record in public.users table
        if (authData.user) {
          const { error: dbError } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              nickname: name,
              email: authData.user.email,
              profile_image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${authData.user.id}`
            });
            
          if (dbError) {
            console.error("Error creating user profile:", dbError);
            // Ignore error for now, as RLS might block it or we can handle it via trigger
          }
        }

        toast.success("회원가입 완료! 로그인 되었습니다.");
        router.push("/");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "오류가 발생했습니다.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md z-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2 shadow-sm">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">오늘도 사랑해</h1>
          <p className="text-muted-foreground text-sm">
            우리가족 비밀 감정 사서함에 오신 것을 환영합니다.
          </p>
        </div>

        <Card className="border-none shadow-lg rounded-2xl overflow-hidden bg-white/80 backdrop-blur-md">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {!isLoginMode && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink">이름 (닉네임)</label>
                  <Input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1 px-1">
                    * 한글, 영문, 숫자를 조합해 2자 이상 10자 이하로 적어주세요. (특수문자 불가)
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">이메일</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                  <Input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일 주소"
                    className="h-12 rounded-xl pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                  <Input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 (6자리 이상)"
                    className="h-12 rounded-xl pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 rounded-xl text-base font-bold mt-2" 
                disabled={isLoading || !email || !password || (!isLoginMode && !name)}
              >
                {isLoading ? "처리 중..." : isLoginMode ? "로그인" : "회원가입"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">
                {isLoginMode ? "아직 계정이 없으신가요?" : "이미 계정이 있으신가요?"}
              </span>
              <button 
                type="button"
                onClick={() => setIsLoginMode(!isLoginMode)}
                className="ml-2 font-bold text-primary hover:underline"
              >
                {isLoginMode ? "회원가입" : "로그인"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
