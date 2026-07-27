import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator, Alert } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';

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
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
    }
    if (!res.ok) throw new Error(json.error || 'Unbekannter Fehler');
    return json;
  } catch (error: any) {
    console.error(`API Request failed for ${path}:`, error.message);
    throw error;
  }
}

export default function OrganizationsSettingsScreen() {
  const [activeTab, setActiveTab] = useState<'Overview' | 'Message sharing'>('Overview');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [keepInInbox, setKeepInInbox] = useState(true);

  const [teams, setTeams] = useState<any[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New team modal state
  const [newTeamName, setNewTeamName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Overview tab state – must be at component level (Rules of Hooks)
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const data = await apiRequest('/api/teams');
      setTeams(data || []);
      if (data && data.length > 0 && !activeTeamId) {
        setActiveTeamId(data[0].id);
      }
    } catch (error: any) {
      console.warn('Error fetching teams:', error.message);
      Alert.alert('Verbindungsfehler', 'Die Organisationen konnten nicht geladen werden. Läuft der Server?');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setIsCreating(true);
    try {
      // Use the backend API so the service role can add the creator as owner
      // (direct Supabase insert would fail: RLS blocks self-insert into team_members)
      const team = await apiRequest('/api/teams', 'POST', {
        name: newTeamName.trim(),
      });
      setTeams([...teams, team]);
      setActiveTeamId(team.id);
      setIsModalVisible(false);
      setNewTeamName('');
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Konnte Organisation nicht erstellen');
    } finally {
      setIsCreating(false);
    }
  };

  const activeTeam = teams.find(t => t.id === activeTeamId);

  // Sync editName when the selected team changes
  useEffect(() => {
    setEditName(activeTeam?.name || '');
  }, [activeTeam?.id]);

  const handleSaveTeam = async () => {
    if (!activeTeam || !editName.trim() || editName.trim() === activeTeam.name) return;
    setIsSaving(true);
    try {
      await apiRequest(`/api/teams/${activeTeam.id}`, 'PATCH', { name: editName.trim() });
      setTeams(teams.map(t => t.id === activeTeam.id ? { ...t, name: editName.trim() } : t));
      Alert.alert('Erfolg', 'Organisation erfolgreich umbenannt');
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Konnte Organisation nicht umbenennen');
    } finally {
      setIsSaving(false);
    }
  };

  const renderOverviewTab = () => (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Organisation Details</Text>
          <Text style={styles.sectionSubtitle}>Einstellungen für {activeTeam?.name || 'die ausgewählte Organisation'}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.settingBlock}>
            <Text style={styles.settingLabel}>Name der Organisation</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm }}>
              <TextInput
                style={[styles.inputSmall, { flex: 1, textAlign: 'left' }]}
                value={editName}
                onChangeText={setEditName}
                editable={!!activeTeam}
              />
              <TouchableOpacity
                style={[
                  styles.modalButtonPrimary,
                  { paddingVertical: 8, paddingHorizontal: 16 },
                  (editName.trim() === (activeTeam?.name || '') || isSaving) && { opacity: 0.5 }
                ]}
                onPress={handleSaveTeam}
                disabled={editName.trim() === (activeTeam?.name || '') || isSaving}
              >
                <Text style={styles.modalButtonPrimaryText}>{isSaving ? '...' : 'Speichern'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.settingDescription}>Administratoren können den Namen der Organisation jederzeit ändern.</Text>
          </View>
        </View>
    </ScrollView>
  );

  const renderMessageSharingTab = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.emptyCard}>
        <Text style={styles.emptyCardText}>Diese Ansicht wird demnächst mit den Postfächern für {activeTeam?.name} verknüpft.</Text>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Modal Overlay */}
      {isModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Organisation erstellen</Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Organisationsname</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="Benenne deine Organisation" 
                placeholderTextColor={Colors.textTertiary}
                value={newTeamName}
                onChangeText={setNewTeamName}
                autoFocus
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButtonPrimary, (!newTeamName.trim() || isCreating) && { opacity: 0.5 }]}
                onPress={handleCreateTeam}
                disabled={!newTeamName.trim() || isCreating}
              >
                <Text style={styles.modalButtonPrimaryText}>{isCreating ? 'Erstelle...' : 'Weiter'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarContent}>
          <View style={styles.searchWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput 
              style={styles.searchInput} 
              placeholder="Organisationen suchen..." 
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          
          <ScrollView>
            {isLoading ? (
              <ActivityIndicator style={{ marginTop: Spacing.xl }} />
            ) : (
              teams.map((team) => (
                <TouchableOpacity 
                  key={team.id}
                  style={activeTeamId === team.id ? styles.sidebarItemActive : styles.sidebarItem}
                  onPress={() => setActiveTeamId(team.id)}
                >
                  <View style={styles.orgAvatar}>
                    <Text style={styles.orgAvatarText}>{team.name.substring(0, 2).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={activeTeamId === team.id ? styles.sidebarItemTitleActive : styles.sidebarItemTitle}>{team.name}</Text>
                    <Text style={activeTeamId === team.id ? styles.sidebarItemSubtitleActive : styles.sidebarItemSubtitle}>Team</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
        <TouchableOpacity style={styles.sidebarFooter} onPress={() => setIsModalVisible(true)}>
          <Text style={styles.sidebarFooterText}>Organisation erstellen</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <View style={styles.mainHeader}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.headerAvatar, { backgroundColor: activeTeam ? '#' + activeTeam.id.replace(/-/g,'').substring(0,6) : '#F06A6A' }]}>
              <Text style={styles.headerAvatarText}>{activeTeam ? activeTeam.name.substring(0, 2).toUpperCase() : '?'}</Text>
            </View>
            <View>
              <Text style={styles.mainHeaderTitle}>{activeTeam?.name || 'Organisation'}</Text>
              <Text style={styles.mainHeaderSubtitle}>Organisationen</Text>
            </View>
          </View>
          
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'Overview' && styles.tabButtonActive]}
              onPress={() => setActiveTab('Overview')}
            >
              <Text style={[styles.tabText, activeTab === 'Overview' && styles.tabTextActive]}>Übersicht</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'Message sharing' && styles.tabButtonActive]}
              onPress={() => setActiveTab('Message sharing')}
            >
              <Text style={[styles.tabText, activeTab === 'Message sharing' && styles.tabTextActive]}>Nachrichtenfreigabe</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {activeTab === 'Overview' ? renderOverviewTab() : renderMessageSharingTab()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  sidebar: {
    width: 260,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    justifyContent: 'space-between',
  },
  sidebarContent: {
    flex: 1,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    margin: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  sidebarItemActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.info,
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
  },
  orgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F06A6A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  orgAvatarText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
  },
  sidebarItemTitleActive: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: '#FFF',
  },
  sidebarItemSubtitleActive: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  sidebarItemTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.text,
  },
  sidebarItemSubtitle: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  sidebarFooter: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  sidebarFooterText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.info,
  },
  main: {
    flex: 1,
  },
  mainHeader: {
    padding: Spacing.xl,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F06A6A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  headerAvatarText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: 'bold',
  },
  mainHeaderTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  mainHeaderSubtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceHover,
    borderRadius: 20,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  tabButtonActive: {
    backgroundColor: Colors.info,
  },
  tabText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  sectionHeader: {
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  sectionSubtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  settingBlock: {
    marginBottom: Spacing.md,
  },
  settingLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  colorPickerBadge: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#F06A6A',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  radioOuterSelected: {
    borderColor: Colors.info,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.info,
  },
  radioLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  timezoneRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  timezoneLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginRight: Spacing.sm,
  },
  timezoneValue: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  scheduleGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scheduleCol: {
    alignItems: 'center',
    flex: 1,
  },
  scheduleCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  checkboxActive: {
    backgroundColor: Colors.border,
  },
  checkmark: {
    color: '#FFF',
    fontSize: 10,
  },
  scheduleDay: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  scheduleTimeLabel: {
    fontFamily: FontFamily,
    fontSize: 10,
    color: Colors.textTertiary,
    marginBottom: 2,
    marginTop: 4,
  },
  scheduleInput: {
    width: 50,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 4,
    padding: 4,
    textAlign: 'center',
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  inactivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inactivityLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginRight: Spacing.sm,
    marginLeft: Spacing.md,
  },
  inputSmall: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 4,
    padding: 6,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'center',
  },
  flexRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  addButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonSecondaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.info,
  },
  table: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceHover,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableHeaderText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tableIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
    color: '#D04040',
  },
  tableCellText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  checkboxEmpty: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F06A6A',
  },
  linkText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  linkTextBlue: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  emptyCardText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.lg,
  },
  infoIconBox: {
    fontSize: FontSize.md,
    marginRight: Spacing.sm,
  },
  infoText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: 500,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  modalSubtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
    marginTop: 2,
    fontWeight: 'bold',
  },
  closeIcon: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: Spacing.xl,
    paddingTop: 0,
  },
  modalLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  modalHint: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginLeft: Spacing.md,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.info,
    borderRadius: 6,
    padding: Spacing.sm,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  logoPickerBox: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#E6E6FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPickerIcon: {
    fontSize: 24,
    color: '#7B68EE',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  modalButtonPrimary: {
    backgroundColor: Colors.info,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: 6,
  },
  modalButtonPrimaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
});
