"use client";

import { useEffect, useState } from "react";
import { Search, Plus, X, Heart, CheckCircle2, Circle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

import { useStore, Message } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VoiceRecorderDialog } from "@/components/shared/VoiceRecorderDialog";
import { AlbumCardSkeleton } from "@/components/shared/LoadingSkeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function BoxPage() {
  const [isMounted, setIsMounted] = useState(false);
  const currentUser = useStore((state) => state.currentUser);
  const albums = useStore((state) => state.albums);
  const medias = useStore((state) => state.medias);
  const messages = useStore((state) => state.messages);
  const addMessage = useStore((state) => state.addMessage);
  const addAlbum = useStore((state) => state.addAlbum);
  const addMedia = useStore((state) => state.addMedia);
  const fetchMessages = useStore((state) => state.fetchMessages);

  const [isSendOpen, setIsSendOpen] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftTargets, setDraftTargets] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const myMedias = medias.filter(m => m.uploaderId === currentUser.id).map(m => m.id);
  const receivedMessages = messages.filter(m => myMedias.includes(m.mediaId));
  const sentMessages = messages.filter(m => m.senderId === currentUser.id);

  useEffect(() => {
    fetchMessages();
    setTimeout(() => setIsMounted(true), 0);
  }, [fetchMessages]);

  const availableTargets = [
    { id: "me", name: `${currentUser.name} (나)`, subtitle: "나에게 보내기", icon: "", type: "me" },
    { id: "random", name: "랜덤", subtitle: "가족 중 랜덤으로 마음 전하기", icon: "?", type: "random" },
    ...albums.map(a => ({ id: `album_all_${a.id}`, name: `${a.name} 전체`, subtitle: "가족방 전체에게 전하기", icon: a.coverImage, type: "album" }))
  ];

  const handleRemoveTarget = (id: string) => {
    setSelectedTargets(selectedTargets.filter(t => t !== id));
  };

  const openPicker = () => {
    setDraftTargets([...selectedTargets]);
    setSearchQuery("");
  };

  const toggleDraftTarget = (id: string) => {
    if (draftTargets.includes(id)) {
      setDraftTargets(draftTargets.filter(t => t !== id));
    } else {
      setDraftTargets([...draftTargets, id]);
    }
  };

  const confirmPicker = () => {
    setSelectedTargets(draftTargets);
    setIsPickerOpen(false);
  };

  const filteredTargets = availableTargets.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSendVoiceMessage = async (duration: number, audioBlob: Blob) => {
    if (selectedTargets.length === 0) {
      toast.error("받는 사람을 한 명 이상 선택해주세요.");
      return;
    }

    try {
      const supabase = createClient();
      const fileName = `${Math.random()}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(`audio/${fileName}`, audioBlob);
        
      if (uploadError) throw uploadError;

      setIsSendOpen(false);
      const targetNames = selectedTargets.map(id => {
        const target = availableTargets.find(t => t.id === id);
        return target ? target.name : "";
      }).filter(Boolean);

      const formattedDuration = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;

      // Create message for each target
      for (const targetId of selectedTargets) {
        let targetMediaId = ""; 
        
        if (targetId === "me") {
          let myMedia = medias.find(m => m.uploaderId === currentUser.id);
          if (!myMedia) {
             let myAlbum = albums.find(a => a.name === `${currentUser.name}의 사서함`);
             if (!myAlbum) {
               myAlbum = await addAlbum({
                 name: `${currentUser.name}의 사서함`,
                 relationType: "none",
                 coverImage: "/logo.png"
               }) || undefined;
             }
             if (myAlbum) {
               myMedia = await addMedia({
                 albumId: myAlbum.id,
                 uploaderId: currentUser.id,
                 type: "image",
                 url: "/logo.png",
                 description: "내 사서함"
               }) || undefined;
             }
          }
          if (!myMedia) {
            throw new Error("사서함을 생성할 수 없습니다.");
          }
          targetMediaId = myMedia.id;
        } else if (targetId.startsWith("album_all_")) {
          const albumId = targetId.replace("album_all_", "");
          let albumMedia = medias.find(m => m.albumId === albumId);
          if (!albumMedia) {
             albumMedia = await addMedia({
               albumId,
               uploaderId: currentUser.id,
               type: "image",
               url: "/logo.png",
               description: "앨범 사서함"
             }) || undefined;
          }
          if (!albumMedia) {
            throw new Error("앨범 사서함을 생성할 수 없습니다.");
          }
          targetMediaId = albumMedia.id;
        } else if (targetId === "random") {
          // 랜덤: 아무 미디어나 하나 골라서 메시지 전송
          const randomMedia = medias.length > 0 
            ? medias[Math.floor(Math.random() * medias.length)] 
            : null;
          if (randomMedia) {
            targetMediaId = randomMedia.id;
          } else {
            // 미디어가 없으면 나에게 보내기와 동일하게 처리
            let myAlbum = albums.find(a => a.name === `${currentUser.name}의 사서함`);
            if (!myAlbum) {
              myAlbum = await addAlbum({
                name: `${currentUser.name}의 사서함`,
                relationType: "none",
                coverImage: "/logo.png"
              }) || undefined;
            }
            if (myAlbum) {
              const newMedia = await addMedia({
                albumId: myAlbum.id,
                uploaderId: currentUser.id,
                type: "image",
                url: "/logo.png",
                description: "내 사서함"
              }) || undefined;
              if (newMedia) targetMediaId = newMedia.id;
            }
          }
        }

        if (targetMediaId) {
          await addMessage({
            mediaId: targetMediaId,
            senderId: currentUser.id,
            senderName: currentUser.name,
            senderProfile: currentUser.profileUrl,
            type: "voice",
            content: formattedDuration, 
          });
        }
      }
      
      toast.success(`${targetNames.join(", ")}에게 마음이 발송되었습니다!`);
      setSelectedTargets([]);
    } catch (error) {
      console.error(error);
      toast.error("업로드에 실패했습니다.");
    }
  };

  const renderMessageList = (msgList: Message[], emptyText: string) => {
    if (msgList.length === 0) {
      return (
        <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-primary/40 fill-primary/10" />
          </div>
          <p className="text-muted-foreground font-medium">{emptyText}</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {msgList.map(msg => (
          <div key={msg.id} className="bg-white rounded-[20px] p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-border/50">
                  <AvatarImage src={msg.senderProfile} />
                  <AvatarFallback>{msg.senderName[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-[15px] text-ink">{msg.senderName}</p>
                  <p className="text-xs text-muted-foreground font-medium">{formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: ko })}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-[#f2f4f6] rounded-[18px] p-4">
              {msg.isLocked ? (
                <div className="flex items-center gap-2 text-ink/60 select-none py-1">
                  <Heart className="w-4 h-4" />
                  <span className="font-medium text-[15px]">마음을 보내면 열어볼 수 있어요.</span>
                </div>
              ) : msg.type === "voice" ? (
                <div className="flex items-center gap-2 text-primary font-bold bg-primary/10 p-3 rounded-xl">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                  음성 메시지 ({msg.content})
                </div>
              ) : (
                <p className="text-ink leading-relaxed font-medium text-[15px]">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isMounted) {
    return (
      <div className="min-h-[100dvh] bg-[#f2f4f6]">
        <div className="max-w-md mx-auto pt-8 px-5 pb-32">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-8">감정 사서함</h1>
          <div className="space-y-4">
            <AlbumCardSkeleton />
            <AlbumCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f2f4f6]">
      <div className="max-w-md mx-auto min-h-full flex flex-col relative pt-8 px-5 pb-32">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-[18px] shadow-sm">
              <Heart className="w-6 h-6 text-primary fill-primary/20" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">감정 사서함</h1>
          </div>

          <VoiceRecorderDialog
            open={isSendOpen}
            onOpenChange={setIsSendOpen}
            onSend={handleSendVoiceMessage}
            title="새로운 마음 보내기"
            trigger={
              <Button className="rounded-2xl shadow-sm hover:shadow-md transition-shadow h-11 px-4 font-bold text-[15px]">
                <Send className="w-4 h-4 mr-1.5" />
                마음 보내기
              </Button>
            }
            customContent={
              <div className="space-y-3 pb-4">
                <label className="text-[15px] font-bold text-ink mb-2 block ml-1">누구에게 보낼까요?</label>
                <div className="flex items-start gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                    <DialogTrigger onClick={openPicker} className="flex flex-col items-center gap-2 group shrink-0 outline-none">
                      <div className="w-[60px] h-[60px] rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center group-hover:border-primary group-hover:bg-primary/5 transition-colors">
                        <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <span className="text-[12px] text-transparent group-hover:text-muted-foreground font-medium select-none">추가</span>
                    </DialogTrigger>
                    <DialogContent className="!fixed !bottom-0 !top-auto !translate-y-0 !translate-x-[-50%] sm:max-w-md w-full h-[85dvh] p-0 flex flex-col bg-white !rounded-t-[32px] !rounded-b-none border-none shadow-[0_-4px_24px_rgba(0,0,0,0.08)] !duration-300 data-[state=open]:!animate-in data-[state=closed]:!animate-out data-[state=closed]:!fade-out-0 data-[state=open]:!fade-in-0 data-[state=closed]:!slide-out-to-bottom-full data-[state=open]:!slide-in-from-bottom-full overflow-hidden">
                      <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-6 mb-2 opacity-40 shrink-0"></div>
                      <div className="flex items-center justify-between px-6 py-2 shrink-0">
                        <h2 className="font-extrabold text-[22px] text-ink tracking-tight">받는 사람 추가</h2>
                        <button onClick={confirmPicker} className="text-primary font-bold text-[16px] px-2 py-1">
                          {draftTargets.length > 0 ? `${draftTargets.length} ` : ""}확인
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto mt-2">
                        <div className="px-6 py-4">
                          {draftTargets.length === 0 ? (
                            <p className="text-[15px] text-muted-foreground font-medium text-center py-4 bg-secondary/30 rounded-2xl">선택된 대화상대가 없어요.</p>
                          ) : (
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                              {draftTargets.map(id => {
                                const t = availableTargets.find(a => a.id === id);
                                if (!t) return null;
                                return (
                                  <div key={id} className="flex flex-col items-center gap-2 relative shrink-0">
                                    <div className="w-[56px] h-[56px] rounded-[18px] overflow-hidden bg-[#ff4a6b] shadow-sm flex items-center justify-center relative">
                                      {t.type === 'album' ? (
                                        <img src={t.icon} alt={t.name} className="w-full h-full object-cover" />
                                      ) : t.type === 'random' ? (
                                        <span className="text-white text-2xl font-bold">?</span>
                                      ) : (
                                        <span className="text-white text-lg font-bold">나</span>
                                      )}
                                    </div>
                                    <button 
                                      onClick={() => toggleDraftTarget(id)}
                                      className="absolute -top-1 -right-1 bg-ink text-white rounded-full p-1 shadow-md transition-colors z-10"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                    <span className="text-[11px] text-ink font-bold max-w-[64px] truncate text-center">
                                      {t.name}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="px-6 pb-6">
                          <div className="relative mb-6">
                            <Input 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="이름이나 초성으로 검색"
                              className="h-14 rounded-2xl pl-4 pr-12 bg-secondary/50 border-transparent focus-visible:border-primary/30 focus-visible:ring-4 focus-visible:ring-primary/10 text-[16px] font-medium transition-all"
                            />
                            <Search className="absolute right-4 top-4 w-5 h-5 text-muted-foreground" />
                          </div>

                          <h3 className="font-bold text-[14px] text-ink/70 mb-3 px-1">추천</h3>
                          <div className="flex flex-col gap-1">
                            {filteredTargets.map(target => {
                              const isSelected = draftTargets.includes(target.id);
                              return (
                                <div 
                                  key={target.id}
                                  onClick={() => toggleDraftTarget(target.id)}
                                  className="flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary/60 cursor-pointer transition-colors"
                                >
                                  <div className="w-[52px] h-[52px] rounded-[16px] overflow-hidden bg-[#ff4a6b] shrink-0 flex items-center justify-center text-white shadow-sm">
                                    {target.type === 'album' ? (
                                      <img src={target.icon || "/logo.png"} alt={target.name} className="w-full h-full object-cover" />
                                    ) : target.type === 'random' ? (
                                      <span className="text-2xl font-bold">?</span>
                                    ) : (
                                      <Heart className="w-6 h-6 fill-white" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-ink text-[16px] truncate">{target.name}</p>
                                    <p className="text-[13px] text-muted-foreground font-medium mt-0.5 truncate">{target.subtitle}</p>
                                  </div>
                                  <div className="shrink-0">
                                    {isSelected ? (
                                      <CheckCircle2 className="w-[26px] h-[26px] text-primary fill-primary/10" />
                                    ) : (
                                      <Circle className="w-[26px] h-[26px] text-muted-foreground/30" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {selectedTargets.map(targetId => {
                    const targetInfo = availableTargets.find(t => t.id === targetId);
                    if (!targetInfo) return null;

                    return (
                      <div key={targetId} className="flex flex-col items-center gap-2 relative shrink-0">
                        <div className="w-[60px] h-[60px] rounded-[20px] overflow-hidden bg-[#ff4a6b] shadow-[0_4px_12px_rgba(255,74,107,0.2)] flex items-center justify-center relative">
                          {targetInfo.type === 'album' ? (
                            <img src={targetInfo.icon} alt={targetInfo.name} className="w-full h-full object-cover" />
                          ) : targetInfo.type === 'random' ? (
                            <span className="text-white text-3xl font-bold">?</span>
                          ) : (
                            <span className="text-white text-xl font-bold">나</span>
                          )}
                        </div>
                        <button 
                          onClick={() => handleRemoveTarget(targetId)}
                          className="absolute -top-1 -right-1 bg-ink text-white rounded-full p-1 shadow-md transition-colors z-10"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[12px] text-ink font-bold max-w-[68px] truncate text-center">
                          {targetInfo.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            }
          />
        </div>

        <Tabs defaultValue="received" className="w-full mt-4">
          <TabsList className="w-full grid grid-cols-2 mb-6 h-14 rounded-[20px] bg-secondary/50 p-1.5">
            <TabsTrigger value="received" className="rounded-[14px] font-bold text-[16px] data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm transition-all text-muted-foreground">
              받은 마음 
              <span className="ml-1.5 text-[11px] bg-secondary data-[state=active]:bg-primary/10 px-2 py-0.5 rounded-full data-[state=active]:text-primary font-bold">{receivedMessages.length}</span>
            </TabsTrigger>
            <TabsTrigger value="sent" className="rounded-[14px] font-bold text-[16px] data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm transition-all text-muted-foreground">
              보낸 마음 
              <span className="ml-1.5 text-[11px] bg-secondary data-[state=active]:bg-primary/10 px-2 py-0.5 rounded-full data-[state=active]:text-primary font-bold">{sentMessages.length}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="received" className="mt-0 outline-none">
            {renderMessageList(receivedMessages, "아직 받은 마음이 없어요")}
          </TabsContent>
          <TabsContent value="sent" className="mt-0 outline-none">
            {renderMessageList(sentMessages, "아직 보낸 마음이 없어요")}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
