import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { useInboxes } from '../../../hooks/useInboxes';

export default function GuestsSettingsScreen() {
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
              placeholder="Gäste suchen..." 
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          <TouchableOpacity style={styles.sidebarItemActive}>
            <View style={styles.orgAvatar}>
              <Text style={styles.orgAvatarText}>{teamName.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.sidebarItemTitleActive}>{teamName}</Text>
              <Text style={styles.sidebarItemSubtitleActive}>0 Gäste</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <View style={styles.mainHeader}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{teamName.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.mainHeaderTitle}>{teamName}</Text>
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
              <TouchableOpacity style={{ marginTop: Spacing.sm }}>
                <Text style={styles.linkTextBlue}>Mehr erfahren</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Gäste</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.seatsUsedText}>0/10 Gastplätze belegt</Text>
              <Text style={styles.infoCircleSmall}>ⓘ</Text>
            </View>
          </View>

          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>Es gibt keine Gäste in dieser Organisation.</Text>
          </View>

        </ScrollView>
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
    justifyContent: 'space-between',
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
    backgroundColor: Colors.info,
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
  },
  orgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F06A6A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  orgAvatarText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
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
    backgroundColor: '#F06A6A',
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
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F8FF', // Light blueish background similar to Missive's info
    borderWidth: 1,
    borderColor: '#BFE0FF',
    borderRadius: 8,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  infoIconBox: {
    fontSize: FontSize.md,
    marginRight: Spacing.sm,
    color: Colors.info,
  },
  infoText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  linkTextBlue: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.text,
  },
  seatsUsedText: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginRight: 4,
  },
  infoCircleSmall: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
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
});
