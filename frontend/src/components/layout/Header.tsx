import Link from 'next/link';
import { Menu } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="container flex h-16 items-center px-4 justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <img src="/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
          </div>
          <span className="font-bold text-lg text-ink tracking-tight hidden sm:inline-block">오늘도 사랑해</span>
        </Link>
        <button className="p-2 text-foreground">
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}
