import { API_URL } from "@/lib/constants";
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, useWindowDimensions
} from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';



interface Team {
  id: string;
  name: string;
  slug: string;
  myRole: string;
  memberCount?: number;
  parent_id: string | null;
}

interface Member {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  isMe?: boolean;
}

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

const AVATAR_COLORS = ['#7B68EE', '#F06A6A', '#00B388', '#F5A623', '#4A90E2'];

function getAvatarColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function TeamsSettingsScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Create team modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // Add member modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [addMemberRole, setAddMemberRole] = useState('member');
  const [isAdding, setIsAdding] = useState(false);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const canManage = selectedTeam && ['owner', 'admin'].includes(selectedTeam.myRole);
  const orgs = teams.filter(t => !t.parent_id);
  const subTeams = teams.filter(t => !!t.parent_id);

  useEffect(() => { loadTeams(); }, []);
  useEffect(() => { if (selectedTeamId) loadMembers(selectedTeamId); }, [selectedTeamId]);

  const loadTeams = async () => {
    try {
      const data = await apiRequest('/api/teams');
      setTeams(data);
      const firstSubTeam = data.find((t: Team) => !!t.parent_id);
      if (firstSubTeam) setSelectedTeamId(firstSubTeam.id);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (teamId: string) => {
    setLoadingMembers(true);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/members`);
      setMembers(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setIsCreating(true);
    try {
      const team = await apiRequest('/api/teams', 'POST', {
        name: newTeamName.trim(),
        ...(selectedOrgId ? { parent_id: selectedOrgId } : {}),
      });
      setTeams(prev => [...prev, team]);
      setSelectedTeamId(team.id);
      setShowCreateModal(false);
      setNewTeamName('');
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTeam = (team: Team) => {
    if (team.myRole !== 'owner') {
      Alert.alert('Keine Berechtigung', 'Nur der Eigentümer kann ein Team löschen.');
      return;
    }
    const confirmed = window.confirm(
      `Team "${team.name}" wirklich löschen?\n\nDieser Schritt kann nicht rückgängig gemacht werden.`
    );
    if (confirmed) {
      (async () => {
        try {
          await apiRequest(`/api/teams/${team.id}`, 'DELETE');
          const updated = teams.filter(t => t.id !== team.id);
          setTeams(updated);
          setSelectedTeamId(updated.length > 0 ? updated[0].id : null);
        } catch (e: any) {
          Alert.alert('Fehler', e.message);
        }
      })();
    }
  };

  const handleShowAddMember = async () => {
    if (!selectedTeamId) return;
    setShowAddMemberModal(true);
    try {
      const available = await apiRequest(`/api/teams/${selectedTeamId}/available-users`);
      setAllProfiles(available);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleAddMember = async (user: any) => {
    if (!selectedTeamId) return;
    setIsAdding(true);
    try {
      await apiRequest(`/api/teams/${selectedTeamId}/members/invite`, 'POST', {
        email: user.email,
        role: addMemberRole,
      });
      setAddMemberRole('member');
      setShowAddMemberModal(false);
      loadMembers(selectedTeamId);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = (member: Member) => {
    const confirmed = window.confirm(`${member.display_name || member.email} aus dem Team entfernen?`);
    if (confirmed && selectedTeamId) {
      (async () => {
        try {
          await apiRequest(`/api/teams/${selectedTeamId}/members/${member.id}`, 'DELETE');
          loadMembers(selectedTeamId);
        } catch (e: any) {
          Alert.alert('Fehler', e.message);
        }
      })();
    }
  };

  return (
    <View style={[styles.container, isMobile && { flexDirection: 'column' }]}>
      {/* Create Team Modal */}
      <Modal visible={showCreateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Team erstellen</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
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
              {orgs.length > 0 && (
                <>
                  <Text style={[styles.modalLabel, { marginTop: Spacing.md }]}>Organisation (optional)</Text>
                  <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                    <TouchableOpacity
                      style={[styles.orgChip, !selectedOrgId && styles.orgChipActive]}
                      onPress={() => setSelectedOrgId(null)}
                    >
                      <Text style={[styles.orgChipText, !selectedOrgId && styles.orgChipTextActive]}>Keine Organisation</Text>
                    </TouchableOpacity>
                    {orgs.map((org) => (
                      <TouchableOpacity
                        key={org.id}
                        style={[styles.orgChip, selectedOrgId === org.id && styles.orgChipActive]}
                        onPress={() => setSelectedOrgId(org.id)}
                      >
                        <Text style={[styles.orgChipText, selectedOrgId === org.id && styles.orgChipTextActive]}>{org.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
              <Text style={styles.modalHint}>
                Teams helfen dir, Mitglieder per @Erwähnung in Kommentaren zu benachrichtigen.
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.btnSecondaryText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, (!newTeamName.trim() || isCreating) && { opacity: 0.5 }]}
                onPress={handleCreateTeam}
                disabled={!newTeamName.trim() || isCreating}
              >
                <Text style={styles.btnPrimaryText}>{isCreating ? 'Erstelle...' : 'Erstellen'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Member Modal */}
      <Modal visible={showAddMemberModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mitglied hinzufügen</Text>
              <TouchableOpacity onPress={() => setShowAddMemberModal(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.modalLabel, { marginBottom: Spacing.md }]}>Rolle</Text>
              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
                {[
                  { value: 'member', label: 'Mitglied' },
                  { value: 'admin', label: 'Admin' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.orgChip, addMemberRole === opt.value && styles.orgChipActive]}
                    onPress={() => setAddMemberRole(opt.value)}
                  >
                    <Text style={[styles.orgChipText, addMemberRole === opt.value && styles.orgChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Nutzer auswählen</Text>
              <ScrollView style={{ maxHeight: 280 }}>
                {allProfiles.length === 0 ? (
                  <Text style={styles.emptyText}>Keine weiteren Nutzer verfügbar</Text>
                ) : (
                  allProfiles.map((user: any) => (
                    <TouchableOpacity
                      key={user.id}
                      style={styles.userPickerRow}
                      onPress={() => handleAddMember(user)}
                      disabled={isAdding}
                    >
                      <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(user.id) }]}>
                        <Text style={styles.userAvatarText}>
                          {(user.display_name || user.email || '??').substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cellBold}>{user.display_name || 'Unbekannt'}</Text>
                        <Text style={styles.cellSub}>{user.email}</Text>
                      </View>
                      <Text style={{ color: Colors.primary, fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold' }}>
                        Hinzufügen
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowAddMemberModal(false)}>
                <Text style={styles.btnSecondaryText}>Schließen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sidebar */}
      <View style={[styles.sidebar, isMobile && { width: '100%', height: 250, borderRightWidth: 0, borderBottomWidth: 1 }]}>
        <View style={styles.sidebarContent}>
          <ScrollView>
            {loading ? (
              <ActivityIndicator style={{ marginTop: Spacing.xl }} />
            ) : subTeams.length === 0 ? (
              <Text style={styles.sidebarEmptyText}>Noch keine Teams vorhanden</Text>
            ) : subTeams.map(team => (
              <TouchableOpacity
                key={team.id}
                style={selectedTeamId === team.id ? styles.sidebarItemActive : styles.sidebarItem}
                onPress={() => setSelectedTeamId(team.id)}
              >
                <View style={[styles.orgAvatar, { backgroundColor: getAvatarColor(team.id) }]}>
                  <Text style={styles.orgAvatarText}>{team.name.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={selectedTeamId === team.id ? styles.sidebarItemTitleActive : styles.sidebarItemTitle} numberOfLines={1}>
                    {team.name}
                  </Text>
                  <Text style={selectedTeamId === team.id ? styles.sidebarItemSubtitleActive : styles.sidebarItemSubtitle}>
                    {team.parent_id ? orgs.find(o => o.id === team.parent_id)?.name || 'Team' : team.myRole === 'owner' ? 'Inhaber' : team.myRole === 'admin' ? 'Admin' : 'Mitglied'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <TouchableOpacity
          style={styles.sidebarFooter}
          onPress={() => orgs.length > 0 ? setShowCreateModal(true) : Alert.alert('Hinweis', 'Erstelle zuerst eine Organisation unter "Organisationen".')}
        >
          <Text style={styles.sidebarFooterText}>+ Team erstellen</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {selectedTeam ? (
          <>
            <View style={styles.mainHeader}>
              <View style={styles.headerTitleRow}>
                <View style={[styles.headerAvatar, { backgroundColor: getAvatarColor(selectedTeam.id) }]}>
                  <Text style={styles.headerAvatarText}>{selectedTeam.name.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mainHeaderTitle}>{selectedTeam.name}</Text>
                  <Text style={styles.mainHeaderSubtitle}>
                    {selectedTeam.parent_id ? `Team in ${orgs.find(o => o.id === selectedTeam.parent_id)?.name || 'Organisation'}` : 'Team'}
                  </Text>
                </View>
                {(selectedTeam.myRole === 'owner' || (selectedTeam.parent_id && canManage)) && (
                  <TouchableOpacity onPress={() => handleDeleteTeam(selectedTeam)}>
                    <Text style={styles.deleteBtn}>Team löschen</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
              <View style={styles.infoBox}>
                <Text style={styles.infoIcon}>👥</Text>
                <Text style={styles.infoText}>
                  Teams bieten eine Möglichkeit, mehrere Personen gleichzeitig per @Erwähnung in Kommentaren zu benachrichtigen.
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Mitglieder ({loadingMembers ? '...' : members.length})</Text>

              {canManage && (
                <TouchableOpacity style={styles.inviteBtn} onPress={handleShowAddMember}>
                  <Text style={styles.inviteBtnText}>+ Hinzufügen</Text>
                </TouchableOpacity>
              )}

              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
                  <Text style={[styles.tableHeaderText, { width: 100 }]}>Rolle</Text>
                  {canManage && <Text style={[styles.tableHeaderText, { width: 80 }]}></Text>}
                </View>

                {loadingMembers ? (
                  <ActivityIndicator style={{ margin: Spacing.xl }} />
                ) : members.length === 0 ? (
                  <Text style={styles.emptyText}>Keine Mitglieder</Text>
                ) : members.map(member => (
                  <View key={member.id} style={styles.tableRow}>
                    <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(member.id) }]}>
                        <Text style={styles.userAvatarText}>
                          {(member.display_name || 'UN').substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.cellBold}>{member.display_name || 'Unbekannt'}</Text>
                        {member.display_name && <Text style={styles.cellSub}>{member.email}</Text>}
                      </View>
                    </View>
                    <View style={{ width: 100 }}>
                      <Text style={styles.cellText}>
                        {member.role === 'owner' ? 'Inhaber' : member.role === 'admin' ? 'Admin' : 'Mitglied'}
                      </Text>
                    </View>
                    {canManage && (
                      <View style={{ width: 80, alignItems: 'flex-end' }}>
                        {!member.isMe && member.role !== 'owner' && (
                          <TouchableOpacity onPress={() => handleRemoveMember(member)}>
                            <Text style={styles.deleteLink}>Entfernen</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          </>
        ) : (
          <View style={styles.emptyState}>
            {loading ? <ActivityIndicator /> : (
              <>
                <Text style={styles.emptyStateTitle}>Noch keine Teams</Text>
                <Text style={styles.emptyStateText}>
                  {orgs.length > 0
                    ? `Erstelle ein Team innerhalb einer Organisation.`
                    : `Erstelle zuerst eine Organisation unter "Organisationen", dann kannst du Teams erstellen.`}
                </Text>
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
  sidebarItemActive: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, padding: Spacing.sm, marginHorizontal: Spacing.sm, borderRadius: 6, marginBottom: 2 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, marginHorizontal: Spacing.sm, borderRadius: 6, marginBottom: 2 },
  orgAvatar: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  orgAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold' },
  sidebarItemTitleActive: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: '#FFF' },
  sidebarItemSubtitleActive: { fontFamily: FontFamily, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  sidebarItemTitle: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text },
  sidebarItemSubtitle: { fontFamily: FontFamily, fontSize: 11, color: Colors.textSecondary },
  sidebarFooter: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'center' },
  sidebarFooterText: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.primary },
  main: { flex: 1 },
  mainHeader: { padding: Spacing.xl, paddingBottom: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  headerAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold' },
  mainHeaderTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  mainHeaderSubtitle: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  deleteBtn: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.error },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, maxWidth: 700, alignSelf: 'center', width: '100%' },
  infoBox: { flexDirection: 'row', backgroundColor: Colors.surfaceHover, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: Spacing.lg, marginBottom: Spacing.xl, gap: Spacing.sm, alignItems: 'flex-start' },
  infoIcon: { fontSize: 18 },
  infoText: { flex: 1, fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  sectionTitle: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  table: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, overflow: 'hidden', marginBottom: Spacing.xl },
  tableHeaderRow: { flexDirection: 'row', padding: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tableHeaderText: { fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  userAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  userAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.xs, fontWeight: 'bold' },
  cellBold: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text },
  cellSub: { fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textSecondary },
  cellText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary },
  emptyText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textTertiary, padding: Spacing.xl, textAlign: 'center' },
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
  modalInput: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.primary, borderRadius: 6, padding: Spacing.sm, fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text, marginBottom: Spacing.sm },
  modalHint: { fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textTertiary, lineHeight: 18 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background, gap: Spacing.sm },
  btnPrimary: { backgroundColor: Colors.primary, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: 6 },
  btnPrimaryText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: '#FFF', fontWeight: FontWeight.bold },
  btnSecondary: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  btnSecondaryText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },
  orgChip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xs },
  orgChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  orgChipText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },
  orgChipTextActive: { color: '#FFF', fontWeight: 'bold' },
  inviteBtn: { alignSelf: 'flex-start', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 6, borderWidth: 1, borderColor: Colors.primary, marginBottom: Spacing.md },
  inviteBtnText: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.primary },
  deleteLink: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.error },
  userPickerRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
});
