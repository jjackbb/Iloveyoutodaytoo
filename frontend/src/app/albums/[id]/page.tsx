"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Camera, Heart, MessageSquare, Send, UserPlus, FileImage, Lock, Mic, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

import { useStore, Media } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { FeedCardSkeleton } from "@/components/shared/LoadingSkeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VoiceRecorderDialog } from "@/components/shared/VoiceRecorderDialog";

export default function AlbumFeed() {
  const { id } = useParams<{ id: string }>();
  const [isMounted, setIsMounted] = useState(false);
  
  const currentUser = useStore((state) => state.currentUser);
  const albums = useStore((state) => state.albums);
  const album = useStore((state) => state.albums.find(a => a.id === id));
  const medias = useStore((state) => state.medias.filter(m => m.albumId === id));
  const messages = useStore((state) => state.messages);
  const addMedia = useStore((state) => state.addMedia);
  const fetchMedias = useStore((state) => state.fetchMedias);
  const fetchMessages = useStore((state) => state.fetchMessages);
  const addMessage = useStore((state) => state.addMessage);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  
  const [recordingMediaId, setRecordingMediaId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchMedias(id as string);
    fetchMessages();
    setTimeout(() => setIsMounted(true), 0);
  }, [id, fetchMedias, fetchMessages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("사진을 선택해주세요.");
      return;
    }

    try {
      setIsUploading(true);
      const supabase = createClient();
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `albums_media/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      await addMedia({
        albumId: id,
        uploaderId: currentUser.id,
        type: "image",
        url: publicUrl,
        description: newDesc || "새로운 추억을 남겼습니다.",
      });
      setNewDesc("");
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsUploadOpen(false);
      toast.success("사진이 성공적으로 업로드되었습니다.");
    } catch (error) {
      toast.error("업로드에 실패했습니다.");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendTextReply = (mediaId: string) => {
    if (!replyText[mediaId]?.trim()) return;
    
    addMessage({
      mediaId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderProfile: currentUser.profileUrl,
      type: "text",
      content: replyText[mediaId],
    });
    setReplyText((prev) => ({ ...prev, [mediaId]: "" }));
  };

  const handleSendVoiceReply = async (duration: number, audioBlob: Blob) => {
    if (!recordingMediaId) return;
    
    try {
      const supabase = createClient();
      const fileName = `${Math.random()}.webm`;
      const filePath = `audio/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, audioBlob);
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      const formattedDuration = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;
      addMessage({
        mediaId: recordingMediaId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderProfile: currentUser.profileUrl,
        type: "voice",
        content: formattedDuration,
      });
      
      setRecordingMediaId(null);
      toast.success("음성 답장이 등록되었습니다.");
    } catch (error) {
      console.error(error);
      toast.error("업로드에 실패했습니다.");
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-[100dvh] bg-[#f2f4f6]">
        <div className="max-w-md mx-auto pt-8 px-5 pb-32 space-y-6">
          <FeedCardSkeleton />
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-[100dvh] bg-[#f2f4f6] flex items-center justify-center">
        <EmptyState icon={FileImage} title="앨범을 찾을 수 없습니다." />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f2f4f6]">
      <div className="max-w-md mx-auto min-h-full flex flex-col relative pt-4 pb-32">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#f2f4f6]/90 backdrop-blur-md z-30 py-4 px-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm hover:shadow-md transition-shadow shrink-0">
              <ArrowLeft className="w-5 h-5 text-ink" />
            </Link>
            <h1 className="text-[22px] font-extrabold tracking-tight text-ink truncate">{album.name}</h1>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-full shadow-sm bg-white hover:bg-white/90 border-transparent text-ink font-bold h-10 px-4">
              <UserPlus className="w-4 h-4 mr-1.5" />
              초대
            </Button>
          </div>
        </div>

        <VoiceRecorderDialog 
          open={!!recordingMediaId} 
          onOpenChange={(open) => !open && setRecordingMediaId(null)} 
          onSend={handleSendVoiceReply}
          title="음성 답글 남기기"
          description="가족의 추억에 따뜻한 목소리를 더해보세요."
        />

        {/* Feed List */}
        <div className="space-y-6 px-5">
          {medias.length === 0 ? (
            <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Camera className="w-8 h-8 text-primary/40" />
              </div>
              <h3 className="font-bold text-ink text-lg mb-2">아직 올라온 추억이 없어요</h3>
              <p className="text-sm text-muted-foreground">첫 번째 사진을 올려 가족들에게<br/>일상을 공유해보세요.</p>
            </div>
          ) : (
            medias.map((media) => {
              const mediaMessages = messages.filter(m => m.mediaId === media.id);
              return (
                <Card key={media.id} className="overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.06)] rounded-[20px] bg-white border-none">
                  <div className="p-4 flex items-center gap-3">
                    <Avatar className="h-11 w-11 border border-border/50">
                      <AvatarImage src={`https://i.pravatar.cc/150?u=${media.uploaderId}`} />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[15px] font-bold text-ink">
                        {media.uploaderId === currentUser.id ? currentUser.name : "가족 구성원"}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {formatDistanceToNow(new Date(media.createdAt), { addSuffix: true, locale: ko })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="relative aspect-square w-full bg-secondary">
                    <img src={media.url} alt="추억" className="object-cover w-full h-full" />
                  </div>
                  
                  <CardContent className="p-5 space-y-4">
                    <p className="text-[15px] text-ink leading-relaxed font-medium">{media.description}</p>
                    
                    {/* Messages Section */}
                    {mediaMessages.length > 0 && (
                      <div className="pt-5 border-t border-secondary space-y-4">
                        {mediaMessages.map(msg => (
                          <div key={msg.id} className="flex gap-3 data-[unlocked=true]:animate-in data-[unlocked=true]:fade-in data-[unlocked=true]:slide-in-from-bottom-2" data-unlocked={!msg.isLocked}>
                            <Avatar className="h-9 w-9 border border-border/50 mt-1">
                              <AvatarImage src={msg.senderProfile} />
                              <AvatarFallback>{msg.senderName[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 bg-[#f2f4f6] rounded-[18px] rounded-tl-none p-3.5 text-sm">
                              <p className="font-bold mb-1 text-ink">{msg.senderName}</p>
                              {msg.isLocked ? (
                                <div className="flex items-center gap-2 text-muted-foreground blur-[2px] select-none py-1">
                                  <Lock className="w-4 h-4 text-ink/40" />
                                  <span className="font-medium text-ink/60">답장 후 확인할 수 있어요.</span>
                                </div>
                              ) : msg.type === "voice" ? (
                                <div className="flex items-center gap-2 text-primary font-bold bg-primary/10 p-2.5 rounded-xl mt-1">
                                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                                  음성 메시지 ({msg.content})
                                </div>
                              ) : (
                                <p className="text-ink leading-relaxed font-medium">{msg.content}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  
                  <CardFooter className="p-4 pt-0">
                    <div className="flex w-full items-center gap-2">
                      <Button 
                        size="icon" 
                        variant="secondary"
                        className="rounded-full shrink-0 h-11 w-11 text-muted-foreground hover:text-ink transition-colors bg-[#f2f4f6] hover:bg-[#e5e8eb]" 
                        onClick={() => setRecordingMediaId(media.id)}
                      >
                        <Mic className="w-[18px] h-[18px]" />
                      </Button>
                      <Input 
                        placeholder="가족에게 마음을 표현해보세요..." 
                        className="rounded-full bg-[#f2f4f6] border-none h-11 px-4 text-[15px] focus-visible:ring-0 focus-visible:bg-[#e5e8eb] transition-colors"
                        value={replyText[media.id] || ""}
                        onChange={(e) => setReplyText(prev => ({ ...prev, [media.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendTextReply(media.id)}
                      />
                      <Button 
                        size="icon" 
                        className="rounded-full shrink-0 h-11 w-11 shadow-sm" 
                        onClick={() => handleSendTextReply(media.id)}
                        disabled={!replyText[media.id]?.trim()}
                      >
                        <Send className="w-4 h-4 ml-0.5" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })
          )}
        </div>

        {/* Fixed bottom CTA for Upload */}
        <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
          <div className="max-w-md mx-auto px-5 pb-8 pt-10 bg-gradient-to-t from-[#f2f4f6] via-[#f2f4f6] to-transparent pointer-events-auto flex justify-end">
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger render={
                <Button className="h-14 rounded-full text-[16px] font-bold shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)] transition-all px-6 gap-2">
                  <Camera className="w-5 h-5" />
                  추억 올리기
                </Button>
              } />
              <DialogContent className="!fixed !bottom-0 !top-auto !translate-y-0 !translate-x-[-50%] sm:max-w-md w-full !rounded-t-[32px] !rounded-b-none bg-white p-6 pb-10 border-none shadow-[0_-4px_24px_rgba(0,0,0,0.08)] !duration-300 data-[state=open]:!animate-in data-[state=closed]:!animate-out data-[state=closed]:!fade-out-0 data-[state=open]:!fade-in-0 data-[state=closed]:!slide-out-to-bottom-full data-[state=open]:!slide-in-from-bottom-full">
                <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6 opacity-40"></div>
                <DialogHeader className="mb-6 text-left">
                  <DialogTitle className="text-[22px] font-extrabold tracking-tight text-ink">새로운 추억 올리기</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpload} className="space-y-5">
                  <label className="aspect-video w-full rounded-[20px] bg-secondary/50 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:bg-secondary transition relative overflow-hidden group">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Camera className="w-8 h-8 mb-2 text-muted-foreground group-hover:text-ink transition-colors" />
                        <span className="text-[15px] font-bold tracking-tight group-hover:text-ink transition-colors">사진이나 영상 선택하기</span>
                      </>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" disabled={isUploading} />
                  </label>
                  <div className="space-y-2">
                    <label className="text-[14px] font-bold text-ink ml-1">어떤 추억인가요?</label>
                    <Input 
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="가족들과 나눌 이야기를 적어주세요" 
                      className="rounded-2xl h-14 bg-secondary/50 border-transparent focus-visible:border-primary/30 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-primary/10 text-[16px] px-4 font-medium transition-all"
                      disabled={isUploading}
                    />
                  </div>
                  <Button type="submit" className="w-full h-14 rounded-2xl text-[17px] font-bold shadow-sm mt-2" disabled={isUploading || !selectedFile}>
                    {isUploading ? "업로드 중..." : "업로드"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
