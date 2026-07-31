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

const MOCK_USER: User = {
  id: 'u-1',
  name: '효녀딸내미',
  profileUrl: 'https://i.pravatar.cc/150?u=1',
};

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
        relationType: a.relationship_type || '가족',
        coverImage: a.cover_image || '/logo.png',
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set({ messages: data.map((m: Record<string, any>) => ({
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
