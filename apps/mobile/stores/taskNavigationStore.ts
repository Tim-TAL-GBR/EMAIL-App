import { create } from 'zustand';

interface TaskNavigationState {
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
}

export const useTaskNavigation = create<TaskNavigationState>((set) => ({
  selectedTaskId: null,
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
}));
