import { create } from 'zustand';

export type ContextType = 'global_inbox' | 'team' | 'private_inbox' | null;
export type FilterType = 
  | 'assigned_to_me' 
  | 'assigned_to_others' 
  | 'needs_attention'
  | 'open' 
  | 'in_progress'
  | 'done' 
  | 'sent' 
  | 'drafts' 
  | 'all';

interface NavigationState {
  activeContextType: ContextType;
  activeContextId: string | null;
  activeFilter: FilterType;
  selectedEmailId: string | null;
  
  setContext: (type: ContextType, id: string | null, filter?: FilterType) => void;
  setFilter: (filter: FilterType) => void;
  setEmailId: (id: string | null) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeContextType: null,
  activeContextId: null,
  activeFilter: 'all',
  selectedEmailId: null,
  
  setContext: (type, id, filter = 'all') => set({ 
    activeContextType: type, 
    activeContextId: id, 
    activeFilter: filter,
    selectedEmailId: null 
  }),
  setFilter: (filter) => set({ activeFilter: filter, selectedEmailId: null }),
  setEmailId: (id) => set({ selectedEmailId: id }),
}));
