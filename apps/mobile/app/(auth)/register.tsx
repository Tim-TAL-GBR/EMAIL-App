import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../lib/constants';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/authStore';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const { signUp } = useAuthStore();

  const handleRegister = async () => {
    if (!email || !password || !displayName) {
      setError('Bitte alle Felder ausfüllen.');
      return;
    }
    setError(null);
    setIsLoading(true);
    
    const { error: signUpError, session } = await signUp(email, password, displayName);
    
    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
    } else if (!session) {
      // Sign up successful, but no session returned -> Email confirmation required
      setError('Erfolgreich! Bitte prüfe deine E-Mails, um deinen Account zu bestätigen.');
      setIsLoading(false);
    }
    // If there is a session, onAuthStateChange in _layout.tsx will handle the redirect

  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Konto erstellen</Text>
          <Text style={styles.subtitle}>Werde Teil von TeamMail</Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <Input
            placeholder="Anzeigename"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <Input
            placeholder="E-Mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            placeholder="Passwort"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <Button 
            title="Registrieren" 
            onPress={handleRegister}
            isLoading={isLoading}
            fullWidth
            style={styles.submitButton}
          />
        </View>

        <View style={styles.footer}>
          <Button 
            title="Bereits ein Konto? Anmelden" 
            variant="ghost" 
            onPress={() => router.replace('/(auth)/login')} 
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['4xl'],
  },
  title: {
    fontFamily: FontFamily,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  form: {
    marginBottom: Spacing.xl,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
});
