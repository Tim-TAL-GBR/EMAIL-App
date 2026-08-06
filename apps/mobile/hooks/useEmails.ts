/**
 * useEmails Hook
 *
 * Fetches emails for a given inbox and sets up Supabase Realtime
 * subscriptions to handle INSERT, UPDATE, and DELETE events.
 * Automatically re-subscribes when inboxId changes.
 *
 * Fix: Remove any stale channel before creating a new one to prevent
 * the React Strict Mode double-invoke crash.
 */

import { useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useEmailStore, type Email } from '../stores/emailStore';
import { ContextType, useNavigationStore } from '../stores/navigationStore';

export function useEmails(inboxIds: string[], labelId?: string, activeContextType?: string, activeFilter?: string) {
  const store = useEmailStore();
  const activeMailbox = useNavigationStore(s => s.activeMailbox);
  const inboxIdsStr = JSON.stringify(inboxIds);

  useEffect(() => {
    if (activeContextType !== 'assigned' && activeContextType !== 'global_inbox' && (!inboxIds || inboxIds.length === 0)) {
      store.fetchEmails([]);
      return;
    }

    store.fetchEmails(inboxIds, labelId, activeContextType, activeFilter, activeMailbox || undefined);

    if (!inboxIds || inboxIds.length === 0) {
      return;
    }

    const channelName = `emails-inboxes-${inboxIds[0]}-${inboxIds.length}-${labelId || 'no-label'}`;
    const filterString = `inbox_id=in.(${inboxIds.join(',')})`;

    // Remove stale channel (React Strict Mode double-invoke guard)
    const stale = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
    if (stale) supabase.removeChannel(stale);

    // If filtering by label, we skip realtime inserts for now because 
    // we can't easily join email_labels in the postgres_changes realtime filter.
    // Realtime updates (read, status) on existing emails will still work.
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'emails', filter: filterString },
        (payload) => { 
          if (!labelId) store.addEmail(payload.new as Email); 
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'emails', filter: filterString },
        (payload) => { store.updateEmail(payload.new as Partial<Email> & { id: string }); },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'emails', filter: filterString },
        (payload) => {
          const deleted = payload.old as { id?: string };
          if (deleted.id) store.removeEmail(deleted.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxIdsStr, labelId, activeFilter, activeMailbox]);

    const isInboxView = activeContextType !== 'assigned' && !activeMailbox && activeFilter !== 'archived' && activeFilter !== 'trash' && activeFilter !== 'sent' && activeFilter !== 'drafts';
    const filteredThreads = useMemo(() => {
      return isInboxView ? store.threads.filter(t => !t.emails.every(e => e.direction === 'outbound')) : store.threads;
    }, [isInboxView, store.threads]);

    return {
    emails: store.emails,
    threads: filteredThreads,
    activeEmailId: store.activeEmailId,
    isLoading: store.isLoading,
    isLoadingMore: store.isLoadingMore,
    hasMoreEmails: store.hasMoreEmails,
    error: store.error,
    fetchEmails: store.fetchEmails,
    fetchMoreEmails: () => store.fetchMoreEmails(inboxIds, labelId, activeContextType, activeFilter, activeMailbox || undefined),
    setActiveEmail: store.setActiveEmail,
    updateEmailStatus: store.updateEmailStatus,
    toggleStar: store.toggleStar,
    markAsRead: store.markAsRead,
    refetch: (inboxIds && inboxIds.length > 0) ? () => store.fetchEmails(inboxIds, labelId, activeContextType, activeFilter, activeMailbox || undefined) : () => Promise.resolve(),
  };
}
