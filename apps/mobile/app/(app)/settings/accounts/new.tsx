import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../../lib/constants';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../stores/authStore';
import { Button } from '../../../../components/ui/Button';

export default function SettingsInboxNew() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [type, setType] = useState<'shared' | 'private'>('shared');
  const [color, setColor] = useState('#3b82f6'); // default blue
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setErrorMsg(null);
    if (!name || !emailAddress) {
      setErrorMsg("Bitte Name und E-Mail-Adresse eingeben.");
      return;
    }
    
    setSaving(true);

    try {
      // 1. Get the user's team
      const { data: teamMember, error: teamError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user?.id)
        .limit(1)
        .single();

      if (teamError || !teamMember) {
        console.error("Team error:", teamError);
        throw new Error("Fehler beim Abrufen der Team-Daten. Du gehörst eventuell keinem Team an.");
      }

      if (type === 'shared' && teamMember.role !== 'admin' && teamMember.role !== 'owner') {
        throw new Error("Nur Team-Admins können geteilte Postfächer erstellen. Aktuelle Rolle: " + teamMember.role);
      }

      // 2. Insert Inbox
      const { data: newInbox, error: insertError } = await supabase
        .from('inboxes')
        .insert({
          team_id: teamMember.team_id,
          name: name,
          email_address: emailAddress,
          type: type,
          owner_id: type === 'private' ? user?.id : null,
          color: color,
        })
        .select('id')
        .single();
        
      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error(insertError.message || "Fehler beim Anlegen des Postfachs in der Datenbank.");
      }

      // 3. If shared, add the creator as an inbox admin automatically
      if (type === 'shared') {
        await supabase
          .from('inbox_members')
          .insert({
            inbox_id: newInbox.id,
            user_id: user?.id,
            role: 'admin'
          });
      }

      // Success! Navigate to detail page
      router.replace(`/settings/accounts/${newInbox.id}`);
    } catch (e: any) {
      setErrorMsg(e.message || "Ein unbekannter Fehler ist aufgetreten.");
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Neues Postfach</Text>
          <Text style={styles.subtitle}>Lege ein neues Postfach für dein Team an</Text>
        </View>
        <Button 
          title="Abbrechen" 
          variant="outline" 
          onPress={() => router.back()} 
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>ALLGEMEINE DATEN</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name des Postfachs</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="z.B. Support Team"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>E-Mail-Adresse</Text>
          <TextInput
            style={styles.input}
            value={emailAddress}
            onChangeText={setEmailAddress}
            placeholder="support@beispiel.de"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Sichtbarkeit</Text>
          <View style={styles.typeSelector}>
            <Button 
              title="Geteilt (Shared)" 
              variant={type === 'shared' ? 'primary' : 'outline'}
              onPress={() => setType('shared')}
              style={{ flex: 1, marginRight: Spacing.sm }}
            />
            <Button 
              title="Privat" 
              variant={type === 'private' ? 'primary' : 'outline'}
              onPress={() => setType('private')}
              style={{ flex: 1 }}
            />
          </View>
          <Text style={styles.helperText}>
            {type === 'shared' 
              ? 'Andere Teammitglieder können zu diesem Postfach eingeladen werden.' 
              : 'Nur du kannst dieses Postfach sehen und nutzen.'}
          </Text>
        </View>
      </View>

      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Button 
          title={saving ? "Erstelle..." : "Postfach erstellen"} 
          variant="primary" 
          onPress={handleSave} 
          disabled={saving}
          style={{ flex: 1 }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: Spacing.xl * 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  title: {
    fontFamily: FontFamily,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  formSection: {
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.lg,
    letterSpacing: 1,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    color: Colors.text,
    fontFamily: FontFamily,
    fontSize: FontSize.md,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  helperText: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  errorContainer: {
    backgroundColor: '#fee2e2', // red-100
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f87171', // red-400
    marginBottom: Spacing.md,
  },
  errorText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: '#b91c1c', // red-700
  }
});
