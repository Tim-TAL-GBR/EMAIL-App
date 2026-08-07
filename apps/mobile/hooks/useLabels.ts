import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Alert } from 'react-native';

export interface Label {
  id: string;
  team_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export function useLabels(teamId: string | null) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLabels = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .eq('team_id', teamId)
        .order('name');
        
      if (error) throw error;
      setLabels(data || []);
    } catch (err: any) {
      console.error('Failed to fetch labels:', err);
      Alert.alert('Fehler', 'Labels konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  const createLabel = async (name: string, color: string = '#00B388') => {
    if (!teamId) return;
    try {
      const { data, error } = await supabase
        .from('labels')
        .insert([{ team_id: teamId, name, color }])
        .select()
        .single();
        
      if (error) throw error;
      setLabels(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    } catch (err: any) {
      console.error('Failed to create label:', err);
      Alert.alert('Fehler', 'Label konnte nicht erstellt werden.');
      throw err;
    }
  };

  const updateLabel = async (id: string, name: string, color: string) => {
    try {
      const { data, error } = await supabase
        .from('labels')
        .update({ name, color })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      setLabels(prev => prev.map(l => l.id === id ? data : l).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: any) {
      console.error('Failed to update label:', err);
      Alert.alert('Fehler', 'Label konnte nicht aktualisiert werden.');
      throw err;
    }
  };

  const deleteLabel = async (id: string) => {
    try {
      const { error } = await supabase
        .from('labels')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      setLabels(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      console.error('Failed to delete label:', err);
      Alert.alert('Fehler', 'Label konnte nicht gelöscht werden.');
      throw err;
    }
  };

  return {
    labels,
    isLoading,
    fetchLabels,
    createLabel,
    updateLabel,
    deleteLabel,
  };
}
