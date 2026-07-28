import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Modal, SafeAreaView, TouchableOpacity, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, FontFamily } from '../../lib/constants';
import { Button } from '../ui/Button';
import { Task, useTasks } from '../../hooks/useTasks';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Feather } from '@expo/vector-icons';

interface TaskComposerProps {
  visible: boolean;
  onClose: () => void;
  teamId?: string; // If provided, default to this team
  task?: Task; // If provided, we are editing
  linkedEmailId?: string;
}

export function TaskComposer({ visible, onClose, teamId: initialTeamId, task, linkedEmailId }: TaskComposerProps) {
  const { user } = useAuthStore();
  const { createTask, updateTask } = useTasks(initialTeamId);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState(initialTeamId || '');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    if (visible) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description || '');
        setTeamId(task.team_id);
        setAssignedTo(task.assigned_to);
      } else {
        setTitle('');
        setDescription('');
        setTeamId(initialTeamId || '');
        setAssignedTo(null);
      }
      loadMyTeams();
    }
  }, [visible, task, initialTeamId]);
  
  useEffect(() => {
    if (teamId) {
      loadTeamMembers(teamId);
    } else {
      setTeamMembers([]);
    }
  }, [teamId]);

  const loadMyTeams = async () => {
    // Actually we can just query teams, RLS will filter to our teams
    const { data } = await supabase.from('teams').select('id, name');
    setMyTeams(data || []);
    if (!teamId && data && data.length > 0) {
      setTeamId(data[0].id);
    }
  };

  const loadTeamMembers = async (tId: string) => {
    // Get profiles for team members
    const { data } = await supabase
      .from('team_members')
      .select('user_id, profiles(id, display_name, email)')
      .eq('team_id', tId);
      
    if (data) {
      setTeamMembers(data.map(d => d.profiles));
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !teamId) return;
    
    setIsSaving(true);
    try {
      if (task) {
        await updateTask(task.id, {
          title: title.trim(),
          description: description.trim() || null,
          team_id: teamId,
          assigned_to: assignedTo,
        });
      } else {
        await createTask({
          title: title.trim(),
          description: description.trim() || null,
          team_id: teamId,
          assigned_to: assignedTo,
          linked_email_id: linkedEmailId || null,
        });
      }
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'web' ? 'pageSheet' : 'fullScreen'}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{task ? 'Task bearbeiten' : 'Neuer Task'}</Text>
          <Button 
            title="Speichern" 
            size="sm" 
            onPress={handleSave} 
            isLoading={isSaving} 
            disabled={!title.trim() || !teamId || isSaving} 
          />
        </View>

        <ScrollView style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Titel</Text>
            <TextInput 
              style={styles.input} 
              value={title} 
              onChangeText={setTitle} 
              placeholder="Was ist zu tun?"
              autoFocus
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Beschreibung (Optional)</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              value={description} 
              onChangeText={setDescription} 
              placeholder="Weitere Details..."
              multiline
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Team</Text>
            <View style={styles.pillContainer}>
              {myTeams.map(t => (
                <TouchableOpacity 
                  key={t.id} 
                  style={[styles.pill, teamId === t.id && styles.pillActive]}
                  onPress={() => setTeamId(t.id)}
                >
                  <Text style={[styles.pillText, teamId === t.id && styles.pillTextActive]}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {teamId && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Zuweisen an</Text>
              <View style={styles.pillContainer}>
                <TouchableOpacity 
                  style={[styles.pill, assignedTo === null && styles.pillActive]}
                  onPress={() => setAssignedTo(null)}
                >
                  <Text style={[styles.pillText, assignedTo === null && styles.pillTextActive]}>Niemanden</Text>
                </TouchableOpacity>
                {teamMembers.map((m: any) => m && (
                  <TouchableOpacity 
                    key={m.id} 
                    style={[styles.pill, assignedTo === m.id && styles.pillActive]}
                    onPress={() => setAssignedTo(m.id)}
                  >
                    <Text style={[styles.pillText, assignedTo === m.id && styles.pillTextActive]}>
                      {m.display_name || 'Unbekannt'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    borderBottomColor: Colors.border,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  closeText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  title: {
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  form: {
    flex: 1,
    padding: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: FontWeight.medium,
  }
});
