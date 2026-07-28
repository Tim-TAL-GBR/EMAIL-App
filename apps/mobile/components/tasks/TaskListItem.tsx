import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight } from '../../lib/constants';
import { Task } from '../../hooks/useTasks';
import { Feather } from '@expo/vector-icons';
import { getInitials } from '../../lib/userDisplay';

interface TaskListItemProps {
  task: Task;
  onToggleStatus: (taskId: string) => void;
  onPress: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return `${Math.abs(days)}d überfällig`;
  if (days === 0) return 'Heute';
  if (days === 1) return 'Morgen';
  if (days <= 7) return `In ${days}d`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

export function TaskListItem({ task, onToggleStatus, onPress, onDelete }: TaskListItemProps) {
  const isDone = task.status === 'done';
  const overdue = !isDone && isOverdue(task.due_date);
  const dueToday = !isDone && isDueToday(task.due_date);
  const dueLabel = formatDueDate(task.due_date);

  return (
    <TouchableOpacity
      style={[styles.container, isDone && styles.containerDone]}
      onPress={() => onPress(task)}
      activeOpacity={0.7}
    >
      <TouchableOpacity
        style={[styles.checkbox, isDone && styles.checkboxDone]}
        onPress={() => onToggleStatus(task.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {isDone && <Feather name="check" size={12} color="#FFF" />}
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, isDone && styles.titleDone]} numberOfLines={1}>
            {task.title}
          </Text>
          {task.linked_email_id && (
            <Feather name="mail" size={13} color={Colors.textTertiary} style={{ marginLeft: 6 }} />
          )}
        </View>

        <View style={styles.metaRow}>
          {task.team && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{task.team.name}</Text>
            </View>
          )}

          {dueLabel && (
            <View style={[styles.dueBadge, overdue && styles.dueBadgeOverdue, dueToday && styles.dueBadgeToday]}>
              <Feather name="calendar" size={11} color={overdue ? '#FFF' : dueToday ? '#FFF' : Colors.textTertiary} />
              <Text style={[styles.dueText, overdue && styles.dueTextOverdue, dueToday && styles.dueTextToday]}>
                {dueLabel}
              </Text>
            </View>
          )}

          {task.comment_count && task.comment_count > 0 ? (
            <View style={styles.commentBadge}>
              <Feather name="message-square" size={11} color={Colors.textTertiary} />
              <Text style={styles.commentText}>{task.comment_count}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {task.assignee && (
        <View style={styles.assignee}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials({ display_name: task.assignee.display_name, email: task.assignee.email })}
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  containerDone: {
    opacity: 0.6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  checkboxDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text,
    flex: 1,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  badge: {
    backgroundColor: Colors.surfaceHover,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: Colors.surfaceHover,
  },
  dueBadgeOverdue: {
    backgroundColor: Colors.error,
  },
  dueBadgeToday: {
    backgroundColor: Colors.warning,
  },
  dueText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  dueTextOverdue: {
    color: '#FFF',
    fontWeight: FontWeight.medium,
  },
  dueTextToday: {
    color: '#FFF',
    fontWeight: FontWeight.medium,
  },
  commentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  commentText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  assignee: {
    marginLeft: Spacing.sm,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: '#FFF',
  },
});
