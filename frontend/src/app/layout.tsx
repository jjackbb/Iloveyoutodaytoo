import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/providers/AuthProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "오늘도 사랑해 - 감정 사서함",
  description: "쑥스러운 마음을 추억으로 전하는 곳, 우리 가족 비밀 감정 사서함",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${inter.variable} antialiased h-full`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <Sidebar />
          <div className="flex flex-col flex-1 md:pl-64">
            <Header />
            <main className="flex-1 pb-16 md:pb-0">{children}</main>
            <BottomNav />
          </div>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
