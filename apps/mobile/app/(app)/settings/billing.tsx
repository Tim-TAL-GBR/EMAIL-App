import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
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

export default function BillingSettingsScreen() {
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
                  <Text style={styles.mainHeaderSubtitle}>Abrechnung</Text>
                </View>
              </View>
            </View>
        
            <ScrollView style={{ flex: 1 }}>
              <View style={styles.contentContainer}>
                {!isOwner ? (
                  <View style={styles.messageContainer}>
                    <Text style={styles.messageTitle}>Du bist nicht der Inhaber</Text>
                    <Text style={styles.messageText}>
                      Du kannst den Plan nicht ändern, Abrechnungsdetails aktualisieren oder Rechnungen herunterladen.
                    </Text>
                    <Text style={styles.messageText}>
                      Nur der Inhaber der Organisation kann das.
                    </Text>
                  </View>
                ) : (
                  <View style={{ width: '100%', maxWidth: 700, alignSelf: 'center', marginTop: Spacing.xl }}>
                    <Text style={{ fontFamily: FontFamily, fontSize: FontSize.md, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.lg }}>
                      Aktueller Plan
                    </Text>
                    <View style={styles.planCard}>
                      <View style={styles.planHeader}>
                        <View>
                          <Text style={styles.planName}>Starter</Text>
                          <Text style={styles.planPrice}>Kostenlos</Text>
                        </View>
                        <TouchableOpacity style={styles.upgradeBtn}>
                          <Text style={styles.upgradeBtnText}>Upgrade</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <Text style={{ fontFamily: FontFamily, fontSize: FontSize.md, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.lg, marginTop: Spacing.xl }}>
                      Rechnungen
                    </Text>
                    <View style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: Spacing.xl }}>
                      <Text style={{ textAlign: 'center', color: Colors.textTertiary }}>Keine Rechnungen vorhanden</Text>
                    </View>
                  </View>
                )}
              </View>
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
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
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
  orgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F06A6A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  orgAvatarText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
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
  main: {
    flex: 1,
  },
  mainHeader: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
  contentContainer: {
    flex: 1,
    padding: Spacing.xl,
  },
  messageContainer: {
    alignItems: 'center',
    maxWidth: 600,
    alignSelf: 'center',
    marginTop: 100,
  },
  messageTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    color: Colors.text,
    marginBottom: Spacing.md,
    fontWeight: 'bold',
  },
  messageText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  planCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.xl,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planName: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  planPrice: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  upgradeBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 6,
  },
  upgradeBtnText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
  },
});
