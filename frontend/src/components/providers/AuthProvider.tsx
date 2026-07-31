"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/store/useStore";
import { Heart } from "lucide-react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const [isLoading, setIsLoading] = useState(true);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  // Lazily create supabase client only on the client side
  function getSupabase() {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  }

  useEffect(() => {
    const supabase = getSupabase();

    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (!session) {
          if (pathname !== "/login" && !pathname.startsWith("/invite")) {
            router.push("/login");
          } else {
            setIsLoading(false);
          }
          return;
        }

        // Fetch user profile from public.users
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (userError) {
          throw userError;
        }

        if (userData) {
          setCurrentUser({
            id: userData.id,
            name: userData.nickname || userData.name || session.user.email?.split("@")[0] || "User",
            profileUrl: userData.profile_image || userData.profile_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.id}`,
          });
        } else {
          setCurrentUser({
            id: session.user.id,
            name: session.user.email?.split("@")[0] || "User",
            profileUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`,
          });
        }

        if (pathname === "/login") {
          router.push("/");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        if (pathname !== "/login" && !pathname.startsWith("/invite")) {
          router.push("/login");
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setCurrentUser(null);
        if (pathname !== "/login" && !pathname.startsWith("/invite")) {
          router.push("/login");
        }
      } else if (event === "SIGNED_IN" && session) {
        checkAuth();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router, setCurrentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <Heart className="w-12 h-12 fill-primary text-primary mb-4 animate-bounce" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
