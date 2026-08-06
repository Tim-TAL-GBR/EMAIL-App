import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Colors, Spacing, BorderRadius, FontFamily, FontSize, FontWeight } from '../../lib/constants';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useInboxStore } from '../../stores/inboxStore';

interface CreateInboxModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CreateInboxModal({ visible, onClose }: CreateInboxModalProps) {
  const [name, setName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [type, setType] = useState<'shared' | 'private'>('shared');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore(s => s.user);
  const fetchInboxes = useInboxStore(s => s.fetchInboxes);

  const handleCreate = async () => {
    if (!name.trim() || !emailAddress.trim() || !user) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('inboxes').insert({
        name: name.trim(),
        email_address: emailAddress.trim(),
        type,
        owner_id: type === 'private' ? user.id : null,
        team_id: null,
        color: type === 'shared' ? '#6366F1' : '#10B981',
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      await fetchInboxes();
      onClose();
      setName('');
      setEmailAddress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'web' ? 'pageSheet' : 'fullScreen'} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Button title="Abbrechen" variant="ghost" onPress={onClose} />
          <Text style={styles.headerTitle}>Neue Inbox</Text>
          <Button title="Erstellen" onPress={handleCreate} isLoading={isSubmitting} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Input
            label="Name"
            placeholder="z.B. Support, Vertrieb"
            value={name}
            onChangeText={setName}
          />

          <Input
            label="E-Mail-Adresse"
            placeholder="inbox@example.com"
            value={emailAddress}
            onChangeText={setEmailAddress}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Typ</Text>
          <View style={styles.typeRow}>
            <Button
              title="Team-Inbox"
              variant={type === 'shared' ? 'primary' : 'secondary'}
              onPress={() => setType('shared')}
            />
            <Button
              title="Privat"
              variant={type === 'private' ? 'primary' : 'secondary'}
              onPress={() => setType('private')}
            />
          </View>

          <Text style={styles.hint}>
            {type === 'shared'
              ? 'Team-Inboxes werden von mehreren Teammitgliedern gemeinsam bearbeitet.'
              : 'Private Inboxes sind nur für dich sichtbar.'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  content: { flex: 1, padding: Spacing.lg },
  label: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  hint: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
  },
});
