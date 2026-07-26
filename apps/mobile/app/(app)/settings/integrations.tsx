import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, ActivityIndicator, Alert } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { Button } from '../../../components/ui/Button';
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

const CATEGORIES = [
  'Alle', 'KI', 'Automatisierung', 'Cloud-Speicher', 'Kommunikation', 'Kontakte',
  'CRM', 'Entwickler', 'E-Commerce', 'Produktivität', 'Projektmanagement', 'Zahlungen'
];

const INTEGRATIONS = [
  { name: 'Shopify', color: '#96BF48', category: 'E-Commerce' },
  { name: 'Stripe MCP', color: '#635BFF', category: 'Zahlungen' },
  { name: 'Notion MCP', color: '#000000', category: 'Produktivität' },
  { name: 'Slack', color: '#4A154B', category: 'Kommunikation' },
  { name: 'GitHub', color: '#24292E', category: 'Entwickler' },
];

export default function IntegrationsSettingsScreen() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Alle');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Maps team_id to an array of connected integration objects
  const [activeIntegrations, setActiveIntegrations] = useState<Record<string, any[]>>({});
  const [shopifyConnectVisible, setShopifyConnectVisible] = useState(false);
  const [shopifyDomain, setShopifyDomain] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const data = await apiRequest('/api/teams');
      setOrganizations(data);
      if (data && data.length > 0) {
        setActiveTeamId(data[0].id);
        
        // Mock loading active integrations per team
        // In a real app we would fetch the connections from the DB per team
        const initialMap: any = {};
        for (const t of data) {
          initialMap[t.id] = [];
        }
        setActiveIntegrations(initialMap);
      }
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Check URL params for success (on web)
  useEffect(() => {
    if (Platform.OS === 'web' && window.location.search.includes('shopify_success=true')) {
      const params = new URLSearchParams(window.location.search);
      const teamIdFromUrl = params.get('team_id'); // We'd need backend to return team_id but we assume activeTeamId for now
      
      if (activeTeamId) {
         setActiveIntegrations(prev => {
            const teamIntegrations = prev[activeTeamId] || [];
            return {
              ...prev,
              [activeTeamId]: [...teamIntegrations.filter(i => i.name !== 'Shopify'), { name: 'Shopify', color: '#96BF48', status: 'Verbunden' }]
            };
         });
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [activeTeamId]);

  const currentIntegrations = activeTeamId ? (activeIntegrations[activeTeamId] || []) : [];

  const handleToggleIntegration = (item: any) => {
    if (!activeTeamId) return;

    if (item.name === 'Shopify') {
      const exists = currentIntegrations.find(i => i.name === 'Shopify');
      if (exists) {
        // Disconnect locally
        setActiveIntegrations(prev => ({
          ...prev,
          [activeTeamId]: prev[activeTeamId].filter(i => i.name !== 'Shopify')
        }));
      } else {
        setModalVisible(false);
        setShopifyConnectVisible(true);
      }
      return;
    }

    const exists = currentIntegrations.find(i => i.name === item.name);
    if (exists) {
      setActiveIntegrations(prev => ({
        ...prev,
        [activeTeamId]: prev[activeTeamId].filter(i => i.name !== item.name)
      }));
    } else {
      setActiveIntegrations(prev => ({
        ...prev,
        [activeTeamId]: [...prev[activeTeamId], { ...item, status: 'Verbunden' }]
      }));
      setModalVisible(false);
    }
  };

  const handleConnectShopify = () => {
    if (!shopifyDomain.trim() || !activeTeamId) return;
    
    const backendUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
    
    if (Platform.OS === 'web') {
      window.location.href = `${backendUrl}/api/shopify/auth?shop=${shopifyDomain.trim()}&team_id=${activeTeamId}`;
    } else {
      Alert.alert("Info", "OAuth via Mobile noch nicht konfiguriert");
    }
  };

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <Text style={styles.sidebarHeaderTitle}>INTEGRATIONEN</Text>
      </View>
      <ScrollView style={styles.sidebarContent}>
        <Text style={[styles.sectionHeader, { marginTop: Spacing.md }]}>Organisationen</Text>
        {loading ? (
          <ActivityIndicator style={{ margin: Spacing.md }} />
        ) : organizations.length === 0 ? (
          <Text style={{ textAlign: 'center', color: Colors.textTertiary, padding: Spacing.md }}>Keine Organisationen</Text>
        ) : (
          organizations.map(org => (
            <TouchableOpacity 
              key={org.id}
              style={[styles.sidebarItem, activeTeamId === org.id && styles.sidebarItemActive]}
              onPress={() => setActiveTeamId(org.id)}
            >
              <View style={[styles.orgAvatar, { backgroundColor: '#' + org.id.substring(0, 6).replace(/[^0-9A-Fa-f]/g, 'C') }]}>
                <Text style={styles.orgAvatarText}>{org.name.substring(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sidebarItemTitle, activeTeamId === org.id && styles.sidebarItemTitleActive]} numberOfLines={1}>{org.name}</Text>
                <Text style={[styles.sidebarItemSubtitle, activeTeamId === org.id && styles.sidebarItemSubtitleActive]}>
                  Verbundene Apps
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );

  const renderModal = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderLeft}>
            <Text style={styles.modalHeaderTitle}>Integrationen</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput 
              style={styles.searchInput} 
              placeholder="Integrationen suchen..." 
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={styles.modalBody}>
          <ScrollView style={styles.modalSidebarList}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity 
                key={cat} 
                style={[styles.categoryItem, activeCategory === cat && styles.categoryItemActive]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={styles.modalContent}>
            {INTEGRATIONS.filter(item => 
              (activeCategory === 'Alle' || item.category === activeCategory) && 
              item.name.toLowerCase().includes(searchQuery.toLowerCase())
            ).map(item => {
              const isConnected = currentIntegrations.some((i: any) => i.name === item.name);
              return (
                <TouchableOpacity 
                  key={item.name} 
                  style={[styles.integrationItem, isConnected && { backgroundColor: Colors.surfaceHover }]}
                  onPress={() => handleToggleIntegration(item)}
                >
                  <View style={[styles.integrationIcon, { backgroundColor: item.color }]} />
                  <Text style={styles.integrationName}>{item.name}</Text>
                  {isConnected && (
                    <Text style={{ marginLeft: 'auto', color: Colors.info, fontFamily: FontFamily, fontSize: FontSize.sm }}>
                      Verbunden
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </View>
  );

  const renderShopifyModal = () => (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContainer, { width: 400, minHeight: 'auto', padding: Spacing.xl }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
          <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text }}>Shopify verbinden</Text>
          <TouchableOpacity onPress={() => setShopifyConnectVisible(false)}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: Colors.textSecondary, marginBottom: Spacing.md }}>
          Gib die URL deines Shopify-Shops ein (z.B. mein-shop.myshopify.com), um die Verbindung für "{organizations.find(o => o.id === activeTeamId)?.name}" herzustellen.
        </Text>
        <TextInput
          style={[styles.searchInput, { marginBottom: Spacing.lg, height: 40, borderBottomWidth: 1, borderColor: Colors.border }]}
          placeholder="dein-shop.myshopify.com"
          placeholderTextColor={Colors.textTertiary}
          value={shopifyDomain}
          onChangeText={setShopifyDomain}
          autoCapitalize="none"
        />
        <Button title="Verbinden" onPress={handleConnectShopify} disabled={!shopifyDomain.trim()} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderSidebar()}
      
      <View style={styles.mainContent}>
        {modalVisible && renderModal()}
        {shopifyConnectVisible && renderShopifyModal()}
        
        {!activeTeamId ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Wähle eine Organisation</Text>
            <Text style={styles.emptySubtitle}>Bitte wähle links eine Organisation aus, um Integrationen zu verwalten.</Text>
          </View>
        ) : currentIntegrations.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Text style={styles.emptyIconText}>📁</Text>
            </View>
            <Text style={styles.emptyTitle}>Keine Integrationen für {organizations.find(o => o.id === activeTeamId)?.name}</Text>
            <Text style={styles.emptySubtitle}>Verbinde deine Lieblingstools mit dieser Organisation</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
              <Text style={styles.addButtonText}>Integration hinzufügen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.activeListScroll} contentContainerStyle={styles.activeListContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl }}>
              <View>
                <Text style={{ fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text }}>Aktive Integrationen</Text>
                <Text style={{ fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary }}>Für {organizations.find(o => o.id === activeTeamId)?.name}</Text>
              </View>
              <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.addButtonText}>Weitere hinzufügen</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.card}>
              {currentIntegrations.map((item: any, index: number) => (
                <View key={item.name} style={[styles.activeIntegrationItem, index > 0 && styles.activeIntegrationItemBorder]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.integrationIcon, { backgroundColor: item.color }]} />
                    <View>
                      <Text style={styles.integrationName}>{item.name}</Text>
                      <Text style={{ fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textSecondary }}>{item.status}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleToggleIntegration(item)}>
                    <Text style={{ color: Colors.error, fontFamily: FontFamily, fontSize: FontSize.sm }}>Trennen</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
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
    width: 280,
    backgroundColor: Colors.surfaceHover,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    display: Platform.OS === 'web' ? 'flex' : 'none',
  },
  sidebarHeader: {
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  sidebarHeaderTitle: {
    fontFamily: FontFamily,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textTertiary,
    letterSpacing: 1,
  },
  sidebarContent: {
    flex: 1,
  },
  sectionHeader: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    fontWeight: 'bold',
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    textTransform: 'uppercase',
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderLeftColor: Colors.primary,
  },
  orgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  orgAvatarText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: 'bold',
  },
  sidebarItemTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  sidebarItemTitleActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  sidebarItemSubtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  sidebarItemSubtitleActive: {
    color: Colors.primary,
  },
  mainContent: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FFF',
  },
  activeListScroll: {
    flex: 1,
  },
  activeListContent: {
    padding: Spacing.xl,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  activeIntegrationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  activeIntegrationItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    backgroundColor: Colors.surface,
  },
  emptyIconText: {
    fontSize: 24,
  },
  emptyTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  addButton: {
    backgroundColor: Colors.info,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: 8,
  },
  addButtonText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFF',
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
    width: 800,
    height: '80%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderLeft: {
    width: 200,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
  },
  modalHeaderTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  closeIcon: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    backgroundColor: '#FFF',
  },
  searchIcon: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  modalBody: {
    flex: 1,
    flexDirection: 'row',
  },
  modalSidebarList: {
    width: 200,
    backgroundColor: Colors.surfaceHover,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  categoryItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.xs,
    marginTop: Spacing.xs,
    borderRadius: 6,
  },
  categoryItemActive: {
    backgroundColor: Colors.info,
  },
  categoryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  categoryTextActive: {
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: Spacing.md,
  },
  integrationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 6,
  },
  integrationIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: Spacing.md,
  },
  integrationName: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
});
