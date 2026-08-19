// Supabase 스키마에서 자동 생성된 타입.
// 스키마를 바꾼 뒤에는 다시 생성해서 이 파일을 교체하세요.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey'
            columns: ['blocked_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey'
            columns: ['blocker_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      daily_streaks: {
        Row: {
          best_count: number
          current_count: number
          id: string
          last_active_date: string | null
          room_member_id: string
        }
        Insert: {
          best_count?: number
          current_count?: number
          id?: string
          last_active_date?: string | null
          room_member_id: string
        }
        Update: {
          best_count?: number
          current_count?: number
          id?: string
          last_active_date?: string | null
          room_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'daily_streaks_room_member_id_fkey'
            columns: ['room_member_id']
            isOneToOne: true
            referencedRelation: 'room_members'
            referencedColumns: ['id']
          },
        ]
      }
      heart_messages: {
        Row: {
          content: string
          created_at: string
          duration_sec: number | null
          id: string
          memory_id: string | null
          prompt_used: string | null
          /** 받는 사람이 재생해서 들은 시각. 답장 미션이 이 값으로 "듣고도 답장 안 한 것"을 센다. */
          read_at: string | null
          // 받는 사람이 탈퇴하면 NULL이 된다 (메시지는 보낸 사람 사서함에 남는다)
          receiver_id: string | null
          /** 답장이 이루어진 시각. 답장을 보내면 그 사람의 미답장 마음이 한꺼번에 찍힌다. */
          replied_at: string | null
          room_id: string
          sender_id: string | null
          /** 보낸 방식. 사서함 필터 칩(일대일·랜덤)이 이 값을 본다. */
          send_mode: Database['public']['Enums']['send_mode']
          type: Database['public']['Enums']['message_type']
          /** 녹음할 때 잰 파형 막대 높이(0~1, 최대 48칸). 텍스트 마음이면 null. */
          voice_levels: number[] | null
        }
        // 새로 보낼 때는 받는 사람이 반드시 있어야 한다.
        // DB는 NULL을 허용하지만(탈퇴 익명화용) 앱이 NULL을 넣을 일은 없다.
        Insert: {
          content: string
          created_at?: string
          duration_sec?: number | null
          id?: string
          memory_id?: string | null
          prompt_used?: string | null
          read_at?: string | null
          receiver_id: string
          replied_at?: string | null
          room_id: string
          sender_id?: string | null
          // 안 넣으면 DB 기본값 'direct'가 들어간다.
          send_mode?: Database['public']['Enums']['send_mode']
          type: Database['public']['Enums']['message_type']
          voice_levels?: number[] | null
        }
        Update: {
          content?: string
          created_at?: string
          duration_sec?: number | null
          id?: string
          memory_id?: string | null
          prompt_used?: string | null
          read_at?: string | null
          receiver_id?: string
          replied_at?: string | null
          room_id?: string
          sender_id?: string | null
          send_mode?: Database['public']['Enums']['send_mode']
          type?: Database['public']['Enums']['message_type']
          voice_levels?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: 'heart_messages_memory_id_fkey'
            columns: ['memory_id']
            isOneToOne: false
            referencedRelation: 'memories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'heart_messages_receiver_id_fkey'
            columns: ['receiver_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'heart_messages_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'heart_messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      /**
       * 사서함 카드의 ♡ (캡처 46·47).
       *
       * memory_likes와 같은 모양이지만 **개수를 보여주지 않는다** — 남에게 보이는
       * 좋아요가 아니라 "다시 듣고 싶은 마음"을 내가 표시해 두는 자리다.
       */
      heart_message_favorites: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'heart_message_favorites_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'heart_messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'heart_message_favorites_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      /**
       * 사서함에서 내가 치운 마음 (노션 IA 2.2의 편집 모드).
       * 물리 삭제가 아니다 — 나만 안 보이고 상대의 사서함에는 그대로 남는다.
       */
      heart_message_hides: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'heart_message_hides_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'heart_messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'heart_message_hides_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          invite_message: string
          invite_token: string
          inviter_id: string
          relationship_label: string
          room_id: string
          // 1회용 초대: 누군가 입장하면 채워지고, 그 뒤로는 링크가 안 먹는다
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          invite_message: string
          invite_token: string
          inviter_id: string
          relationship_label: string
          room_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          invite_message?: string
          invite_token?: string
          inviter_id?: string
          relationship_label?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invitations_inviter_id_fkey'
            columns: ['inviter_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invitations_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      memories: {
        Row: {
          author_id: string | null
          created_at: string
          /**
           * 소프트 삭제 시각. 물리 삭제 금지 원칙(PRD/05 §5)에 따라 행은 지우지 않는다.
           * 피드 조회는 반드시 `is('deleted_at', null)`을 건다.
           */
          deleted_at: string | null
          /** 방 피드 상단 고정 시각. null이면 고정 아님. 한 방에 한 건만 채워진다(DB 유니크 인덱스). */
          pinned_at: string | null
          /** 게시물 문구(캡처 12 "문구 선택"). 선택 사항이라 비어 있을 수 있다. */
          description: string | null
          id: string
          media_type: Database['public']['Enums']['media_type']
          /** (폐지) 사진은 memory_photos로 옮겼다. 새 게시물은 null이다. */
          media_url: string | null
          room_id: string
          taken_at: string | null
          /** voice 버킷 경로 "{room_id}/파일명". 함께 담은 목소리. */
          voice_path: string | null
          /** 음성 길이(초). voice_path와 항상 짝을 이룬다(DB CHECK). */
          voice_duration_sec: number | null
          /**
           * 녹음할 때 잰 파형 막대 높이(0~1, 최대 48칸).
           * 저장해 두면 피드가 오디오 파일을 안 받고도 파형을 그린다.
           * 이 컬럼이 생기기 전 음성과 마이크 측정을 못 한 브라우저에서는 null이다.
           */
          voice_levels: number[] | null
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          media_type?: Database['public']['Enums']['media_type']
          media_url?: string | null
          pinned_at?: string | null
          room_id: string
          taken_at?: string | null
          voice_path?: string | null
          voice_duration_sec?: number | null
          voice_levels?: number[] | null
        }
        Update: {
          author_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          media_type?: Database['public']['Enums']['media_type']
          media_url?: string | null
          pinned_at?: string | null
          room_id?: string
          taken_at?: string | null
          voice_path?: string | null
          voice_duration_sec?: number | null
          voice_levels?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: 'memories_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memories_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      /** 추억 게시물에 담긴 사진들. sort_order = 0 이 대표 사진이다(캡처 13). */
      memory_photos: {
        Row: {
          created_at: string
          id: string
          memory_id: string
          /** media 버킷 경로 "{room_id}/파일명". */
          storage_path: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          memory_id: string
          storage_path: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          memory_id?: string
          storage_path?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'memory_photos_memory_id_fkey'
            columns: ['memory_id']
            isOneToOne: false
            referencedRelation: 'memories'
            referencedColumns: ['id']
          },
        ]
      }
      /**
       * 게시물 댓글 (캡처 24~36).
       *
       * `body`(텍스트)와 `voice_path`(음성) 중 **정확히 하나**만 채워진다(DB CHECK).
       * 삭제는 `deleted_at`을 적는 소프트 삭제라, 모든 조회가 `deleted_at is null`을 건다.
       */
      memory_comments: {
        Row: {
          /** 탈퇴하면 null이 된다(ON DELETE SET NULL). 댓글 자체는 남는다. */
          author_id: string | null
          /** 텍스트 댓글의 내용. 음성 댓글이면 null. */
          body: string | null
          created_at: string
          /** 지운 시각. null이면 살아 있는 댓글이다. */
          deleted_at: string | null
          /** 마지막으로 고친 시각. 있으면 화면에 "수정됨"을 붙인다. 음성 댓글은 항상 null. */
          edited_at: string | null
          id: string
          memory_id: string
          /** voice 버킷 경로 "{room_id}/파일명". 텍스트 댓글이면 null. */
          voice_path: string | null
          voice_duration_sec: number | null
          /** 녹음할 때 잰 파형 막대 높이(0~1, 최대 48칸). 텍스트 댓글이면 null. */
          voice_levels: number[] | null
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          memory_id: string
          voice_path?: string | null
          voice_duration_sec?: number | null
          voice_levels?: number[] | null
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          memory_id?: string
          voice_path?: string | null
          voice_duration_sec?: number | null
          voice_levels?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: 'memory_comments_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memory_comments_memory_id_fkey'
            columns: ['memory_id']
            isOneToOne: false
            referencedRelation: 'memories'
            referencedColumns: ['id']
          },
        ]
      }
      /**
       * 게시물 좋아요. 행이 있으면 "이 사람이 눌렀다"는 뜻이라 취소는 행을 지운다.
       * 방 멤버 모두가 서로의 좋아요를 볼 수 있다(수를 세야 하므로).
       */
      memory_likes: {
        Row: {
          created_at: string
          id: string
          memory_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memory_likes_memory_id_fkey'
            columns: ['memory_id']
            isOneToOne: false
            referencedRelation: 'memories'
            referencedColumns: ['id']
          },
        ]
      }
      /** 개인별 숨김. 이 행이 있으면 **그 사람의 피드에서만** 빠진다. */
      memory_hides: {
        Row: {
          created_at: string
          id: string
          memory_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memory_hides_memory_id_fkey'
            columns: ['memory_id']
            isOneToOne: false
            referencedRelation: 'memories'
            referencedColumns: ['id']
          },
        ]
      }
      /** 개인 북마크. 저장한 목록을 보여주는 화면은 아직 없다. */
      memory_saves: {
        Row: {
          created_at: string
          id: string
          memory_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memory_saves_memory_id_fkey'
            columns: ['memory_id']
            isOneToOne: false
            referencedRelation: 'memories'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          /** 소프트 삭제. 모든 조회가 deleted_at is null을 건다. */
          deleted_at: string | null
          heart_message_id: string | null
          id: string
          memory_id: string | null
          read_at: string | null
          recipient_id: string
          room_id: string | null
          type: Database['public']['Enums']['notification_type']
        }
        // 넣기는 트리거(SECURITY DEFINER)만 한다. 앱에서 insert 하지 않는다.
        Insert: {
          actor_id?: string | null
          created_at?: string
          deleted_at?: string | null
          heart_message_id?: string | null
          id?: string
          memory_id?: string | null
          read_at?: string | null
          recipient_id: string
          room_id?: string | null
          type: Database['public']['Enums']['notification_type']
        }
        // 앱이 바꾸는 건 read_at(읽음)과 deleted_at(지움) 둘뿐이다.
        Update: {
          actor_id?: string | null
          created_at?: string
          deleted_at?: string | null
          heart_message_id?: string | null
          id?: string
          memory_id?: string | null
          read_at?: string | null
          recipient_id?: string
          room_id?: string | null
          type?: Database['public']['Enums']['notification_type']
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_recipient_id_fkey'
            columns: ['recipient_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_memory_id_fkey'
            columns: ['memory_id']
            isOneToOne: false
            referencedRelation: 'memories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_heart_message_id_fkey'
            columns: ['heart_message_id']
            isOneToOne: false
            referencedRelation: 'heart_messages'
            referencedColumns: ['id']
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          reason: string
          reporter_id: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey'
            columns: ['reporter_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      room_members: {
        Row: {
          /**
           * 내 화면에서만 보이는 이 방의 이름. null이면 rooms.name(원래 이름)을 쓴다.
           * 방장이 고치는 rooms.name과 **다른 값**이다 — 그건 모두의 화면이 바뀌고,
           * 이건 내 화면만 바뀐다. 규칙은 src/lib/room-name.ts 한 곳에 있다.
           */
          custom_name: string | null
          /** 내 화면에서만 보이는 커버 프리셋 키. rooms_cover_preset_check와 같은 목록. */
          custom_cover_preset: string | null
          /** 내 화면에서만 보이는 커버 사진 경로(covers 버킷, `{room_id}/…`). */
          custom_cover_path: string | null
          favorited: boolean
          has_replied_first_invite: boolean
          id: string
          joined_at: string
          left_at: string | null
          /**
           * 이 방에서만 쓰는 본인의 별명. null이면 users.name(전역 이름)을 쓴다.
           * 초대한 분이 붙인 relationship_label과는 **다른 값**이다 —
           * 그건 부르는 쪽이 적은 호칭이고, 이건 불리는 쪽이 정한 이름이다.
           */
          nickname: string | null
          relationship_label: string
          role: Database['public']['Enums']['member_role']
          room_id: string
          status: Database['public']['Enums']['member_status']
          user_id: string
        }
        Insert: {
          custom_name?: string | null
          custom_cover_preset?: string | null
          custom_cover_path?: string | null
          favorited?: boolean
          has_replied_first_invite?: boolean
          id?: string
          joined_at?: string
          left_at?: string | null
          nickname?: string | null
          relationship_label: string
          role?: Database['public']['Enums']['member_role']
          room_id: string
          status?: Database['public']['Enums']['member_status']
          user_id: string
        }
        Update: {
          custom_name?: string | null
          custom_cover_preset?: string | null
          custom_cover_path?: string | null
          favorited?: boolean
          has_replied_first_invite?: boolean
          id?: string
          joined_at?: string
          left_at?: string | null
          nickname?: string | null
          relationship_label?: string
          role?: Database['public']['Enums']['member_role']
          room_id?: string
          status?: Database['public']['Enums']['member_status']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'room_members_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'room_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      rooms: {
        Row: {
          // 프리셋 키. NOT NULL·기본값 'warm'이라 커버가 비는 방은 없다.
          // 쓸 수 있는 값은 rooms_cover_preset_check 제약과 src/lib/covers.ts가 함께 정한다.
          cover_preset: string
          // 직접 올린 커버 사진의 Storage 경로(`{room_id}/…`). 있으면 프리셋보다 우선한다.
          cover_path: string | null
          created_at: string
          id: string
          name: string
          // 방장이 탈퇴하면 NULL이 된다. 방과 그 안의 기록은 남은 사람들을 위해 보존된다.
          owner_id: string | null
          relationship_type:
            | Database['public']['Enums']['relationship_type']
            | null
          theme: string | null
        }
        Insert: {
          cover_preset?: string
          cover_path?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          relationship_type:
            | Database['public']['Enums']['relationship_type']
            | null
          theme?: string | null
        }
        Update: {
          cover_preset?: string
          cover_path?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          relationship_type?:
            | Database['public']['Enums']['relationship_type']
            | null
          theme?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'rooms_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      users: {
        Row: {
          auth_provider: Database['public']['Enums']['auth_provider']
          birth_date: string
          created_at: string
          email: string | null
          guardian_consented_at: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          is_withdrawn: boolean
          /** 큰 글자 모드(캡처 48). 기기가 아니라 사람에 붙는 설정이다. */
          large_text: boolean
          name: string
          phone: string | null
          profile_image: string | null
          username: string | null
        }
        Insert: {
          auth_provider?: Database['public']['Enums']['auth_provider']
          birth_date: string
          created_at?: string
          email?: string | null
          guardian_consented_at?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id: string
          is_withdrawn?: boolean
          large_text?: boolean
          name: string
          phone?: string | null
          profile_image?: string | null
          username?: string | null
        }
        Update: {
          auth_provider?: Database['public']['Enums']['auth_provider']
          birth_date?: string
          created_at?: string
          email?: string | null
          guardian_consented_at?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_withdrawn?: boolean
          large_text?: boolean
          name?: string
          phone?: string | null
          profile_image?: string | null
          username?: string | null
        }
        Relationships: []
      }
      withdrawal_reasons: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          reason: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          reason: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          reason?: string
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      accept_invitation: {
        Args: { p_label?: string; p_token: string }
        Returns: string
      }
      effective_streak: { Args: { p_room_member_id: string }; Returns: number }
      has_blocked: { Args: { p_blocked: string }; Returns: boolean }
      is_room_admin: { Args: { p_room_id: string }; Returns: boolean }
      is_room_member: { Args: { p_room_id: string }; Returns: boolean }
      owns_room_member: { Args: { p_room_member_id: string }; Returns: boolean }
      path_uuid: { Args: { p_name: string }; Returns: string }
      /**
       * 게시물 고정/해제. 방 멤버 누구나 부를 수 있고, pinned_at 말고는 아무것도 못 바꾼다.
       * 새로 고정하면 그 방의 이전 고정은 자동으로 풀린다.
       */
      pin_memory: {
        Args: { p_memory_id: string; p_pinned: boolean }
        Returns: undefined
      }
      preview_invitation: {
        Args: { p_token: string }
        Returns: {
          expired: boolean
          invite_message: string
          inviter_name: string
          relationship_label: string
          room_id: string
          room_name: string
          // 이미 누군가 이 링크로 들어왔는가 (1회용)
          used: boolean
        }[]
      }
      shares_room_with: { Args: { p_user_id: string }; Returns: boolean }
      /**
       * 지금 나에게 락이 걸린 발신자들 (답장 미션, PRD [MISSION-01]).
       * "그 사람이 보낸 마음 중 내가 듣고도 답장하지 않은 것"이 5개 이상이면 잠긴다.
       */
      locked_senders: {
        Args: Record<string, never>
        Returns: { sender_id: string; unreplied_count: number }[]
      }
      /**
       * 마음을 들었다고 표시한다(재생할 때 부른다).
       * 잠긴 마음이면 false를 돌려주고 아무것도 하지 않는다.
       */
      mark_heart_read: { Args: { p_id: string }; Returns: boolean }
    }
    Enums: {
      notification_type:
        | 'memory_created'
        | 'comment_created'
        | 'member_joined'
        | 'heart_received'
      auth_provider: 'email' | 'kakao' | 'google' | 'phone'
      media_type: 'photo' | 'video'
      member_role: 'admin' | 'member'
      member_status: 'active' | 'left'
      message_type: 'text' | 'voice' | 'video'
      relationship_type: 'family' | 'lover' | 'friend' | 'self'
      /**
       * 마음을 보낸 방식 (heart_messages.send_mode).
       *
       * DB에서는 enum 타입이 아니라 text + CHECK 제약이다. 여기서만 좁혀 쓴다 —
       * enum을 새로 만들면 값을 하나 더할 때 마이그레이션이 무거워지는데,
       * 이 값은 화면 필터를 위해 늘어날 가능성이 있다.
       */
      send_mode: 'direct' | 'broadcast' | 'random'
    }
    CompositeTypes: Record<never, never>
  }
}

type PublicSchema = Database['public']

/** 테이블 한 행의 타입.  예: `Tables<'rooms'>` */
export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']

/** 테이블에 새로 넣을 때의 타입.  예: `TablesInsert<'rooms'>` */
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']

/** 테이블을 수정할 때의 타입.  예: `TablesUpdate<'rooms'>` */
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']

/** DB enum 타입.  예: `Enums<'relationship_type'>` */
export type Enums<T extends keyof PublicSchema['Enums']> =
  PublicSchema['Enums'][T]

export const RELATIONSHIP_TYPES = [
  'family',
  'lover',
  'friend',
  'self',
] as const satisfies readonly Enums<'relationship_type'>[]

export const MESSAGE_TYPES = [
  'text',
  'voice',
  'video',
] as const satisfies readonly Enums<'message_type'>[]
