import { API_URL } from "@/lib/constants";
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';



async function apiRequest(path: string, method = 'GET', body?: object) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error(`Invalid JSON: ${text.substring(0, 100)}`); }
    if (!res.ok) throw new Error(json.error || 'Unbekannter Fehler');
    return json;
  } catch (error: any) {
    console.error(`API Request failed for ${path}:`, error.message);
    throw error;
  }
}

interface Team {
  id: string;
  name: string;
  slug?: string;
  created_at?: string;
  myRole: string;
  parent_id: string | null;
}

const AVATAR_COLORS = ['#7B68EE', '#F06A6A', '#00B388', '#F5A623', '#4A90E2'];
function getAvatarColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function OrganizationsSettingsScreen() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchTeams(); }, []);

  const fetchTeams = async () => {
    try {
      const data = await apiRequest('/api/teams');
      setTeams(data || []);
      if (data && data.length > 0 && !activeOrgId) {
        const orgs = data.filter((t: Team) => !t.parent_id);
        if (orgs.length > 0) setActiveOrgId(orgs[0].id);
      }
    } catch (error: any) {
      Alert.alert('Verbindungsfehler', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const orgs = teams.filter((t) => !t.parent_id);
  const subTeams = teams.filter((t) => t.parent_id === activeOrgId);
  const activeOrg = orgs.find((t) => t.id === activeOrgId);

  useEffect(() => {
    setEditName(activeOrg?.name || '');
  }, [activeOrg?.id]);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setIsCreating(true);
    try {
      const team = await apiRequest('/api/teams', 'POST', { name: newOrgName.trim() });
      setTeams((prev) => [...prev, team]);
      setActiveOrgId(team.id);
      setShowCreateOrgModal(false);
      setNewOrgName('');
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !activeOrgId) return;
    setIsCreatingTeam(true);
    try {
      const team = await apiRequest('/api/teams', 'POST', { name: newTeamName.trim(), parent_id: activeOrgId });
      setTeams((prev) => [...prev, team]);
      setShowCreateTeamModal(false);
      setNewTeamName('');
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleSaveOrg = async () => {
    if (!activeOrg || !editName.trim() || editName.trim() === activeOrg.name) return;
    setIsSaving(true);
    try {
      await apiRequest(`/api/teams/${activeOrg.id}`, 'PATCH', { name: editName.trim() });
      setTeams((prev) => prev.map((t) => t.id === activeOrg.id ? { ...t, name: editName.trim() } : t));
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTeam = (team: Team) => {
    const confirmed = window.confirm(`Team "${team.name}" wirklich löschen?`);
    if (confirmed) {
      (async () => {
        try {
          await apiRequest(`/api/teams/${team.id}`, 'DELETE');
          setTeams((prev) => prev.filter((t) => t.id !== team.id));
        } catch (e: any) {
          Alert.alert('Fehler', e.message);
        }
      })();
    }
  };

  const handleDeleteOrg = (org: Team) => {
    const confirmed = window.confirm(
      `Organisation "${org.name}" wirklich löschen?\n\nAlle zugehörigen Teams werden ebenfalls gelöscht.`
    );
    if (confirmed) {
      (async () => {
        try {
          await apiRequest(`/api/teams/${org.id}`, 'DELETE');
          setTeams((prev) => prev.filter((t) => t.id !== org.id && t.parent_id !== org.id));
          setActiveOrgId(null);
        } catch (e: any) {
          Alert.alert('Fehler', e.message);
        }
      })();
    }
  };

  return (
    <View style={styles.container}>
      {/* Create Org Modal */}
      <Modal visible={showCreateOrgModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Organisation erstellen</Text>
              <TouchableOpacity onPress={() => setShowCreateOrgModal(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Organisationsname</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="z.B. TAL GbR, Acme GmbH..."
                placeholderTextColor={Colors.textTertiary}
                value={newOrgName}
                onChangeText={setNewOrgName}
                autoFocus
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowCreateOrgModal(false)}>
                <Text style={styles.btnSecondaryText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, (!newOrgName.trim() || isCreating) && { opacity: 0.5 }]}
                onPress={handleCreateOrg}
                disabled={!newOrgName.trim() || isCreating}
              >
                <Text style={styles.btnPrimaryText}>{isCreating ? 'Erstelle...' : 'Erstellen'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Team Modal */}
      <Modal visible={showCreateTeamModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Team erstellen</Text>
              <TouchableOpacity onPress={() => setShowCreateTeamModal(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Teamname</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="z.B. Support, Vertrieb, Buchhaltung..."
                placeholderTextColor={Colors.textTertiary}
                value={newTeamName}
                onChangeText={setNewTeamName}
                autoFocus
              />
              <Text style={styles.modalHint}>
                Teams innerhalb von {activeOrg?.name} erstellen.
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowCreateTeamModal(false)}>
                <Text style={styles.btnSecondaryText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, (!newTeamName.trim() || isCreatingTeam) && { opacity: 0.5 }]}
                onPress={handleCreateTeam}
                disabled={!newTeamName.trim() || isCreatingTeam}
              >
                <Text style={styles.btnPrimaryText}>{isCreatingTeam ? 'Erstelle...' : 'Erstellen'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarContent}>
          <ScrollView>
            {isLoading ? (
              <ActivityIndicator style={{ marginTop: Spacing.xl }} />
            ) : orgs.length === 0 ? (
              <Text style={styles.sidebarEmptyText}>Noch keine Organisationen vorhanden</Text>
            ) : orgs.map((org) => (
              <TouchableOpacity
                key={org.id}
                style={activeOrgId === org.id ? styles.sidebarItemActive : styles.sidebarItem}
                onPress={() => setActiveOrgId(org.id)}
              >
                <View style={[styles.orgAvatar, { backgroundColor: getAvatarColor(org.id) }]}>
                  <Text style={styles.orgAvatarText}>{org.name.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={activeOrgId === org.id ? styles.sidebarItemTitleActive : styles.sidebarItemTitle} numberOfLines={1}>
                    {org.name}
                  </Text>
                  <Text style={activeOrgId === org.id ? styles.sidebarItemSubtitleActive : styles.sidebarItemSubtitle}>
                    {org.myRole === 'owner' ? 'Inhaber' : org.myRole === 'admin' ? 'Admin' : 'Mitglied'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <TouchableOpacity style={styles.sidebarFooter} onPress={() => setShowCreateOrgModal(true)}>
          <Text style={styles.sidebarFooterText}>+ Organisation erstellen</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {activeOrg ? (
          <>
            <View style={styles.mainHeader}>
              <View style={styles.headerTitleRow}>
                <View style={[styles.headerAvatar, { backgroundColor: getAvatarColor(activeOrg.id) }]}>
                  <Text style={styles.headerAvatarText}>{activeOrg.name.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mainHeaderTitle}>{activeOrg.name}</Text>
                  <Text style={styles.mainHeaderSubtitle}>Organisation</Text>
                </View>
                {activeOrg.myRole === 'owner' && (
                  <TouchableOpacity onPress={() => handleDeleteOrg(activeOrg)}>
                    <Text style={styles.deleteBtn}>Löschen</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
              {/* Org Name */}
              <View style={styles.card}>
                <Text style={styles.settingLabel}>Name der Organisation</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm }}>
                  <TextInput
                    style={[styles.inputSmall, { flex: 1, textAlign: 'left' }]}
                    value={editName}
                    onChangeText={setEditName}
                    editable={!!activeOrg}
                  />
                  <TouchableOpacity
                    style={[styles.btnPrimary, { paddingVertical: 8, paddingHorizontal: 16 },
                      (editName.trim() === (activeOrg?.name || '') || isSaving) && { opacity: 0.5 }]}
                    onPress={handleSaveOrg}
                    disabled={editName.trim() === (activeOrg?.name || '') || isSaving}
                  >
                    <Text style={styles.btnPrimaryText}>{isSaving ? '...' : 'Speichern'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sub-Teams */}
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.sectionTitle}>Teams ({subTeams.length})</Text>
                  {activeOrg.myRole !== 'member' && (
                    <TouchableOpacity onPress={() => setShowCreateTeamModal(true)}>
                      <Text style={styles.addBtn}>+ Team erstellen</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.sectionSubtitle}>Teams innerhalb dieser Organisation</Text>
              </View>

              {subTeams.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>Noch keine Teams vorhanden. Erstelle dein erstes Team.</Text>
                </View>
              ) : (
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
                    <Text style={[styles.tableHeaderText, { width: 100 }]}>Rolle</Text>
                    <Text style={[styles.tableHeaderText, { width: 80 }]}></Text>
                  </View>
                  {subTeams.map((team) => (
                    <View key={team.id} style={styles.tableRow}>
                      <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.teamAvatar, { backgroundColor: getAvatarColor(team.id) }]}>
                          <Text style={styles.teamAvatarText}>{team.name.substring(0, 2).toUpperCase()}</Text>
                        </View>
                        <Text style={styles.tableCellText}>{team.name}</Text>
                      </View>
                      <View style={{ width: 100 }}>
                        <Text style={styles.tableCellText}>
                          {team.myRole === 'owner' ? 'Inhaber' : team.myRole === 'admin' ? 'Admin' : 'Mitglied'}
                        </Text>
                      </View>
                      <View style={{ width: 80, alignItems: 'flex-end' }}>
                        {activeOrg.myRole === 'owner' && (
                          <TouchableOpacity onPress={() => handleDeleteTeam(team)}>
                            <Text style={styles.deleteLink}>Löschen</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </>
        ) : (
          <View style={styles.emptyState}>
            {isLoading ? <ActivityIndicator /> : (
              <>
                <Text style={styles.emptyStateTitle}>Noch keine Organisationen</Text>
                <Text style={styles.emptyStateText}>Erstelle deine erste Organisation, um Teams zu verwalten.</Text>
                <TouchableOpacity style={[styles.btnPrimary, { marginTop: Spacing.lg }]} onPress={() => setShowCreateOrgModal(true)}>
                  <Text style={styles.btnPrimaryText}>Organisation erstellen</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: Colors.background },
  sidebar: { width: 260, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.border, justifyContent: 'space-between' },
  sidebarContent: { flex: 1 },
  sidebarEmptyText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textTertiary, padding: Spacing.md, textAlign: 'center', marginTop: Spacing.xl },
  sidebarItemActive: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.info, padding: Spacing.sm, marginHorizontal: Spacing.sm, borderRadius: 6, marginBottom: 2 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, marginHorizontal: Spacing.sm, borderRadius: 6, marginBottom: 2 },
  orgAvatar: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  orgAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold' },
  sidebarItemTitleActive: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: '#FFF' },
  sidebarItemSubtitleActive: { fontFamily: FontFamily, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  sidebarItemTitle: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text },
  sidebarItemSubtitle: { fontFamily: FontFamily, fontSize: 11, color: Colors.textSecondary },
  sidebarFooter: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'center' },
  sidebarFooterText: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.info },
  main: { flex: 1 },
  mainHeader: { padding: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  headerAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold' },
  mainHeaderTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  mainHeaderSubtitle: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  deleteBtn: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.error },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, maxWidth: 700, alignSelf: 'center', width: '100%' },
  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: Spacing.lg, marginBottom: Spacing.xl },
  settingLabel: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  inputSmall: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 4, padding: 6, fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },
  sectionHeader: { marginBottom: Spacing.md },
  sectionTitle: { fontFamily: FontFamily, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  sectionSubtitle: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  addBtn: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.info },
  table: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, overflow: 'hidden', marginBottom: Spacing.xl },
  tableHeader: { flexDirection: 'row', padding: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tableHeaderText: { fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  teamAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  teamAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.xs, fontWeight: 'bold' },
  tableCellText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },
  deleteLink: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.error },
  emptyCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: Spacing.lg, marginBottom: Spacing.xl },
  emptyCardText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textTertiary },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyStateTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  emptyStateText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: 480, backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  closeIcon: { fontSize: FontSize.md, color: Colors.textSecondary },
  modalBody: { padding: Spacing.xl },
  modalLabel: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  modalInput: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.info, borderRadius: 6, padding: Spacing.sm, fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text, marginBottom: Spacing.sm },
  modalHint: { fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textTertiary, lineHeight: 18 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background, gap: Spacing.sm },
  btnPrimary: { backgroundColor: Colors.info, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: 6 },
  btnPrimaryText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: '#FFF', fontWeight: 'bold' },
  btnSecondary: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  btnSecondaryText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },
});
