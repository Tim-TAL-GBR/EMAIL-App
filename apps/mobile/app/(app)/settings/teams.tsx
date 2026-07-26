import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, Platform, Pressable
} from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';

interface Organization {
  id: string;
  name: string;
  myRole: string;
}

interface Group {
  id: string;
  name: string;
  memberCount: number;
  myRole: string | null;
}

interface Member {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
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
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [orgMembers, setOrgMembers] = useState<Member[]>([]);
  const [loadingOrgMembers, setLoadingOrgMembers] = useState(false);

  const selectedOrg = organizations.find(o => o.id === selectedOrgId);
  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const canManage = selectedOrg && ['owner', 'admin'].includes(selectedOrg.myRole);

  useEffect(() => { loadOrganizations(); }, []);
  useEffect(() => { if (selectedOrgId) loadGroups(selectedOrgId); }, [selectedOrgId]);
  useEffect(() => { if (selectedGroupId) loadMembers(selectedGroupId); else setMembers([]); }, [selectedGroupId]);

  const loadOrganizations = async () => {
    try {
      const data = await apiRequest('/api/teams');
      setOrganizations(data);
      if (data.length > 0) setSelectedOrgId(data[0].id);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async (orgId: string) => {
    setLoadingGroups(true);
    try {
      const data = await apiRequest(`/api/groups?team_id=${orgId}`);
      setGroups(data);
      if (data.length > 0) setSelectedGroupId(data[0].id);
      else setSelectedGroupId(null);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadMembers = async (groupId: string) => {
    setLoadingMembers(true);
    try {
      const data = await apiRequest(`/api/groups/${groupId}/members`);
      setMembers(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !selectedOrgId) return;
    setIsCreating(true);
    try {
      const group = await apiRequest('/api/groups', 'POST', { name: newGroupName.trim(), team_id: selectedOrgId });
      setGroups(prev => [...prev, group]);
      setSelectedGroupId(group.id);
      setShowCreateModal(false);
      setNewGroupName('');
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGroup = (group: Group) => {
    if (!canManage) return;
    Alert.alert(
      'Team löschen',
      `Soll das Team "${group.name}" wirklich gelöscht werden?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen', style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/api/groups/${group.id}`, 'DELETE');
              const updated = groups.filter(g => g.id !== group.id);
              setGroups(updated);
              setSelectedGroupId(updated.length > 0 ? updated[0].id : null);
            } catch (e: any) {
              Alert.alert('Fehler', e.message);
            }
          }
        }
      ]
    );
  };

  const openAddMemberModal = async () => {
    if (!selectedOrgId) return;
    setShowAddMemberModal(true);
    setLoadingOrgMembers(true);
    try {
      const data = await apiRequest(`/api/teams/${selectedOrgId}/members`);
      // Filter out those who are already in this group
      const available = data.filter((orgMember: Member) => !members.find(m => m.id === orgMember.id));
      setOrgMembers(available);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
      setShowAddMemberModal(false);
    } finally {
      setLoadingOrgMembers(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    console.log('[teams.tsx] handleAddMember called with userId:', userId);
    if (!selectedGroupId) {
      console.warn('[teams.tsx] handleAddMember aborted because selectedGroupId is null');
      return;
    }
    try {
      await apiRequest(`/api/groups/${selectedGroupId}/members`, 'POST', { user_id: userId });
      setShowAddMemberModal(false);
      loadMembers(selectedGroupId); // reload members
    } catch (e: any) {
      console.error('[teams.tsx] handleAddMember error:', e.message);
      if (Platform.OS === 'web') window.alert('Fehler\n' + e.message);
      else Alert.alert('Fehler', e.message);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroupId) return;
    try {
      await apiRequest(`/api/groups/${selectedGroupId}/members/${userId}`, 'DELETE');
      loadMembers(selectedGroupId); // reload members
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Create Team Modal */}
      <Modal visible={showCreateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Neues Team in {selectedOrg?.name}</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Teamname</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="z.B. Support, Buchhaltung..."
                placeholderTextColor={Colors.textTertiary}
                value={newGroupName}
                onChangeText={setNewGroupName}
                autoFocus
              />
              <Text style={styles.modalHint}>
                Ein Team strukturiert Benutzer innerhalb einer Organisation.
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.btnSecondaryText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, (!newGroupName.trim() || isCreating) && { opacity: 0.5 }]}
                onPress={handleCreateGroup}
                disabled={!newGroupName.trim() || isCreating}
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
            <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="always">
              {loadingOrgMembers ? (
                <ActivityIndicator style={{ margin: Spacing.xl }} />
              ) : orgMembers.length === 0 ? (
                <Text style={styles.emptyText}>Alle Benutzer dieser Organisation sind bereits im Team, oder es gibt keine weiteren Benutzer.</Text>
              ) : (
                orgMembers.map(member => (
                  <Pressable key={member.id} style={({pressed}) => [styles.orgMemberItem, pressed && {opacity: 0.7}]} onPress={() => handleAddMember(member.id)}>
                    <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(member.id), width: 36, height: 36, borderRadius: 18 }]}>
                      <Text style={[styles.userAvatarText, { fontSize: 14 }]}>
                        {(member.display_name || member.email).substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.cellBold}>{member.display_name || member.email}</Text>
                      {member.display_name && <Text style={styles.cellSub}>{member.email}</Text>}
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sidebar */}
      <View style={styles.sidebar}>
        <ScrollView style={styles.sidebarContent}>
          {loading ? (
            <ActivityIndicator style={{ marginTop: Spacing.xl }} />
          ) : organizations.length === 0 ? (
            <Text style={styles.sidebarEmptyText}>Keine Organisationen gefunden</Text>
          ) : (
            organizations.map(org => (
              <View key={org.id} style={styles.orgSection}>
                <Text style={styles.orgHeader}>{org.name.toUpperCase()}</Text>
                
                {loadingGroups && selectedOrgId === org.id ? (
                  <ActivityIndicator size="small" style={{ margin: Spacing.sm }} />
                ) : (
                  <>
                    {(selectedOrgId === org.id ? groups : []).map(group => (
                      <TouchableOpacity
                        key={group.id}
                        style={selectedGroupId === group.id ? styles.sidebarItemActive : styles.sidebarItem}
                        onPress={() => setSelectedGroupId(group.id)}
                      >
                        <View style={[styles.orgAvatar, { backgroundColor: getAvatarColor(group.id), width: 28, height: 28, borderRadius: 6 }]}>
                          <Text style={[styles.orgAvatarText, { fontSize: 11 }]}>{group.name.substring(0, 2).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={selectedGroupId === group.id ? styles.sidebarItemTitleActive : styles.sidebarItemTitle} numberOfLines={1}>
                            {group.name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    
                    {selectedOrgId === org.id && canManage && (
                      <TouchableOpacity style={styles.sidebarAddGroup} onPress={() => setShowCreateModal(true)}>
                        <Text style={styles.sidebarAddGroupText}>+ Neues Team</Text>
                      </TouchableOpacity>
                    )}
                    
                    {selectedOrgId !== org.id && (
                      <TouchableOpacity style={styles.sidebarItem} onPress={() => setSelectedOrgId(org.id)}>
                        <Text style={[styles.sidebarItemTitle, { color: Colors.primary }]}>Teams anzeigen</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {selectedGroup ? (
          <>
            <View style={styles.mainHeader}>
              <View style={styles.headerTitleRow}>
                <View style={[styles.headerAvatar, { backgroundColor: getAvatarColor(selectedGroup.id) }]}>
                  <Text style={styles.headerAvatarText}>{selectedGroup.name.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mainHeaderTitle}>{selectedGroup.name}</Text>
                  <Text style={styles.mainHeaderSubtitle}>Team in {selectedOrg?.name}</Text>
                </View>
                {canManage && (
                  <TouchableOpacity onPress={() => handleDeleteGroup(selectedGroup)}>
                    <Text style={styles.deleteBtn}>Team löschen</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
              <View style={styles.infoBox}>
                <Text style={styles.infoIcon}>👥</Text>
                <Text style={styles.infoText}>
                  Dies ist ein Team innerhalb der Organisation "{selectedOrg?.name}". Ein Benutzer kann in mehreren Teams gleichzeitig sein.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
                <Text style={styles.sectionTitle}>Mitglieder ({loadingMembers ? '...' : members.length})</Text>
                {canManage && (
                  <TouchableOpacity onPress={openAddMemberModal}>
                    <Text style={{ color: Colors.primary, fontWeight: 'bold', fontSize: FontSize.sm }}>+ Mitglied hinzufügen</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
                  {canManage && <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Aktion</Text>}
                </View>

                {loadingMembers ? (
                  <ActivityIndicator style={{ margin: Spacing.xl }} />
                ) : members.length === 0 ? (
                  <Text style={styles.emptyText}>Dieses Team hat noch keine Mitglieder.</Text>
                ) : members.map(member => (
                  <View key={member.id} style={styles.tableRow}>
                    <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(member.id) }]}>
                        <Text style={styles.userAvatarText}>
                          {(member.display_name || member.email).substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.cellBold}>{member.display_name || member.email}</Text>
                        {member.display_name && <Text style={styles.cellSub}>{member.email}</Text>}
                      </View>
                    </View>
                    {canManage && (
                      <View style={{ width: 80, alignItems: 'flex-end' }}>
                        <TouchableOpacity onPress={() => handleRemoveMember(member.id)}>
                          <Text style={styles.deleteBtn}>Entfernen</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          </>
        ) : (
          <View style={styles.emptyState}>
            {loadingGroups ? <ActivityIndicator /> : (
              <>
                <Text style={styles.emptyStateTitle}>Kein Team ausgewählt</Text>
                <Text style={styles.emptyStateText}>Bitte wähle ein Team in der Seitenleiste aus oder erstelle ein neues.</Text>
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
  sidebar: { width: 260, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.border },
  sidebarContent: { flex: 1 },
  orgSection: { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: Spacing.sm },
  orgHeader: { fontFamily: FontFamily, fontSize: FontSize.xs, fontWeight: 'bold', color: Colors.textTertiary, padding: Spacing.md, paddingBottom: Spacing.sm, letterSpacing: 0.5 },
  sidebarEmptyText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textTertiary, padding: Spacing.md, textAlign: 'center', marginTop: Spacing.xl },
  sidebarItemActive: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, padding: Spacing.sm, marginHorizontal: Spacing.sm, borderRadius: 6, marginBottom: 2 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, marginHorizontal: Spacing.sm, borderRadius: 6, marginBottom: 2 },
  sidebarAddGroup: { padding: Spacing.sm, marginHorizontal: Spacing.sm, marginTop: Spacing.xs },
  sidebarAddGroupText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.primary, fontWeight: 'bold' },
  orgAvatar: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  orgAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold' },
  sidebarItemTitleActive: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: '#FFF' },
  sidebarItemTitle: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text },
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
  emptyText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textTertiary, padding: Spacing.xl, textAlign: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyStateTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  emptyStateText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  // Modals
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
  orgMemberItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
});
