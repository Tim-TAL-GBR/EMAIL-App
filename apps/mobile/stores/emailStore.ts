/**
 * Email Store
 *
 * Manages email threads for the active inbox.
 * Supports fetching, status updates, and star toggling.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { ContextType, useNavigationStore } from './navigationStore';

/** Email status enum matching the database */
export type EmailStatus = 'open' | 'in_progress' | 'done';

/** Email data shape from Supabase */
export interface Email {
  id: string;
  inbox_id: string;
  team_id: string;
  message_id: string | null;
  thread_id: string | null;
  subject: string | null;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[] | null;
  bcc_addresses: string[] | null;
  body_text: string | null;
  body_html?: string | null;
  snippet?: string | null;
  direction: 'inbound' | 'outbound';
  status: EmailStatus;
  is_read: boolean;
  is_starred: boolean;
  is_deleted: boolean;
  last_activity_at?: string;
  received_at: string;
  created_at: string;
  updated_at: string | null;
  snooze_until: string | null;
  email_assignments?: { assigned_to: string }[];
  email_attachments?: {
    id: string;
    file_name: string;
    content_type: string;
    size_bytes: number;
    storage_path: string;
    is_inline: boolean;
  }[];
}

export interface Thread {
  id: string; // The thread_id, or email.id if null
  emails: Email[]; // Sorted oldest to newest
  latestEmail: Email; // The most recent email
  subject: string;
  is_read: boolean;
  is_starred: boolean;
  participants: string[];
}

function computeThreads(emails: Email[]): Thread[] {
  const threadMap = new Map<string, Email[]>();
  
  emails.forEach(email => {
    // Falls thread_id fehlt, kann die E-Mail selbst der Start eines Threads sein.
    // Dann nutzen wir ihre eigene message_id als Gruppierungsschlüssel.
    const key = email.thread_id || email.message_id || email.id;
    if (!threadMap.has(key)) threadMap.set(key, []);
    threadMap.get(key)!.push(email);
  });

  const threads: Thread[] = [];
  for (const [id, threadEmails] of threadMap.entries()) {
    threadEmails.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
    const latestEmail = threadEmails[threadEmails.length - 1];
    
    const pSet = new Set<string>();
    threadEmails.forEach(e => {
      pSet.add(e.from_address);
      e.to_addresses.forEach(t => pSet.add(t));
    });

    threads.push({
      id,
      emails: threadEmails,
      latestEmail,
      subject: latestEmail.subject || "(Kein Betreff)",
      is_read: threadEmails.every(e => e.is_read),
      is_starred: threadEmails.some(e => e.is_starred),
      participants: Array.from(pSet)
    });
  }

  threads.sort((a, b) => {
    const aTime = a.latestEmail.last_activity_at ? new Date(a.latestEmail.last_activity_at).getTime() : new Date(a.latestEmail.received_at).getTime();
    const bTime = b.latestEmail.last_activity_at ? new Date(b.latestEmail.last_activity_at).getTime() : new Date(b.latestEmail.received_at).getTime();
    return bTime - aTime;
  });
  return threads;
}

/** Shape of the email state and actions */
interface EmailState {
  /** All raw emails for the current context */
  emails: Email[];
  /** Grouped and sorted threads */
  threads: Thread[];
  /** Currently selected email/thread ID */
  activeEmailId: string | null;
  /** Whether emails are being fetched */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  _currentFetchId: number;

  /** Fetch emails for the active context */
  fetchEmails: (inboxIds: string[], labelId?: string, contextType?: string) => Promise<void>;
  /** Set the active email/thread by ID */
  setActiveEmail: (id: string | null) => void;
  /** Get a single email by ID */
  getEmailById: (id: string) => Email | undefined;
  /** Update the status of an email */
  updateEmailStatus: (emailId: string, status: EmailStatus) => Promise<void>;
  /** Snooze an email until a certain date */
  snoozeEmail: (emailId: string, until: Date) => Promise<void>;
  /** Toggle the starred state of an email */
  toggleStar: (emailId: string) => Promise<void>;
  /** Mark an email as read */
  markAsRead: (emailId: string) => Promise<void>;
  /** Add a single email to the list (used by realtime) */
  addEmail: (email: Email) => void;
  /** Update a single email in the list (used by realtime) */
  updateEmail: (email: Partial<Email> & { id: string }) => void;
  /** Remove an email from the list (used by realtime) */
  removeEmail: (emailId: string) => void;
  /** Archive an email */
  archiveEmail: (emailId: string) => Promise<void>;
  /** Delete an email */
  deleteEmail: (emailId: string) => Promise<void>;

  /** Pinned threads for the sidebar */
  pinnedThreads: { thread_id: string, subject: string, created_at: string }[];
  /** Fetch user's pinned threads */
  fetchPinnedThreads: () => Promise<void>;
  /** Toggle pin status of a thread */
  togglePinThread: (threadId: string, subject: string) => Promise<void>;
}

export const useEmailStore = create<EmailState>((set, get) => ({
  emails: [],
  threads: [],
  activeEmailId: null,
  isLoading: false,
  error: null,

  getEmailById: (id) => {
    return get().emails.find((email) => email.id === id);
  },

  _currentFetchId: 0,
  
  fetchEmails: async (inboxIds: string[], labelId?: string, contextType?: string) => {
    const fetchId = Date.now();
    set({ isLoading: true, error: null, _currentFetchId: fetchId });

    if (contextType !== 'assigned' && (!inboxIds || inboxIds.length === 0)) {
      set({ emails: [], threads: [], isLoading: false });
      return;
    }

    try {
      const baseColumns = 'id, inbox_id, team_id, message_id, thread_id, subject, from_address, to_addresses, cc_addresses, bcc_addresses, direction, status, is_read, is_starred, is_deleted, is_archived, received_at, created_at, updated_at, imap_uid, mailbox_name, tags, snooze_until, last_activity_at, snippet';

      let query = supabase
        .from('emails')
        .select(
          labelId 
            ? `${baseColumns}, email_assignments!inner(assigned_to), email_attachments(id, file_name, content_type, size_bytes, storage_path, is_inline), email_labels!inner(label_id)`
            : `${baseColumns}, email_assignments(assigned_to), email_attachments(id, file_name, content_type, size_bytes, storage_path, is_inline)`
        )
        .eq('is_archived', false)
        .eq('is_deleted', false);
        
      if (contextType === 'assigned') {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        query = supabase
          .from('emails')
          .select(`${baseColumns}, email_assignments!inner(assigned_to), email_attachments(id, file_name, content_type, size_bytes, storage_path, is_inline)`)
          .eq('is_archived', false)
          .eq('is_deleted', false)
          .eq('email_assignments.assigned_to', userId);
      } else {
        query = query.in('inbox_id', inboxIds);
      }
      
      if (labelId) {
        query = query.eq('email_labels.label_id', labelId);
      }
      
      const { data, error } = await query.order('last_activity_at', { ascending: false }).limit(200);

      if (error) {
        console.error('Fetch emails error:', error);
        set({ error: error.message, isLoading: false });
        return;
      }

      if (get()._currentFetchId !== fetchId) {
        console.log('[DEBUG] Ignoring stale fetchEmails response');
        return;
      }

      const emails = (data as Email[]) ?? [];
      set({ emails, threads: computeThreads(emails), isLoading: false });
    } catch (err) {
      if (get()._currentFetchId !== fetchId) return;
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch emails',
        isLoading: false,
      });
    }
  },

  setActiveEmail: (id) => {
    set({ activeEmailId: id });

    // Auto-mark as read when selecting
    if (id) {
      const email = get().emails.find((e) => e.id === id);
      if (email && !email.is_read) {
        get().markAsRead(id);
      }
    }
  },

  updateEmailStatus: async (emailId, status) => {
    const oldEmail = get().emails.find(e => e.id === emailId);
    if (!oldEmail) return;
    const oldStatus = oldEmail.status;

    // Optimistic update
    set((state) => {
      const emails = state.emails.map((e) =>
        e.id === emailId ? { ...e, status } : e,
      );
      return { emails, threads: computeThreads(emails) };
    });

    const { error } = await supabase
      .from('emails')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', emailId);

    if (error) {
      // Revert on error
      set((state) => {
        const emails = state.emails.map((e) =>
          e.id === emailId ? { ...e, status: oldStatus } : e,
        );
        return { emails, threads: computeThreads(emails) };
      });
    }
  },

  snoozeEmail: async (emailId, until) => {
    const oldEmail = get().emails.find(e => e.id === emailId);
    if (!oldEmail) return;
    const oldSnooze = oldEmail.snooze_until;
    const newSnoozeStr = until.toISOString();

    set((state) => {
      const emails = state.emails.map((e) =>
        e.id === emailId ? { ...e, snooze_until: newSnoozeStr, status: 'done' as EmailStatus } : e,
      );
      return { emails, threads: computeThreads(emails) };
    });

    const { error } = await supabase
      .from('emails')
      .update({ snooze_until: newSnoozeStr, status: 'done', updated_at: new Date().toISOString() })
      .eq('id', emailId);

    if (error) {
      set((state) => {
        const emails = state.emails.map((e) =>
          e.id === emailId ? { ...e, snooze_until: oldSnooze, status: oldEmail.status } : e,
        );
        return { emails, threads: computeThreads(emails) };
      });
    }
  },

  toggleStar: async (emailId) => {
    const email = get().emails.find((e) => e.id === emailId);
    if (!email) return;

    const newStarred = !email.is_starred;

    // Optimistic update
    set((state) => {
      const emails = state.emails.map((e) =>
        e.id === emailId ? { ...e, is_starred: newStarred } : e,
      );
      return { emails, threads: computeThreads(emails) };
    });

    const { error } = await supabase
      .from('emails')
      .update({ is_starred: newStarred })
      .eq('id', emailId);

    if (error) {
      // Revert on error
      set((state) => {
        const emails = state.emails.map((e) =>
          e.id === emailId ? { ...e, is_starred: !newStarred } : e,
        );
        return { emails, threads: computeThreads(emails) };
      });
    }
  },

  markAsRead: async (emailId) => {
    set((state) => {
      const emails = state.emails.map((e) =>
        e.id === emailId ? { ...e, is_read: true } : e,
      );
      return { emails, threads: computeThreads(emails) };
    });

    await supabase
      .from('emails')
      .update({ is_read: true })
      .eq('id', emailId);
  },

  addEmail: (email) => {
    set((state) => {
      // Prevent duplicates from realtime INSERT events
      if (state.emails.some((e) => e.id === email.id)) {
        return state;
      }
      const emails = [email, ...state.emails];
      return {
        emails,
        threads: computeThreads(emails),
      };
    });
  },

  updateEmail: (updatedEmail) => {
    set((state) => {
      const emails = state.emails.map((e) =>
        e.id === updatedEmail.id ? { ...e, ...updatedEmail } : e,
      );
      return { emails, threads: computeThreads(emails) };
    });
  },

  removeEmail: (emailId) => {
    set((state) => {
      const emails = state.emails.filter((e) => e.id !== emailId);
      return {
        emails,
        threads: computeThreads(emails),
        activeEmailId: state.activeEmailId === emailId ? null : state.activeEmailId,
      };
    });
  },

  archiveEmail: async (emailId) => {
    // Optimistic removal
    get().removeEmail(emailId);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/emails/${emailId}/archive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      if (!response.ok) throw new Error('Failed to archive');
    } catch (e) {
      console.error(e);
      // Ideally revert optimistic update, but keeping it simple for now
    }
  },

  deleteEmail: async (emailId) => {
    get().removeEmail(emailId);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/emails/${emailId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      if (!response.ok) throw new Error('Failed to delete');
    } catch (e) {
      console.error(e);
      // Revert omitted for brevity
    }
  },

  pinnedThreads: [],

  fetchPinnedThreads: async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) return;

    const { data, error } = await supabase
      .from('user_pinned_threads')
      .select('thread_id, subject, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) {
      set({ pinnedThreads: data });
    }
  },

  togglePinThread: async (threadId, subject) => {
    const current = get().pinnedThreads;
    const isPinned = current.some(p => p.thread_id === threadId);

    if (isPinned) {
      set({ pinnedThreads: current.filter(p => p.thread_id !== threadId) });
      await supabase.from('user_pinned_threads').delete().eq('thread_id', threadId);
    } else {
      const newPin = { thread_id: threadId, subject, created_at: new Date().toISOString() };
      set({ pinnedThreads: [newPin, ...current] });
      await supabase.from('user_pinned_threads').insert([
        { thread_id: threadId, subject }
      ]);
    }
  }
}));
