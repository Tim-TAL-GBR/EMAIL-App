import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
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

export default function GuestsSettingsScreen() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrganizations();
  }, []);

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

  const selectedOrg = organizations.find(o => o.id === selectedOrgId);
  const isOwner = selectedOrg && selectedOrg.myRole === 'owner';

  return (
    <View style={styles.container}>
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
            {loading ? (
              <ActivityIndicator style={{ marginTop: Spacing.xl }} />
            ) : organizations.length === 0 ? (
              <Text style={{ textAlign: 'center', marginTop: Spacing.xl, color: Colors.textTertiary }}>Keine Organisationen</Text>
            ) : (
              organizations.map(org => (
                <TouchableOpacity 
                  key={org.id} 
                  style={selectedOrgId === org.id ? styles.sidebarItemActive : styles.sidebarItem}
                  onPress={() => setSelectedOrgId(org.id)}
                >
                  <View style={[styles.orgAvatar, { backgroundColor: getAvatarColor(org.id) }]}>
                    <Text style={styles.orgAvatarText}>{org.name.substring(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={selectedOrgId === org.id ? styles.sidebarItemTitleActive : styles.sidebarItemTitle} numberOfLines={1}>{org.name}</Text>
                    <Text style={selectedOrgId === org.id ? styles.sidebarItemSubtitleActive : styles.sidebarItemSubtitle}>
                      {org.myRole === 'owner' ? 'Inhaber' : 'Mitglied'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {selectedOrg ? (
          <>
            <View style={styles.mainHeader}>
              <View style={styles.headerTitleRow}>
                <View style={[styles.headerAvatar, { backgroundColor: getAvatarColor(selectedOrg.id) }]}>
                  <Text style={styles.headerAvatarText}>{selectedOrg.name.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.mainHeaderTitle}>{selectedOrg.name}</Text>
                  <Text style={styles.mainHeaderSubtitle}>Gäste</Text>
                </View>
              </View>
            </View>
            
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
              <View style={styles.infoBox}>
                <Text style={styles.infoIconBox}>❔</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoText}>
                    Gäste sind externe Benutzer, die auf bestimmte geteilte Unterhaltungen zugreifen und daran teilnehmen können, ohne vollständige Mitglieder deiner Organisation zu sein.
                  </Text>
                  <TouchableOpacity>
                    <Text style={styles.infoLink}>Mehr über Gäste erfahren →</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {!isOwner ? (
                <View style={{ alignItems: 'center', marginTop: Spacing.xl }}>
                  <Text style={{ fontFamily: FontFamily, fontSize: FontSize.md, color: Colors.textSecondary }}>Nur der Inhaber kann Gäste verwalten.</Text>
                </View>
              ) : (
                <>
                  <View style={styles.tableHeader}>
                    <Text style={styles.sectionTitle}>Aktive Gäste (0)</Text>
                    <TouchableOpacity style={styles.inviteBtn}>
                      <Text style={styles.inviteBtnText}>+ Gast einladen</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.table}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderText, { flex: 2 }]}>Benutzer</Text>
                      <Text style={[styles.tableHeaderText, { flex: 1 }]}>Zugriff auf</Text>
                      <Text style={[styles.tableHeaderText, { width: 100 }]}></Text>
                    </View>
                    
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateIcon}>👥</Text>
                      <Text style={styles.emptyStateTitle}>Keine Gäste vorhanden</Text>
                      <Text style={styles.emptyStateText}>
                        Lade Kunden, Partner oder Freelancer ein, um mit ihnen in bestimmten Unterhaltungen zusammenzuarbeiten.
                      </Text>
                      <TouchableOpacity style={[styles.inviteBtn, { marginTop: Spacing.lg }]}>
                        <Text style={styles.inviteBtnText}>Ersten Gast einladen</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          </>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {loading ? <ActivityIndicator /> : <Text style={{ color: Colors.textSecondary }}>Keine Organisation ausgewählt</Text>}
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
  searchWrapper: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, margin: Spacing.md, backgroundColor: Colors.background, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  searchIcon: { fontSize: 14, color: Colors.textTertiary, marginRight: Spacing.sm },
  searchInput: { flex: 1, fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },
  sidebarItemActive: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, padding: Spacing.sm, marginHorizontal: Spacing.sm, borderRadius: 6, marginBottom: 2 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, marginHorizontal: Spacing.sm, borderRadius: 6, marginBottom: 2 },
  sidebarItemTitle: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text },
  sidebarItemSubtitle: { fontFamily: FontFamily, fontSize: 11, color: Colors.textSecondary },
  orgAvatar: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  orgAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.xs, fontWeight: 'bold' },
  sidebarItemTitleActive: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: '#FFF' },
  sidebarItemSubtitleActive: { fontFamily: FontFamily, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  main: { flex: 1 },
  mainHeader: { padding: Spacing.xl, paddingBottom: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  headerAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold' },
  mainHeaderTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  mainHeaderSubtitle: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, maxWidth: 800, alignSelf: 'center', width: '100%' },
  infoBox: { flexDirection: 'row', backgroundColor: Colors.surfaceHover, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: Spacing.lg, marginBottom: Spacing.xl, alignItems: 'flex-start' },
  infoIconBox: { fontSize: 20, marginRight: Spacing.md, marginTop: 2 },
  infoText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  infoLink: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.primary, fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontFamily: FontFamily, fontSize: FontSize.md, fontWeight: 'bold', color: Colors.text },
  inviteBtn: { backgroundColor: Colors.primary, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 6 },
  inviteBtnText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold' },
  table: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, overflow: 'hidden' },
  tableHeaderRow: { flexDirection: 'row', padding: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tableHeaderText: { fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: 'bold' },
  emptyState: { padding: Spacing.xxl, alignItems: 'center', justifyContent: 'center' },
  emptyStateIcon: { fontSize: 40, marginBottom: Spacing.md },
  emptyStateTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  emptyStateText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', maxWidth: 400, lineHeight: 20 },
});
