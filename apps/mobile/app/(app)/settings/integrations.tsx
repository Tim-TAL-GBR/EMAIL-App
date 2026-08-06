import { API_URL } from "@/lib/constants";
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform, Linking } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';
import { useTeams } from '../../../hooks/useTeams';

const INTEGRATIONS = [
  { name: 'Shopify', color: '#96BF48' },
];

export default function IntegrationsSettingsScreen() {
  const { orgs } = useTeams();
  const [modalVisible, setModalVisible] = useState(false);
  const [activeIntegrations, setActiveIntegrations] = useState<any[]>([]);
  const [shopStatus, setShopStatus] = useState<{ configured: boolean; shops: { shop_domain: string; created_at: string }[] } | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [connectShopDomain, setConnectShopDomain] = useState('');
  const [showConnectInput, setShowConnectInput] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Shopify Config
  const [showConfigInput, setShowConfigInput] = useState(false);
  const [shopifyApiKey, setShopifyApiKey] = useState('');
  const [shopifyApiSecret, setShopifyApiSecret] = useState('');
  const [isConfiguringShopify, setIsConfiguringShopify] = useState(false);

  const teamId = selectedTeamId || orgs[0]?.id || null;

  useEffect(() => {
    if (orgs.length > 0 && !selectedTeamId) {
      setSelectedTeamId(orgs[0].id);
    }
  }, [orgs, selectedTeamId]);

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
        } else {
          setActiveIntegrations(prev => prev.filter(i => i.name !== 'Shopify'));
        }
      } catch (e) { console.error('Status fetch failed:', e); }
    })();
  }, [teamId]);

  const handleDisconnect = useCallback(async (shopDomain: string) => {
    const tid = selectedTeamId || orgs[0]?.id || null;
    console.log('[Disconnect] tid:', tid, 'shopDomain:', shopDomain, 'selectedTeamId:', selectedTeamId, 'orgs:', orgs);
    if (!tid) {
      console.error('Disconnect failed: no teamId');
      Alert.alert('Fehler', 'Kein Team ausgewählt.');
      return;
    }
    setDisconnecting(shopDomain);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_URL}/api/shopify/disconnect`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ teamId: tid, shopDomain }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setActiveIntegrations(prev => prev.filter(i => i.shopDomain !== shopDomain));
    } catch (e) {
      console.error('Disconnect failed:', e);
      Alert.alert('Fehler', 'Trennen fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setDisconnecting(null);
    }
  }, [selectedTeamId, orgs]);

  const handleToggleIntegration = useCallback((item: any) => {
    const exists = activeIntegrations.find(i => i.name === item.name);
    if (exists) {
      if (item.name === 'Shopify') {
        if (exists.shopDomain) {
          if (Platform.OS === 'web') {
            const ok = window.confirm(`Möchtest du ${exists.shopDomain} trennen?`);
            if (ok) handleDisconnect(exists.shopDomain);
          } else {
            Alert.alert(
              'Trennen',
              `Möchtest du ${exists.shopDomain} trennen?`,
              [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Trennen', style: 'destructive', onPress: () => handleDisconnect(exists.shopDomain) }
              ]
            );
          }
          return;
        }
        setActiveIntegrations(prev => prev.filter(i => i.name !== 'Shopify'));
        return;
      }
      setActiveIntegrations(prev => prev.filter(i => i.name !== item.name));
    } else {
      if (item.name === 'Shopify') {
        if (!teamId) return;
        (async () => {
          if (!shopStatus?.configured) {
            setShowConfigInput(true);
            return;
          }
          setShowConnectInput(true);
        })();
        return;
      }
      setActiveIntegrations([...activeIntegrations, { ...item, status: 'Verbunden' }]);
      setModalVisible(false);
    }
  }, [activeIntegrations, shopStatus, teamId, handleDisconnect]);

  const handleConnectShop = useCallback(async () => {
    if (!connectShopDomain.trim() || !teamId) return;
    const shop = connectShopDomain.trim().includes('.myshopify.com')
      ? connectShopDomain.trim()
      : `${connectShopDomain.trim()}.myshopify.com`;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const authUrl = `${API_URL}/api/shopify/auth?shop=${encodeURIComponent(shop)}&team_id=${teamId}&token=${encodeURIComponent(session.access_token)}`;
      if (Platform.OS === 'web') {
        window.open(authUrl, '_blank', 'width=800,height=700');
      } else {
        Linking.openURL(authUrl);
      }
    } catch (e) { console.error('Connect failed:', e); }
    setShowConnectInput(false);
    setConnectShopDomain('');
  }, [connectShopDomain, teamId]);

  const handleSaveConfig = async () => {
    if (!teamId || !shopifyApiKey || !shopifyApiSecret) return;
    setIsConfiguringShopify(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_URL}/api/shopify/app-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ teamId, apiKey: shopifyApiKey.trim(), apiSecret: shopifyApiSecret.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setShopStatus(prev => prev ? { ...prev, configured: true } : { configured: true, shops: [] });
      setShowConfigInput(false);
      setShowConnectInput(true); // Automatically show connect input after config
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setIsConfiguringShopify(false);
    }
  };

  const renderModal = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.simpleModalContainer}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
          <Text style={{ fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text }}>Integration hinzufügen</Text>
          <Pressable onPress={() => setModalVisible(false)}>
            <Text style={{ fontSize: FontSize.lg, color: Colors.textSecondary, fontWeight: 'bold' }}>✕</Text>
          </Pressable>
        </View>
        {INTEGRATIONS.map(item => {
          const isConnected = activeIntegrations.some(i => i.name === item.name);
          return (
            <Pressable
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {modalVisible && renderModal()}

      {orgs.length > 0 && (
        <View style={{ padding: Spacing.xl, paddingBottom: 0 }}>
          <Text style={{ fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.textSecondary, marginBottom: Spacing.sm }}>
            Organisation wählen
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {orgs.map(org => (
              <Pressable
                key={org.id}
                style={[
                  { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: 8, marginRight: Spacing.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
                  teamId === org.id && { backgroundColor: Colors.primary, borderColor: Colors.primary }
                ]}
                onPress={() => setSelectedTeamId(org.id)}
              >
                <Text style={[{ fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text }, teamId === org.id && { color: '#FFF', fontWeight: 'bold' }]}>
                  {org.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {activeIntegrations.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <Text style={styles.emptyIconText}>📁</Text>
          </View>
          <Text style={styles.emptyTitle}>Du hast keine Integrationen</Text>
          <Text style={styles.emptySubtitle}>Verbinde deine Lieblingstools</Text>
          <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.addButtonText}>Integration hinzufügen</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.activeListScroll} contentContainerStyle={styles.activeListContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl }}>
            <Text style={{ fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text }}>Aktive Integrationen</Text>
            <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
              <Text style={styles.addButtonText}>Integration hinzufügen</Text>
            </Pressable>
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
                <View
                  // @ts-ignore - web only pointer event
                  onPointerDown={() => {
                    if (disconnecting === item.shopDomain) return;
                    if (Platform.OS === 'web') {
                      const ok = window.confirm(`Möchtest du ${item.shopDomain} trennen?`);
                      if (ok) handleDisconnect(item.shopDomain);
                    } else {
                      Alert.alert(
                        'Trennen',
                        `Möchtest du ${item.shopDomain} trennen?`,
                        [
                          { text: 'Abbrechen', style: 'cancel' },
                          { text: 'Trennen', style: 'destructive', onPress: () => handleDisconnect(item.shopDomain) }
                        ]
                      );
                    }
                  }}
                  style={{ cursor: 'pointer', padding: Spacing.sm, margin: -Spacing.sm, opacity: disconnecting === item.shopDomain ? 0.5 : 1 }}
                >
                  <Text style={{ color: Colors.error, fontFamily: FontFamily, fontSize: FontSize.sm, userSelect: 'none' }}>
                    {disconnecting === item.shopDomain ? 'Wird getrennt...' : 'Trennen'}
                  </Text>
                </View>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md }}>
              <Pressable onPress={() => { setShowConnectInput(false); setShowConfigInput(true); }}>
                <Text style={{ fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.info }}>API-Schlüssel ändern</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <Pressable
                  style={[styles.addButton, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
                  onPress={() => { setShowConnectInput(false); setConnectShopDomain(''); }}
                >
                  <Text style={[styles.addButtonText, { color: Colors.text }]}>Abbrechen</Text>
                </Pressable>
                <Pressable style={styles.addButton} onPress={handleConnectShop}>
                  <Text style={styles.addButtonText}>Verbinden</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}

      {showConfigInput && (
        <View style={styles.modalOverlay}>
          <View style={styles.connectModal}>
            <Text style={{ fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.md }}>
              Shopify API konfigurieren
            </Text>
            <Text style={{ fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md }}>
              Hinterlege hier die Client ID und das Client Secret deiner eigenen Shopify Custom App.
            </Text>
            <Text style={{ fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text, marginBottom: Spacing.xs, fontWeight: 'bold' }}>Client ID (API Key)</Text>
            <TextInput
              style={[styles.domainInput, { marginBottom: Spacing.md }]}
              placeholder="z.B. 7c9a..."
              placeholderTextColor={Colors.textTertiary}
              value={shopifyApiKey}
              onChangeText={setShopifyApiKey}
              autoCapitalize="none"
            />
            <Text style={{ fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text, marginBottom: Spacing.xs, fontWeight: 'bold' }}>Client Secret</Text>
            <TextInput
              style={styles.domainInput}
              placeholder="z.B. shpss_..."
              placeholderTextColor={Colors.textTertiary}
              value={shopifyApiSecret}
              onChangeText={setShopifyApiSecret}
              autoCapitalize="none"
              secureTextEntry
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md }}>
              <Pressable
                style={[styles.addButton, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
                onPress={() => { setShowConfigInput(false); }}
              >
                <Text style={[styles.addButtonText, { color: Colors.text }]}>Abbrechen</Text>
              </Pressable>
              <Pressable 
                style={[styles.addButton, (!shopifyApiKey || !shopifyApiSecret || isConfiguringShopify) && { opacity: 0.5 }]} 
                onPress={handleSaveConfig}
                disabled={!shopifyApiKey || !shopifyApiSecret || isConfiguringShopify}
              >
                <Text style={styles.addButtonText}>{isConfiguringShopify ? 'Speichern...' : 'Speichern'}</Text>
              </Pressable>
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
    justifyContent: 'flex-start',
    alignItems: 'stretch',
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
    justifyContent: 'center',
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
  simpleModalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.xl,
    width: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
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
