import { API_URL } from "@/lib/constants";
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';



export interface Label {
  id: string;
  team_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

interface LabelState {
  labels: Label[];
  isLoading: boolean;
  error: string | null;
  fetchLabels: (teamId: string) => Promise<void>;
  createLabel: (teamId: string, name: string, color?: string) => Promise<{ data: Label | null; error: Error | null }>;
  addLabelToEmail: (emailId: string, labelId: string) => Promise<{ error: Error | null }>;
  removeLabelFromEmail: (emailId: string, labelId: string) => Promise<{ error: Error | null }>;
}

export const useLabelStore = create<LabelState>((set, get) => ({
  labels: [],
  isLoading: false,
  error: null,

  fetchLabels: async (teamId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .eq('team_id', teamId)
        .order('name');
        
      if (error) throw error;
      set({ labels: data as Label[], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createLabel: async (teamId: string, name: string, color?: string) => {
    try {
      const { data, error } = await supabase
        .from('labels')
        .insert({ team_id: teamId, name, color: color || '#8B5CF6' })
        .select()
        .single();
        
      if (error) throw error;
      
      const newLabel = data as Label;
      set((state) => ({ labels: [...state.labels, newLabel].sort((a, b) => a.name.localeCompare(b.name)) }));
      
      return { data: newLabel, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  addLabelToEmail: async (emailId: string, labelId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/emails/${emailId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ labelId, action: 'add' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to add label');
      return { error: null };
    } catch (error: any) {
      if (error.message?.toLowerCase().includes('network') || error.message?.toLowerCase().includes('fetch') || error instanceof TypeError) {
        console.warn('[LabelStore] addLabelToEmail error, falling back to direct Supabase:', error.message);
        const { error: sbError } = await supabase.from('email_labels').insert({ email_id: emailId, label_id: labelId });
        return { error: sbError || error };
      }
      return { error };
    }
  },

  removeLabelFromEmail: async (emailId: string, labelId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/emails/${emailId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ labelId, action: 'remove' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to remove label');
      return { error: null };
    } catch (error: any) {
      if (error.message?.toLowerCase().includes('network') || error.message?.toLowerCase().includes('fetch') || error instanceof TypeError) {
        console.warn('[LabelStore] removeLabelFromEmail error, falling back to direct Supabase:', error.message);
        const { error: sbError } = await supabase.from('email_labels').delete().match({ email_id: emailId, label_id: labelId });
        return { error: sbError || error };
      }
      return { error };
    }
  }
}));
