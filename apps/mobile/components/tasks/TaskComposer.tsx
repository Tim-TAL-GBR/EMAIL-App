import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Modal, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight } from '../../lib/constants';
import { Button } from '../ui/Button';
import { Task, useTasks } from '../../hooks/useTasks';
import { supabase } from '../../lib/supabase';
import { useTeams, TeamData } from '../../hooks/useTeams';
import { Feather } from '@expo/vector-icons';

interface TaskComposerProps {
  visible: boolean;
  onClose: () => void;
  teamId?: string;
  task?: Task;
  linkedEmailId?: string;
}

export function TaskComposer({ visible, onClose, teamId: initialTeamId, task, linkedEmailId }: TaskComposerProps) {
  const { createTask, updateTask } = useTasks();
  const { teams, orgs, getSubTeams } = useTeams();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');

  // Hierarchical selection
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null); // null = Privat
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null); // null = Gesamte Org
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  // Determine which team_id to use for saving
  const effectiveTeamId = selectedTeamId || selectedOrgId || null;

  useEffect(() => {
    if (visible) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description || '');
        setAssignedTo(task.assigned_to);
        setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
        // Restore hierarchy from task's team_id
        if (task.team_id) {
          const parentOrg = teams.find(t => t.id === task.team_id && !t.parent_id);
          const subTeam = teams.find(t => t.id === task.team_id && t.parent_id);
          if (parentOrg) {
            setSelectedOrgId(parentOrg.id);
            setSelectedTeamId(null);
          } else if (subTeam) {
            setSelectedOrgId(subTeam.parent_id);
            setSelectedTeamId(subTeam.id);
          }
        } else {
          setSelectedOrgId(null);
          setSelectedTeamId(null);
        }
      } else {
        setTitle('');
        setDescription('');
        setAssignedTo(null);
        setDueDate('');
        setSelectedOrgId(null);
        setSelectedTeamId(null);
      }
    }
  }, [visible, task, teams]);

  // Load team members when a specific sub-team is selected
  useEffect(() => {
    if (selectedTeamId) {
      loadTeamMembers(selectedTeamId);
    } else if (selectedOrgId) {
      // Load all members from the org
      loadOrgMembers(selectedOrgId);
    } else {
      setTeamMembers([]);
    }
  }, [selectedTeamId, selectedOrgId]);

  const loadTeamMembers = async (tId: string) => {
    const { data } = await supabase
      .from('team_members')
      .select('user_id, profiles(id, display_name, email)')
      .eq('team_id', tId);
    if (data) setTeamMembers(data.map(d => d.profiles).filter(Boolean));
  };

  const loadOrgMembers = async (orgId: string) => {
    // Get all sub-team IDs + the org itself
    const subTeamIds = getSubTeams(orgId).map(t => t.id);
    const allTeamIds = [orgId, ...subTeamIds];

    const { data } = await supabase
      .from('team_members')
      .select('user_id, profiles(id, display_name, email)')
      .in('team_id', allTeamIds);

    if (data) {
      // Deduplicate by user_id
      const seen = new Set<string>();
      const unique = data.map(d => d.profiles).filter((p: any) => {
        if (!p || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      setTeamMembers(unique);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        team_id: effectiveTeamId,
        assigned_to: assignedTo,
        due_date: dueDate ? new Date(dueDate + 'T00:00:00').toISOString() : null,
      };

      if (task) {
        await updateTask(task.id, payload as any);
      } else {
        await createTask({
          ...payload,
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

  const subTeams = selectedOrgId ? getSubTeams(selectedOrgId) : [];

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
            disabled={!title.trim() || isSaving}
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
            <Text style={styles.label}>Fälligkeitsdatum (Optional)</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={dueDate}
                onChange={(e: any) => setDueDate(e.target.value)}
                style={{
                  backgroundColor: Colors.surface,
                  borderRadius: 8,
                  padding: '12px',
                  fontSize: 16,
                  color: Colors.text,
                  borderWidth: 1,
                  borderColor: Colors.borderLight,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <TextInput
                style={styles.input}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="JJJJ-MM-TT"
              />
            )}
          </View>

          {/* Row 1: Organisation / Privat */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Organisation</Text>
            <View style={styles.pillContainer}>
              <TouchableOpacity
                style={[styles.pill, selectedOrgId === null && styles.pillActive]}
                onPress={() => { setSelectedOrgId(null); setSelectedTeamId(null); setAssignedTo(null); }}
              >
                <Feather name="lock" size={13} color={selectedOrgId === null ? '#FFF' : Colors.textSecondary} />
                <Text style={[styles.pillText, selectedOrgId === null && styles.pillTextActive]}>Privat</Text>
              </TouchableOpacity>
              {orgs.map(org => (
                <TouchableOpacity
                  key={org.id}
                  style={[styles.pill, selectedOrgId === org.id && styles.pillActive]}
                  onPress={() => { setSelectedOrgId(org.id); setSelectedTeamId(null); setAssignedTo(null); }}
                >
                  <Feather name="briefcase" size={13} color={selectedOrgId === org.id ? '#FFF' : Colors.textSecondary} />
                  <Text style={[styles.pillText, selectedOrgId === org.id && styles.pillTextActive]}>{org.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Row 2: Teams innerhalb der Org (nur wenn Org gewählt) */}
          {selectedOrgId && subTeams.length > 0 && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Team</Text>
              <View style={styles.pillContainer}>
                <TouchableOpacity
                  style={[styles.pill, selectedTeamId === null && styles.pillActive]}
                  onPress={() => { setSelectedTeamId(null); setAssignedTo(null); }}
                >
                  <Feather name="users" size={13} color={selectedTeamId === null ? '#FFF' : Colors.textSecondary} />
                  <Text style={[styles.pillText, selectedTeamId === null && styles.pillTextActive]}>Gesamte Organisation</Text>
                </TouchableOpacity>
                {subTeams.map(team => (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.pill, selectedTeamId === team.id && styles.pillActive]}
                    onPress={() => { setSelectedTeamId(team.id); setAssignedTo(null); }}
                  >
                    <Feather name="users" size={13} color={selectedTeamId === team.id ? '#FFF' : Colors.textSecondary} />
                    <Text style={[styles.pillText, selectedTeamId === team.id && styles.pillTextActive]}>{team.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Row 3: Nutzer (wenn Org oder Team gewählt) */}
          {(selectedOrgId || selectedTeamId) && (
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
    backgroundColor: Colors.surface,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 16,
    backgroundColor: Colors.surface,
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
  },
});
