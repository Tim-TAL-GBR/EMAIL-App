import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

export interface RuleAction {
  type: string;
  value: string;
}

export interface Rule {
  id: string;
  team_id: string | null;
  owner_id: string | null;
  scope: 'private' | 'team';
  name: string;
  description: string | null;
  trigger_type: 'incoming' | 'outgoing' | 'user_action';
  conditions_match_type: 'all' | 'any';
  conditions: RuleCondition[];
  actions: RuleAction[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching rules:', error);
      } else {
        setRules(data || []);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();

    const existingChannel = supabase.getChannels().find(c => c.topic === 'realtime:rules');
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const subscription = supabase
      .channel('realtime:rules')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rules' }, () => {
        fetchRules();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return { rules, isLoading, refetch: fetchRules };
}
