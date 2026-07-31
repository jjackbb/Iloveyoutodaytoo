import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────

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
  content: string;
  createdAt: string;
  isLocked: boolean;
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

// ─── DB → Local Mapping Helpers ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbAlbum(a: Record<string, any>): Album {
  return {
    id: a.id,
    name: a.name,
    relationType: a.relationship_type || '가족',
    coverImage: a.cover_image || '/logo.png',
    createdAt: a.created_at,
    memberCount: 1,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbMedia(m: Record<string, any>): Media {
  return {
    id: m.id,
    albumId: m.album_id,
    uploaderId: m.uploader_id,
    type: m.type as 'image' | 'video',
    url: m.url,
    description: m.description || '',
    createdAt: m.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbMessage(m: Record<string, any>): Message {
  return {
    id: m.id,
    mediaId: m.media_id,
    senderId: m.sender_id,
    senderName: m.users?.name || m.sender_name || 'Unknown',
    senderProfile: m.users?.profile_url || m.sender_profile || '',
    type: m.type as 'text' | 'voice',
    content: m.content,
    createdAt: m.created_at,
    isLocked: m.is_locked,
  };
}

// ─── Supabase Singleton ──────────────────────────────────

let _supabase: ReturnType<typeof import('@/lib/supabase/client').createClient> | null = null;

async function getSupabase() {
  if (!_supabase) {
    const { createClient } = await import('@/lib/supabase/client');
    _supabase = createClient();
  }
  return _supabase;
}

// ─── Store ───────────────────────────────────────────────

type AppState = {
  // Data
  currentUser: User;
  albums: Album[];
  medias: Media[];
  messages: Message[];
  isInitialized: boolean;

  // Actions
  setCurrentUser: (user: User | null) => void;
  fetchAlbums: () => Promise<void>;
  fetchMedias: (albumId?: string) => Promise<void>;
  fetchMessages: (mediaId?: string) => Promise<void>;
  addAlbum: (album: Omit<Album, 'id' | 'createdAt' | 'memberCount'>) => Promise<Album | null>;
  addMedia: (media: Omit<Media, 'id' | 'createdAt'>) => Promise<Media | null>;
  addMessage: (message: Omit<Message, 'id' | 'createdAt' | 'isLocked'>) => Promise<void>;
  unlockMessage: (messageId: string) => Promise<void>;

  // Realtime
  realtimeChannel: RealtimeChannel | null;
  subscribeToRealtime: () => Promise<void>;
  unsubscribeFromRealtime: () => void;

  // Init
  initializeData: () => Promise<void>;
};

const DEFAULT_USER: User = {
  id: '',
  name: 'User',
  profileUrl: '',
};

export const useStore = create<AppState>((set, get) => ({
  currentUser: DEFAULT_USER,
  albums: [],
  medias: [],
  messages: [],
  isInitialized: false,
  realtimeChannel: null,

  setCurrentUser: (user) => set({ currentUser: user || DEFAULT_USER }),

  // ─── Initialize all data at once ───
  initializeData: async () => {
    const supabase = await getSupabase();

    const [albumsRes, mediasRes, messagesRes] = await Promise.all([
      supabase.from('albums').select('*').order('created_at', { ascending: false }),
      supabase.from('medias').select('*').order('created_at', { ascending: false }),
      supabase.from('messages').select('*, users(name, profile_url)').order('created_at', { ascending: true }),
    ]);

    set({
      albums: albumsRes.data?.map(mapDbAlbum) || [],
      medias: mediasRes.data?.map(mapDbMedia) || [],
      messages: messagesRes.data?.map(mapDbMessage) || [],
      isInitialized: true,
    });
  },

  // ─── Individual fetch (kept for manual refresh if needed) ───
  fetchAlbums: async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('albums').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      set({ albums: data.map(mapDbAlbum) });
    }
  },

  fetchMedias: async (albumId) => {
    const supabase = await getSupabase();
    let query = supabase.from('medias').select('*').order('created_at', { ascending: false });
    if (albumId) query = query.eq('album_id', albumId);
    const { data, error } = await query;
    if (!error && data) {
      set({ medias: data.map(mapDbMedia) });
    }
  },

  fetchMessages: async (mediaId) => {
    const supabase = await getSupabase();
    let query = supabase.from('messages').select('*, users(name, profile_url)').order('created_at', { ascending: true });
    if (mediaId) query = query.eq('media_id', mediaId);
    const { data, error } = await query;
    if (!error && data) {
      set({ messages: data.map(mapDbMessage) });
    }
  },

  // ─── Realtime Subscription ───
  subscribeToRealtime: async () => {
    const supabase = await getSupabase();

    // Unsubscribe existing channel first
    const existing = get().realtimeChannel;
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase.channel('app-realtime')
      // Albums
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'albums' }, (payload) => {
        const newAlbum = mapDbAlbum(payload.new);
        set(state => {
          if (state.albums.some(a => a.id === newAlbum.id)) return state;
          return { albums: [newAlbum, ...state.albums] };
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'albums' }, (payload) => {
        const updated = mapDbAlbum(payload.new);
        set(state => ({
          albums: state.albums.map(a => a.id === updated.id ? updated : a),
        }));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'albums' }, (payload) => {
        set(state => ({
          albums: state.albums.filter(a => a.id !== payload.old.id),
        }));
      })
      // Medias
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'medias' }, (payload) => {
        const newMedia = mapDbMedia(payload.new);
        set(state => {
          if (state.medias.some(m => m.id === newMedia.id)) return state;
          return { medias: [newMedia, ...state.medias] };
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'medias' }, (payload) => {
        const updated = mapDbMedia(payload.new);
        set(state => ({
          medias: state.medias.map(m => m.id === updated.id ? updated : m),
        }));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'medias' }, (payload) => {
        set(state => ({
          medias: state.medias.filter(m => m.id !== payload.old.id),
        }));
      })
      // Messages
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        // Messages need user info, so we fetch the full record
        const supabase = await getSupabase();
        const { data } = await supabase
          .from('messages')
          .select('*, users(name, profile_url)')
          .eq('id', payload.new.id)
          .single();

        if (data) {
          const newMsg = mapDbMessage(data);
          set(state => {
            if (state.messages.some(m => m.id === newMsg.id)) return state;
            return { messages: [...state.messages, newMsg] };
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        set(state => ({
          messages: state.messages.map(m =>
            m.id === payload.new.id ? { ...m, isLocked: payload.new.is_locked, content: payload.new.content } : m
          ),
        }));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        set(state => ({
          messages: state.messages.filter(m => m.id !== payload.old.id),
        }));
      })
      .subscribe();

    set({ realtimeChannel: channel });
  },

  unsubscribeFromRealtime: () => {
    const channel = get().realtimeChannel;
    if (channel) {
      getSupabase().then(sb => sb.removeChannel(channel));
      set({ realtimeChannel: null });
    }
  },

  // ─── Mutations ───
  addAlbum: async (album) => {
    const supabase = await getSupabase();
    const currentUser = get().currentUser;
    const { data, error } = await supabase.from('albums').insert({
      name: album.name,
      created_by: currentUser.id,
      relationship_type: "none",
      cover_image: album.coverImage
    }).select().single();

    if (!error && data) {
      const newAlbum = mapDbAlbum(data);
      set(state => ({ albums: [newAlbum, ...state.albums] }));
      return newAlbum;
    } else if (error) {
      // 409/23505: already exists → fetch existing
      if (error.code === '23505' || (error as { status?: number }).status === 409) {
        const { data: existing } = await supabase
          .from('albums')
          .select('*')
          .eq('name', album.name)
          .eq('created_by', currentUser.id)
          .maybeSingle();
        if (existing) {
          const existingAlbum = mapDbAlbum(existing);
          set(state => {
            if (state.albums.some(a => a.id === existingAlbum.id)) return state;
            return { albums: [existingAlbum, ...state.albums] };
          });
          return existingAlbum;
        }
      }
      console.error("Failed to add album:", error);
      return null;
    }
    return null;
  },

  addMedia: async (media) => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('medias').insert({
      album_id: media.albumId,
      uploader_id: media.uploaderId,
      type: media.type,
      url: media.url,
      description: media.description
    }).select().single();

    if (!error && data) {
      const newMedia = mapDbMedia(data);
      set(state => ({ medias: [newMedia, ...state.medias] }));
      return newMedia;
    }
    return null;
  },

  addMessage: async (message) => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('messages').insert({
      media_id: message.mediaId,
      sender_id: message.senderId,
      type: message.type,
      content: message.content,
      is_locked: false
    }).select('*, users(name, profile_url)').single();

    if (!error && data) {
      const newMessage = mapDbMessage(data);
      set(state => ({ messages: [...state.messages, newMessage] }));
    } else if (error) {
      console.error("addMessage Supabase Error:", error);
      throw error;
    }
  },

  unlockMessage: async (messageId) => {
    const supabase = await getSupabase();
    await supabase.from('messages').update({ is_locked: false }).eq('id', messageId);
    set(state => ({
      messages: state.messages.map(m => m.id === messageId ? { ...m, isLocked: false } : m)
    }));
  },
}));
