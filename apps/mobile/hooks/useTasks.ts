import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';

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
  notification_sent?: boolean;
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
  team?: {
    id: string;
    name: string;
  } | null;
  comment_count?: number;
  comments?: TaskComment[];
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    display_name: string | null;
    email: string;
  } | null;
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  };
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/tasks`, { headers });
      if (!res.ok) throw new Error('Failed to load tasks');
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err: any) {
      setError(err);
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();

    const channelName = 'tasks-realtime';
    const stale = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
    if (stale) supabase.removeChannel(stale);

    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, loadTasks)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTasks]);

  const createTask = async (taskData: {
    title: string;
    description?: string | null;
    team_id: string;
    assigned_to?: string | null;
    linked_email_id?: string | null;
    due_date?: string | null;
  }) => {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(taskData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create task');
    }
    const data = await res.json();
    setTasks(prev => [data.task, ...prev]);
    return data.task;
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update task');
    }
    const data = await res.json();
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...data.task } : t));
    return data.task;
  };

  const deleteTask = async (taskId: string) => {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete task');
    }
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const toggleStatus = async (taskId: string) => {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/tasks/${taskId}/toggle-status`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to toggle status');
    }
    const data = await res.json();
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: data.status } : t));
    return data.status;
  };

  const assignTask = async (taskId: string, userId: string | null) => {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/tasks/${taskId}/assign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ assignedTo: userId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to assign task');
    }
  };

  const fetchTaskDetail = async (taskId: string): Promise<Task | null> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/tasks/${taskId}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data.task;
  };

  return {
    tasks,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    toggleStatus,
    assignTask,
    fetchTaskDetail,
    reload: loadTasks,
  };
}

export function useTaskComments(taskId: string | null) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadComments = useCallback(async () => {
    if (!taskId) { setComments([]); return; }
    setIsLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/tasks/${taskId}/comments`, { headers });
      if (!res.ok) throw new Error('Failed to load comments');
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const addComment = async (content: string) => {
    if (!taskId || !content.trim()) return;
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: content.trim() }),
    });
    if (!res.ok) throw new Error('Failed to add comment');
    const data = await res.json();
    setComments(prev => [...prev, data.comment]);
    return data.comment;
  };

  const deleteComment = async (commentId: string) => {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/tasks/comments/${commentId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error('Failed to delete comment');
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  return {
    comments,
    isLoading,
    addComment,
    deleteComment,
    reload: loadComments,
  };
}
