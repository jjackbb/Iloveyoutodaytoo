import Link from 'next/link';
import { Home, Inbox, User } from 'lucide-react';

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background hidden md:flex">
      <div className="flex h-16 items-center px-6 border-b">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <img src="/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
          </div>
          <span className="font-bold text-lg text-ink tracking-tight">오늘도 사랑해</span>
        </Link>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        <Link href="/" className="flex items-center gap-3 px-3 py-3 text-foreground hover:bg-secondary rounded-md font-medium transition-colors">
          <Home className="w-5 h-5 text-muted-foreground" />
          홈
        </Link>
        <Link href="/box" className="flex items-center gap-3 px-3 py-3 text-foreground hover:bg-secondary rounded-md font-medium transition-colors">
          <Inbox className="w-5 h-5 text-muted-foreground" />
          감정 사서함
        </Link>
        <Link href="/mypage" className="flex items-center gap-3 px-3 py-3 text-foreground hover:bg-secondary rounded-md font-medium transition-colors">
          <User className="w-5 h-5 text-muted-foreground" />
          마이페이지
        </Link>
      </nav>
    </aside>
  );
}
