import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight } from '../../lib/constants';
import { Feather } from '@expo/vector-icons';

export type TaskFilter = 'all' | 'open' | 'done' | 'assigned_to_me' | 'overdue' | 'due_today';

interface TaskFiltersProps {
  activeFilter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
  taskCounts: Record<TaskFilter, number>;
}

const FILTERS: { key: TaskFilter; label: string; icon: string }[] = [
  { key: 'open', label: 'Offen', icon: 'circle' },
  { key: 'done', label: 'Erledigt', icon: 'check-circle' },
  { key: 'all', label: 'Alle', icon: 'list' },
  { key: 'assigned_to_me', label: 'Meine', icon: 'user' },
  { key: 'overdue', label: 'Überfällig', icon: 'alert-circle' },
  { key: 'due_today', label: 'Heute', icon: 'clock' },
];

export function TaskFilters({ activeFilter, onFilterChange, taskCounts }: TaskFiltersProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container} contentContainerStyle={styles.content}>
      {FILTERS.map(f => {
        const isActive = activeFilter === f.key;
        const count = taskCounts[f.key] || 0;
        return (
          <TouchableOpacity
            key={f.key}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onFilterChange(f.key)}
          >
            <Feather
              name={f.icon as any}
              size={13}
              color={isActive ? '#FFF' : Colors.textSecondary}
            />
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {f.label}
            </Text>
            {count > 0 && (
              <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
                <Text style={[styles.countText, isActive && styles.countTextActive]}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 44,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 6,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHover,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  pillTextActive: {
    color: '#FFF',
  },
  countBadge: {
    backgroundColor: Colors.borderLight,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  countText: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  countTextActive: {
    color: '#FFF',
  },
});
