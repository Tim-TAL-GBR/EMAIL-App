import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';

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
  const [modalVisible, setModalVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Alle');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIntegrations, setActiveIntegrations] = useState<any[]>([]);

  const handleToggleIntegration = (item: any) => {
    const exists = activeIntegrations.find(i => i.name === item.name);
    if (exists) {
      setActiveIntegrations(activeIntegrations.filter(i => i.name !== item.name));
    } else {
      setActiveIntegrations([...activeIntegrations, { ...item, status: 'Verbunden' }]);
      setModalVisible(false);
    }
  };

  const renderModal = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        {/* Modal Header */}
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
          {/* Sidebar */}
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

          {/* List Content */}
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
});
