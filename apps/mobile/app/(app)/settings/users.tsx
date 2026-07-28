import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal
} from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';

interface Team {
  id: string;
  name: string;
  slug: string;
  myRole: string;
}

interface Member {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  joinedAt: string;
  isMe: boolean;
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

const ROLE_LABELS: Record<string, string> = {
  owner: 'Inhaber',
  admin: 'Admin',
  member: 'Mitglied',
};

const AVATAR_COLORS = ['#7B68EE', '#F06A6A', '#00B388', '#F5A623', '#4A90E2', '#D04040'];

function getAvatarColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.split(' ');
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }
  return 'UN';
}

export default function UsersSettingsScreen() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [isInviting, setIsInviting] = useState(false);

  // Role dropdown state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Unassigned users state
  const [unassignedUsers, setUnassignedUsers] = useState<any[]>([]);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [showAddToTeamModal, setShowAddToTeamModal] = useState(false);
  const [assigningUser, setAssigningUser] = useState<any>(null);
  const [assignTargetTeamId, setAssignTargetTeamId] = useState<string | null>(null);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const canManage = selectedTeam && ['owner', 'admin'].includes(selectedTeam.myRole);

  const filteredMembers = members.filter(m => {
    const q = searchQuery.toLowerCase();
    return (
      (m.display_name || '').toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  useEffect(() => { loadTeams(); }, []);
  useEffect(() => { if (selectedTeamId) loadMembers(selectedTeamId); }, [selectedTeamId]);

  const fetchUnassignedUsers = async () => {
    setLoadingUnassigned(true);
    try {
      const data = await apiRequest('/api/teams/unassigned-users');
      setUnassignedUsers(data);
    } catch (e: any) {
      console.warn('Error fetching unassigned users:', e.message);
    } finally {
      setLoadingUnassigned(false);
    }
  };

  const handleAssignToTeam = async () => {
    if (!assigningUser || !assignTargetTeamId) return;
    try {
      await apiRequest(`/api/teams/${assignTargetTeamId}/members/create`, 'POST', {
        email: assigningUser.email,
        password: 'TeamMail2026!',
        role: 'member',
      });
      Alert.alert('Erfolg', `${assigningUser.display_name || assigningUser.email} wurde hinzugefügt.`);
      setShowAddToTeamModal(false);
      setAssigningUser(null);
      setAssignTargetTeamId(null);
      fetchUnassignedUsers();
      if (selectedTeamId) loadMembers(selectedTeamId);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    try {
      await apiRequest(`/api/teams/unassigned-users/${userId}`, 'DELETE');
      Alert.alert('Erfolg', `${name} wurde gelöscht.`);
      fetchUnassignedUsers();
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    }
  };

  const loadTeams = async () => {
    try {
      const data = await apiRequest('/api/teams');
      setTeams(data);
      if (data.length > 0) setSelectedTeamId(data[0].id);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoadingTeams(false);
    }
  };

  const loadMembers = async (teamId: string) => {
    setLoadingMembers(true);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/members`);
      setMembers(data);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleInvite = async () => {
    if (!selectedTeamId || !inviteEmail.trim() || !invitePassword.trim()) return;
    setIsInviting(true);
    try {
      const res = await apiRequest(`/api/teams/${selectedTeamId}/members/create`, 'POST', {
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        password: invitePassword.trim(),
        role: inviteRole,
      });
      Alert.alert('Erfolg ✓', res.message);
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      setInvitePassword('');
      setInviteRole('member');
      loadMembers(selectedTeamId);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    if (!selectedTeamId) return;
    setEditingMemberId(null);
    try {
      await apiRequest(`/api/teams/${selectedTeamId}/members/${memberId}`, 'PATCH', { role: newRole });
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    }
  };

  const handleRemoveMember = (member: Member) => {
    Alert.alert(
      'Mitglied entfernen',
      `Soll ${member.display_name || 'Unbekannt'} wirklich aus dem Team entfernt werden?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen', style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/api/teams/${selectedTeamId}/members/${member.id}`, 'DELETE');
              setMembers(prev => prev.filter(m => m.id !== member.id));
            } catch (e: any) {
              Alert.alert('Fehler', e.message);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Invite Modal */}
      <Modal visible={showInviteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Benutzer anlegen</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Max Mustermann"
                placeholderTextColor={Colors.textTertiary}
                value={inviteName}
                onChangeText={setInviteName}
                autoFocus
              />
              <Text style={[styles.modalLabel, { marginTop: Spacing.md }]}>E-Mail-Adresse</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="name@beispiel.de"
                placeholderTextColor={Colors.textTertiary}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text style={[styles.modalLabel, { marginTop: Spacing.md }]}>Passwort</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Mindestens 6 Zeichen"
                placeholderTextColor={Colors.textTertiary}
                value={invitePassword}
                onChangeText={setInvitePassword}
                secureTextEntry
              />
              <Text style={[styles.modalLabel, { marginTop: Spacing.md }]}>Rolle</Text>
              <View style={styles.roleSelector}>
                {['member', 'admin'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleOption, inviteRole === r && styles.roleOptionActive]}
                    onPress={() => setInviteRole(r)}
                  >
                    <Text style={[styles.roleOptionText, inviteRole === r && styles.roleOptionTextActive]}>
                      {ROLE_LABELS[r]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setShowInviteModal(false)}
              >
                <Text style={styles.btnSecondaryText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, (!inviteEmail.trim() || !invitePassword.trim() || isInviting) && { opacity: 0.5 }]}
                onPress={handleInvite}
                disabled={!inviteEmail.trim() || !invitePassword.trim() || isInviting}
              >
                <Text style={styles.btnPrimaryText}>{isInviting ? 'Wird angelegt...' : 'Anlegen'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add to Team Modal */}
      <Modal visible={showAddToTeamModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Zu Organisation hinzufügen</Text>
              <TouchableOpacity onPress={() => { setShowAddToTeamModal(false); setAssigningUser(null); }}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Benutzer</Text>
              <Text style={[styles.tableCellText, { marginBottom: Spacing.md }]}>{assigningUser?.display_name || assigningUser?.email || ''}</Text>
              <Text style={[styles.modalLabel, { marginTop: Spacing.md }]}>Organisation wählen</Text>
              {teams.map(team => (
                <TouchableOpacity
                  key={team.id}
                  style={[styles.roleOption, assignTargetTeamId === team.id && styles.roleOptionActive, { marginBottom: Spacing.sm }]}
                  onPress={() => setAssignTargetTeamId(team.id)}
                >
                  <Text style={[styles.roleOptionText, assignTargetTeamId === team.id && styles.roleOptionTextActive]}>
                    {team.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => { setShowAddToTeamModal(false); setAssigningUser(null); }}>
                <Text style={styles.btnSecondaryText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, !assignTargetTeamId && { opacity: 0.5 }]}
                onPress={handleAssignToTeam}
                disabled={!assignTargetTeamId}
              >
                <Text style={styles.btnPrimaryText}>Hinzufügen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarContent}>
          <View style={styles.searchWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Benutzer suchen..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <ScrollView>
            {loadingTeams ? (
              <ActivityIndicator style={{ marginTop: Spacing.xl }} />
            ) : (
              <>
                {teams.map(team => (
                  <TouchableOpacity
                    key={team.id}
                    style={selectedTeamId === team.id && !showUnassigned ? styles.sidebarItemActive : styles.sidebarItem}
                    onPress={() => { setSelectedTeamId(team.id); setShowUnassigned(false); }}
                  >
                    <View style={[styles.orgAvatar, { backgroundColor: getAvatarColor(team.id) }]}>
                      <Text style={styles.orgAvatarText}>{team.name.substring(0, 2).toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={selectedTeamId === team.id && !showUnassigned ? styles.sidebarItemTitleActive : styles.sidebarItemTitle}>
                        {team.name}
                      </Text>
                      <Text style={selectedTeamId === team.id && !showUnassigned ? styles.sidebarItemSubtitleActive : styles.sidebarItemSubtitle}>
                        {ROLE_LABELS[team.myRole] || team.myRole}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={showUnassigned ? styles.sidebarItemActive : styles.sidebarItem}
                  onPress={() => { setShowUnassigned(true); fetchUnassignedUsers(); }}
                >
                  <View style={[styles.orgAvatar, { backgroundColor: '#9CA3AF' }]}>
                    <Text style={styles.orgAvatarText}>?</Text>
                  </View>
                  <View>
                    <Text style={showUnassigned ? styles.sidebarItemTitleActive : styles.sidebarItemTitle}>
                      Ohne Organisation
                    </Text>
                    <Text style={showUnassigned ? styles.sidebarItemSubtitleActive : styles.sidebarItemSubtitle}>
                      {unassignedUsers.length} Nutzer
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
        {canManage && (
          <TouchableOpacity style={styles.sidebarFooter} onPress={() => setShowInviteModal(true)}>
            <Text style={styles.sidebarFooterText}>+ Benutzer anlegen</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {showUnassigned ? (
          <>
            <View style={styles.mainHeader}>
              <View style={styles.headerTitleRow}>
                <View style={[styles.headerAvatar, { backgroundColor: '#9CA3AF' }]}>
                  <Text style={styles.headerAvatarText}>?</Text>
                </View>
                <View>
                  <Text style={styles.mainHeaderTitle}>Ohne Organisation</Text>
                  <Text style={styles.mainHeaderSubtitle}>Benutzer ohne Team-Zugehörigkeit</Text>
                </View>
              </View>
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>E-Mail</Text>
                <Text style={[styles.tableHeaderText, { width: 180 }]}></Text>
              </View>
              {loadingUnassigned ? (
                <ActivityIndicator style={{ marginTop: Spacing.xl }} />
              ) : unassignedUsers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Alle Benutzer sind einer Organisation zugeordnet.</Text>
                </View>
              ) : unassignedUsers.map(user => (
                <View key={user.id} style={styles.tableRow}>
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(user.id) }]}>
                      <Text style={styles.userAvatarText}>{getInitials(user.display_name, user.email)}</Text>
                    </View>
                    <View>
                      <Text style={styles.tableCellTextBold}>{user.display_name || 'Unbekannt'}</Text>
                    </View>
                  </View>
                  <Text style={[styles.tableCellSubtitle, { flex: 2 }]}>{user.email}</Text>
                  <View style={{ width: 180, flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm }}>
                    <TouchableOpacity onPress={() => { setAssigningUser(user); setShowAddToTeamModal(true); }}>
                      <Text style={styles.roleChip}>Hinzufügen →</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      const name = user.display_name || user.email;
                      const confirmed = typeof window !== 'undefined'
                        ? window.confirm(`Soll ${name} wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`)
                        : true;
                      if (!confirmed) return;
                      handleDeleteUser(user.id, name);
                    }}>
                      <Text style={[styles.roleChip, { color: Colors.error }]}>Löschen</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        ) : selectedTeam ? (
          <>
            <View style={styles.mainHeader}>
              <View style={styles.headerTitleRow}>
                <View style={[styles.headerAvatar, { backgroundColor: getAvatarColor(selectedTeam.id) }]}>
                  <Text style={styles.headerAvatarText}>{selectedTeam.name.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.mainHeaderTitle}>{selectedTeam.name}</Text>
                  <Text style={styles.mainHeaderSubtitle}>Benutzer</Text>
                </View>
              </View>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
                <Text style={[styles.tableHeaderText, { width: 100 }]}>Rolle</Text>
                {canManage && <Text style={[styles.tableHeaderText, { width: 100 }]}></Text>}
              </View>

              {loadingMembers ? (
                <ActivityIndicator style={{ marginTop: Spacing.xl }} />
              ) : filteredMembers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Keine Mitglieder gefunden</Text>
                </View>
              ) : filteredMembers.map(member => (
                <View key={member.id} style={styles.tableRow}>
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(member.id) }]}>
                      <Text style={styles.userAvatarText}>{getInitials(member.display_name, member.email)}</Text>
                    </View>
                    <View>
                      <Text style={styles.tableCellTextBold}>
                        {member.display_name || 'Unbekannt'}
                        {member.isMe && <Text style={styles.meBadge}> (Du)</Text>}
                      </Text>
                      <Text style={styles.tableCellSubtitle}>{member.email}</Text>
                    </View>
                  </View>

                  <View style={{ width: 100 }}>
                    {canManage && !member.isMe ? (
                      <View>
                        <TouchableOpacity
                          onPress={() => setEditingMemberId(editingMemberId === member.id ? null : member.id)}
                        >
                          <Text style={styles.roleChip}>{ROLE_LABELS[member.role] || member.role} ⌄</Text>
                        </TouchableOpacity>
                        {editingMemberId === member.id && (
                          <View style={styles.roleDropdown}>
                            {(['member', 'admin', 'owner'] as const).map(r => (
                              <TouchableOpacity
                                key={r}
                                style={styles.roleDropdownItem}
                                onPress={() => handleChangeRole(member.id, r)}
                              >
                                <Text style={[styles.roleDropdownText, member.role === r && { color: Colors.primary, fontWeight: 'bold' }]}>
                                  {ROLE_LABELS[r]}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.tableCellText}>{ROLE_LABELS[member.role] || member.role}</Text>
                    )}
                  </View>

                  {canManage && (
                    <View style={{ width: 100, alignItems: 'flex-end' }}>
                      {!member.isMe && (
                        <TouchableOpacity onPress={() => handleRemoveMember(member)}>
                          <Text style={styles.removeBtn}>Entfernen</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </>
        ) : (
          <View style={styles.emptyState}>
            {loadingTeams ? <ActivityIndicator /> : <Text style={styles.emptyStateText}>Kein Team ausgewählt</Text>}
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
  searchWrapper: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, margin: Spacing.md, backgroundColor: Colors.background, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  searchIcon: { fontSize: 14, color: Colors.textTertiary, marginRight: Spacing.sm },
  searchInput: { flex: 1, fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },
  sidebarItemActive: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, padding: Spacing.sm, marginHorizontal: Spacing.sm, borderRadius: 6, marginBottom: 2 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, marginHorizontal: Spacing.sm, borderRadius: 6, marginBottom: 2 },
  orgAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
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
  headerAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  headerAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold' },
  mainHeaderTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  mainHeaderSubtitle: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, maxWidth: 800, alignSelf: 'center', width: '100%' },
  tableHeader: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surfaceHover, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, marginBottom: 2 },
  tableHeaderText: { fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  userAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  userAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold' },
  tableCellTextBold: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text },
  tableCellSubtitle: { fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textSecondary },
  tableCellText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary },
  meBadge: { color: Colors.textTertiary, fontWeight: 'normal' },
  roleChip: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.primary, fontWeight: 'bold' },
  roleDropdown: { position: 'absolute', top: 24, left: 0, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, zIndex: 999, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8, minWidth: 120 },
  roleDropdownItem: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  roleDropdownText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },
  removeBtn: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.error },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyStateText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textTertiary },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: 480, backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  closeIcon: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: 'bold' },
  modalBody: { padding: Spacing.xl },
  modalLabel: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  modalInput: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.primary, borderRadius: 6, padding: Spacing.sm, fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },
  roleSelector: { flexDirection: 'row', gap: Spacing.sm },
  roleOption: { flex: 1, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, alignItems: 'center' },
  roleOptionActive: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
  roleOptionText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary },
  roleOptionTextActive: { color: Colors.primary, fontWeight: 'bold' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background, gap: Spacing.sm },
  btnPrimary: { backgroundColor: Colors.primary, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: 6 },
  btnPrimaryText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: '#FFF', fontWeight: FontWeight.bold },
  btnSecondary: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  btnSecondaryText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },
});
