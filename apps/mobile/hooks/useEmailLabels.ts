import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';

// Assuming apiRequest is available, we'll import it from where it's defined,
// or we can implement a basic fetch wrapper here if needed.
import { API_URL } from '../lib/constants';

async function apiRequest(path: string, method = 'GET', body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${session?.access_token}` 
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const text = await res.text();
  let json;
  try { 
    json = JSON.parse(text); 
  } catch { 
    throw new Error(res.ok ? `Ungültige Serverantwort` : `Server nicht erreichbar oder fehlerhaft.`); 
  }
  
  if (!res.ok) throw new Error(json.error || 'Unbekannter Fehler');
  return json;
}

export interface IMAPFolder {
  path: string;
  name: string;
  specialUse?: string;
}

export function useEmailLabels(inboxId: string | null) {
  const [folders, setFolders] = useState<IMAPFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFolders = useCallback(async () => {
    if (!inboxId) return;
    setIsLoading(true);
    try {
      const data = await apiRequest(`/api/inboxes/${inboxId}/folders`);
      setFolders(data.folders || []);
    } catch (err: any) {
      console.error('Failed to fetch folders:', err);
      Alert.alert('Fehler', 'E-Mail-Labels konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  }, [inboxId]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const createFolder = async (name: string) => {
    if (!inboxId) return;
    try {
      const data = await apiRequest(`/api/inboxes/${inboxId}/folders`, 'POST', { name });
      // Refresh the list to get the exact path returned by server
      await fetchFolders();
      return data;
    } catch (err: any) {
      console.error('Failed to create folder:', err);
      Alert.alert('Fehler', err.message || 'Label konnte nicht erstellt werden.');
      throw err;
    }
  };

  const deleteFolder = async (path: string) => {
    if (!inboxId) return;
    try {
      await apiRequest(`/api/inboxes/${inboxId}/folders`, 'DELETE', { path });
      setFolders(prev => prev.filter(f => f.path !== path));
    } catch (err: any) {
      console.error('Failed to delete folder:', err);
      Alert.alert('Fehler', err.message || 'Label konnte nicht gelöscht werden.');
      throw err;
    }
  };

  return {
    folders,
    isLoading,
    fetchFolders,
    createFolder,
    deleteFolder,
  };
}
