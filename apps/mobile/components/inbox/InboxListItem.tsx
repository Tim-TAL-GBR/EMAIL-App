import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, BorderRadius } from '../../lib/constants';

interface InboxListItemProps {
  inbox: {
    id: string;
    name: string;
    email_address: string;
    type: 'private' | 'shared';
    color: string | null;
    unread_count?: number;
  };
  isActive: boolean;
  onPress: () => void;
  variant?: 'sidebar' | 'card';
}

export function InboxListItem({ inbox, isActive, onPress, variant = 'sidebar' }: InboxListItemProps) {
  const dotColor = inbox.color || Colors.primary;
  const isSidebar = variant === 'sidebar';

  if (isSidebar) {
    return (
      <TouchableOpacity
        style={[styles.sidebarContainer, isActive && styles.sidebarContainerActive]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={[styles.sidebarName, isActive && styles.sidebarNameActive]} numberOfLines={1}>
          {inbox.name}
        </Text>
        {inbox.unread_count ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{inbox.unread_count}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  // Card Variant for Dashboard
  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.dot, { backgroundColor: dotColor, width: 12, height: 12, borderRadius: 6 }]} />
          <Text style={styles.cardName}>{inbox.name}</Text>
        </View>
        {inbox.unread_count ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{inbox.unread_count} ungelesen</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardEmail}>{inbox.email_address}</Text>
      <View style={styles.cardFooter}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {inbox.type === 'shared' ? 'Shared Inbox' : 'Private Inbox'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Sidebar Styles
  sidebarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: 2,
  },
  sidebarContainerActive: {
    backgroundColor: Colors.surfaceHover,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  sidebarName: {
    flex: 1,
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  sidebarNameActive: {
    color: Colors.text,
    fontWeight: FontWeight.semibold,
  },
  badge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  // Card Styles
  cardContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardName: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  cardEmail: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  typeBadge: {
    backgroundColor: Colors.surfaceHover,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  typeBadgeText: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});
