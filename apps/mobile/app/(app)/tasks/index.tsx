import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Colors, FontFamily, FontSize, FontWeight, Spacing } from '../../../lib/constants';
import { useTasks, Task } from '../../../hooks/useTasks';
import { TaskComposer } from '../../../components/tasks/TaskComposer';
import { Feather } from '@expo/vector-icons';
import { format, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuthStore } from '../../../stores/authStore';

type FilterType = 'all' | 'open' | 'done' | 'mine';

export default function TasksScreen() {
  const { user } = useAuthStore();
  const { tasks, isLoading, updateTask } = useTasks(); // null teamId fetches all user's tasks
  const [filter, setFilter] = useState<FilterType>('open');
  
  const [composerVisible, setComposerVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | undefined>(undefined);

  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'open') return t.status === 'open';
    if (filter === 'done') return t.status === 'done';
    if (filter === 'mine') return t.assigned_to === user?.id && t.status === 'open';
    return true;
  });

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'open' ? 'done' : 'open';
    await updateTask(task.id, { status: newStatus });
  };

  const renderTask = ({ item }: { item: Task }) => {
    const isDone = item.status === 'done';
    const isOverdue = item.due_date && isPast(new Date(item.due_date)) && !isDone;
    
    return (
      <TouchableOpacity 
        style={[styles.taskCard, isDone && styles.taskCardDone]} 
        onPress={() => {
          setSelectedTask(item);
          setComposerVisible(true);
        }}
      >
        <TouchableOpacity 
          style={styles.checkboxContainer}
          onPress={() => toggleTaskStatus(item)}
        >
          <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
            {isDone && <Feather name="check" size={14} color="#fff" />}
          </View>
        </TouchableOpacity>
        
        <View style={styles.taskContent}>
          <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>
            {item.title}
          </Text>
          <View style={styles.taskMeta}>
            {item.assignee && (
              <View style={styles.metaItem}>
                <Feather name="user" size={12} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{item.assignee.display_name || item.assignee.email.split('@')[0]}</Text>
              </View>
            )}
            {item.due_date && (
              <View style={styles.metaItem}>
                <Feather name="calendar" size={12} color={isOverdue ? '#F06A6A' : Colors.textSecondary} />
                <Text style={[styles.metaText, isOverdue && { color: '#F06A6A' }]}>
                  {format(new Date(item.due_date), 'dd. MMM', { locale: de })}
                </Text>
              </View>
            )}
            {item.linked_email_id && (
              <View style={styles.metaItem}>
                <Feather name="mail" size={12} color={Colors.textSecondary} />
                <Text style={styles.metaText}>Mail</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            setSelectedTask(undefined);
            setComposerVisible(true);
          }}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <FilterPill label="Offen" active={filter === 'open'} onPress={() => setFilter('open')} />
          <FilterPill label="Meine Tasks" active={filter === 'mine'} onPress={() => setFilter('mine')} />
          <FilterPill label="Erledigt" active={filter === 'done'} onPress={() => setFilter('done')} />
          <FilterPill label="Alle" active={filter === 'all'} onPress={() => setFilter('all')} />
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredTasks.length === 0 ? (
        <View style={styles.center}>
          <Feather name="check-circle" size={48} color={Colors.border} style={{ marginBottom: Spacing.md }} />
          <Text style={styles.emptyText}>Keine Tasks gefunden.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={item => item.id}
          renderItem={renderTask}
          contentContainerStyle={styles.listContent}
        />
      )}

      <TaskComposer 
        visible={composerVisible} 
        onClose={() => setComposerVisible(false)} 
        task={selectedTask}
      />
    </View>
  );
}

function FilterPill({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) {
  return (
    <TouchableOpacity 
      style={[styles.filterPill, active && styles.filterPillActive]} 
      onPress={onPress}
    >
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: FontFamily,
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  addButton: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBar: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterScroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: FontWeight.medium,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  taskCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  taskCardDone: {
    opacity: 0.6,
    backgroundColor: Colors.backgroundSecondary,
  },
  checkboxContainer: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text,
    marginBottom: 4,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  }
});
