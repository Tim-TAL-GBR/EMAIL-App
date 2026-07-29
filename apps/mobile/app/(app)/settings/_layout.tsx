import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { Stack, Slot, useRouter, usePathname } from 'expo-router';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../../lib/constants';

export const SETTINGS_PAGES = [
  { section: 'ICH', items: [
    { label: 'Profil', href: '/settings/profile' },
    { label: 'Einstellungen', href: '/settings/preferences' },
    { label: 'Login & Sicherheit', href: '/settings/security' },
  ]},
  { section: 'VERBINDUNGEN', items: [
    { label: 'Konten', href: '/settings/accounts' },
    { label: 'Kalender', href: '/settings/calendars' },
    { label: 'Integrationen', href: '/settings/integrations' },
    { label: 'API', href: '/settings/api' },
  ]},
  { section: 'ARBEIT', items: [
    { label: 'Organisationen', href: '/settings/organizations' },
    { label: 'Benutzer', href: '/settings/users' },
    { label: 'Rollen', href: '/settings/roles' },
    { label: 'Gäste', href: '/settings/guests' },
    { label: 'Teams', href: '/settings/teams' },
    { label: 'Labels', href: '/settings/labels' },
    { label: 'Vorlagen', href: '/settings/templates' },
    { label: 'KI', href: '/settings/ai' },
    { label: 'Regeln', href: '/settings/rules' },
    { label: 'Signaturen', href: '/settings/signatures' },
    { label: 'Abrechnung', href: '/settings/billing' },
  ]},
  { section: 'SUPER ADMIN', items: [
    { label: 'Dashboard', href: '/settings/admin' },
  ]},
  { section: '', items: [
    { label: 'Rewards 💰', href: '/settings/rewards' },
    { label: 'Hilfe & Feedback', href: '/settings/help' },
  ]}
];

export default function SettingsLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const router = useRouter();
  const pathname = usePathname();

  if (!isDesktop) {
    return (
      <Stack screenOptions={{ 
        headerShown: true,
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        contentStyle: { backgroundColor: Colors.background }
      }} />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Einstellungen</Text>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => router.replace('/inbox/list')}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.sidebarScroll}>
          {SETTINGS_PAGES.map((group) => (
            <View key={group.section} style={styles.section}>
              {group.section ? <Text style={styles.sectionTitle}>{group.section}</Text> : null}
              {group.items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <TouchableOpacity
                    key={item.href}
                    style={[styles.navItem, isActive && styles.navItemActive]}
                    onPress={() => router.push(item.href as any)}
                  >
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={styles.content}>
        <Slot />
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
    width: 240,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sidebarTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.sm,
    marginRight: -Spacing.sm,
  },
  closeIcon: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  sidebarScroll: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textTertiary,
    marginLeft: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  navItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  navItemActive: {
    backgroundColor: Colors.surfaceHover,
  },
  navLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  navLabelActive: {
    color: Colors.text,
    fontWeight: FontWeight.semibold,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
