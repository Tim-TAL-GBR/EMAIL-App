import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';

type ActionType = 'ARCHIVE' | 'DELETE' | 'MARK_READ' | 'REPLY' | 'UPDATE_STATUS' | 'SNOOZE' | 'TOGGLE_STAR';

interface QueuedAction {
  id: string;
  type: ActionType;
  payload: any;
  timestamp: number;
}

interface OfflineSyncState {
  queue: QueuedAction[];
  isSyncing: boolean;
  queueAction: (type: ActionType, payload: any) => void;
  syncQueue: () => Promise<void>;
  clearQueue: () => void;
}

export const useOfflineSyncStore = create<OfflineSyncState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,

      queueAction: (type, payload) => {
        set((state) => ({
          queue: [
            ...state.queue,
            {
              id: Math.random().toString(36).substring(7),
              type,
              payload,
              timestamp: Date.now(),
            },
          ],
        }));
      },

      syncQueue: async () => {
        const { queue, isSyncing } = get();
        if (isSyncing || queue.length === 0) return;

        set({ isSyncing: true });

        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        
        if (!token) {
          set({ isSyncing: false });
          return;
        }

        const remainingQueue = [...queue];
        const processedIds = new Set<string>();

        for (const action of queue) {
          try {
            switch (action.type) {
              case 'ARCHIVE': {
                const response = await fetch(`${API_URL}/api/emails/${action.payload.emailId}/archive`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to archive');
                break;
              }
              case 'DELETE': {
                const response = await fetch(`${API_URL}/api/emails/${action.payload.emailId}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to delete');
                break;
              }
              case 'MARK_READ': {
                // If single email
                if (action.payload.emailId) {
                  const response = await fetch(`${API_URL}/api/emails/bulk-action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ emailIds: [action.payload.emailId], action: 'read' })
                  });
                  if (!response.ok) throw new Error('Failed to mark read');
                } else if (action.payload.emailIds) {
                  const response = await fetch(`${API_URL}/api/emails/bulk-action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ emailIds: action.payload.emailIds, action: 'read' })
                  });
                  if (!response.ok) throw new Error('Failed to mark read bulk');
                }
                break;
              }
            }
            
            // Successfully processed, remove from queue
            remainingQueue.shift();
            processedIds.add(action.id);
            
          } catch (error) {
            console.error(`Failed to process queued action ${action.type}:`, error);
            // Stop processing on first failure to maintain order, or just break
            break;
          }
        }

        set(state => ({ 
          queue: state.queue.filter(a => !processedIds.has(a.id)), 
          isSyncing: false 
        }));
      },

      clearQueue: () => {
        set({ queue: [] });
      }
    }),
    {
      name: 'offline-sync-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
