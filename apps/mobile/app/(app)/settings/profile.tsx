import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';

export default function ProfileSettingsScreen() {
  const { user } = useAuthStore();
  
  // Split displayName into first and last name
  const nameParts = (user?.user_metadata?.display_name || '').split(' ');
  const initialFirstName = nameParts[0] || '';
  const initialLastName = nameParts.slice(1).join(' ') || '';

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    
    const newDisplayName = `${firstName.trim()} ${lastName.trim()}`.trim();
    
    try {
      // 1. Update auth user metadata (triggers authStateChange -> updates authStore automatically)
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: newDisplayName }
      });
      
      if (authError) throw authError;

      // 2. Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ display_name: newDisplayName })
        .eq('id', user.id);
        
      if (profileError) throw profileError;
      
      Alert.alert('Erfolg', 'Profil erfolgreich aktualisiert.');
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Beim Speichern ist ein Fehler aufgetreten.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = firstName !== initialFirstName || lastName !== initialLastName;
  const avatarInitials = `${firstName.charAt(0).toUpperCase()}${lastName.charAt(0).toUpperCase()}` || 'U';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarInitials}</Text>
        </View>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Du</Text>
          <Text style={styles.headerSubtitle}>Profil</Text>
        </View>
        <View style={styles.headerActions}>
          <Button 
            title="Speichern" 
            onPress={handleSave} 
            disabled={!hasChanges || isSaving}
            isLoading={isSaving}
          />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Änderungen an deinem Profil werden für alle Organisationen übernommen.
          </Text>
        </View>

        <View style={styles.formRow}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>{avatarInitials}</Text>
          </View>
          
          <View style={styles.inputsContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Vorname</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Vorname"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nachname</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Nachname"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    color: '#FFF',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerActions: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    maxWidth: Layout.maxContentWidth,
  },
  infoBox: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  infoText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xl,
    marginTop: Spacing.xs,
  },
  avatarTextLarge: {
    color: '#FFF',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.lg,
  },
  inputsContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.md,
    color: Colors.text,
    fontFamily: FontFamily,
    fontSize: FontSize.md,
  },
});
