import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type RuleTriggerType = 'incoming' | 'outgoing' | 'user_action';
export type RuleMatchType = 'all' | 'any';

export interface RuleCondition {
  field: 'from' | 'to' | 'subject' | 'body';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with';
  value: string;
}

export interface RuleAction {
  type: 'add_label' | 'mark_read' | 'archive' | 'star' | 'assign';
  value?: string; // e.g., label_id or user_id
}

export interface Rule {
  id: string;
  team_id: string | null;
  owner_id: string | null;
  scope: 'private' | 'team';
  name: string;
  description: string | null;
  trigger_type: RuleTriggerType;
  conditions_match_type: RuleMatchType;
  conditions: RuleCondition[];
  actions: RuleAction[];
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

interface RuleState {
  rules: Rule[];
  isLoading: boolean;
  error: string | null;

  fetchRules: (teamId?: string) => Promise<void>;
  createRule: (rule: Omit<Rule, 'id' | 'created_at' | 'updated_at'>) => Promise<{ data: Rule | null, error: any }>;
  updateRule: (id: string, updates: Partial<Rule>) => Promise<{ error: any }>;
  deleteRule: (id: string) => Promise<{ error: any }>;
}

export const useRuleStore = create<RuleState>((set, get) => ({
  rules: [],
  isLoading: false,
  error: null,

  fetchRules: async (teamId) => {
    set({ isLoading: true, error: null });
    try {
      let query = supabase.from('rules').select('*').order('created_at', { ascending: false });
      
      if (teamId) {
        query = query.or(`scope.eq.private,team_id.eq.${teamId}`);
      } else {
        query = query.eq('scope', 'private');
      }

      const { data, error } = await query;
      if (error) throw error;
      
      set({ rules: data as Rule[], isLoading: false });
    } catch (err: any) {
      console.error('Error fetching rules:', err);
      set({ error: err.message, isLoading: false });
    }
  },

  createRule: async (rule) => {
    try {
      const { data, error } = await supabase.from('rules').insert(rule as any).select().single();
      if (error) throw error;
      
      set(state => ({ rules: [data as Rule, ...state.rules] }));
      return { data: data as Rule, error: null };
    } catch (error: any) {
      console.error('Error creating rule:', error);
      return { data: null, error };
    }
  },

  updateRule: async (id, updates) => {
    try {
      const { data, error } = await supabase.from('rules').update(updates as any).eq('id', id).select().single();
      if (error) throw error;
      
      set(state => ({
        rules: state.rules.map(r => r.id === id ? { ...r, ...data } : r)
      }));
      return { error: null };
    } catch (error: any) {
      console.error('Error updating rule:', error);
      return { error };
    }
  },

  deleteRule: async (id) => {
    try {
      const { error } = await supabase.from('rules').delete().eq('id', id);
      if (error) throw error;
      
      set(state => ({
        rules: state.rules.filter(r => r.id !== id)
      }));
      return { error: null };
    } catch (error: any) {
      console.error('Error deleting rule:', error);
      return { error };
    }
  }
}));
