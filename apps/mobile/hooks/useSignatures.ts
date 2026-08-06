import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Signature {
  id: string;
  team_id: string | null;
  owner_id: string | null;
  scope: 'private' | 'team';
  name: string;
  content_text: string;
  created_at: string;
  updated_at: string;
}

export function useSignatures() {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSignatures = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSignatures([]);
        return;
      }

      const { data, error } = await supabase
        .from('signatures')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching signatures:', error);
      } else {
        setSignatures(data || []);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSignatures();

    const channelId = Math.random().toString(36).slice(2);
    const channelName = `signatures-${channelId}`;

    const existingChannel = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signatures' }, () => {
        fetchSignatures();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return { signatures, isLoading, refetch: fetchSignatures };
}
