import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { useInboxes } from '../../../hooks/useInboxes';

export default function APISettingsScreen() {
  const { inboxes } = useInboxes();
  const teamName = React.useMemo(() => {
    const teams = new Map<string, string>();
    inboxes.forEach(i => { if (i.team?.name && !teams.has(i.team.id)) teams.set(i.team.id, i.team.name); });
    return teams.values().next().value || 'Organisation';
  }, [inboxes]);

  const [activeTab, setActiveTab] = useState<'Tokens' | 'Resource IDs'>('Tokens');
  const [isModalVisible, setIsModalVisible] = useState(false);

  const renderTokensTab = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.infoBox}>
        <View style={styles.infoBoxHeader}>
          <Text style={styles.infoIcon}>❔</Text>
          <Text style={styles.infoText}>
            Die TeamMail API ermöglicht es dir, TeamMail-Unterhaltungen mit Inhalten aus dem gesamten Web zu bereichern.
          </Text>
        </View>
        <TouchableOpacity>
          <Text style={styles.linkText}>Dokumentation</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.flexRowBetween}>
        <Text style={styles.sectionTitle}>Persönliche API-Tokens</Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <TouchableOpacity style={styles.buttonSecondary}>
            <Text style={styles.buttonSecondaryText}>Aktualisieren</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonSecondary} onPress={() => setIsModalVisible(true)}>
            <Text style={styles.buttonSecondaryTextBlue}>⊕ Neuer Token</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyCardText}>Keine API-Tokens.</Text>
      </View>
    </ScrollView>
  );

  const renderResourceIdsTab = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Ressourcen-IDs</Text>
      <Text style={[styles.infoText, { marginBottom: Spacing.lg }]}>
        Hier findest du die eindeutigen IDs für verschiedene Objekte, die du für API-Aufrufe benötigst.
      </Text>

      <View style={styles.card}>
        <View style={styles.tableRow}>
          <Text style={[styles.tableCellText, { flex: 1, fontWeight: FontWeight.bold }]}>Mein Benutzer</Text>
          <Text style={[styles.tableCellText, { flex: 2, fontFamily: 'Courier' }]}>user_123456789</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={[styles.tableCellText, { flex: 1, fontWeight: FontWeight.bold }]}>Organisation ({teamName})</Text>
          <Text style={[styles.tableCellText, { flex: 2, fontFamily: 'Courier' }]}>org_987654321</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={[styles.tableCellText, { flex: 1, fontWeight: FontWeight.bold }]}>Team (Studio)</Text>
          <Text style={[styles.tableCellText, { flex: 2, fontFamily: 'Courier' }]}>team_55555555</Text>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Modal Overlay */}
      {isModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Neuer Token</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Beschreibung" 
              placeholderTextColor={Colors.textTertiary} 
              autoFocus
            />
            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.modalButtonSecondary}>
                <Text style={styles.modalButtonSecondaryText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonPrimary}>
                <Text style={styles.modalButtonPrimaryText}>Erstellen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Sidebar */}
      <View style={styles.sidebar}>
        <TouchableOpacity 
          style={[styles.sidebarItem, activeTab === 'Tokens' && styles.sidebarItemActive]}
          onPress={() => setActiveTab('Tokens')}
        >
          <Text style={[styles.sidebarItemText, activeTab === 'Tokens' && styles.sidebarItemTextActive]}>Tokens</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sidebarItem, activeTab === 'Resource IDs' && styles.sidebarItemActive]}
          onPress={() => setActiveTab('Resource IDs')}
        >
          <Text style={[styles.sidebarItemText, activeTab === 'Resource IDs' && styles.sidebarItemTextActive]}>Ressourcen-IDs</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <View style={styles.mainHeader}>
          <Text style={styles.mainHeaderTitle}>{activeTab === 'Tokens' ? 'Tokens' : 'Ressourcen-IDs'}</Text>
          <Text style={styles.mainHeaderSubtitle}>API</Text>
        </View>
        
        {activeTab === 'Tokens' ? renderTokensTab() : renderResourceIdsTab()}
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
    paddingTop: Spacing.md,
  },
  sidebarItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.xs,
    marginBottom: Spacing.xs,
    borderRadius: 6,
  },
  sidebarItemActive: {
    backgroundColor: Colors.info,
  },
  sidebarItemText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  sidebarItemTextActive: {
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
  main: {
    flex: 1,
  },
  mainHeader: {
    padding: Spacing.xl,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  infoBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  infoBoxHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  infoIcon: {
    fontSize: FontSize.md,
    marginRight: Spacing.sm,
  },
  infoText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  linkText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
    marginLeft: 28,
  },
  sectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  flexRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  buttonSecondary: {
    backgroundColor: Colors.surfaceHover,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: 6,
  },
  buttonSecondaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  buttonSecondaryTextBlue: {
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
  },
  emptyCardText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tableCellText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
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
    width: 400,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.info,
    borderRadius: 6,
    padding: Spacing.sm,
    color: Colors.text,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xl,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: Colors.surfaceHover,
    paddingVertical: Spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: Colors.info,
    paddingVertical: Spacing.sm,
    borderRadius: 6,
    marginLeft: Spacing.sm,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
});
