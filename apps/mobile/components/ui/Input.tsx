import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, Platform } from 'react-native';
import { Colors, Spacing, BorderRadius, FontFamily, FontSize, Shadows } from '../../lib/constants';

interface InputProps extends TextInputProps {
  label?: string;
  icon?: string;
  error?: string;
}

export function Input({ label, icon, error, style, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          props.multiline && { alignItems: 'flex-start', paddingVertical: Spacing.md },
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
        ]}
      >
        {icon && (
          <Text style={[styles.icon, props.multiline && { marginTop: 2 }]}>
            {icon}
          </Text>
        )}
        <TextInput
          style={[styles.input, props.multiline && { textAlignVertical: 'top' }, style]}
          placeholderTextColor={Colors.textTertiary}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  label: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHover,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    ...Platform.select({
      ios: Shadows.subtle,
      android: { elevation: 1 },
    }),
  },
  inputContainerFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  inputContainerError: {
    borderColor: Colors.error,
  },
  icon: {
    fontSize: FontSize.lg,
    marginRight: Spacing.sm,
    color: Colors.textSecondary,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  errorText: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
});
