import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Draft } from './useDraft';
import { ContextType } from '../stores/navigationStore';

export function useDraftsList(inboxIds: string[]) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inboxIdsStr = JSON.stringify(inboxIds);

  const fetchDrafts = useCallback(async () => {
    if (!inboxIds || inboxIds.length === 0) {
      setDrafts([]);
      return;
    }
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('drafts')
      .select('id, inbox_id, subject, to_addresses, in_reply_to, thread_id, created_at, updated_at')
      .in('inbox_id', inboxIds)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setDrafts(data as any);
    }
    setIsLoading(false);
  }, [inboxIdsStr]);

  useEffect(() => {
    fetchDrafts();
    
    if (!inboxIds || inboxIds.length === 0) return;

    const channelName = `drafts-inboxes-${inboxIds[0]}-${inboxIds.length}`;
    const filterString = `inbox_id=in.(${inboxIds.join(',')})`;
    
    // Remove stale channel (React Strict Mode double-invoke guard)
    const stale = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
    if (stale) supabase.removeChannel(stale);

    // Subscribe to realtime changes
    const subscription = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drafts', filter: filterString }, fetchDrafts)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [inboxIdsStr, fetchDrafts]);

  return { drafts, isLoading, refetch: fetchDrafts };
}
