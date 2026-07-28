import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing, FontWeight } from '../../../lib/constants';
import { useTasks } from '../../../hooks/useTasks';
import { useTaskNavigation } from '../../../stores/taskNavigationStore';
import { TaskCalendar } from '../../../components/tasks/TaskCalendar';
import { useRouter } from 'expo-router';

export default function CalendarsScreen() {
  const { tasks } = useTasks();
  const { setSelectedTaskId } = useTaskNavigation();
  const router = useRouter();

  const handleTaskPress = (task: any) => {
    setSelectedTaskId(task.id);
    router.push('/tasks');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kalender</Text>
      </View>
      <TaskCalendar tasks={tasks} onTaskPress={handleTaskPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
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
});
