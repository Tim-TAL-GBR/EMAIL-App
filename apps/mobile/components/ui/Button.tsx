import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  ActivityIndicator, 
  StyleSheet, 
  View,
  TouchableOpacityProps 
} from 'react-native';
import { Colors, Spacing, BorderRadius, FontFamily, FontSize, FontWeight, AnimationDuration } from '../../lib/constants';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: any;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      style={[
        styles.button,
        styles[`size_${size}`],
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        isGhost && styles.ghost,
        isDanger && styles.danger,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.contentContainer}>
        {isLoading ? (
          <ActivityIndicator 
            color={isPrimary ? Colors.background : (isDanger ? Colors.text : Colors.textSecondary)} 
            size="small" 
          />
        ) : (
          <>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text
              style={[
                styles.text,
                styles[`text_${size}`],
                isPrimary && styles.textPrimary,
                isSecondary && styles.textSecondary,
                isGhost && styles.textGhost,
                isDanger && styles.textDanger,
                disabled && styles.textDisabled,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    marginRight: Spacing.sm,
  },
  // Sizes
  size_sm: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  size_md: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  size_lg: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  // Variants
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.error,
  },
  // Text Styles
  text: {
    fontFamily: FontFamily,
    fontWeight: FontWeight.medium,
  },
  text_sm: {
    fontSize: FontSize.sm,
  },
  text_md: {
    fontSize: FontSize.md,
  },
  text_lg: {
    fontSize: FontSize.lg,
  },
  textPrimary: {
    color: Colors.background,
  },
  textSecondary: {
    color: Colors.textSecondary,
  },
  textGhost: {
    color: Colors.textSecondary,
  },
  textDanger: {
    color: Colors.text,
  },
  textDisabled: {
    color: Colors.textSecondary,
  },
});
