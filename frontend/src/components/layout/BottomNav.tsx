import Link from 'next/link';
import { Home, Inbox, User } from 'lucide-react';

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background md:hidden pb-safe">
      <Link href="/" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
        <Home className="w-6 h-6" />
        <span className="text-[10px] font-medium">홈</span>
      </Link>
      <Link href="/box" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
        <Inbox className="w-6 h-6" />
        <span className="text-[10px] font-medium">사서함</span>
      </Link>
      <Link href="/mypage" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
        <User className="w-6 h-6" />
        <span className="text-[10px] font-medium">마이페이지</span>
      </Link>
    </nav>
  );
}
