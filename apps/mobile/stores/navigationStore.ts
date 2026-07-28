import { create } from 'zustand';

export type ContextType = 'global_inbox' | 'org' | 'team' | 'private_inbox' | 'label' | null;
export type FilterType = 
  | 'assigned_to_me' 
  | 'assigned_to_others' 
  | 'needs_attention'
  | 'open' 
  | 'in_progress'
  | 'done' 
  | 'sent' 
  | 'drafts' 
  | 'archived'
  | 'trash'
  | 'all';

interface NavigationState {
  activeContextType: ContextType;
  activeContextId: string | null;
  activeFilter: FilterType;
  activeMailbox: string | null;
  selectedEmailId: string | null;
  
  setContext: (type: ContextType, id: string | null, filter?: FilterType) => void;
  setFilter: (filter: FilterType) => void;
  setMailbox: (mailbox: string | null) => void;
  setEmailId: (id: string | null) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeContextType: null,
  activeContextId: null,
  activeFilter: 'all',
  activeMailbox: null,
  selectedEmailId: null,
  
  setContext: (type, id, filter = 'all') => set({ 
    activeContextType: type, 
    activeContextId: id, 
    activeFilter: filter,
    activeMailbox: null,
    selectedEmailId: null 
  }),
  setFilter: (filter) => set({ activeFilter: filter, activeMailbox: null, selectedEmailId: null }),
  setMailbox: (mailbox) => set({ activeMailbox: mailbox, activeFilter: 'all', selectedEmailId: null }),
  setEmailId: (id) => set({ selectedEmailId: id }),
}));
