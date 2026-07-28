import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';
import { useTeams } from '../../../hooks/useTeams';

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';

const CATEGORIES = [
  'Alle',
  'KI',
  'Automatisierung',
  'Cloud-Speicher',
  'Kommunikation',
  'Kontakte',
  'CRM',
  'Entwickler',
  'E-Commerce',
  'Grammatik & Rechtschreibung',
  'Interne Tools',
  'MCP',
  'Meetings',
  'No-Code',
  'Zahlungen',
  'Produktivität',
  'Projektmanagement',
  'Soziales & Spaß',
  'Video',
  'Sprache'
];

const INTEGRATIONS = [
  { name: 'Aircall', color: '#00B388' },
  { name: 'Asana', color: '#F06A6A' },
  { name: 'Attio MCP', color: '#000000' },
  { name: 'ChargeDesk', color: '#3A8EE6' },
  { name: 'Claude', color: '#D97757' },
  { name: 'ClickUp', color: '#7B68EE' },
  { name: 'ClickUp MCP', color: '#7B68EE' },
  { name: 'Close', color: '#36B37E' },
  { name: '{ } Custom', color: '#555555' },
  { name: 'Custom MCP', color: '#555555' },
  { name: 'Daylite', color: '#FF9900' },
  { name: 'Dialpad', color: '#A020F0' },
  { name: 'Dropbox', color: '#0061FF' },
  { name: 'FullContact Enrich', color: '#1B95E0' },
  { name: 'Gemini', color: '#1A73E8' },
  { name: 'Giphy', color: '#000000' },
  { name: 'GitHub', color: '#24292E' },
  { name: 'Google Drive', color: '#1DA462' },
  { name: 'HubSpot', color: '#FF7A59' },
  { name: 'Integrately', color: '#FF9900' },
  { name: 'Linear MCP', color: '#5E6AD2' },
  { name: 'Make', color: '#A020F0' },
  { name: 'Notion MCP', color: '#000000' },
  { name: 'OpenAI', color: '#10A37F' },
  { name: 'Pipedrive', color: '#262626' },
  { name: 'Relay', color: '#0066FF' },
  { name: 'Retool', color: '#3D5AFE' },
  { name: 'Salesforce', color: '#00A1E0' },
  { name: 'Shopify', color: '#96BF48' },
  { name: 'Stripe MCP', color: '#635BFF' },
  { name: 'Synology', color: '#4B92C2' },
  { name: 'Todoist', color: '#E44332' },
  { name: 'Todoist MCP', color: '#E44332' },
  { name: 'Trello', color: '#0052CC' },
  { name: 'Video Chat', color: '#2D8CFF' },
  { name: 'Zapier', color: '#FF4A00' },
  { name: 'Zoom', color: '#2D8CFF' }
];

export default function IntegrationsSettingsScreen() {
  const { teams } = useTeams();
  const [modalVisible, setModalVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Alle');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIntegrations, setActiveIntegrations] = useState<any[]>([]);
  const [shopStatus, setShopStatus] = useState<{ configured: boolean; shops: { shop_domain: string; created_at: string }[] } | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [connectShopDomain, setConnectShopDomain] = useState('');
  const [showConnectInput, setShowConnectInput] = useState(false);

  const teamId = selectedTeamId || teams[0]?.id || null;

  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(`${API_URL}/api/shopify/status?team_id=${teamId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        setShopStatus(json);
        if (json.shops?.length > 0) {
          const shops: any[] = json.shops.map((s: any) => ({
            name: 'Shopify',
            color: '#96BF48',
            status: 'Verbunden',
            shopDomain: s.shop_domain,
            connectedAt: s.created_at,
          }));
          setActiveIntegrations(prev => {
            const withoutShopify = prev.filter(i => i.name !== 'Shopify');
            return [...withoutShopify, ...shops];
          });
        } else if (json.configured) {
          setActiveIntegrations(prev => {
            const withoutShopify = prev.filter(i => i.name !== 'Shopify');
            return [...withoutShopify, { name: 'Shopify', color: '#96BF48', status: 'Bereit', configured: true }];
          });
        }
      } catch { /* ignore */ }
    })();
  }, [teamId]);

  const handleToggleIntegration = useCallback(async (item: any) => {
    const exists = activeIntegrations.find(i => i.name === item.name);
    if (exists) {
      if (item.name === 'Shopify') {
        if (exists.shopDomain) {
          Alert.alert(
            'Shop trennen',
            `Möchtest du ${exists.shopDomain} trennen?`,
            [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text: 'Trennen', style: 'destructive', onPress: async () => {
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session || !teamId) return;
                    await fetch(`${API_URL}/api/shopify/disconnect`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                      body: JSON.stringify({ teamId, shopDomain: exists.shopDomain }),
                    });
                    setActiveIntegrations(prev => prev.filter(i => i !== exists));
                  } catch { /* ignore */ }
                }
              },
            ]
          );
          return;
        }
        setActiveIntegrations(prev => prev.filter(i => i.name !== 'Shopify'));
        return;
      }
      setActiveIntegrations(prev => prev.filter(i => i.name !== item.name));
    } else {
      if (item.name === 'Shopify') {
        if (!teamId) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        if (!shopStatus?.configured) {
          Alert.alert(
            'Shopify nicht konfiguriert',
            'Ein Team-Admin muss zuerst die Shopify API-Schlüssel in den Team-Einstellungen hinterlegen.'
          );
          return;
        }
        setShowConnectInput(true);
        return;
      }
      setActiveIntegrations([...activeIntegrations, { ...item, status: 'Verbunden' }]);
      setModalVisible(false);
    }
  }, [activeIntegrations, shopStatus, teamId]);

  const handleConnectShop = useCallback(async () => {
    if (!connectShopDomain.trim() || !teamId) return;
    const shop = connectShopDomain.trim().includes('.myshopify.com')
      ? connectShopDomain.trim()
      : `${connectShopDomain.trim()}.myshopify.com`;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const authUrl = `${API_URL}/api/shopify/auth?shop=${encodeURIComponent(shop)}&team_id=${teamId}&token=${encodeURIComponent(session.access_token)}`;
      window.open(authUrl, '_blank', 'width=800,height=700');
    } catch { /* ignore */ }
    setShowConnectInput(false);
    setConnectShopDomain('');
  }, [connectShopDomain, teamId]);

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
          <ScrollView style={styles.modalSidebar}>
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
            {INTEGRATIONS.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase())).map(item => {
              const isConnected = activeIntegrations.some(i => i.name === item.name);
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

  return (
    <View style={[styles.container, activeIntegrations.length > 0 && { justifyContent: 'flex-start', alignItems: 'stretch' }]}>
      {modalVisible && renderModal()}

      {activeIntegrations.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <Text style={styles.emptyIconText}>📁</Text>
          </View>
          <Text style={styles.emptyTitle}>Du hast keine Integrationen</Text>
          <Text style={styles.emptySubtitle}>Verbinde deine Lieblingstools</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.addButtonText}>Integration hinzufügen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.activeListScroll} contentContainerStyle={styles.activeListContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl }}>
            <Text style={{ fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text }}>Aktive Integrationen</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
              <Text style={styles.addButtonText}>Integration hinzufügen</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {activeIntegrations.map((item, index) => (
              <View key={item.name + (item.shopDomain || '')} style={[styles.activeIntegrationItem, index > 0 && styles.activeIntegrationItemBorder]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[styles.integrationIcon, { backgroundColor: item.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.integrationName}>{item.name}</Text>
                    <Text style={{ fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textSecondary }}>
                      {item.shopDomain || item.status}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleToggleIntegration(item)}>
                  <Text style={{ color: Colors.error, fontFamily: FontFamily, fontSize: FontSize.sm }}>
                    {item.shopDomain ? 'Trennen' : 'Entfernen'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {showConnectInput && (
        <View style={styles.modalOverlay}>
          <View style={styles.connectModal}>
            <Text style={{ fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.md }}>
              Shopify-Shop verbinden
            </Text>
            <Text style={{ fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md }}>
              Gib deine Shop-Domain ein (z. B. mystore.myshopify.com)
            </Text>
            <TextInput
              style={styles.domainInput}
              placeholder="mystore.myshopify.com"
              placeholderTextColor={Colors.textTertiary}
              value={connectShopDomain}
              onChangeText={setConnectShopDomain}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md }}>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
                onPress={() => { setShowConnectInput(false); setConnectShopDomain(''); }}
              >
                <Text style={[styles.addButtonText, { color: Colors.text }]}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addButton} onPress={handleConnectShop}>
                <Text style={styles.addButtonText}>Verbinden</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
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
    alignItems: 'center',
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
  modalSidebar: {
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
  connectModal: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.xl,
    width: 440,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  domainInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
});
