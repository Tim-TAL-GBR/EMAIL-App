/**
 * Inbox Store
 *
 * Manages shared inboxes the current user has access to.
 * Fetches inbox data from Supabase (RLS handles authorization).
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/** Inbox data shape from Supabase */
export interface Inbox {
  id: string;
  name: string;
  email_address: string;
  type: 'shared' | 'private';
  color: string | null;
  description: string | null;
  signature_id: string | null;
  created_at: string;
  updated_at: string;
  /** User's role in this inbox (from inbox_members join) */
  inbox_members: { role: string }[];
  /** Count of unread emails – computed client-side or via RPC */
  unread_count?: number;
  /** Team this inbox belongs to */
  team?: { id: string; name: string } | null;
  avatar_url?: string | null;
  imap_host?: string;
  imap_user?: string;
  imap_pass?: string;
  imap_port?: number;
  smtp_host?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_port?: number;
  folder_archive?: string;
  folder_sent?: string;
  folder_trash?: string;
  folder_spam?: string;
  folder_drafts?: string;
  folder_inbox?: string;
  imap_secure?: boolean;
  smtp_secure?: boolean;
}

/** Shape of the inbox state and actions */
interface InboxState {
  /** All inboxes the user is a member of */
  inboxes: Inbox[];
  /** Currently selected inbox ID */
  activeInboxId: string | null;
  /** Whether inboxes are being fetched */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;

  /** Fetch all inboxes the user has access to */
  fetchInboxes: () => Promise<void>;
  /** Set the active inbox by ID */
  setActiveInbox: (id: string | null) => void;
  /** Get a single inbox by ID */
  getInboxById: (id: string) => Inbox | undefined;
  /** Update a single inbox in the local store */
  updateInbox: (inbox: Partial<Inbox> & { id: string }) => void;
}

/**
 * Zustand store for inbox management.
 *
 * Usage:
 * ```ts
 * const { inboxes, activeInboxId, fetchInboxes } = useInboxStore();
 * ```
 */
export const useInboxStore = create<InboxState>((set, get) => ({
  inboxes: [],
  activeInboxId: null,
  isLoading: false,
  error: null,

  fetchInboxes: async () => {
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('inboxes')
        .select('*, team:teams(id, name), inbox_members(role)')
        .order('name');

      if (error) {
        set({ error: error.message, isLoading: false });
        return;
      }

      set({ inboxes: (data as Inbox[]) ?? [], isLoading: false });

      // Auto-select first inbox if none is active
      const state = get();
      if (!state.activeInboxId && data && data.length > 0) {
        set({ activeInboxId: data[0].id });
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch inboxes',
        isLoading: false,
      });
    }
  },

  setActiveInbox: (id) => {
    set({ activeInboxId: id });
  },

  getInboxById: (id) => {
    return get().inboxes.find((inbox) => inbox.id === id);
  },

  updateInbox: (updatedInbox) => {
    set((state) => ({
      inboxes: state.inboxes.map((inbox) =>
        inbox.id === updatedInbox.id ? { ...inbox, ...updatedInbox } : inbox,
      ),
    }));
  },
}));
