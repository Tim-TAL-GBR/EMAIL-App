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

const PREDEFINED_COLORS = [
  '#4A90E2', '#7B68EE', '#F06A6A', '#F5A623', '#00B388', 
  '#9B51E0', '#E53935', '#FB8C00', '#43A047', '#00ACC1'
];

export default function LabelsSettingsScreen() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<'you' | string>('you'); // 'you' or org_id
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const data = await apiRequest('/api/teams');
      setOrganizations(data);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedOrg = organizations.find(o => o.id === selectedItem);

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarHeaderTitle}>LABELS</Text>
        </View>
        
        <ScrollView style={styles.sidebarContent}>
          <Text style={styles.sectionHeader}>Persönlich</Text>
          <TouchableOpacity 
            style={[styles.sidebarItem, selectedItem === 'you' && styles.sidebarItemActive]}
            onPress={() => setSelectedItem('you')}
          >
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>DU</Text>
            </View>
            <View>
              <Text style={[styles.sidebarItemTitle, selectedItem === 'you' && styles.sidebarItemTitleActive]}>Du</Text>
              <Text style={[styles.sidebarItemSubtitle, selectedItem === 'you' && styles.sidebarItemSubtitleActive]}>Persönliche Labels</Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>Organisationen</Text>
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
                    Organisations-Labels
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
        <TouchableOpacity style={styles.sidebarFooter}>
          <Text style={styles.sidebarFooterText}>Label erstellen</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <View style={styles.mainHeader}>
          <View style={styles.headerTitleRow}>
            {selectedItem === 'you' ? (
              <>
                <View style={styles.headerAvatar}>
                  <Text style={styles.headerAvatarText}>DU</Text>
                </View>
                <View>
                  <Text style={styles.mainHeaderTitle}>Persönliche Labels</Text>
                  <Text style={styles.mainHeaderSubtitle}>Labels, die nur du siehst</Text>
                </View>
              </>
            ) : selectedOrg ? (
              <>
                <View style={[styles.headerAvatar, { backgroundColor: getAvatarColor(selectedOrg.id) }]}>
                  <Text style={styles.headerAvatarText}>{selectedOrg.name.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.mainHeaderTitle}>{selectedOrg.name}</Text>
                  <Text style={styles.mainHeaderSubtitle}>Organisations-Labels</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Noch keine Labels erstellt</Text>
            <Text style={styles.emptyStateText}>
              Erstelle Labels, um deine Konversationen besser zu organisieren.
            </Text>
            <TouchableOpacity style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Neues Label erstellen</Text>
            </TouchableOpacity>
          </View>
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
  content: { padding: Spacing.xl, maxWidth: 800, alignSelf: 'center', width: '100%' },
  emptyState: { padding: Spacing.xxl, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyStateTitle: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  emptyStateText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', maxWidth: 400, lineHeight: 20, marginBottom: Spacing.xl },
  btnPrimary: { backgroundColor: Colors.primary, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: 6 },
  btnPrimaryText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: '#FFF', fontWeight: FontWeight.bold },
});
