import { API_URL } from "@/lib/constants";
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';

async function apiRequest(path: string, method = 'GET') {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Unbekannter Fehler');
  return json;
}

export default function AdminSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<'orgs'|'users'>('orgs');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [orgsData, usersData] = await Promise.all([
        apiRequest('/api/admin/organizations'),
        apiRequest('/api/admin/users')
      ]);
      setOrganizations(orgsData);
      setUsers(usersData);
    } catch (e: any) {
      Alert.alert('Fehler', 'Keine Super-Admin Berechtigung oder Fehler beim Laden: ' + e.message);
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.title}>Super Admin Dashboard</Text>
      </View>
      
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'orgs' && styles.tabActive]} onPress={() => setActiveTab('orgs')}>
          <Text style={[styles.tabText, activeTab === 'orgs' && styles.tabTextActive]}>Organisationen ({organizations.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'users' && styles.tabActive]} onPress={() => setActiveTab('users')}>
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Benutzer ({users.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'orgs' && (
          <View style={styles.list}>
            {organizations.map(org => (
              <View key={org.id} style={styles.card}>
                <Text style={styles.cardTitle}>{org.name}</Text>
                <Text style={styles.cardSub}>ID: {org.id}</Text>
                <Text style={styles.cardSub}>Erstellt: {new Date(org.created_at).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'users' && (
          <View style={styles.list}>
            {users.map(u => (
              <View key={u.id} style={styles.card}>
                <Text style={styles.cardTitle}>{u.display_name || 'Kein Name'} {u.is_super_admin ? '🌟 (Super Admin)' : ''}</Text>
                <Text style={styles.cardSub}>{u.email}</Text>
                <Text style={styles.cardSub}>ID: {u.id}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { padding: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, fontFamily: FontFamily },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  tab: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontFamily: FontFamily, fontWeight: FontWeight.semibold },
  tabTextActive: { color: Colors.primary },
  content: { flex: 1, padding: Spacing.xl },
  list: { gap: Spacing.md },
  card: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, fontFamily: FontFamily, marginBottom: Spacing.xs },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, fontFamily: FontFamily }
});
