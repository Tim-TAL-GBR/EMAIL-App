import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../../lib/constants';
import { SETTINGS_PAGES } from './_layout';
import { Feather } from '@expo/vector-icons';

export default function SettingsIndex() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'macos' || width >= 768;
  const router = useRouter();

  if (isDesktop) {
    return <Redirect href="/settings/profile" />;
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
    >
      {SETTINGS_PAGES.map((group) => (
        <View key={group.section} style={styles.section}>
          {group.section ? <Text style={styles.sectionTitle}>{group.section}</Text> : null}
          <View style={styles.groupContainer}>
            {group.items.map((item, index) => (
              <TouchableOpacity
                key={item.href}
                style={[
                  styles.navItem,
                  index < group.items.length - 1 && styles.borderBottom
                ]}
                onPress={() => router.push(item.href as any)}
              >
                <Text style={styles.navLabel}>{item.label}</Text>
                <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 2,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  groupContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  navItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  navLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.text,
  },
});
