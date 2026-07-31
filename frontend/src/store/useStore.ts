import { create } from 'zustand';

export type User = {
  id: string;
  name: string;
  profileUrl: string;
};

export type Message = {
  id: string;
  mediaId: string;
  senderId: string;
  senderName: string;
  senderProfile: string;
  type: 'text' | 'voice' | 'video';
  content: string; // text content or URL
  createdAt: string;
  isLocked: boolean; // For the mission
};

export type Media = {
  id: string;
  albumId: string;
  uploaderId: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  description: string;
  createdAt: string;
};

export type Album = {
  id: string;
  name: string;
  relationType: string;
  coverImage: string;
  createdAt: string;
  memberCount: number;
};

type MockState = {
  currentUser: User;
  albums: Album[];
  medias: Media[];
  messages: Message[];
  addAlbum: (album: Omit<Album, 'id' | 'createdAt' | 'memberCount'>) => Promise<Album | null>;
  addMedia: (media: Omit<Media, 'id' | 'createdAt'>) => Promise<Media | null>;
  addMessage: (message: Omit<Message, 'id' | 'createdAt' | 'isLocked'>) => Promise<void>;
  unlockMessage: (messageId: string) => Promise<void>;
  fetchAlbums: () => Promise<void>;
  fetchMedias: (albumId?: string) => Promise<void>;
  fetchMessages: (mediaId?: string) => Promise<void>;
  setCurrentUser: (user: User | null) => void;
};

// Initial Mock Data
const MOCK_USER: User = {
  id: 'u-1',
  name: '효녀딸내미',
  profileUrl: 'https://i.pravatar.cc/150?u=1',
};

const INITIAL_ALBUMS: Album[] = [
  {
    id: 'a-1',
    name: '엄빠 사랑해요 ❤️',
    relationType: '가족',
    coverImage: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=600&auto=format&fit=crop',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    memberCount: 3,
  },
  {
    id: 'a-2',
    name: '우리집 강쥐 초코 🐶',
    relationType: '반려동물',
    coverImage: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=600&auto=format&fit=crop',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    memberCount: 4,
  },
];

const INITIAL_MEDIAS: Media[] = [
  {
    id: 'm-1',
    albumId: 'a-1',
    uploaderId: 'u-1',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?q=80&w=600&auto=format&fit=crop',
    description: '주말에 본가 내려가서 먹은 엄마표 김치찌개 🍲',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: 'm-2',
    albumId: 'a-1',
    uploaderId: 'u-1',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1476610182048-b716b8518aae?q=80&w=600&auto=format&fit=crop',
    description: '오랜만에 아빠랑 등산 다녀옴 ⛰️',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  }
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    mediaId: 'm-1',
    senderId: 'u-2',
    senderName: '엄마',
    senderProfile: 'https://i.pravatar.cc/150?u=2',
    type: 'text',
    content: '우리 딸 다음엔 더 맛있는거 해줄게 사랑한다~',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString(),
    isLocked: false,
  },
  {
    id: 'msg-2',
    mediaId: 'm-2',
    senderId: 'u-3',
    senderName: '아빠',
    senderProfile: 'https://i.pravatar.cc/150?u=3',
    type: 'voice',
    content: '0:15', // mock duration
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    isLocked: false,
  }
];

export const useStore = create<MockState>((set, get) => ({
  currentUser: MOCK_USER, // Will be overridden by AuthProvider
  setCurrentUser: (user) => set({ currentUser: user || MOCK_USER }),
  albums: [],
  medias: [],
  messages: [],

  fetchAlbums: async () => {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const { data, error } = await supabase.from('albums').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      set({ albums: data.map(a => ({
        id: a.id,
        name: a.name,
        relationType: '가족', // simplified for MVP
        coverImage: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=600&auto=format&fit=crop',
        createdAt: a.created_at,
        memberCount: 1,
      }))});
    }
  },

  fetchMedias: async (albumId) => {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    let query = supabase.from('medias').select('*').order('created_at', { ascending: false });
    if (albumId) query = query.eq('album_id', albumId);
    
    const { data, error } = await query;
    if (!error && data) {
      set({ medias: data.map(m => ({
        id: m.id,
        albumId: m.album_id,
        uploaderId: m.uploader_id,
        type: m.type as 'image' | 'video',
        url: m.url,
        description: m.description || '',
        createdAt: m.created_at,
      }))});
    }
  },

  fetchMessages: async (mediaId) => {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    let query = supabase.from('messages').select('*, users(name, profile_url)').order('created_at', { ascending: true });
    if (mediaId) query = query.eq('media_id', mediaId);
    
    const { data, error } = await query;
    if (!error && data) {
      set({ messages: data.map((m: any) => ({
        id: m.id,
        mediaId: m.media_id,
        senderId: m.sender_id,
        senderName: m.users?.name || 'Unknown',
        senderProfile: m.users?.profile_url || '',
        type: m.type as 'text' | 'voice',
        content: m.content,
        createdAt: m.created_at,
        isLocked: m.is_locked,
      }))});
    }
  },

  addAlbum: async (album) => {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const currentUser = get().currentUser;
    const { data, error } = await supabase.from('albums').insert({
      name: album.name,
      created_by: currentUser.id,
      relationship_type: "none",
      cover_image: album.coverImage
    }).select().single();
    
    if (!error && data) {
      const newAlbum: Album = {
        id: data.id,
        name: data.name,
        relationType: "none",
        coverImage: data.cover_image || album.coverImage,
        createdAt: data.created_at,
        memberCount: 1,
      };
      set(state => ({ albums: [newAlbum, ...state.albums] }));
      return newAlbum;
    } else if (error) {
      console.error("Failed to add album:", error);
      return null;
    }
    return null;
  },

  addMedia: async (media) => {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const { data, error } = await supabase.from('medias').insert({
      album_id: media.albumId,
      uploader_id: media.uploaderId,
      type: media.type,
      url: media.url,
      description: media.description
    }).select().single();

    if (!error && data) {
      const newMedia: Media = {
        id: data.id,
        albumId: data.album_id,
        uploaderId: data.uploader_id,
        type: data.type as 'image' | 'video',
        url: data.url,
        description: data.description || '',
        createdAt: data.created_at,
      };
      set(state => ({ medias: [newMedia, ...state.medias] }));
      return newMedia;
    }
    return null;
  },

  addMessage: async (message) => {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const { data, error } = await supabase.from('messages').insert({
      media_id: message.mediaId,
      sender_id: message.senderId,
      type: message.type,
      content: message.content,
      is_locked: false
    }).select('*, users(name, profile_url)').single();

    if (!error && data) {
      const newMessage: Message = {
        id: data.id,
        mediaId: data.media_id,
        senderId: data.sender_id,
        senderName: data.users?.name || message.senderName,
        senderProfile: data.users?.profile_url || message.senderProfile,
        type: data.type as 'text' | 'voice',
        content: data.content,
        createdAt: data.created_at,
        isLocked: data.is_locked,
      };
      set(state => ({ messages: [...state.messages, newMessage] }));
    } else if (error) {
      console.error("addMessage Supabase Error:", error);
      throw error;
    }
  },

  unlockMessage: async (messageId) => {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    await supabase.from('messages').update({ is_locked: false }).eq('id', messageId);
    set(state => ({
      messages: state.messages.map(m => m.id === messageId ? { ...m, isLocked: false } : m)
    }));
  },
}));
