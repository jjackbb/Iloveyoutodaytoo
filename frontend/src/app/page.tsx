"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Users, Image as ImageIcon, Camera } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

import { useStore } from "@/store/useStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { AlbumCardSkeleton } from "@/components/shared/LoadingSkeleton";
import { ImageCropperDialog } from "@/components/shared/ImageCropperDialog";

export default function Home() {
  const albums = useStore((state) => state.albums);
  const addAlbum = useStore((state) => state.addAlbum);
  const isInitialized = useStore((state) => state.isInitialized);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [coverImage, setCoverImage] = useState("/logo.png");
  const [isUploading, setIsUploading] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [uploadedCovers, setUploadedCovers] = useState<string[]>([]);

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumName.trim()) return;
    
    await addAlbum({
      name: newAlbumName,
      relationType: "none",
      coverImage: coverImage,
    });
    setNewAlbumName("");
    setCoverImage("/logo.png");
    setIsCreateOpen(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setCropImageSrc(reader.result?.toString() || null);
      setIsCropperOpen(true);
    });
    reader.readAsDataURL(file);
    e.target.value = ""; // reset input
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsCropperOpen(false);
    setIsUploading(true);
    try {
      const supabase = createClient();
      const fileName = `${Math.random()}.jpg`;
      const filePath = `album_covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, croppedBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      setCoverImage(publicUrlData.publicUrl);
      setUploadedCovers(prev => {
        const newCovers = [publicUrlData.publicUrl, ...prev.filter(c => c !== publicUrlData.publicUrl)];
        return newCovers.slice(0, 10);
      });
      toast.success("사진이 적용되었습니다.");
    } catch (error) {
      console.error("Error uploading cropped image:", error);
      toast.error("사진 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
      setCropImageSrc(null);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-[100dvh] bg-[#f2f4f6]">
        <div className="max-w-md mx-auto pt-8 px-5 pb-32">
          <h1 className="text-2xl font-extrabold mb-6 text-ink tracking-tight">내 앨범방</h1>
          <div className="flex flex-col gap-4">
            {[...Array(4)].map((_, i) => <AlbumCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f2f4f6]">
      <div className="max-w-md mx-auto min-h-full flex flex-col relative pt-8 px-5 pb-32">
        <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-6">내 앨범방</h1>
        
        {albums.length === 0 ? (
          <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-center flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-primary/40" />
            </div>
            <h3 className="font-bold text-ink text-lg mb-2">아직 만들어진 앨범방이 없어요</h3>
            <p className="text-sm text-muted-foreground">가족, 친구와 함께 추억을 나눌<br/>공간을 만들어보세요.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {albums.map((album) => (
              <Link key={album.id} href={`/albums/${album.id}`}>
                <Card className="overflow-hidden cursor-pointer group hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 border-none bg-white rounded-[20px] p-4 flex gap-4 items-center">
                  <div className="relative w-20 h-20 shrink-0 overflow-hidden rounded-[14px] bg-secondary">
                    <img 
                      src={album.coverImage} 
                      alt={album.name} 
                      className={`w-full h-full ${album.coverImage === '/logo.png' ? 'object-contain p-2' : 'object-cover'} group-hover:scale-105 transition-transform duration-500 ease-out`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[17px] text-ink truncate tracking-tight mb-1">{album.name}</h3>
                    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground font-medium">
                      <Users className="w-3.5 h-3.5" />
                      <span>{album.memberCount}명 참여중</span>
                      <span className="text-muted-foreground/30 px-1">•</span>
                      <span>{formatDistanceToNow(new Date(album.createdAt), { addSuffix: true, locale: ko })}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Fixed bottom CTA (Bottom Sheet style dialog trigger) */}
      <div className="fixed bottom-0 left-0 right-0 z-10 pointer-events-none">
        <div className="max-w-md mx-auto px-5 pb-8 pt-10 bg-gradient-to-t from-[#f2f4f6] via-[#f2f4f6] to-transparent pointer-events-auto">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger render={
              <Button className="w-full h-14 rounded-2xl text-[17px] font-bold shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.15)] transition-all">
                <Plus className="w-5 h-5 mr-1.5" />
                새 앨범방 만들기
              </Button>
            } />
            <DialogContent className="!fixed !bottom-0 !top-auto !translate-y-0 !translate-x-[-50%] sm:max-w-md w-full !rounded-t-[32px] !rounded-b-none bg-white p-6 pb-10 border-none shadow-[0_-4px_24px_rgba(0,0,0,0.08)] !duration-300 data-[state=open]:!animate-in data-[state=closed]:!animate-out data-[state=closed]:!fade-out-0 data-[state=open]:!fade-in-0 data-[state=closed]:!slide-out-to-bottom-full data-[state=open]:!slide-in-from-bottom-full">
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6 opacity-40"></div>
              <DialogHeader className="space-y-2 mb-6 text-left min-w-0">
                <DialogTitle className="text-[24px] font-extrabold tracking-tight text-ink truncate">가족들과 함께할<br/>공간을 만들어볼까요?</DialogTitle>
                <p className="text-[15px] text-muted-foreground font-medium truncate mt-1">우리만의 추억 공간에 이름을 붙여주세요.</p>
              </DialogHeader>
              <form onSubmit={handleCreateAlbum} className="space-y-6 min-w-0 w-full">
                <div className="space-y-3 min-w-0">
                  <label htmlFor="name" className="text-[15px] font-bold text-ink ml-1">앨범방 이름</label>
                  <Input 
                    id="name" 
                    value={newAlbumName}
                    onChange={(e) => setNewAlbumName(e.target.value)}
                    placeholder="예: 우리 가족 행복방" 
                    className="w-full shrink-0 rounded-2xl h-14 bg-secondary/50 border-transparent focus-visible:border-primary/30 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-primary/10 text-[16px] px-4 font-medium transition-all"
                  />
                </div>
                
                <div className="space-y-3 min-w-0">
                  <label className="text-[15px] font-bold text-ink ml-1">커버 사진</label>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide items-center w-full min-w-0">
                    {['/logo.png', ...uploadedCovers].map((presetUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCoverImage(presetUrl)}
                        className={`w-20 h-20 shrink-0 rounded-[18px] overflow-hidden relative transition-all border-[3px] ${
                          coverImage === presetUrl ? "border-primary p-0.5 shadow-sm" : "border-transparent"
                        }`}
                      >
                        <div className="w-full h-full rounded-[14px] overflow-hidden bg-secondary">
                          <img src={presetUrl} alt={`Cover ${idx}`} className={`w-full h-full ${presetUrl === '/logo.png' ? 'object-contain p-2' : 'object-cover'}`} />
                        </div>
                        
                        {isUploading && coverImage === presetUrl && presetUrl !== '/logo.png' && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-[14px] m-0.5 backdrop-blur-[2px]">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </button>
                    ))}

                    <label className="w-[4.5rem] h-[4.5rem] shrink-0 rounded-[18px] bg-secondary/50 border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors gap-1 ml-1 group">
                      <Camera className="w-5 h-5 text-muted-foreground group-hover:text-ink transition-colors" />
                      <span className="text-[10px] font-bold text-muted-foreground group-hover:text-ink tracking-tight">직접<br/>올리기</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="hidden" 
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                </div>

                <Button type="submit" className="w-full h-14 rounded-2xl text-[17px] font-bold shadow-sm mt-4" disabled={!newAlbumName.trim() || isUploading}>
                  앨범방 만들기
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {cropImageSrc && (
            <ImageCropperDialog
              isOpen={isCropperOpen}
              onClose={() => {
                setIsCropperOpen(false);
                setCropImageSrc(null);
              }}
              imageSrc={cropImageSrc}
              onCropComplete={handleCropComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
