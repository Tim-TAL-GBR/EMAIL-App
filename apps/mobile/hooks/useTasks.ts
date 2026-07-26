import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Task {
  id: string;
  team_id: string;
  created_by: string | null;
  assigned_to: string | null;
  linked_email_id: string | null;
  title: string;
  description: string | null;
  status: 'open' | 'done';
  due_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  assignee?: {
    id: string;
    display_name: string | null;
    email: string;
  } | null;
  creator?: {
    id: string;
    display_name: string | null;
    email: string;
  } | null;
}

export function useTasks(teamId?: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assignee:assigned_to ( id, display_name, email ),
          creator:created_by ( id, display_name, email )
        `)
        .order('created_at', { ascending: false });

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { data, error: err } = await query;
      
      if (err) throw err;
      
      setTasks(data as any[] || []);
    } catch (err: any) {
      setError(err);
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadTasks();
    
    const channelName = `tasks-${teamId || 'all'}`;
    const stale = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
    if (stale) supabase.removeChannel(stale);

    let filterStr = undefined;
    if (teamId) {
      filterStr = `team_id=eq.${teamId}`;
    }

    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: filterStr }, loadTasks)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTasks, teamId]);

  const createTask = async (taskData: Partial<Task>) => {
    if (!taskData.team_id && !teamId) {
      throw new Error('team_id is required to create a task');
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        team_id: teamId || taskData.team_id,
        ...taskData,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  };

  return {
    tasks,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    reload: loadTasks
  };
}
