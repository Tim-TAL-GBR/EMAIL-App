import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, ActivityIndicator } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight } from '../../lib/constants';
import { Task, useTasks } from '../../hooks/useTasks';
import { TaskComments } from './TaskComments';
import { TaskComposer } from './TaskComposer';
import { Feather } from '@expo/vector-icons';
import { getInitials } from '../../lib/userDisplay';
import { useRouter } from 'expo-router';

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onRefresh: () => void;
}

export function TaskDetail({ task: initialTask, onClose, onRefresh }: TaskDetailProps) {
  const router = useRouter();
  const { fetchTaskDetail, toggleStatus, assignTask, deleteTask, updateTask } = useTasks();
  const [task, setTask] = useState<Task>(initialTask);
  const [showComposer, setShowComposer] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dueDateDraft, setDueDateDraft] = useState(task.due_date ? task.due_date.split('T')[0] : '');

  useEffect(() => {
    setTask(initialTask);
    setDueDateDraft(initialTask.due_date ? initialTask.due_date.split('T')[0] : '');
    loadMembers();
  }, [initialTask.id]);

  const loadMembers = async () => {
    const { supabase } = await import('../../lib/supabase');
    const { data } = await supabase
      .from('team_members')
      .select('user_id, profiles(id, display_name, email)')
      .eq('team_id', initialTask.team_id);
    if (data) setTeamMembers(data.map(d => d.profiles).filter(Boolean));
  };

  const handleToggle = async () => {
    const newStatus = await toggleStatus(task.id);
    setTask(prev => ({ ...prev, status: newStatus }));
    onRefresh();
  };

  const handleAssign = async (userId: string | null) => {
    await assignTask(task.id, userId);
    const member = userId ? teamMembers.find(m => m.id === userId) : null;
    setTask(prev => ({
      ...prev,
      assigned_to: userId,
      assignee: member ? { id: member.id, display_name: member.display_name, email: member.email } : null,
    }));
    setShowAssigneePicker(false);
    onRefresh();
  };

  const handleDueDateSave = async () => {
    const newDate = dueDateDraft ? new Date(dueDateDraft + 'T00:00:00').toISOString() : null;
    await updateTask(task.id, { due_date: newDate } as any);
    setTask(prev => ({ ...prev, due_date: newDate }));
    setShowDatePicker(false);
    onRefresh();
  };

  const handleDelete = async () => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Task wirklich löschen?')) return;
    }
    await deleteTask(task.id);
    onClose();
    onRefresh();
  };

  const handleOpenLinkedEmail = () => {
    if (task.linked_email_id) {
      router.push('/');
      // The email view will handle navigation
    }
  };

  const isDone = task.status === 'done';
  const overdue = !isDone && task.due_date && new Date(task.due_date) < new Date();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowComposer(true)} style={styles.iconBtn}>
            <Feather name="edit-2" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
            <Feather name="trash-2" size={16} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Status + Title */}
        <View style={styles.titleSection}>
          <TouchableOpacity
            style={[styles.checkbox, isDone && styles.checkboxDone]}
            onPress={handleToggle}
          >
            {isDone && <Feather name="check" size={14} color="#FFF" />}
          </TouchableOpacity>
          <Text style={[styles.title, isDone && styles.titleDone]}>{task.title}</Text>
        </View>

        {task.description ? (
          <Text style={styles.description}>{task.description}</Text>
        ) : null}

        {/* Meta */}
        <View style={styles.metaCard}>
          {/* Status */}
          <TouchableOpacity style={styles.metaRow} onPress={handleToggle}>
            <Feather name={isDone ? 'check-circle' : 'circle'} size={16} color={isDone ? Colors.success : Colors.textTertiary} />
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={[styles.metaValue, isDone && { color: Colors.success }]}>
              {isDone ? 'Erledigt' : 'Offen'}
            </Text>
          </TouchableOpacity>

          {/* Due Date */}
          <TouchableOpacity style={styles.metaRow} onPress={() => setShowDatePicker(!showDatePicker)}>
            <Feather name="calendar" size={16} color={overdue ? Colors.error : Colors.textTertiary} />
            <Text style={styles.metaLabel}>Fällig am</Text>
            <Text style={[styles.metaValue, overdue && { color: Colors.error }]}>
              {task.due_date ? new Date(task.due_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Nicht gesetzt'}
            </Text>
            <Feather name="chevron-right" size={14} color={Colors.textTertiary} />
          </TouchableOpacity>

          {showDatePicker && (
            <View style={styles.datePickerRow}>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={dueDateDraft}
                  onChange={(e: any) => setDueDateDraft(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 6,
                    border: `1px solid ${Colors.borderLight}`,
                    fontSize: 14,
                    color: Colors.text,
                    backgroundColor: Colors.surface,
                  }}
                />
              ) : (
                <TextInput
                  style={styles.dateInput}
                  value={dueDateDraft}
                  onChangeText={setDueDateDraft}
                  placeholder="JJJJ-MM-TT"
                />
              )}
              <TouchableOpacity style={styles.dateSaveBtn} onPress={handleDueDateSave}>
                <Text style={styles.dateSaveBtnText}>Speichern</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Assignee */}
          <TouchableOpacity style={styles.metaRow} onPress={() => setShowAssigneePicker(!showAssigneePicker)}>
            <Feather name="user" size={16} color={Colors.textTertiary} />
            <Text style={styles.metaLabel}>Zugewiesen an</Text>
            {task.assignee ? (
              <View style={styles.assigneeChip}>
                <View style={styles.miniAvatar}>
                  <Text style={styles.miniAvatarText}>{getInitials({ display_name: task.assignee.display_name, email: task.assignee.email })}</Text>
                </View>
                <Text style={styles.metaValue}>{task.assignee.display_name || task.assignee.email}</Text>
              </View>
            ) : (
              <Text style={[styles.metaValue, { color: Colors.textTertiary }]}>Niemand</Text>
            )}
            <Feather name="chevron-right" size={14} color={Colors.textTertiary} />
          </TouchableOpacity>

          {showAssigneePicker && (
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[styles.pickerItem, task.assigned_to === null && styles.pickerItemActive]}
                onPress={() => handleAssign(null)}
              >
                <Text style={[styles.pickerText, task.assigned_to === null && styles.pickerTextActive]}>Niemanden</Text>
              </TouchableOpacity>
              {teamMembers.map((m: any) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.pickerItem, task.assigned_to === m.id && styles.pickerItemActive]}
                  onPress={() => handleAssign(m.id)}
                >
                  <Text style={[styles.pickerText, task.assigned_to === m.id && styles.pickerTextActive]}>
                    {m.display_name || 'Unbekannt'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Team */}
          <View style={styles.metaRow}>
            <Feather name="users" size={16} color={Colors.textTertiary} />
            <Text style={styles.metaLabel}>Team</Text>
            <Text style={styles.metaValue}>{task.team?.name || '—'}</Text>
          </View>

          {/* Creator */}
          <View style={styles.metaRow}>
            <Feather name="plus-circle" size={16} color={Colors.textTertiary} />
            <Text style={styles.metaLabel}>Erstellt von</Text>
            <Text style={styles.metaValue}>{task.creator?.display_name || task.creator?.email || '—'}</Text>
          </View>

          {/* Linked Email */}
          {task.linked_email_id && (
            <TouchableOpacity style={styles.metaRow} onPress={handleOpenLinkedEmail}>
              <Feather name="mail" size={16} color={Colors.primary} />
              <Text style={styles.metaLabel}>Verlinkte E-Mail</Text>
              <Text style={[styles.metaValue, { color: Colors.primary }]}>Anzeigen</Text>
              <Feather name="external-link" size={12} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Comments */}
        <TaskComments taskId={task.id} />
      </ScrollView>

      {showComposer && (
        <TaskComposer
          visible={showComposer}
          onClose={() => { setShowComposer(false); onRefresh(); }}
          task={task}
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconBtn: {
    padding: Spacing.xs,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: Spacing.md,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    marginTop: 2,
  },
  checkboxDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  title: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    lineHeight: 28,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  description: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  metaCard: {
    backgroundColor: Colors.surfaceHover,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  metaLabel: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    width: 100,
  },
  metaValue: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },
  assigneeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 9,
    fontWeight: FontWeight.semibold,
    color: '#FFF',
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 26,
    paddingBottom: 8,
  },
  dateInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  dateSaveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  dateSaveBtnText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  pickerContainer: {
    paddingHorizontal: 26,
    paddingBottom: 8,
    gap: 4,
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pickerItemActive: {
    backgroundColor: Colors.primary,
  },
  pickerText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  pickerTextActive: {
    color: '#FFF',
    fontWeight: FontWeight.medium,
  },
});
