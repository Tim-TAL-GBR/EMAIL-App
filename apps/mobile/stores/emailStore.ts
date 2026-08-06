/**
 * Email Store
 *
 * Manages email threads for the active inbox.
 * Supports fetching, status updates, and star toggling.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineSyncStore } from './offlineSyncStore';
import { supabase } from '../lib/supabase';
import { ContextType, useNavigationStore } from './navigationStore';
import { API_URL } from "@/lib/constants";

/** Returns a valid Bearer token, refreshing the session if needed. Throws if not authenticated. */
async function getValidToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    // Force a session refresh in case the token is stale
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error('Session abgelaufen – bitte neu einloggen.');
    }
    return refreshed.session.access_token;
  }
  return session.access_token;
}

/**
 * Picks the thread that should be selected after a thread was removed.
 * Prefers the next thread in the list that is actually DISPLAYED
 * (visibleThreadIds), falling back to the full store list. This prevents a
 * closed/filtered-out conversation from opening after a delete/archive.
 */
function pickNextVisibleThreadId(
  visibleIds: string[],
  removedThreadId: string,
  originalThreads: Thread[],
  newThreads: Thread[],
): string | null {
  const exists = (id: string | undefined) => id !== undefined && newThreads.some(t => t.id === id);

  const removedIndex = visibleIds.indexOf(removedThreadId);
  if (removedIndex !== -1) {
    const after = visibleIds.slice(removedIndex + 1).find(id => exists(id));
    if (after) return after;
    const before = visibleIds.slice(0, removedIndex).reverse().find(id => exists(id));
    if (before) return before;
  }

  const deletedIndex = originalThreads.indexOf(originalThreads.find(t => t.id === removedThreadId) as Thread);
  const nextInOriginal = originalThreads[deletedIndex + 1];
  const prevInOriginal = originalThreads[deletedIndex - 1];
  const fallback = newThreads.find(t => t.id === nextInOriginal?.id)
    ?? newThreads.find(t => t.id === prevInOriginal?.id)
    ?? newThreads[Math.min(deletedIndex, newThreads.length - 1)]
    ?? newThreads[newThreads.length - 1]
    ?? newThreads[0];
  return fallback?.id ?? null;
}

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
  is_archived: boolean;
  mailbox_name: string;
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
    const fallbackKey = email.subject ? `${email.subject}|${email.from_address}` : email.id;
    const key = email.thread_id || email.message_id || fallbackKey;
    
    if (!threadMap.has(key)) threadMap.set(key, []);
    threadMap.get(key)!.push(email);
  });

  const threads: Thread[] = [];
  for (const [id, threadEmails] of threadMap.entries()) {
    threadEmails.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
    
    const uniqueEmails: Email[] = [];
    const seen = new Set<string>();
    threadEmails.forEach(e => {
      const dedupKey = (e.subject && e.received_at) ? `${e.subject}|${e.from_address}|${e.received_at}` : e.id;
      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        uniqueEmails.push(e);
      }
    });

    const latestEmail = uniqueEmails[uniqueEmails.length - 1];
    if (!latestEmail) continue;
    
    const pSet = new Set<string>();
    uniqueEmails.forEach(e => {
      pSet.add(e.from_address);
      e.to_addresses.forEach(t => pSet.add(t));
    });

    threads.push({
      id,
      emails: uniqueEmails,
      latestEmail,
      subject: latestEmail.subject || "(Kein Betreff)",
      is_read: uniqueEmails.every(e => e.is_read),
      is_starred: uniqueEmails.some(e => e.is_starred),
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


const MAX_EMAILS = 500;

// Batching queues for realtime updates
type UpdateOperation = 
  | { type: 'add', payload: Email }
  | { type: 'update', payload: Partial<Email> & { id: string } }
  | { type: 'remove', payload: { id: string } };

let _updateQueue: UpdateOperation[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function _queueEmailUpdate(type: 'add' | 'update' | 'remove', payload: any) {
  _updateQueue.push({ type, payload } as UpdateOperation);
}

function _flushEmailUpdates(set: any, get: any) {
  if (_flushTimer) return; // already scheduled
  
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    if (_updateQueue.length === 0) return;
    
    const queue = [..._updateQueue];
    _updateQueue = [];
    
    set((state: any) => {
      let emails = [...state.emails];
      let needsRecompute = false;
      const { activeMailbox } = useNavigationStore.getState();
      
      for (const op of queue) {
        if (op.type === 'add') {
          const email = op.payload as Email;
          if (!emails.some(e => e.id === email.id)) {
            if (!activeMailbox || email.mailbox_name === activeMailbox) {
              emails.unshift(email);
              needsRecompute = true;
            }
          }
        } else if (op.type === 'update') {
          const updatedEmail = op.payload as Partial<Email> & { id: string };
          const idx = emails.findIndex(e => e.id === updatedEmail.id);
          if (idx !== -1) {
            emails[idx] = { ...emails[idx], ...updatedEmail };
            needsRecompute = true; // Could optimize by doing granular thread updates, but recompute is safer for batching
          }
        } else if (op.type === 'remove') {
          const id = op.payload.id;
          const initialLength = emails.length;
          emails = emails.filter(e => e.id !== id);
          if (emails.length !== initialLength) {
            needsRecompute = true;
          }
        }
      }
      
      if (!needsRecompute) return state;
      
      emails = emails.slice(0, MAX_EMAILS);
      return {
        emails,
        threads: computeThreads(emails),
      };
    });
  }, 300); // 300ms batching window
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
  _fetchOffset: number;

  /** Whether more emails are being fetched */
  isLoadingMore: boolean;
  /** Whether there are more emails to fetch */
  hasMoreEmails: boolean;

  /** Fetch emails for the active context */
  fetchEmails: (inboxIds: string[], labelId?: string, contextType?: string, filterType?: string, mailboxName?: string) => Promise<void>;
  /** Fetch next page of emails */
  fetchMoreEmails: (inboxIds: string[], labelId?: string, contextType?: string, filterType?: string, mailboxName?: string) => Promise<void>;
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
  /** IDs of the currently displayed threads (in list order) – used to pick the next thread after delete/archive */
  visibleThreadIds: string[];
  /** Keep in sync with the thread list actually rendered in the UI */
  setVisibleThreadIds: (ids: string[]) => void;
  /** Bulk action on multiple emails (read/archive/delete) */
  bulkActionEmails: (emailIds: string[], action: 'read' | 'archive' | 'delete') => Promise<void>;
  archiveThread: (threadId: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;

  /** Pinned threads for the sidebar */
  pinnedThreads: { thread_id: string, subject: string, created_at: string }[];
  /** Fetch user's pinned threads */
  fetchPinnedThreads: () => Promise<void>;
  /** Toggle pin status of a thread */
  togglePinThread: (threadId: string, subject: string) => Promise<void>;
}

export const useEmailStore = create<EmailState>()(
  persist(
    (set, get) => ({
  emails: [],
  threads: [],
  activeEmailId: null,
  visibleThreadIds: [],
  setVisibleThreadIds: (ids) => set({ visibleThreadIds: ids }),
  isLoading: false,
  isLoadingMore: false,
  hasMoreEmails: true,
  _currentFetchId: 0,
  _fetchOffset: 0,
  error: null,

  getEmailById: (id) => {
    return get().emails.find((email) => email.id === id);
  },
  
  fetchEmails: async (inboxIds: string[], labelId?: string, contextType?: string, filterType?: string, mailboxName?: string) => {
    const fetchId = Date.now();
    set({ isLoading: true, isLoadingMore: false, error: null, _currentFetchId: fetchId, _fetchOffset: 0 });

    if (contextType !== 'assigned' && (!inboxIds || inboxIds.length === 0)) {
      set({ emails: [], threads: [], isLoading: false });
      return;
    }

    try {
      const baseColumns = 'id, inbox_id, team_id, message_id, thread_id, subject, from_address, to_addresses, cc_addresses, bcc_addresses, direction, status, is_read, is_starred, is_deleted, is_archived, received_at, created_at, updated_at, imap_uid, mailbox_name, tags, snooze_until, last_activity_at, snippet';

      let query: any;
      
      if (contextType === 'global_inbox') {
        query = supabase.rpc('get_global_inbox_emails').select(
          labelId 
            ? `${baseColumns}, email_assignments!inner(assigned_to), email_attachments(id, file_name, content_type, size_bytes, storage_path, is_inline), email_labels!inner(label_id)`
            : `${baseColumns}, email_assignments(assigned_to), email_attachments(id, file_name, content_type, size_bytes, storage_path, is_inline)`
        );
      } else {
        query = supabase
          .from('emails')
          .select(
            labelId 
              ? `${baseColumns}, email_assignments!inner(assigned_to), email_attachments(id, file_name, content_type, size_bytes, storage_path, is_inline), email_labels!inner(label_id)`
              : `${baseColumns}, email_assignments(assigned_to), email_attachments(id, file_name, content_type, size_bytes, storage_path, is_inline)`
          );
          
        if (contextType === 'assigned') {
          const userId = (await supabase.auth.getUser()).data.user?.id;
          query = query.eq('email_assignments.assigned_to', userId);
        } else {
          query = query.in('inbox_id', inboxIds);
        }
      }
      
      if (filterType === 'trash') {
        query = query.eq('is_deleted', true);
      } else if (filterType === 'archived') {
        query = query.eq('is_archived', true);
      } else if (filterType === 'sent') {
        query = query.eq('direction', 'outbound').eq('is_deleted', false);
      } else if (filterType === 'needs_attention') {
        query = query.eq('is_archived', false).eq('is_deleted', false).neq('status', 'done');
      } else if (filterType === 'done') {
        query = query.eq('is_archived', false).eq('is_deleted', false).eq('status', 'done');
      } else if (!mailboxName) {
        query = query.eq('is_archived', false).eq('is_deleted', false);
      }

      if (mailboxName) {
        query = query.eq('mailbox_name', mailboxName);
      }
      
      if (labelId) {
        query = query.eq('email_labels.label_id', labelId);
      }
      
      const limit = 50;
      const { data, error } = await query.order('last_activity_at', { ascending: false }).order('id', { ascending: false }).limit(limit);

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
      set({ emails, threads: computeThreads(emails), isLoading: false, hasMoreEmails: emails.length === limit, _fetchOffset: emails.length });
    } catch (err) {
      if (get()._currentFetchId !== fetchId) return;
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch emails',
        isLoading: false,
      });
    }
  },

  fetchMoreEmails: async (inboxIds: string[], labelId?: string, contextType?: string, filterType?: string, mailboxName?: string) => {
    if (get().isLoadingMore || !get().hasMoreEmails) return;
    const fetchId = Date.now();
    set({ isLoadingMore: true, error: null, _currentFetchId: fetchId });

    if (contextType !== 'assigned' && (!inboxIds || inboxIds.length === 0)) {
      set({ isLoadingMore: false });
      return;
    }

    try {
      const baseColumns = 'id, inbox_id, team_id, message_id, thread_id, subject, from_address, to_addresses, cc_addresses, bcc_addresses, direction, status, is_read, is_starred, is_deleted, is_archived, received_at, created_at, updated_at, imap_uid, mailbox_name, tags, snooze_until, last_activity_at, snippet';

      let query: any;

      if (contextType === 'global_inbox') {
        query = supabase.rpc('get_global_inbox_emails').select(
          labelId 
            ? `${baseColumns}, email_assignments!inner(assigned_to), email_attachments(id, file_name, content_type, size_bytes, storage_path, is_inline), email_labels!inner(label_id)`
            : `${baseColumns}, email_assignments(assigned_to), email_attachments(id, file_name, content_type, size_bytes, storage_path, is_inline)`
        );
      } else {
        query = supabase
          .from('emails')
          .select(
            labelId 
              ? `${baseColumns}, email_assignments!inner(assigned_to), email_attachments(id, file_name, content_type, size_bytes, storage_path, is_inline), email_labels!inner(label_id)`
              : `${baseColumns}, email_assignments(assigned_to), email_attachments(id, file_name, content_type, size_bytes, storage_path, is_inline)`
          );

        if (contextType === 'assigned') {
          const userId = (await supabase.auth.getUser()).data.user?.id;
          query = query.eq('email_assignments.assigned_to', userId);
        } else {
          query = query.in('inbox_id', inboxIds);
        }
      }
      
      if (filterType === 'trash') {
        query = query.eq('is_deleted', true);
      } else if (filterType === 'archived') {
        query = query.eq('is_archived', true);
      } else if (filterType === 'sent') {
        query = query.eq('direction', 'outbound').eq('is_deleted', false);
      } else if (filterType === 'needs_attention') {
        query = query.eq('is_archived', false).eq('is_deleted', false).neq('status', 'done');
      } else if (filterType === 'done') {
        query = query.eq('is_archived', false).eq('is_deleted', false).eq('status', 'done');
      } else if (!mailboxName) {
        query = query.eq('is_archived', false).eq('is_deleted', false);
      }

      if (mailboxName) {
        query = query.eq('mailbox_name', mailboxName);
      }
      
      if (labelId) {
        query = query.eq('email_labels.label_id', labelId);
      }
      
      const currentEmails = get().emails;
      const offset = get()._fetchOffset;
      const limit = 50;
      
      const { data, error } = await query
        .order('last_activity_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Fetch more emails error:', error);
        set({ error: error.message, isLoadingMore: false });
        return;
      }

      if (get()._currentFetchId !== fetchId) {
        console.log('[DEBUG] Ignoring stale fetchMoreEmails response');
        return;
      }

      const newEmails = (data as Email[]) ?? [];
      
      // Filter out any potential duplicates that might have been added via realtime while fetching
      const existingIds = new Set(currentEmails.map(e => e.id));
      const uniqueNewEmails = newEmails.filter(e => !existingIds.has(e.id));
      
      const allEmails = [...currentEmails, ...uniqueNewEmails].slice(0, MAX_EMAILS);
      
      set({ 
        emails: allEmails, 
        threads: computeThreads(allEmails), 
        isLoadingMore: false, 
        hasMoreEmails: newEmails.length === limit && allEmails.length < MAX_EMAILS && uniqueNewEmails.length > 0,
        _fetchOffset: offset + limit
      });
    } catch (err) {
      if (get()._currentFetchId !== fetchId) return;
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch more emails',
        isLoadingMore: false,
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
      const threads = state.threads.map(t => {
        if (t.emails.some(e => e.id === emailId)) {
          return {
            ...t,
            emails: t.emails.map(e => e.id === emailId ? { ...e, status } : e),
            latestEmail: t.latestEmail.id === emailId ? { ...t.latestEmail, status } : t.latestEmail
          };
        }
        return t;
      });
      return { emails, threads };
    });

    const { error } = await supabase
      .from('emails')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', emailId);

    if (error) {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        useOfflineSyncStore.getState().queueAction('UPDATE_STATUS', { emailId, status });
      } else {
        // Revert on error
        set((state) => {
          const emails = state.emails.map((e) =>
            e.id === emailId ? { ...e, status: oldStatus } : e,
          );
          const threads = state.threads.map(t => {
            if (t.emails.some(e => e.id === emailId)) {
              return {
                ...t,
                emails: t.emails.map(e => e.id === emailId ? { ...e, status: oldStatus } : e),
                latestEmail: t.latestEmail.id === emailId ? { ...t.latestEmail, status: oldStatus } : t.latestEmail
              };
            }
            return t;
          });
          return { emails, threads };
        });
      }
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
      const threads = state.threads.map(t => {
        if (t.emails.some(e => e.id === emailId)) {
          return {
            ...t,
            emails: t.emails.map(e => e.id === emailId ? { ...e, snooze_until: newSnoozeStr, status: 'done' as EmailStatus } : e),
            latestEmail: t.latestEmail.id === emailId ? { ...t.latestEmail, snooze_until: newSnoozeStr, status: 'done' as EmailStatus } : t.latestEmail
          };
        }
        return t;
      });
      return { emails, threads };
    });

    const { error } = await supabase
      .from('emails')
      .update({ snooze_until: newSnoozeStr, status: 'done', updated_at: new Date().toISOString() })
      .eq('id', emailId);

    if (error) {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        useOfflineSyncStore.getState().queueAction('SNOOZE', { emailId, until: newSnoozeStr });
      } else {
        set((state) => {
          const emails = state.emails.map((e) =>
            e.id === emailId ? { ...e, snooze_until: oldSnooze, status: oldEmail.status } : e,
          );
          const threads = state.threads.map(t => {
            if (t.emails.some(e => e.id === emailId)) {
              return {
                ...t,
                emails: t.emails.map(e => e.id === emailId ? { ...e, snooze_until: oldSnooze, status: oldEmail.status } : e),
                latestEmail: t.latestEmail.id === emailId ? { ...t.latestEmail, snooze_until: oldSnooze, status: oldEmail.status } : t.latestEmail
              };
            }
            return t;
          });
          return { emails, threads };
        });
      }
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
      const threads = state.threads.map(t => {
        if (t.emails.some(e => e.id === emailId)) {
          const updatedEmails = t.emails.map(e => e.id === emailId ? { ...e, is_starred: newStarred } : e);
          return {
            ...t,
            emails: updatedEmails,
            latestEmail: t.latestEmail.id === emailId ? { ...t.latestEmail, is_starred: newStarred } : t.latestEmail,
            is_starred: updatedEmails.some(e => e.is_starred)
          };
        }
        return t;
      });
      return { emails, threads };
    });

    const { error } = await supabase
      .from('emails')
      .update({ is_starred: newStarred })
      .eq('id', emailId);

    if (error) {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        useOfflineSyncStore.getState().queueAction('TOGGLE_STAR', { emailId });
      } else {
        // Revert on error
        set((state) => {
          const emails = state.emails.map((e) =>
            e.id === emailId ? { ...e, is_starred: !newStarred } : e,
          );
          const threads = state.threads.map(t => {
            if (t.emails.some(e => e.id === emailId)) {
              const updatedEmails = t.emails.map(e => e.id === emailId ? { ...e, is_starred: !newStarred } : e);
              return {
                ...t,
                emails: updatedEmails,
                latestEmail: t.latestEmail.id === emailId ? { ...t.latestEmail, is_starred: !newStarred } : t.latestEmail,
                is_starred: updatedEmails.some(e => e.is_starred)
              };
            }
            return t;
          });
          return { emails, threads };
        });
      }
    }
  },

  markAsRead: async (emailId) => {
    const oldEmail = get().emails.find(e => e.id === emailId);
    if (!oldEmail) return;
    const oldRead = oldEmail.is_read;

    set((state) => {
      const emails = state.emails.map((e) =>
        e.id === emailId ? { ...e, is_read: true } : e,
      );
      const threads = state.threads.map(t => {
        if (t.emails.some(e => e.id === emailId)) {
          const updatedEmails = t.emails.map(e => e.id === emailId ? { ...e, is_read: true } : e);
          return {
            ...t,
            emails: updatedEmails,
            latestEmail: t.latestEmail.id === emailId ? { ...t.latestEmail, is_read: true } : t.latestEmail,
            is_read: updatedEmails.every(e => e.is_read)
          };
        }
        return t;
      });
      return { emails, threads };
    });

    const { error } = await supabase
      .from('emails')
      .update({ is_read: true })
      .eq('id', emailId);

    if (error) {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        useOfflineSyncStore.getState().queueAction('MARK_READ', { emailId });
      } else {
        // Revert on error
        set((state) => {
          const emails = state.emails.map((e) =>
            e.id === emailId ? { ...e, is_read: oldRead } : e,
          );
          const threads = state.threads.map(t => {
            if (t.emails.some(e => e.id === emailId)) {
              const updatedEmails = t.emails.map(e => e.id === emailId ? { ...e, is_read: oldRead } : e);
              return {
                ...t,
                emails: updatedEmails,
                latestEmail: t.latestEmail.id === emailId ? { ...t.latestEmail, is_read: oldRead } : t.latestEmail,
                is_read: updatedEmails.every(e => e.is_read)
              };
            }
            return t;
          });
          return { emails, threads };
        });
      }
    }
  },

  addEmail: (email) => {
    _queueEmailUpdate('add', email);
    _flushEmailUpdates(set, get);
  },

  updateEmail: (updatedEmail) => {
    _queueEmailUpdate('update', updatedEmail);
    _flushEmailUpdates(set, get);
  },

  removeEmail: (emailId) => {
    _queueEmailUpdate('remove', { id: emailId });
    _flushEmailUpdates(set, get);
  },

  archiveThread: async (threadId: string) => {
    const thread = get().threads.find(t => t.id === threadId);
    if (!thread || thread.emails.length === 0) return;
    
    const emailIds = thread.emails.map(e => e.id);
    const previousSelectedId = useNavigationStore.getState().selectedEmailId;
    
    // Auto-select next thread BEFORE optimistically deleting so we have the visible ids
    if (previousSelectedId === threadId) {
      const nextId = pickNextVisibleThreadId(get().visibleThreadIds, threadId, get().threads, get().threads.filter(t => t.id !== threadId));
      useNavigationStore.getState().setEmailId(nextId);
    }

    await get().bulkActionEmails(emailIds, 'archive');
  },

  deleteThread: async (threadId: string) => {
    const thread = get().threads.find(t => t.id === threadId);
    if (!thread || thread.emails.length === 0) return;
    
    const emailIds = thread.emails.map(e => e.id);
    const previousSelectedId = useNavigationStore.getState().selectedEmailId;
    
    // Auto-select next thread BEFORE optimistically deleting
    if (previousSelectedId === threadId) {
      const nextId = pickNextVisibleThreadId(get().visibleThreadIds, threadId, get().threads, get().threads.filter(t => t.id !== threadId));
      useNavigationStore.getState().setEmailId(nextId);
    }

    await get().bulkActionEmails(emailIds, 'delete');
  },

  bulkActionEmails: async (emailIds, action) => {
    const originalEmails = get().emails;
    const originalThreads = get().threads;
    const originalActive = get().activeEmailId;

    // Optimistic update
    set((state) => {
      let emails = [...state.emails];
      if (action === 'delete' || action === 'archive') {
        emails = emails.filter((e) => !emailIds.includes(e.id));
      } else if (action === 'read') {
        emails = emails.map((e) => emailIds.includes(e.id) ? { ...e, is_read: true } : e);
      }

      let threads = state.threads.map(t => {
        if (action === 'delete' || action === 'archive') {
          const newEmails = t.emails.filter(e => !emailIds.includes(e.id));
          if (newEmails.length === 0) return null;
          return {
            ...t,
            emails: newEmails,
            latestEmail: newEmails[newEmails.length - 1],
            is_read: newEmails.every(e => e.is_read),
            is_starred: newEmails.some(e => e.is_starred),
          };
        } else if (action === 'read') {
          if (t.emails.some(e => emailIds.includes(e.id))) {
            const newEmails = t.emails.map(e => emailIds.includes(e.id) ? { ...e, is_read: true } : e);
            return {
              ...t,
              emails: newEmails,
              latestEmail: newEmails[newEmails.length - 1],
              is_read: newEmails.every(e => e.is_read),
            };
          }
        }
        return t;
      }).filter(Boolean) as Thread[];

      return {
        emails,
        threads,
        activeEmailId: originalActive && emailIds.includes(originalActive) && (action === 'delete' || action === 'archive') ? null : originalActive,
      };
    });

    try {
      const token = await getValidToken();
      const response = await fetch(`${API_URL}/api/emails/bulk-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ emailIds, action })
      });
      const responseText = await response.text();
      if (!response.ok) {
        // Prevent huge HTML error pages from crashing the iOS Alert bridge
        const safeResponse = responseText.length > 200 ? responseText.substring(0, 200) + '...' : responseText;
        throw new Error(`Aktion fehlgeschlagen (${response.status}): ${safeResponse}`);
      }
    } catch (e: any) {
      console.error('[emailStore] bulkActionEmails error:', e.message);
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        if (action === 'read') {
          useOfflineSyncStore.getState().queueAction('MARK_READ', { emailIds });
        } else if (action === 'archive') {
          emailIds.forEach(id => useOfflineSyncStore.getState().queueAction('ARCHIVE', { emailId: id }));
        } else if (action === 'delete') {
          emailIds.forEach(id => useOfflineSyncStore.getState().queueAction('DELETE', { emailId: id }));
        }
        return;
      }
      // Revert optimistic update
      set({ emails: originalEmails, threads: originalThreads, activeEmailId: originalActive });
      throw e;
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const current = get().pinnedThreads;
    const isPinned = current.some(p => p.thread_id === threadId);

    if (isPinned) {
      set({ pinnedThreads: current.filter(p => p.thread_id !== threadId) });
      const { error } = await supabase
        .from('user_pinned_threads')
        .delete()
        .eq('user_id', user.id)
        .eq('thread_id', threadId);
      if (error) {
        set({ pinnedThreads: current });
      }
    } else {
      const newPin = { thread_id: threadId, subject, created_at: new Date().toISOString() };
      set({ pinnedThreads: [newPin, ...current] });
      const { error } = await supabase
        .from('user_pinned_threads')
        .insert([{ user_id: user.id, thread_id: threadId, subject }]);
      if (error) {
        set({ pinnedThreads: current });
      }
    }
  }
    }),
    {
      name: 'email-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ emails: state.emails, threads: state.threads, pinnedThreads: state.pinnedThreads }),
    }
  )
);
