import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { useInboxes } from '../../../hooks/useInboxes';

export default function LabelsSettingsScreen() {
  const { inboxes } = useInboxes();
  const teamName = React.useMemo(() => {
    const teams = new Map<string, string>();
    inboxes.forEach(i => { if (i.team?.name && !teams.has(i.team.id)) teams.set(i.team.id, i.team.name); });
    return teams.values().next().value || 'Organisation';
  }, [inboxes]);

  const [selectedItem, setSelectedItem] = useState<'org' | 'email'>('org');

  const renderOrgContent = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.infoBox}>
        <Text style={styles.infoIconBox}>❔</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoText}>
            Organisations-Labels sind exklusiv für Missive und werden nicht mit einem E-Mail-Konto synchronisiert. Sie können auf E-Mails, Chats, SMS-Unterhaltungen usw. angewendet werden.
          </Text>
          <TouchableOpacity style={{ marginTop: Spacing.sm }}>
            <Text style={styles.linkTextBlue}>Mehr erfahren</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Organisations-Labels</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.headerIconButton}>
            <Text style={styles.headerIconButtonText}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButtonSecondary}>
            <Text style={styles.addButtonSecondaryText}>⊕ Label erstellen</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
          <Text style={[styles.tableHeaderText, { width: 100, textAlign: 'right' }]}>Geteilt mit</Text>
          <Text style={[styles.tableHeaderText, { width: 40 }]}></Text>
        </View>
        
        <View style={styles.tableRow}>
          <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.tagIcon, { color: '#00B388' }]}>🏷</Text>
            <Text style={styles.tableCellText}>Agenda hochgeladen</Text>
          </View>
          <View style={{ width: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          </View>
          <View style={{ width: 40, alignItems: 'center' }}>
            <TouchableOpacity><Text style={styles.moreIcon}>⋯</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.tableRow}>
          <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.tagIcon, { color: '#008000' }]}>🏷</Text>
            <Text style={styles.tableCellText}>bearbeitet</Text>
          </View>
          <View style={{ width: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
            <View style={[styles.userAvatar, { backgroundColor: '#00B388', zIndex: 2 }]}>
              <Text style={styles.userAvatarText}>TR</Text>
            </View>
            <View style={[styles.userAvatar, { backgroundColor: '#7B68EE', marginLeft: -8, zIndex: 1 }]}>
              <Text style={styles.userAvatarText}>PK</Text>
            </View>
          </View>
          <View style={{ width: 40, alignItems: 'center' }}>
            <TouchableOpacity><Text style={styles.moreIcon}>⋯</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.tableRow}>
          <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.tagIcon, { color: '#1E90FF' }]}>🏷</Text>
            <Text style={styles.tableCellText}>Rechnung</Text>
          </View>
          <View style={{ width: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
            <View style={[styles.userAvatar, { backgroundColor: '#00B388', zIndex: 2 }]}>
              <Text style={styles.userAvatarText}>TR</Text>
            </View>
            <View style={[styles.userAvatar, { backgroundColor: '#7B68EE', marginLeft: -8, zIndex: 1 }]}>
              <Text style={styles.userAvatarText}>PK</Text>
            </View>
          </View>
          <View style={{ width: 40, alignItems: 'center' }}>
            <TouchableOpacity><Text style={styles.moreIcon}>⋯</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderEmailContent = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.infoBox}>
        <Text style={styles.infoIconBox}>❔</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoText}>
            Diese E-Mail-Labels werden mit dem <Text style={{fontWeight: 'bold'}}>studioleitung@celle.clever-fit.com</Text> E-Mail-Konto synchronisiert. Sie werden mit allen geteilt, die Zugriff auf dieses Konto haben.
          </Text>
          <TouchableOpacity style={{ marginTop: Spacing.sm }}>
            <Text style={styles.linkTextBlue}>Mehr erfahren</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>E-Mail-Labels</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.headerIconButton}>
            <Text style={styles.headerIconButtonText}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButtonSecondary}>
            <Text style={styles.addButtonSecondaryText}>⊕ Label erstellen</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Name</Text>
        </View>
        
        {['Aktuelle Bewerbungen', 'Archive', 'Bewerbungen', 'Blocked', 'Erledigt', 'Junk Email', 'Later', 'Motive', 'Reinigung', 'Verfügbarkeiten'].map((labelName) => (
          <View key={labelName} style={styles.tableRow}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.tagIcon, { color: Colors.textTertiary }]}>🏷</Text>
              <Text style={styles.tableCellText}>{labelName}</Text>
            </View>
            <View style={{ width: 40, alignItems: 'center' }}>
              <TouchableOpacity><Text style={styles.moreIcon}>⋯</Text></TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        <ScrollView style={styles.sidebarContent}>
          <View style={styles.searchWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput 
              style={styles.searchInput} 
              placeholder="Labels suchen..." 
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          
          <Text style={styles.sidebarSectionTitle}>E-Mail-Konten</Text>
          <TouchableOpacity 
            style={[styles.sidebarItem, selectedItem === 'email' && styles.sidebarItemActive]}
            onPress={() => setSelectedItem('email')}
          >
            <View style={styles.emailAvatar}>
              <Text style={styles.emailAvatarText}>fit</Text>
            </View>
            <View>
              <Text style={[styles.sidebarItemTitle, selectedItem === 'email' && styles.sidebarItemTitleActive]}>studioleitung@celle.clever-...</Text>
              <Text style={[styles.sidebarItemSubtitle, selectedItem === 'email' && styles.sidebarItemSubtitleActive]}>10 labels</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sidebarItem}>
            <View style={styles.emailAvatar}>
              <Text style={styles.emailAvatarText}>fit</Text>
            </View>
            <View>
              <Text style={styles.sidebarItemTitle}>studio@celle.clever-fit.com</Text>
              <Text style={styles.sidebarItemSubtitle}>96 labels</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sidebarItem}>
            <View style={[styles.emailAvatar, { backgroundColor: 'transparent' }]}>
            </View>
            <View>
              <Text style={styles.sidebarItemTitle}>t.regener@cf-celle.de</Text>
              <Text style={styles.sidebarItemSubtitle}>0 labels</Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.sidebarSectionTitle, { marginTop: Spacing.md }]}>Organisationen</Text>
          <TouchableOpacity 
            style={[styles.sidebarItem, selectedItem === 'org' && styles.sidebarItemActive]}
            onPress={() => setSelectedItem('org')}
          >
            <View style={styles.orgAvatar}>
              <Text style={styles.orgAvatarText}>{teamName.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={[styles.sidebarItemTitle, selectedItem === 'org' && styles.sidebarItemTitleActive]}>{teamName}</Text>
              <Text style={[styles.sidebarItemSubtitle, selectedItem === 'org' && styles.sidebarItemSubtitleActive]}>3 labels</Text>
            </View>
          </TouchableOpacity>

        </ScrollView>
        <TouchableOpacity style={styles.sidebarFooter}>
          <Text style={styles.sidebarFooterText}>Label erstellen</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <View style={styles.mainHeader}>
          <View style={styles.headerTitleRow}>
            {selectedItem === 'org' ? (
              <>
                <View style={styles.headerAvatar}>
                  <Text style={styles.headerAvatarText}>{teamName.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.mainHeaderTitle}>{teamName}</Text>
                  <Text style={styles.mainHeaderSubtitle}>Labels</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.headerAvatar, { backgroundColor: '#FFF', borderWidth: 1, borderColor: Colors.border }]}>
                  <Text style={[styles.headerAvatarText, { color: '#E3000F' }]}>fit</Text>
                </View>
                <View>
                  <Text style={styles.mainHeaderTitle}>studioleitung@celle.clever-fit.com</Text>
                  <Text style={styles.mainHeaderSubtitle}>Office 365 Konto</Text>
                </View>
              </>
            )}
          </View>
        </View>
        
        {selectedItem === 'org' ? renderOrgContent() : renderEmailContent()}
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
  sidebarSectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    fontWeight: 'bold',
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
  },
  sidebarItemActive: {
    backgroundColor: Colors.info,
  },
  emailAvatar: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  emailAvatarText: {
    color: '#E3000F',
    fontFamily: FontFamily,
    fontSize: 10,
    fontWeight: 'bold',
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
  sidebarItemTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  sidebarItemTitleActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  sidebarItemSubtitle: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  sidebarItemSubtitleActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  sidebarFooter: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  sidebarFooterText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.info,
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
    backgroundColor: '#F0F8FF',
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
  headerIconButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  headerIconButtonText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  addButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFE0FF',
  },
  addButtonSecondaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.info,
  },
  table: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceHover,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableHeaderText: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tagIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  tableCellText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  moreIcon: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  userAvatarText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: 10,
    fontWeight: 'bold',
  },
});
