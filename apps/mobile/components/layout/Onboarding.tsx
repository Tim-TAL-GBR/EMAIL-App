import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, BorderRadius } from '../../lib/constants';

export function Onboarding() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Willkommen bei TeamMail</Text>
      <Text style={styles.subtitle}>Bitte verbinde dein erstes E-Mail-Konto, um loszulegen.</Text>
      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push('/settings/accounts')}
      >
        <Text style={styles.buttonText}>Erstes Postfach hinzufügen</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  title: {
    fontFamily: FontFamily,
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    marginBottom: Spacing['4xl'],
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  buttonText: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.background,
  },
});
