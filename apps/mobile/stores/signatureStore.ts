import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

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

interface SignatureState {
  signatures: Signature[];
  isLoading: boolean;
  fetchSignatures: () => Promise<void>;
  createSignature: (payload: { name: string; content_text: string; scope: 'private' | 'team'; team_id?: string | null }) => Promise<{ error: Error | null }>;
  updateSignature: (id: string, payload: Partial<{ name: string; content_text: string; scope: string; team_id: string | null }>) => Promise<{ error: Error | null }>;
  deleteSignature: (id: string) => Promise<void>;
}

export const useSignatureStore = create<SignatureState>((set, get) => ({
  signatures: [],
  isLoading: false,

  fetchSignatures: async () => {
    set({ isLoading: true });
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;
      const { data, error } = await supabase
        .from('signatures')
        .select('*')
        .or(`owner_id.eq.${user.id},scope.eq.team`)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching signatures:', error);
      } else {
        set({ signatures: (data as Signature[]) ?? [] });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  createSignature: async (payload) => {
    const user = useAuthStore.getState().user;
    if (!user) return { error: new Error('Not authenticated') };
    const { data, error } = await supabase
      .from('signatures')
      .insert({ ...payload, owner_id: user.id })
      .select()
      .single();
    if (error) {
      return { error: new Error(error.message) };
    }
    set({ signatures: [...get().signatures, data as Signature] });
    return { error: null };
  },

  updateSignature: async (id, payload) => {
    const { error } = await supabase
      .from('signatures')
      .update(payload)
      .eq('id', id);
    if (error) {
      return { error: new Error(error.message) };
    }
    set({
      signatures: get().signatures.map(s => s.id === id ? { ...s, ...payload } as Signature : s),
    });
    return { error: null };
  },

  deleteSignature: async (id) => {
    await supabase
      .from('signatures')
      .delete()
      .eq('id', id);
    set({ signatures: get().signatures.filter(s => s.id !== id) });
  },
}));
