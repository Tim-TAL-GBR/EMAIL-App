/**
 * useComments Hook
 *
 * Fetches internal comments for a specific email and sets up
 * Supabase Realtime to keep the comment list in sync.
 * Includes an addComment action to post new comments.
 *
 * Usage:
 * ```tsx
 * const { comments, isLoading, addComment } = useComments(emailId);
 * ```
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

/** Author profile shape (joined from profiles table) */
export interface CommentAuthor {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string;
}

/** Internal comment data shape */
export interface Comment {
  id: string;
  email_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  /** Joined author profile */
  author: CommentAuthor;
}

/** Return type of the useComments hook */
interface UseCommentsReturn {
  /** List of comments for the email */
  comments: Comment[];
  /** Whether comments are being loaded */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Post a new comment to the email thread */
  addComment: (body: string, mentionedUserIds?: string[]) => Promise<{ error: Error | null }>;
}

/**
 * Hook for managing internal comments on an email.
 *
 * @param emailId - The email to load comments for (null to skip)
 */
export function useComments(emailId: string | null): UseCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);

  // Fetch comments with author profile join
  const fetchComments = useCallback(async () => {
    if (!emailId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('internal_comments')
        .select('*, author:profiles(id, display_name, avatar_url, email)')
        .eq('email_id', emailId)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('Fetch comments error:', fetchError);
        setError(fetchError.message);
      } else {
        setComments((data as Comment[]) ?? []);
      }
    } catch (err) {
      console.error('Fetch comments exception:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch comments');
    } finally {
      setIsLoading(false);
    }
  }, [emailId]);

  // Set up initial fetch and realtime subscription
  useEffect(() => {
    if (!emailId) {
      setComments([]);
      return;
    }

    fetchComments();

    // Subscribe to realtime changes on comments for this email.
    // Remove stale channel first (React Strict Mode double-invoke guard).
    const channelName = `comments-${emailId}`;
    const stale = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
    if (stale) supabase.removeChannel(stale);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_comments',
          filter: `email_id=eq.${emailId}`,
        },
        async (payload) => {
          // Fetch the full comment with author join
          const { data, error } = await supabase
            .from('internal_comments')
            .select('*, author:profiles(id, display_name, avatar_url, email)')
            .eq('id', (payload.new as { id: string }).id)
            .single();

          if (error) {
            console.error('Realtime fetch comment error:', error);
          }

          if (data) {
            setComments((prev) => {
              // Avoid duplicates (in case we already added it optimistically)
              if (prev.some((c) => c.id === (data as Comment).id)) return prev;
              return [...prev, data as Comment];
            });
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'internal_comments',
          filter: `email_id=eq.${emailId}`,
        },
        (payload) => {
          setComments((prev) =>
            prev.map((c) =>
              c.id === (payload.new as Comment).id
                ? { ...c, ...(payload.new as Partial<Comment>) }
                : c,
            ),
          );
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'internal_comments',
          filter: `email_id=eq.${emailId}`,
        },
        (payload) => {
          const deleted = payload.old as { id?: string };
          if (deleted.id) {
            setComments((prev) => prev.filter((c) => c.id !== deleted.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [emailId, fetchComments]);

  /** Post a new internal comment */
  const addComment = useCallback(
    async (body: string, mentionedUserIds: string[] = []): Promise<{ error: Error | null }> => {
      if (!emailId || !user) {
        return { error: new Error('Not authenticated or no email selected') };
      }

      try {
        const { data: newComment, error: insertError } = await supabase
          .from('internal_comments')
          .insert({
            email_id: emailId,
            author_id: user.id,
            body,
          })
          .select()
          .single();

        if (insertError) {
          return { error: new Error(insertError.message) };
        }

        // Assign email to mentioned users so it shows up in their inbox
        if (mentionedUserIds && mentionedUserIds.length > 0) {
          const assignments = mentionedUserIds.map((userId) => ({
            email_id: emailId,
            assigned_to: userId,
            assigned_by: user.id
          }));
          
          const { error: assignError } = await supabase
            .from('email_assignments')
            .upsert(assignments, { onConflict: 'email_id, assigned_to', ignoreDuplicates: true });
            
          if (assignError) console.error('Failed to assign mentioned users:', assignError);
        }

        // Fetch comments to ensure UI updates immediately
        // even if Realtime subscription is delayed or disconnected
        fetchComments();

        return { error: null };
      } catch (err) {
        return {
          error: err instanceof Error ? err : new Error('Failed to add comment'),
        };
      }
    },
    [emailId, user, fetchComments],
  );

  return { comments, isLoading, error, addComment };
}
