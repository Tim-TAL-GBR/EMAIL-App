/**
 * useInboxes Hook
 *
 * Fetches inboxes on mount and sets up a Supabase Realtime subscription
 * to keep the inbox list in sync across all connected clients.
 *
 * Fix: In React Strict Mode, useEffect fires twice in dev. We remove any
 * existing channel before creating a new one to avoid the
 * "cannot add postgres_changes callbacks after subscribe()" error.
 */

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useInboxStore, type Inbox } from '../stores/inboxStore';

const CHANNEL_NAME = 'inboxes-realtime';

export function useInboxes() {
  const store = useInboxStore();

  useEffect(() => {
    // Initial fetch
    store.fetchInboxes();

    // Remove any stale channel with the same name before subscribing.
    // This handles React Strict Mode's double-invoke of useEffect in dev.
    const channelId = Math.random().toString(36).slice(2);
    const channelName = `${CHANNEL_NAME}-${channelId}`;
    const stale = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
    if (stale) {
      supabase.removeChannel(stale);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inboxes' },
        (payload) => {
          switch (payload.eventType) {
            case 'INSERT':
              store.fetchInboxes();
              break;
            case 'UPDATE':
              store.updateInbox(payload.new as Partial<Inbox> & { id: string });
              break;
            case 'DELETE':
              store.fetchInboxes();
              break;
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    inboxes: store.inboxes,
    activeInboxId: store.activeInboxId,
    isLoading: store.isLoading,
    error: store.error,
    fetchInboxes: store.fetchInboxes,
    setActiveInbox: store.setActiveInbox,
    getInboxById: store.getInboxById,
    refetch: store.fetchInboxes,
  };
}
