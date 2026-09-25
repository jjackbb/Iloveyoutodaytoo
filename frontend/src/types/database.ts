// Supabase 스키마에서 자동 생성된 타입 (supabase gen types typescript --local, 2026-09-26).
// 원본: supabase/migrations/. 스키마를 바꾼 뒤에는 다시 생성해서 이 파일을 교체하세요.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string,"id": string
                  }
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string,"id"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_streaks": {
                  Row: {
                    "best_count": number,"current_count": number,"id": string,"last_active_date": string | null,"room_member_id": string
                  }
                  Insert: {
                    "best_count"?: number,"current_count"?: number,"id"?: string,"last_active_date"?: string | null,"room_member_id": string
                  }
                  Update: {
                    "best_count"?: number,"current_count"?: number,"id"?: string,"last_active_date"?: string | null,"room_member_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_streaks_room_member_id_fkey"
      columns: ["room_member_id"]
isOneToOne: true
      referencedRelation: "room_members"
      referencedColumns: ["id"]
    }
                  ]
                },"guardian_verifications": {
                  Row: {
                    "attempts": number,"code_hash": string,"consumed_at": string | null,"created_at": string,"expires_at": string,"guardian_phone": string,"id": string,"verified_at": string | null
                  }
                  Insert: {
                    "attempts"?: number,"code_hash": string,"consumed_at"?: string | null,"created_at"?: string,"expires_at": string,"guardian_phone": string,"id"?: string,"verified_at"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"code_hash"?: string,"consumed_at"?: string | null,"created_at"?: string,"expires_at"?: string,"guardian_phone"?: string,"id"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"heart_message_favorites": {
                  Row: {
                    "created_at": string,"id": string,"message_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"message_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "heart_message_favorites_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "heart_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "heart_message_favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"heart_message_hides": {
                  Row: {
                    "created_at": string,"id": string,"message_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"message_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "heart_message_hides_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "heart_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "heart_message_hides_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"heart_messages": {
                  Row: {
                    "content": string,"created_at": string,"duration_sec": number | null,"id": string,"memory_id": string | null,"prompt_used": string | null,"read_at": string | null,"receiver_id": string | null,"room_id": string,"send_mode": Database["public"]['Enums']["send_mode"],"sender_id": string | null,"type": Database["public"]['Enums']["message_type"],"voice_levels": (number)[] | null
                  }
                  Insert: {
                    "content": string,"created_at"?: string,"duration_sec"?: number | null,"id"?: string,"memory_id"?: string | null,"prompt_used"?: string | null,"read_at"?: string | null,"receiver_id"?: string | null,"room_id": string,"send_mode"?: Database["public"]['Enums']["send_mode"],"sender_id"?: string | null,"type": Database["public"]['Enums']["message_type"],"voice_levels"?: (number)[] | null
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"duration_sec"?: number | null,"id"?: string,"memory_id"?: string | null,"prompt_used"?: string | null,"read_at"?: string | null,"receiver_id"?: string | null,"room_id"?: string,"send_mode"?: Database["public"]['Enums']["send_mode"],"sender_id"?: string | null,"type"?: Database["public"]['Enums']["message_type"],"voice_levels"?: (number)[] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "heart_messages_memory_id_fkey"
      columns: ["memory_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "heart_messages_receiver_id_fkey"
      columns: ["receiver_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "heart_messages_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "heart_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "created_at": string,"expires_at": string | null,"id": string,"invite_message": string,"invite_token": string,"inviter_id": string,"relationship_label": string,"room_id": string,"used_at": string | null,"used_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"expires_at"?: string | null,"id"?: string,"invite_message": string,"invite_token": string,"inviter_id": string,"relationship_label": string,"room_id": string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string | null,"id"?: string,"invite_message"?: string,"invite_token"?: string,"inviter_id"?: string,"relationship_label"?: string,"room_id"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_inviter_id_fkey"
      columns: ["inviter_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_used_by_fkey"
      columns: ["used_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"memories": {
                  Row: {
                    "author_id": string | null,"created_at": string,"description": string | null,"handwriting_duration_ms": number | null,"handwriting_path": string | null,"id": string,"pinned_at": string | null,"room_id": string,"taken_at": string | null,"video_duration_ms": number | null,"video_path": string | null,"visibility": Database["public"]['Enums']["memory_visibility"],"voice_duration_sec": number | null,"voice_levels": (number)[] | null,"voice_path": string | null
                  }
                  Insert: {
                    "author_id"?: string | null,"created_at"?: string,"description"?: string | null,"handwriting_duration_ms"?: number | null,"handwriting_path"?: string | null,"id"?: string,"pinned_at"?: string | null,"room_id": string,"taken_at"?: string | null,"video_duration_ms"?: number | null,"video_path"?: string | null,"visibility"?: Database["public"]['Enums']["memory_visibility"],"voice_duration_sec"?: number | null,"voice_levels"?: (number)[] | null,"voice_path"?: string | null
                  }
                  Update: {
                    "author_id"?: string | null,"created_at"?: string,"description"?: string | null,"handwriting_duration_ms"?: number | null,"handwriting_path"?: string | null,"id"?: string,"pinned_at"?: string | null,"room_id"?: string,"taken_at"?: string | null,"video_duration_ms"?: number | null,"video_path"?: string | null,"visibility"?: Database["public"]['Enums']["memory_visibility"],"voice_duration_sec"?: number | null,"voice_levels"?: (number)[] | null,"voice_path"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "memories_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memories_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"memory_comments": {
                  Row: {
                    "author_id": string | null,"body": string | null,"created_at": string,"deleted_at": string | null,"edited_at": string | null,"id": string,"memory_id": string,"voice_duration_sec": number | null,"voice_levels": (number)[] | null,"voice_path": string | null
                  }
                  Insert: {
                    "author_id"?: string | null,"body"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"memory_id": string,"voice_duration_sec"?: number | null,"voice_levels"?: (number)[] | null,"voice_path"?: string | null
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"memory_id"?: string,"voice_duration_sec"?: number | null,"voice_levels"?: (number)[] | null,"voice_path"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "memory_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memory_comments_memory_id_fkey"
      columns: ["memory_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id"]
    }
                  ]
                },"memory_hides": {
                  Row: {
                    "created_at": string,"id": string,"memory_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"memory_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"memory_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memory_hides_memory_id_fkey"
      columns: ["memory_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memory_hides_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"memory_likes": {
                  Row: {
                    "created_at": string,"id": string,"memory_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"memory_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"memory_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memory_likes_memory_id_fkey"
      columns: ["memory_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memory_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"memory_photos": {
                  Row: {
                    "created_at": string,"id": string,"memory_id": string,"sort_order": number,"storage_path": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"memory_id": string,"sort_order": number,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"memory_id"?: string,"sort_order"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memory_photos_memory_id_fkey"
      columns: ["memory_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id"]
    }
                  ]
                },"memory_saves": {
                  Row: {
                    "created_at": string,"id": string,"memory_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"memory_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"memory_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memory_saves_memory_id_fkey"
      columns: ["memory_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memory_saves_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"deleted_at": string | null,"heart_message_id": string | null,"id": string,"memory_id": string | null,"read_at": string | null,"recipient_id": string,"room_id": string | null,"type": Database["public"]['Enums']["notification_type"]
                  }
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"heart_message_id"?: string | null,"id"?: string,"memory_id"?: string | null,"read_at"?: string | null,"recipient_id": string,"room_id"?: string | null,"type": Database["public"]['Enums']["notification_type"]
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"heart_message_id"?: string | null,"id"?: string,"memory_id"?: string | null,"read_at"?: string | null,"recipient_id"?: string,"room_id"?: string | null,"type"?: Database["public"]['Enums']["notification_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_heart_message_id_fkey"
      columns: ["heart_message_id"]
isOneToOne: false
      referencedRelation: "heart_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_memory_id_fkey"
      columns: ["memory_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string | null,"created_at": string,"endpoint": string | null,"id": string,"p256dh": string | null,"platform": string,"token": string | null,"user_id": string
                  }
                  Insert: {
                    "auth"?: string | null,"created_at"?: string,"endpoint"?: string | null,"id"?: string,"p256dh"?: string | null,"platform"?: string,"token"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string | null,"created_at"?: string,"endpoint"?: string | null,"id"?: string,"p256dh"?: string | null,"platform"?: string,"token"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"detail": string | null,"id": string,"reason": string,"reporter_id": string | null,"status": string,"target_id": string,"target_type": string
                  }
                  Insert: {
                    "created_at"?: string,"detail"?: string | null,"id"?: string,"reason": string,"reporter_id"?: string | null,"status"?: string,"target_id": string,"target_type": string
                  }
                  Update: {
                    "created_at"?: string,"detail"?: string | null,"id"?: string,"reason"?: string,"reporter_id"?: string | null,"status"?: string,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"room_members": {
                  Row: {
                    "custom_cover_path": string | null,"custom_cover_preset": string | null,"custom_name": string | null,"favorited": boolean,"id": string,"joined_at": string,"left_at": string | null,"nickname": string | null,"relationship_label": string,"role": Database["public"]['Enums']["member_role"],"room_id": string,"status": Database["public"]['Enums']["member_status"],"user_id": string
                  }
                  Insert: {
                    "custom_cover_path"?: string | null,"custom_cover_preset"?: string | null,"custom_name"?: string | null,"favorited"?: boolean,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"nickname"?: string | null,"relationship_label": string,"role"?: Database["public"]['Enums']["member_role"],"room_id": string,"status"?: Database["public"]['Enums']["member_status"],"user_id": string
                  }
                  Update: {
                    "custom_cover_path"?: string | null,"custom_cover_preset"?: string | null,"custom_name"?: string | null,"favorited"?: boolean,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"nickname"?: string | null,"relationship_label"?: string,"role"?: Database["public"]['Enums']["member_role"],"room_id"?: string,"status"?: Database["public"]['Enums']["member_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "room_members_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "room_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "cover_path": string | null,"cover_preset": string,"created_at": string,"id": string,"name": string,"owner_id": string | null,"theme": string | null
                  }
                  Insert: {
                    "cover_path"?: string | null,"cover_preset"?: string,"created_at"?: string,"id"?: string,"name": string,"owner_id"?: string | null,"theme"?: string | null
                  }
                  Update: {
                    "cover_path"?: string | null,"cover_preset"?: string,"created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string | null,"theme"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rooms_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"storage_deletion_jobs": {
                  Row: {
                    "attempts": number,"bucket_id": string,"claimed_at": string | null,"created_at": string,"id": string,"last_error": string | null,"object_name": string,"reason": string,"requested_by": string
                  }
                  Insert: {
                    "attempts"?: number,"bucket_id": string,"claimed_at"?: string | null,"created_at"?: string,"id"?: string,"last_error"?: string | null,"object_name": string,"reason"?: string,"requested_by": string
                  }
                  Update: {
                    "attempts"?: number,"bucket_id"?: string,"claimed_at"?: string | null,"created_at"?: string,"id"?: string,"last_error"?: string | null,"object_name"?: string,"reason"?: string,"requested_by"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_private": {
                  Row: {
                    "auth_provider": Database["public"]['Enums']["auth_provider"],"birth_date": string,"email": string | null,"guardian_consented_at": string | null,"guardian_name": string | null,"guardian_phone": string | null,"id": string,"is_withdrawn": boolean,"large_text": boolean,"phone": string | null,"username": string | null
                  }
                  Insert: {
                    "auth_provider"?: Database["public"]['Enums']["auth_provider"],"birth_date": string,"email"?: string | null,"guardian_consented_at"?: string | null,"guardian_name"?: string | null,"guardian_phone"?: string | null,"id": string,"is_withdrawn"?: boolean,"large_text"?: boolean,"phone"?: string | null,"username"?: string | null
                  }
                  Update: {
                    "auth_provider"?: Database["public"]['Enums']["auth_provider"],"birth_date"?: string,"email"?: string | null,"guardian_consented_at"?: string | null,"guardian_name"?: string | null,"guardian_phone"?: string | null,"id"?: string,"is_withdrawn"?: boolean,"large_text"?: boolean,"phone"?: string | null,"username"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_private_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"profile_image": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id": string,"name": string,"profile_image"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"profile_image"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"widget_tokens": {
                  Row: {
                    "created_at": string,"id": string,"last_used_at": string | null,"token_hash": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_used_at"?: string | null,"token_hash": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_used_at"?: string | null,"token_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "widget_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"withdrawal_reasons": {
                  Row: {
                    "created_at": string,"detail": string | null,"id": string,"reason": string
                  }
                  Insert: {
                    "created_at"?: string,"detail"?: string | null,"id"?: string,"reason": string
                  }
                  Update: {
                    "created_at"?: string,"detail"?: string | null,"id"?: string,"reason"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_label"?: string,"p_token": string }; Returns: string
                           },
"assert_own_upload":
{ Args: { "p_bucket": string,"p_path": string }; Returns: undefined
                           },
"can_read_memory":
{ Args: { "p_memory_id": string }; Returns: boolean
                           },
"can_read_storage_object":
{ Args: { "p_bucket": string,"p_name": string }; Returns: boolean
                           },
"consume_guardian_verification":
{ Args: { "p_id": string,"p_phone": string }; Returns: boolean
                           },
"create_memory":
{ Args: { "p_caption": string,"p_handwriting_duration_ms"?: number,"p_handwriting_path"?: string,"p_photo_paths": (string)[],"p_room_id": string,"p_video_duration_ms"?: number,"p_video_path"?: string,"p_voice_duration_sec"?: number,"p_voice_levels"?: (number)[],"p_voice_path"?: string }; Returns: string
                           },
"delete_memory":
{ Args: { "p_memory_id": string }; Returns: {
              "bucket_id": string,"object_name": string
            }[]
                           },
"effective_streak":
{ Args: { "p_room_member_id": string }; Returns: number
                           },
"enqueue_own_storage_deletion":
{ Args: { "p_bucket": string,"p_path": string }; Returns: undefined
                           },
"finish_storage_deletions":
{ Args: { "p_error"?: string }; Returns: number
                           },
"has_blocked":
{ Args: { "p_blocked": string }; Returns: boolean
                           },
"is_room_admin":
{ Args: { "p_room_id": string }; Returns: boolean
                           },
"is_room_member":
{ Args: { "p_room_id": string }; Returns: boolean
                           },
"issue_widget_token":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"mark_heart_read":
{ Args: { "p_id": string }; Returns: boolean
                           },
"owns_room_member":
{ Args: { "p_room_member_id": string }; Returns: boolean
                           },
"path_uuid":
{ Args: { "p_name": string }; Returns: string
                           },
"pending_storage_deletions":
{ Args: Record<PropertyKey, never>; Returns: {
              "bucket_id": string,"object_name": string
            }[]
                           },
"pin_memory":
{ Args: { "p_memory_id": string,"p_pinned": boolean }; Returns: undefined
                           },
"preview_invitation":
{ Args: { "p_token": string }; Returns: {
              "expired": boolean,"invite_message": string,"inviter_name": string,"relationship_label": string,"room_id": string,"room_name": string,"used": boolean
            }[]
                           },
"prune_push_subscription":
{ Args: { "p_endpoint": string }; Returns: undefined
                           },
"purge_guardian_verifications":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"push_targets_for_user":
{ Args: { "p_user_id": string }; Returns: {
              "auth": string,"endpoint": string,"p256dh": string
            }[]
                           },
"revoke_widget_tokens":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"shares_room_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"storage_object_pending_deletion":
{ Args: { "p_bucket": string,"p_name": string }; Returns: boolean
                           },
"update_memory":
{ Args: { "p_caption": string,"p_handwriting_duration_ms"?: number,"p_handwriting_path"?: string,"p_memory_id": string,"p_photo_paths": (string)[],"p_video_duration_ms"?: number,"p_video_path"?: string,"p_voice_duration_sec"?: number,"p_voice_levels"?: (number)[],"p_voice_path"?: string }; Returns: undefined
                           },
"username_taken":
{ Args: { "p_username": string }; Returns: boolean
                           },
"widget_knock":
{ Args: { "p_memory"?: string,"p_target": string,"p_token": string }; Returns: boolean
                           },
"widget_latest":
{ Args: { "p_token": string }; Returns: {
              "author_id": string,"author_name": string,"caption": string,"created_at": string,"handwriting_path": string,"is_mine": boolean,"memory_id": string,"photo_path": string,"room_id": string,"room_name": string,"voice_duration_sec": number
            }[]
                           },
"widget_user_from_token":
{ Args: { "p_token": string }; Returns: string
                           },
"withdraw_account":
{ Args: { "p_detail"?: string,"p_reason"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "auth_provider": "email"|"kakao"|"google"|"phone","member_role": "admin"|"member","member_status": "active"|"left","memory_visibility": "private"|"room","message_type": "text"|"voice"|"video","notification_type": "memory_created"|"comment_created"|"member_joined"|"heart_received"|"knock","send_mode": "direct"|"broadcast"|"random"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "auth_provider": ["email", "kakao", "google", "phone"],"member_role": ["admin", "member"],"member_status": ["active", "left"],"memory_visibility": ["private", "room"],"message_type": ["text", "voice", "video"],"notification_type": ["memory_created", "comment_created", "member_joined", "heart_received", "knock"],"send_mode": ["direct", "broadcast", "random"]
          }
        }
} as const

