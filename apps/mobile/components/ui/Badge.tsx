import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, FontWeight, Spacing, BorderRadius } from '../../lib/constants';

interface BadgeProps {
  text: string;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'sm' | 'md';
}

export function Badge({ text, variant = 'primary', size = 'md' }: BadgeProps) {
  const isSm = size === 'sm';

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return { bg: 'rgba(16, 185, 129, 0.1)', text: Colors.success };
      case 'warning':
        return { bg: 'rgba(245, 158, 11, 0.1)', text: Colors.warning };
      case 'error':
        return { bg: 'rgba(239, 68, 68, 0.1)', text: Colors.error };
      case 'neutral':
        return { bg: Colors.surfaceHover, text: Colors.textSecondary };
      case 'primary':
      default:
        return { bg: 'rgba(99, 102, 241, 0.1)', text: Colors.primaryLight };
    }
  };

  const { bg, text: textColor } = getVariantStyles();

  return (
    <View
      style={[
        styles.container,
        isSm ? styles.containerSm : styles.containerMd,
        { backgroundColor: bg },
      ]}
    >
      <Text
        style={[
          styles.text,
          isSm ? styles.textSm : styles.textMd,
          { color: textColor },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  containerSm: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
  },
  containerMd: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
  },
  text: {
    fontFamily: FontFamily,
    fontWeight: FontWeight.medium,
  },
  textSm: {
    fontSize: FontSize.xs,
  },
  textMd: {
    fontSize: FontSize.sm,
  },
});
