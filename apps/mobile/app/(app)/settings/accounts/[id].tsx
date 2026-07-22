import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../../lib/constants';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../stores/authStore';
import { Button } from '../../../../components/ui/Button';

export default function SettingsInboxDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [inbox, setInbox] = useState<any>(null);
  
  // Form State
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [imapUser, setImapUser] = useState('');
  const [imapPass, setImapPass] = useState('');
  
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  
  const [syncSince, setSyncSince] = useState('');

  useEffect(() => {
    fetchInbox();
  }, [id]);

  const fetchInbox = async () => {
    const { data, error } = await supabase
      .from('inboxes')
      .select('*')
      .eq('id', id)
      .single();
      
    if (data) {
      setInbox(data);
      setImapHost(data.imap_host || '');
      setImapPort(data.imap_port ? data.imap_port.toString() : '993');
      setImapUser(data.imap_user || '');
      setImapPass(data.imap_pass || '');
      
      setSmtpHost(data.smtp_host || '');
      setSmtpPort(data.smtp_port ? data.smtp_port.toString() : '465');
      setSmtpUser(data.smtp_user || '');
      setSmtpPass(data.smtp_pass || '');
      
      if (data.sync_since) {
        setSyncSince(data.sync_since.split('T')[0]);
      }
    }
    setLoading(false);
  };

  const handleTestConnection = async () => {
    if (!imapHost || !imapUser || !imapPass || !smtpHost || !smtpUser || !smtpPass) {
      Alert.alert("Fehler", "Bitte alle Felder ausfüllen.");
      return;
    }
    
    setTesting(true);
    try {
      // Use EXPO_PUBLIC_BACKEND_URL or fallback to localhost
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/mail/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          imap: {
            host: imapHost,
            port: parseInt(imapPort, 10),
            user: imapUser,
            pass: imapPass,
            tls: true
          },
          smtp: {
            host: smtpHost,
            port: parseInt(smtpPort, 10),
            user: smtpUser,
            pass: smtpPass,
            secure: parseInt(smtpPort, 10) === 465
          }
        })
      });
      
      const data = await response.json();
      if (data.success) {
        Alert.alert("Erfolgreich", "IMAP und SMTP Verbindung erfolgreich hergestellt!");
      } else {
        Alert.alert("Verbindungsfehler", data.errors?.join('\n') || data.error);
      }
    } catch (e: any) {
      Alert.alert("Fehler", "Backend konnte nicht erreicht werden: " + e.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    let syncSinceDate = null;
    if (syncSince) {
      const parsed = new Date(syncSince);
      if (!isNaN(parsed.getTime())) {
        syncSinceDate = parsed.toISOString();
      }
    }
    
    // 1. Update Supabase
    const { error } = await supabase
      .from('inboxes')
      .update({
        imap_host: imapHost,
        imap_port: parseInt(imapPort, 10),
        imap_user: imapUser,
        imap_pass: imapPass,
        smtp_host: smtpHost,
        smtp_port: parseInt(smtpPort, 10),
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        sync_since: syncSinceDate,
      })
      .eq('id', id);
      
    if (error) {
      Alert.alert("Fehler beim Speichern", error.message);
      setSaving(false);
      return;
    }
    
    // 2. Restart backend client
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      await fetch(`${backendUrl}/api/mail/restart-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ inboxId: id })
      });
    } catch (e) {
      console.error("Could not notify backend to restart client", e);
    }
    
    setSaving(false);
    Alert.alert("Gespeichert", "Die Zugangsdaten wurden gespeichert und der Sync-Dienst neu gestartet.");
    router.back();
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{inbox?.name}</Text>
          <Text style={styles.subtitle}>{inbox?.email_address}</Text>
        </View>
        <Button 
          title="Zurück" 
          variant="outline" 
          onPress={() => router.back()} 
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>IMAP EINSTELLUNGEN (Eingang)</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>IMAP Host</Text>
          <TextInput
            style={styles.input}
            value={imapHost}
            onChangeText={setImapHost}
            placeholder="imap.example.com"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
          />
        </View>
        
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>IMAP Benutzer</Text>
            <TextInput
              style={styles.input}
              value={imapUser}
              onChangeText={setImapUser}
              placeholder="benutzername"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
            />
          </View>
          <View style={[styles.inputGroup, { width: 100, marginLeft: Spacing.md }]}>
            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              value={imapPort}
              onChangeText={setImapPort}
              placeholder="993"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
            />
          </View>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>IMAP Passwort</Text>
          <TextInput
            style={styles.input}
            value={imapPass}
            onChangeText={setImapPass}
            placeholder="••••••••"
            placeholderTextColor={Colors.textTertiary}
            secureTextEntry
          />
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>SMTP EINSTELLUNGEN (Ausgang)</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>SMTP Host</Text>
          <TextInput
            style={styles.input}
            value={smtpHost}
            onChangeText={setSmtpHost}
            placeholder="smtp.example.com"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
          />
        </View>
        
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>SMTP Benutzer</Text>
            <TextInput
              style={styles.input}
              value={smtpUser}
              onChangeText={setSmtpUser}
              placeholder="benutzername"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
            />
          </View>
          <View style={[styles.inputGroup, { width: 100, marginLeft: Spacing.md }]}>
            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              value={smtpPort}
              onChangeText={setSmtpPort}
              placeholder="465"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
            />
          </View>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>SMTP Passwort</Text>
          <TextInput
            style={styles.input}
            value={smtpPass}
            onChangeText={setSmtpPass}
            placeholder="••••••••"
            placeholderTextColor={Colors.textTertiary}
            secureTextEntry
          />
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>SYNC EINSTELLUNGEN</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mails abrufen ab (Datum)</Text>
          <TextInput
            style={styles.input}
            value={syncSince}
            onChangeText={setSyncSince}
            placeholder="z.B. 2023-01-01 (optional)"
            placeholderTextColor={Colors.textTertiary}
          />
          <Text style={[styles.label, { fontSize: 12, marginTop: 4, opacity: 0.7 }]}>
            Wenn leer, werden nur die letzten 20 sowie alle neuen Mails abgerufen.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button 
          title={testing ? "Teste..." : "Verbindung testen"} 
          variant="secondary" 
          onPress={handleTestConnection} 
          disabled={testing || saving}
          style={{ flex: 1, marginRight: Spacing.md }}
        />
        <Button 
          title={saving ? "Speichere..." : "Speichern"} 
          variant="primary" 
          onPress={handleSave} 
          disabled={testing || saving}
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
    marginBottom: Spacing.md,
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
  row: {
    flexDirection: 'row',
  },
  actions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  }
});
