import { API_URL } from "@/lib/constants";
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Switch } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';

interface Team {
  id: string;
  name: string;
  myRole: string;
}

interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
}

const PERMISSIONS_LIST = [
  { id: 'can_delete_emails', label: 'E-Mails löschen' },
  { id: 'can_manage_templates', label: 'Vorlagen verwalten' },
  { id: 'can_manage_users', label: 'Benutzer verwalten' },
  { id: 'can_view_reports', label: 'Berichte ansehen' }
];

async function apiRequest(path: string, method = 'GET', body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Unbekannter Fehler');
  return json;
}

export default function RolesSettingsScreen() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(false);
  
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [rolePerms, setRolePerms] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { loadTeams(); }, []);
  useEffect(() => { if (selectedTeamId) loadRoles(selectedTeamId); }, [selectedTeamId]);

  const loadTeams = async () => {
    try {
      const data = await apiRequest('/api/teams');
      setTeams(data);
      if (data.length > 0) setSelectedTeamId(data[0].id);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async (teamId: string) => {
    setLoadingRoles(true);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/roles`);
      setRoles(data);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoadingRoles(false);
    }
  };

  const handleSaveRole = async () => {
    if (!selectedTeamId || !roleName.trim()) return;
    setIsSaving(true);
    try {
      const method = editingRole ? 'PATCH' : 'POST';
      const url = editingRole ? `/api/teams/${selectedTeamId}/roles/${editingRole.id}` : `/api/teams/${selectedTeamId}/roles`;
      
      await apiRequest(url, method, {
        name: roleName.trim(),
        description: roleDesc.trim(),
        permissions: rolePerms
      });
      
      Alert.alert('Erfolg', 'Rolle gespeichert');
      setShowRoleModal(false);
      loadRoles(selectedTeamId);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!selectedTeamId) return;
    try {
      await apiRequest(`/api/teams/${selectedTeamId}/roles/${roleId}`, 'DELETE');
      Alert.alert('Erfolg', 'Rolle gelöscht');
      loadRoles(selectedTeamId);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    }
  };

  const openCreateModal = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDesc('');
    setRolePerms({});
    setShowRoleModal(true);
  };

  const openEditModal = (role: CustomRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description || '');
    setRolePerms(role.permissions || {});
    setShowRoleModal(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Benutzerdefinierte Rollen</Text>
      </View>

      <ScrollView style={styles.content}>
        {teams.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Organisation wählen</Text>
            <View style={styles.teamsList}>
              {teams.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.teamButton, selectedTeamId === t.id && styles.teamButtonActive]}
                  onPress={() => setSelectedTeamId(t.id)}
                >
                  <Text style={[styles.teamButtonText, selectedTeamId === t.id && styles.teamButtonTextActive]}>
                    {t.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {selectedTeamId && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Rollen</Text>
              <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
                <Text style={styles.addButtonText}>+ Neue Rolle</Text>
              </TouchableOpacity>
            </View>

            {loadingRoles ? (
              <ActivityIndicator color={Colors.primary} />
            ) : roles.length === 0 ? (
              <Text style={styles.emptyText}>Keine benutzerdefinierten Rollen vorhanden.</Text>
            ) : (
              <View style={styles.cardList}>
                {roles.map(r => (
                  <View key={r.id} style={styles.card}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>{r.name}</Text>
                      {r.description ? <Text style={styles.cardDesc}>{r.description}</Text> : null}
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.iconButton} onPress={() => openEditModal(r)}>
                        <Text style={styles.iconButtonText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconButton} onPress={() => {
                        Alert.alert('Löschen?', 'Bist du sicher?', [
                          { text: 'Abbrechen', style: 'cancel' },
                          { text: 'Löschen', style: 'destructive', onPress: () => handleDeleteRole(r.id) }
                        ]);
                      }}>
                        <Text style={styles.iconButtonText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Role Modal */}
      <Modal visible={showRoleModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingRole ? 'Rolle bearbeiten' : 'Neue Rolle erstellen'}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput style={styles.input} value={roleName} onChangeText={setRoleName} placeholder="z.B. Support Mitarbeiter" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Beschreibung</Text>
              <TextInput style={styles.input} value={roleDesc} onChangeText={setRoleDesc} placeholder="Kurze Beschreibung" />
            </View>

            <Text style={styles.inputLabel}>Berechtigungen</Text>
            <View style={styles.permsList}>
              {PERMISSIONS_LIST.map(p => (
                <View key={p.id} style={styles.permRow}>
                  <Text style={styles.permLabel}>{p.label}</Text>
                  <Switch
                    value={!!rolePerms[p.id]}
                    onValueChange={(val) => setRolePerms(prev => ({ ...prev, [p.id]: val }))}
                  />
                </View>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowRoleModal(false)}>
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleSaveRole} disabled={isSaving}>
                <Text style={styles.submitButtonText}>{isSaving ? 'Speichern...' : 'Speichern'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { padding: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, fontFamily: FontFamily },
  content: { flex: 1, padding: Spacing.xl },
  section: { marginBottom: Spacing['2xl'] },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: Spacing.lg, fontFamily: FontFamily },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  teamsList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  teamButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  teamButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  teamButtonText: { color: Colors.textSecondary, fontFamily: FontFamily },
  teamButtonTextActive: { color: '#FFF', fontWeight: FontWeight.bold },
  addButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: 8 },
  addButtonText: { color: '#FFF', fontWeight: FontWeight.bold, fontFamily: FontFamily },
  emptyText: { color: Colors.textTertiary, fontStyle: 'italic', fontFamily: FontFamily },
  cardList: { gap: Spacing.md },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, fontFamily: FontFamily },
  cardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, fontFamily: FontFamily },
  cardActions: { flexDirection: 'row', gap: Spacing.sm },
  iconButton: { padding: Spacing.sm },
  iconButtonText: { fontSize: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxWidth: 500, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.xl },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.xl, fontFamily: FontFamily },
  inputGroup: { marginBottom: Spacing.lg },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.xs, fontFamily: FontFamily },
  input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: Spacing.md, color: Colors.text, fontFamily: FontFamily },
  permsList: { backgroundColor: Colors.background, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.xl },
  permRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  permLabel: { color: Colors.text, fontFamily: FontFamily },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md },
  cancelButton: { padding: Spacing.md },
  cancelButtonText: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontFamily: FontFamily },
  submitButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: 8 },
  submitButtonText: { color: '#FFF', fontWeight: FontWeight.bold, fontFamily: FontFamily }
});
