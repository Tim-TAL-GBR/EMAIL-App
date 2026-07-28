import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight } from '../../lib/constants';
import { TaskComment, useTaskComments } from '../../hooks/useTasks';
import { useAuthStore } from '../../stores/authStore';
import { Feather } from '@expo/vector-icons';
import { getInitials } from '../../lib/userDisplay';

interface TaskCommentsProps {
  taskId: string;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Gerade eben';
  if (mins < 60) return `vor ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  return `vor ${days}d`;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const { user } = useAuthStore();
  const { comments, isLoading, addComment, deleteComment } = useTaskComments(taskId);
  const [newComment, setNewComment] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!newComment.trim() || isSending) return;
    setIsSending(true);
    try {
      await addComment(newComment.trim());
      setNewComment('');
    } catch (e) {
      console.error('Failed to add comment:', e);
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Kommentar löschen?')) return;
    }
    try {
      await deleteComment(commentId);
    } catch (e) {
      console.error('Failed to delete comment:', e);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Kommentare ({comments.length})</Text>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {isLoading && (
          <Text style={styles.loadingText}>Laden...</Text>
        )}
        {!isLoading && comments.length === 0 && (
          <Text style={styles.emptyText}>Noch keine Kommentare</Text>
        )}
        {comments.map(comment => (
          <View key={comment.id} style={styles.comment}>
            <View style={styles.commentHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials({ display_name: comment.user?.display_name, email: comment.user?.email })}
                </Text>
              </View>
              <View style={styles.commentMeta}>
                <Text style={styles.commentAuthor}>
                  {comment.user?.display_name || comment.user?.email || 'Unbekannt'}
                </Text>
                <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
              </View>
              {comment.user_id === user?.id && (
                <TouchableOpacity
                  onPress={() => handleDelete(comment.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="trash-2" size={13} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.commentContent}>{comment.content}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={newComment}
          onChangeText={setNewComment}
          placeholder="Kommentar hinzufügen..."
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!newComment.trim() || isSending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!newComment.trim() || isSending}
        >
          <Feather name="send" size={16} color={newComment.trim() ? '#FFF' : Colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

import { Platform } from 'react-native';

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  list: {
    maxHeight: 300,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  comment: {
    marginBottom: Spacing.md,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    color: '#FFF',
  },
  commentMeta: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  commentTime: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  commentContent: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginLeft: 32,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceHover,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    maxHeight: 80,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.surfaceHover,
  },
});
