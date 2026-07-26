import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';

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

export default function SignaturesSettingsScreen() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Data for selected org
  const [members, setMembers] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [signatureContent, setSignatureContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (selectedItem) {
      loadTeamData(selectedItem);
    }
  }, [selectedItem]);

  const loadOrganizations = async () => {
    try {
      const data = await apiRequest('/api/teams');
      setOrganizations(data);
      if (data.length > 0) {
        setSelectedItem(data[0].id);
      }
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamData = async (teamId: string) => {
    setLoadingMembers(true);
    try {
      const [membersData, signaturesData] = await Promise.all([
        apiRequest(`/api/teams/${teamId}/members`),
        apiRequest(`/api/signatures?team_id=${teamId}`)
      ]);
      setMembers(membersData);
      setSignatures(signaturesData);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoadingMembers(false);
    }
  };

  const selectedOrg = organizations.find(o => o.id === selectedItem);
  const isOwnerOrAdmin = selectedOrg && ['owner', 'admin'].includes(selectedOrg.myRole);

  const openEditor = (user: any) => {
    const existingSig = signatures.find(s => s.owner_id === user.id);
    setEditingUser(user);
    setSignatureContent(existingSig ? existingSig.content_text : '');
    setShowModal(true);
  };

  const saveSignature = async () => {
    if (!editingUser || !selectedOrg) return;
    setSaving(true);
    try {
      await apiRequest('/api/signatures', 'POST', {
        team_id: selectedOrg.id,
        owner_id: editingUser.id,
        content_text: signatureContent
      });
      // reload signatures
      const newSignatures = await apiRequest(`/api/signatures?team_id=${selectedOrg.id}`);
      setSignatures(newSignatures);
      setShowModal(false);
    } catch (e: any) {
      Alert.alert('Fehler beim Speichern', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Signature Editor Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Signatur bearbeiten</Text>
              <Text style={styles.modalSubtitle}>für {editingUser?.display_name || editingUser?.email}</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={{ fontFamily: FontFamily, color: Colors.textSecondary, marginBottom: Spacing.sm }}>
                HTML Inhalt der Signatur:
              </Text>
              <TextInput
                style={styles.htmlInput}
                multiline
                value={signatureContent}
                onChangeText={setSignatureContent}
                placeholder="<p>Mit freundlichen Grüßen...</p>"
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowModal(false)} disabled={saving}>
                <Text style={styles.btnSecondaryText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={saveSignature} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnPrimaryText}>Speichern</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarHeaderTitle}>SIGNATUREN</Text>
        </View>
        
        <ScrollView style={styles.sidebarContent}>
          <Text style={styles.sectionHeader}>Organisationen</Text>
          {loading ? (
            <ActivityIndicator style={{ margin: Spacing.md }} />
          ) : organizations.length === 0 ? (
            <Text style={{ textAlign: 'center', color: Colors.textTertiary, padding: Spacing.md }}>Keine Organisationen</Text>
          ) : (
            organizations.map(org => (
              <TouchableOpacity 
                key={org.id}
                style={[styles.sidebarItem, selectedItem === org.id && styles.sidebarItemActive]}
                onPress={() => setSelectedItem(org.id)}
              >
                <View style={[styles.orgAvatar, { backgroundColor: getAvatarColor(org.id) }]}>
                  <Text style={styles.orgAvatarText}>{org.name.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sidebarItemTitle, selectedItem === org.id && styles.sidebarItemTitleActive]} numberOfLines={1}>{org.name}</Text>
                  <Text style={[styles.sidebarItemSubtitle, selectedItem === org.id && styles.sidebarItemSubtitleActive]}>
                    Organisations-Signaturen
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <View style={styles.mainHeader}>
          <View style={styles.headerTitleRow}>
            {selectedOrg ? (
              <>
                <View style={[styles.headerAvatar, { backgroundColor: getAvatarColor(selectedOrg.id) }]}>
                  <Text style={styles.headerAvatarText}>{selectedOrg.name.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.mainHeaderTitle}>{selectedOrg.name}</Text>
                  <Text style={styles.mainHeaderSubtitle}>Signaturen der Organisationsmitglieder</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {!selectedItem ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>Keine Organisation ausgewählt</Text>
              <Text style={styles.emptyStateText}>
                Bitte wähle links eine Organisation aus, um die Signaturen zu verwalten.
              </Text>
            </View>
          ) : loadingMembers ? (
            <ActivityIndicator style={{ marginTop: 40 }} />
          ) : !isOwnerOrAdmin ? (
             <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>Fehlende Berechtigung</Text>
              <Text style={styles.emptyStateText}>
                Nur Administratoren der Organisation können die Signaturen der Mitglieder bearbeiten.
              </Text>
            </View>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Mitglied</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Status</Text>
                <Text style={[styles.tableHeaderText, { width: 120 }]}></Text>
              </View>

              {members.map(member => {
                const hasSignature = signatures.some(s => s.owner_id === member.id);
                return (
                  <View key={member.id} style={styles.tableRow}>
                    <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                       <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(member.id) }]}>
                        <Text style={styles.memberAvatarText}>{member.email.substring(0, 2).toUpperCase()}</Text>
                      </View>
                      <View>
                        <Text style={styles.memberName}>{member.display_name || 'Kein Name'}</Text>
                        <Text style={styles.memberEmail}>{member.email}</Text>
                      </View>
                    </View>
                    
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      {hasSignature ? (
                        <View style={styles.badgeSuccess}>
                          <Text style={styles.badgeSuccessText}>Eingerichtet</Text>
                        </View>
                      ) : (
                        <View style={styles.badgeWarning}>
                          <Text style={styles.badgeWarningText}>Fehlt</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={{ width: 120, alignItems: 'flex-end', justifyContent: 'center' }}>
                      <TouchableOpacity 
                        style={hasSignature ? styles.editBtn : styles.createBtn} 
                        onPress={() => openEditor(member)}
                      >
                        <Text style={hasSignature ? styles.editBtnText : styles.createBtnText}>
                          {hasSignature ? 'Bearbeiten' : 'Erstellen'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: Colors.background },
  sidebar: { width: 280, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.border, flexDirection: 'column' },
  sidebarHeader: { padding: Spacing.xl, paddingBottom: Spacing.md },
  sidebarHeaderTitle: { fontFamily: FontFamily, fontSize: FontSize.xs, fontWeight: 'bold', color: Colors.textSecondary, letterSpacing: 1 },
  sidebarContent: { flex: 1 },
  sectionHeader: { fontFamily: FontFamily, fontSize: FontSize.xs, fontWeight: 'bold', color: Colors.textTertiary, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm, letterSpacing: 0.5 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, paddingHorizontal: Spacing.md, marginHorizontal: Spacing.sm, borderRadius: 6, marginBottom: 2 },
  sidebarItemActive: { backgroundColor: Colors.primary },
  sidebarItemTitle: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text },
  sidebarItemTitleActive: { color: '#FFF' },
  sidebarItemSubtitle: { fontFamily: FontFamily, fontSize: 11, color: Colors.textSecondary },
  sidebarItemSubtitleActive: { color: 'rgba(255,255,255,0.8)' },
  userAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  userAvatarText: { color: Colors.textSecondary, fontFamily: FontFamily, fontSize: FontSize.xs, fontWeight: 'bold' },
  orgAvatar: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F06A6A', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  orgAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.xs, fontWeight: 'bold' },
  sidebarFooter: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'center' },
  sidebarFooterText: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.primary },
  main: { flex: 1 },
  mainHeader: { padding: Spacing.xl, paddingBottom: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  headerAvatarText: { color: Colors.textSecondary, fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold' },
  mainHeaderTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  mainHeaderSubtitle: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, maxWidth: 900, alignSelf: 'center', width: '100%' },
  emptyState: { padding: Spacing.xxl, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyStateTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  emptyStateText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', maxWidth: 400, lineHeight: 20, marginBottom: Spacing.xl },
  btnPrimary: { backgroundColor: Colors.primary, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: 6 },
  btnPrimaryText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: '#FFF', fontWeight: FontWeight.bold },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: 800, backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalHeader: { padding: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surfaceHover },
  modalTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  modalSubtitle: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  modalBody: { padding: Spacing.xl },
  htmlInput: { 
    borderWidth: 1, 
    borderColor: Colors.border, 
    borderRadius: 8, 
    padding: Spacing.md, 
    fontFamily: 'Courier', 
    fontSize: FontSize.sm, 
    height: 250, 
    backgroundColor: Colors.background 
  },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface, gap: Spacing.sm },
  btnSecondary: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  btnSecondaryText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },

  // Table
  table: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, overflow: 'hidden' },
  tableHeaderRow: { flexDirection: 'row', padding: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tableHeaderText: { fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  memberAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold' },
  memberName: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text },
  memberEmail: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary },
  badgeSuccess: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  badgeSuccessText: { color: '#2E7D32', fontSize: 11, fontWeight: 'bold' },
  badgeWarning: { backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  badgeWarningText: { color: '#E65100', fontSize: 11, fontWeight: 'bold' },
  editBtn: { borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: 6 },
  editBtnText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },
  createBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: 6 },
  createBtnText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: '#FFF', fontWeight: 'bold' },
});
