import React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { useInboxes } from '../../../hooks/useInboxes';

export default function BillingSettingsScreen() {
  const { inboxes } = useInboxes();
  const teamName = React.useMemo(() => {
    const teams = new Map<string, string>();
    inboxes.forEach(i => { if (i.team?.name && !teams.has(i.team.id)) teams.set(i.team.id, i.team.name); });
    return teams.values().next().value || 'Organisation';
  }, [inboxes]);

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
          
          <TouchableOpacity style={styles.sidebarItemActive}>
            <View style={styles.orgAvatar}>
              <Text style={styles.orgAvatarText}>{teamName.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.sidebarItemTitleActive}>{teamName}</Text>
              <Text style={styles.sidebarItemSubtitleActive}>Starter • Monatlich • 2 Benutzer</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <View style={styles.mainHeader}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.headerAvatar, { backgroundColor: '#F06A6A' }]}>
              <Text style={styles.headerAvatarText}>{teamName.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.mainHeaderTitle}>{teamName}</Text>
              <Text style={styles.mainHeaderSubtitle}>Abrechnung</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.contentContainer}>
          <View style={styles.messageContainer}>
            <Text style={styles.messageTitle}>Du bist nicht der Inhaber</Text>
            <Text style={styles.messageText}>
              Du kannst den Plan nicht ändern, Abrechnungsdetails aktualisieren oder Rechnungen herunterladen.
            </Text>
            <Text style={styles.messageText}>
              Nur <Text style={{fontWeight: 'bold'}}>Pepe Köbke</Text>, der Inhaber der Organisation, kann das.
            </Text>
          </View>
        </View>
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
    backgroundColor: Colors.info,
  },
  orgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    borderRadius: 24,
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  messageContainer: {
    alignItems: 'center',
    maxWidth: 600,
  },
  messageTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  messageText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
