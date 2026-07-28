import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing, FontWeight } from '../../../lib/constants';
import { useTasks, Task } from '../../../hooks/useTasks';
import { useAuthStore } from '../../../stores/authStore';
import { useTeams } from '../../../hooks/useTeams';
import { TaskListItem } from '../../../components/tasks/TaskListItem';
import { TaskFilters, TaskFilter } from '../../../components/tasks/TaskFilters';
import { TaskDetail } from '../../../components/tasks/TaskDetail';
import { TaskComposer } from '../../../components/tasks/TaskComposer';
import { Feather } from '@expo/vector-icons';

export default function TasksScreen() {
  const { user } = useAuthStore();
  const { tasks, isLoading, toggleStatus, deleteTask, reload } = useTasks();
  const { teams } = useTeams();

  const [activeFilter, setActiveFilter] = useState<TaskFilter>('open');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showComposer, setShowComposer] = useState(false);

  const taskCounts = useMemo(() => {
    const counts: Record<TaskFilter, number> = {
      all: tasks.length,
      open: 0,
      done: 0,
      assigned_to_me: 0,
      overdue: 0,
      due_today: 0,
    };
    const now = new Date();
    const todayStr = now.toDateString();
    for (const t of tasks) {
      if (t.status === 'open') counts.open++;
      if (t.status === 'done') counts.done++;
      if (t.assigned_to === user?.id) counts.assigned_to_me++;
      if (t.status === 'open' && t.due_date && new Date(t.due_date) < now) counts.overdue++;
      if (t.due_date && new Date(t.due_date).toDateString() === todayStr) counts.due_today++;
    }
    return counts;
  }, [tasks, user?.id]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    const now = new Date();
    const todayStr = now.toDateString();
    switch (activeFilter) {
      case 'open':
        result = result.filter(t => t.status === 'open');
        break;
      case 'done':
        result = result.filter(t => t.status === 'done');
        break;
      case 'assigned_to_me':
        result = result.filter(t => t.assigned_to === user?.id);
        break;
      case 'overdue':
        result = result.filter(t => t.status === 'open' && t.due_date && new Date(t.due_date) < now);
        break;
      case 'due_today':
        result = result.filter(t => t.due_date && new Date(t.due_date).toDateString() === todayStr);
        break;
    }
    // Sort: overdue first, then by due date, then by created_at
    return result.sort((a, b) => {
      const aOverdue = a.status === 'open' && a.due_date && new Date(a.due_date) < now;
      const bOverdue = b.status === 'open' && b.due_date && new Date(b.due_date) < now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
  }, [tasks, activeFilter, user?.id]);

  // Group by team
  const groupedTasks = useMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const task of filteredTasks) {
      const teamName = task.team?.name || 'Ohne Team';
      const teamId = task.team_id;
      const key = `${teamId}|${teamName}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    }
    return groups;
  }, [filteredTasks]);

  const handleToggleStatus = async (taskId: string) => {
    try {
      await toggleStatus(taskId);
    } catch (e) {
      console.error('Failed to toggle:', e);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Task wirklich löschen?')) return;
    }
    try {
      await deleteTask(taskId);
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  const handleTaskPress = (task: Task) => {
    setSelectedTask(task);
  };

  const renderTeamSection = (teamKey: string, teamTasks: Task[]) => {
    const [teamId, teamName] = teamKey.split('|');
    return (
      <View key={teamKey} style={styles.teamSection}>
        <View style={styles.teamHeader}>
          <Feather name="users" size={14} color={Colors.textSecondary} />
          <Text style={styles.teamName}>{teamName}</Text>
          <Text style={styles.teamCount}>{teamTasks.length}</Text>
        </View>
        {teamTasks.map(task => (
          <TaskListItem
            key={task.id}
            task={task}
            onToggleStatus={handleToggleStatus}
            onPress={handleTaskPress}
            onDelete={handleDeleteTask}
          />
        ))}
      </View>
    );
  };

  if (selectedTask) {
    return (
      <TaskDetail
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onRefresh={reload}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowComposer(true)}>
          <Feather name="plus" size={18} color="#FFF" />
          <Text style={styles.addBtnText}>Neuer Task</Text>
        </TouchableOpacity>
      </View>

      <TaskFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        taskCounts={taskCounts}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="check-circle" size={48} color={Colors.borderLight} />
          <Text style={styles.emptyTitle}>Keine Tasks</Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter === 'open' ? 'Alle Tasks erledigt!' : 'Keine Tasks für diesen Filter'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...groupedTasks.entries()]}
          keyExtractor={([key]) => key}
          renderItem={({ item: [key, teamTasks] }) => renderTeamSection(key, teamTasks)}
          contentContainerStyle={styles.listContent}
        />
      )}

      {showComposer && (
        <TaskComposer
          visible={showComposer}
          onClose={() => setShowComposer(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    fontFamily: FontFamily,
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
  listContent: {
    paddingBottom: Spacing.xl,
  },
  teamSection: {
    marginTop: Spacing.md,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceHover,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  teamName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    flex: 1,
  },
  teamCount: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
});
