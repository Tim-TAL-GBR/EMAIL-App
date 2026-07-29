import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Draft {
  id?: string;
  inbox_id: string;
  team_id: string;
  thread_id?: string | null;
  in_reply_to?: string | null;
  to_addresses?: string[];
  cc_addresses?: string[];
  bcc_addresses?: string[];
  subject?: string;
  body_text?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UseDraftOptions {
  fetchExisting?: boolean;
  draftId?: string;
}

export function useDraft(inboxId: string, threadId?: string | null, options?: UseDraftOptions) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchExisting = options?.fetchExisting ?? true;
  const draftId = options?.draftId;

  // Fetch an existing draft for this thread, or just any draft for this inbox if threadId is not provided
  const loadDraft = useCallback(async () => {
    if (!fetchExisting) return;

    setIsLoading(true);
    let query = supabase
      .from('drafts')
      .select('*')
      .eq('inbox_id', inboxId);
      
    if (draftId) {
      query = query.eq('id', draftId);
    } else if (threadId) {
      query = query.eq('thread_id', threadId);
    } else {
      query = query.is('thread_id', null);
    }

    const { data, error } = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle();
    
    if (!error && data) {
      setDraft(data as any);
    } else {
      setDraft(null);
    }
    setIsLoading(false);
  }, [inboxId, threadId, fetchExisting, draftId]);

  useEffect(() => {
    if (inboxId && fetchExisting) {
      loadDraft();

      // Subscribe to realtime changes for this draft
      const filterStr = `inbox_id=eq.${inboxId}`; 
      const channelName = `draft-${inboxId}-${draftId || threadId || 'new'}`;

      // Remove stale channel first (React Strict Mode double-invoke guard).
      const stale = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
      if (stale) supabase.removeChannel(stale);

      const channel = supabase.channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drafts', filter: filterStr }, loadDraft)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [inboxId, loadDraft, fetchExisting, threadId, draftId]);

  const saveDraft = useCallback(async (
    draftData: Partial<Draft>
  ) => {
    // If we don't have a team_id yet, we need to get it from the inbox
    let teamId = draftData.team_id || draft?.team_id;
    if (!teamId) {
      const { data } = await supabase.from('inboxes').select('team_id').eq('id', inboxId).single();
      if (data) teamId = data.team_id;
    }

    const payload = {
      ...draftData,
      inbox_id: inboxId,
      team_id: teamId,
      thread_id: threadId,
    };

    if (draft?.id) {
      // Update existing draft
      const { data, error } = await supabase
        .from('drafts')
        .update(payload)
        .eq('id', draft.id)
        .select()
        .single();
        
      if (!error && data) {
        setDraft(data as any);
      }
    } else {
      // Create new draft
      // Also set created_by
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('drafts')
        .insert({
          ...payload,
          created_by: userData?.user?.id
        })
        .select()
        .single();
        
      if (!error && data) {
        setDraft(data as any);
      }
    }
  }, [draft, inboxId, threadId]);

  const deleteDraft = useCallback(async () => {
    if (draft?.id) {
      const { error } = await supabase.from('drafts').delete().eq('id', draft.id);
      if (error) {
        console.error('deleteDraft error:', error);
        return;
      }
      setDraft(null);
    }
  }, [draft]);

  return { draft, saveDraft, deleteDraft, isLoading };
}
