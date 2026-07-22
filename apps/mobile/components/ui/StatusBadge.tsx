import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, StatusColors, StatusLabels, Spacing, BorderRadius, FontFamily, FontSize, FontWeight } from '../../lib/constants';

interface StatusBadgeProps {
  status: 'open' | 'in_progress' | 'done';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = StatusColors[status] || Colors.textSecondary;
  const label = StatusLabels[status] || 'Unknown';

  return (
    <View style={[styles.container, { backgroundColor: `${color}1A` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontFamily: FontFamily,
    fontWeight: FontWeight.medium,
    fontSize: FontSize.xs,
  },
});
