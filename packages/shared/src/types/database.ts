export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      drafts: {
        Row: {
          bcc_addresses: string[] | null
          body_html: string | null
          body_text: string | null
          cc_addresses: string[] | null
          created_at: string
          created_by: string | null
          id: string
          in_reply_to: string | null
          inbox_id: string
          subject: string | null
          team_id: string
          thread_id: string | null
          to_addresses: string[] | null
          updated_at: string
        }
        Insert: {
          bcc_addresses?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          in_reply_to?: string | null
          inbox_id: string
          subject?: string | null
          team_id: string
          thread_id?: string | null
          to_addresses?: string[] | null
          updated_at?: string
        }
        Update: {
          bcc_addresses?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          in_reply_to?: string | null
          inbox_id?: string
          subject?: string | null
          team_id?: string
          thread_id?: string | null
          to_addresses?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      email_assignments: {
        Row: {
          assigned_by: string
          assigned_to: string
          created_at: string
          email_id: string
          id: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          created_at?: string
          email_id: string
          id?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          created_at?: string
          email_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_assignments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_attachments: {
        Row: {
          content_type: string
          created_at: string
          email_id: string
          file_name: string
          id: string
          is_inline: boolean
          size_bytes: number
          storage_path: string
          updated_at: string | null
        }
        Insert: {
          content_type: string
          created_at?: string
          email_id: string
          file_name: string
          id?: string
          is_inline?: boolean
          size_bytes: number
          storage_path: string
          updated_at?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          email_id?: string
          file_name?: string
          id?: string
          is_inline?: boolean
          size_bytes?: number
          storage_path?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_labels: {
        Row: {
          created_at: string
          email_id: string
          label_id: string
        }
        Insert: {
          created_at?: string
          email_id: string
          label_id: string
        }
        Update: {
          created_at?: string
          email_id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_labels_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          bcc_addresses: string[] | null
          body_html: string | null
          body_text: string | null
          cc_addresses: string[] | null
          created_at: string
          direction: Database["public"]["Enums"]["email_direction"]
          from_address: string
          id: string
          imap_uid: number | null
          inbox_id: string
          is_archived: boolean | null
          is_deleted: boolean
          is_read: boolean
          is_starred: boolean
          last_activity_at: string
          mailbox_name: string | null
          message_id: string | null
          received_at: string
          snooze_until: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string | null
          tags: string[] | null
          team_id: string
          thread_id: string | null
          to_addresses: string[]
          updated_at: string | null
        }
        Insert: {
          bcc_addresses?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[] | null
          created_at?: string
          direction?: Database["public"]["Enums"]["email_direction"]
          from_address: string
          id?: string
          imap_uid?: number | null
          inbox_id: string
          is_archived?: boolean | null
          is_deleted?: boolean
          is_read?: boolean
          is_starred?: boolean
          last_activity_at?: string
          mailbox_name?: string | null
          message_id?: string | null
          received_at?: string
          snooze_until?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          tags?: string[] | null
          team_id: string
          thread_id?: string | null
          to_addresses: string[]
          updated_at?: string | null
        }
        Update: {
          bcc_addresses?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[] | null
          created_at?: string
          direction?: Database["public"]["Enums"]["email_direction"]
          from_address?: string
          id?: string
          imap_uid?: number | null
          inbox_id?: string
          is_archived?: boolean | null
          is_deleted?: boolean
          is_read?: boolean
          is_starred?: boolean
          last_activity_at?: string
          mailbox_name?: string | null
          message_id?: string | null
          received_at?: string
          snooze_until?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          tags?: string[] | null
          team_id?: string
          thread_id?: string | null
          to_addresses?: string[]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_aliases: {
        Row: {
          auto_bcc: string | null
          auto_cc: string | null
          created_at: string | null
          email_address: string
          id: string
          inbox_id: string
          is_primary: boolean | null
          name: string | null
          signature: string | null
          updated_at: string | null
        }
        Insert: {
          auto_bcc?: string | null
          auto_cc?: string | null
          created_at?: string | null
          email_address: string
          id?: string
          inbox_id: string
          is_primary?: boolean | null
          name?: string | null
          signature?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_bcc?: string | null
          auto_cc?: string | null
          created_at?: string | null
          email_address?: string
          id?: string
          inbox_id?: string
          is_primary?: boolean | null
          name?: string | null
          signature?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_aliases_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_members: {
        Row: {
          added_at: string
          inbox_id: string
          role: Database["public"]["Enums"]["inbox_role"]
          user_id: string
        }
        Insert: {
          added_at?: string
          inbox_id: string
          role?: Database["public"]["Enums"]["inbox_role"]
          user_id: string
        }
        Update: {
          added_at?: string
          inbox_id?: string
          role?: Database["public"]["Enums"]["inbox_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_members_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      inboxes: {
        Row: {
          avatar_url: string | null
          color: string | null
          created_at: string
          email_address: string
          folder_archive: string | null
          folder_drafts: string | null
          folder_inbox: string | null
          folder_sent: string | null
          folder_spam: string | null
          folder_trash: string | null
          id: string
          imap_host: string | null
          imap_pass: string | null
          imap_port: number | null
          imap_secure: boolean | null
          imap_user: string | null
          name: string
          owner_id: string | null
          signature_id: string | null
          smtp_host: string | null
          smtp_pass: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_user: string | null
          sync_since: string | null
          team_id: string
          type: Database["public"]["Enums"]["inbox_type"]
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          color?: string | null
          created_at?: string
          email_address: string
          folder_archive?: string | null
          folder_drafts?: string | null
          folder_inbox?: string | null
          folder_sent?: string | null
          folder_spam?: string | null
          folder_trash?: string | null
          id?: string
          imap_host?: string | null
          imap_pass?: string | null
          imap_port?: number | null
          imap_secure?: boolean | null
          imap_user?: string | null
          name: string
          owner_id?: string | null
          signature_id?: string | null
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          sync_since?: string | null
          team_id: string
          type?: Database["public"]["Enums"]["inbox_type"]
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          color?: string | null
          created_at?: string
          email_address?: string
          folder_archive?: string | null
          folder_drafts?: string | null
          folder_inbox?: string | null
          folder_sent?: string | null
          folder_spam?: string | null
          folder_trash?: string | null
          id?: string
          imap_host?: string | null
          imap_pass?: string | null
          imap_port?: number | null
          imap_secure?: boolean | null
          imap_user?: string | null
          name?: string
          owner_id?: string | null
          signature_id?: string | null
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          sync_since?: string | null
          team_id?: string
          type?: Database["public"]["Enums"]["inbox_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inboxes_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inboxes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          email_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          email_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          email_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_comments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          team_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          team_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          comment_id: string | null
          created_at: string
          email_id: string | null
          id: string
          is_read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          email_id?: string | null
          id?: string
          is_read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          email_id?: string | null
          id?: string
          is_read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "internal_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string | null
          id: string
          platform: string | null
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform?: string | null
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rules: {
        Row: {
          actions: Json
          conditions: Json
          conditions_match_type: Database["public"]["Enums"]["rule_match_type"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          owner_id: string | null
          scope: Database["public"]["Enums"]["template_scope"]
          team_id: string | null
          trigger_type: Database["public"]["Enums"]["rule_trigger_type"]
          updated_at: string | null
        }
        Insert: {
          actions?: Json
          conditions?: Json
          conditions_match_type?: Database["public"]["Enums"]["rule_match_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string | null
          scope?: Database["public"]["Enums"]["template_scope"]
          team_id?: string | null
          trigger_type: Database["public"]["Enums"]["rule_trigger_type"]
          updated_at?: string | null
        }
        Update: {
          actions?: Json
          conditions?: Json
          conditions_match_type?: Database["public"]["Enums"]["rule_match_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string | null
          scope?: Database["public"]["Enums"]["template_scope"]
          team_id?: string | null
          trigger_type?: Database["public"]["Enums"]["rule_trigger_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          content_text: string
          created_at: string
          id: string
          name: string
          owner_id: string | null
          scope: Database["public"]["Enums"]["template_scope"]
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          content_text: string
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          scope?: Database["public"]["Enums"]["template_scope"]
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content_text?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          scope?: Database["public"]["Enums"]["template_scope"]
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          linked_email_id: string | null
          notification_sent: boolean | null
          status: string
          team_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          linked_email_id?: string | null
          notification_sent?: boolean | null
          status?: string
          team_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          linked_email_id?: string | null
          notification_sent?: boolean | null
          status?: string
          team_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_linked_email_id_fkey"
            columns: ["linked_email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          task_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          task_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          task_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          joined_at: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          owner_id: string | null
          scope: Database["public"]["Enums"]["template_scope"]
          subject: string | null
          team_id: string | null
          updated_at: string | null
          show_in_shopify: boolean
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          scope?: Database["public"]["Enums"]["template_scope"]
          subject?: string | null
          team_id?: string | null
          updated_at?: string | null
          show_in_shopify?: boolean
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          scope?: Database["public"]["Enums"]["template_scope"]
          subject?: string | null
          team_id?: string | null
          updated_at?: string | null
          show_in_shopify?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pinned_threads: {
        Row: {
          created_at: string
          subject: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          subject?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          subject?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_inbox_role: {
        Args: { p_inbox_id: string }
        Returns: Database["public"]["Enums"]["inbox_role"]
      }
      get_user_open_tasks_count: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: number
      }
      get_user_team_role: {
        Args: { p_team_id: string }
        Returns: Database["public"]["Enums"]["team_role"]
      }
      has_inbox_access: {
        Args: { p_inbox_id: string; p_min_role?: string }
        Returns: boolean
      }
      is_team_admin: { Args: { p_team_id: string }; Returns: boolean }
      is_user_assigned_to_email: {
        Args: { p_email_id: string; p_user_id: string }
        Returns: boolean
      }
      is_user_assigned_to_thread: {
        Args: { p_thread_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      email_direction: "inbound" | "outbound"
      email_status: "open" | "in_progress" | "done"
      inbox_role: "admin" | "member" | "observer"
      inbox_type: "private" | "shared"
      rule_match_type: "all" | "any"
      rule_trigger_type: "incoming" | "outgoing" | "user_action"
      team_role: "owner" | "admin" | "member"
      template_scope: "private" | "team"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

// ── Convenience type aliases ──
export type Email = Tables<'emails'>
export type EmailAssignment = Tables<'email_assignments'>
export type EmailAttachment = Tables<'email_attachments'>
export type EmailLabel = Tables<'email_labels'>
export type EmailStatus = Enums<'email_status'>
export type EmailDirection = Enums<'email_direction'>
export type InternalComment = Tables<'internal_comments'>
export type Profile = Tables<'profiles'>
export type Inbox = Tables<'inboxes'>
export type InboxMember = Tables<'inbox_members'>
export type InboxRole = Enums<'inbox_role'>
export type InboxType = Enums<'inbox_type'>
export type InboxAlias = Tables<'inbox_aliases'>
export type Team = Tables<'teams'>
export type TeamMember = Tables<'team_members'>
export type TeamRole = Enums<'team_role'>
export type Label = Tables<'labels'>
export type Template = Tables<'templates'>
export type Task = Tables<'tasks'>
export type TaskComment = Tables<'task_comments'>
export type Rule = Tables<'rules'>
export type Signature = Tables<'signatures'>
export type Notification = Tables<'notifications'>
export type PushToken = Tables<'push_tokens'>
export type Draft = Tables<'drafts'>
export type UserPinnedThread = Tables<'user_pinned_threads'>

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      email_direction: ["inbound", "outbound"],
      email_status: ["open", "in_progress", "done"],
      inbox_role: ["admin", "member", "observer"],
      inbox_type: ["private", "shared"],
      rule_match_type: ["all", "any"],
      rule_trigger_type: ["incoming", "outgoing", "user_action"],
      team_role: ["owner", "admin", "member"],
      template_scope: ["private", "team"],
    },
  },
} as const

