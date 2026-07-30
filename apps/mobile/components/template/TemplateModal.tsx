import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, KeyboardAvoidingView, Platform, ScrollView, Switch } from 'react-native';
import { Colors, Spacing, BorderRadius, FontFamily, FontSize, FontWeight } from '../../lib/constants';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface Template {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  scope: 'private' | 'team';
  show_in_shopify: boolean;
}

interface TemplateModalProps {
  visible: boolean;
  onClose: () => void;
  template?: Template | null;
}

export function TemplateModal({ visible, onClose, template }: TemplateModalProps) {
  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [showInShopify, setShowInShopify] = useState(template?.show_in_shopify ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!template;

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing) {
        const { error: updateError } = await supabase
          .from('templates')
          .update({ name: name.trim(), subject: subject.trim() || null, body: body.trim(), show_in_shopify: showInShopify })
          .eq('id', template!.id);
        if (updateError) throw updateError;
      } else {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) throw new Error('Not authenticated');
        const { error: insertError } = await supabase
          .from('templates')
          .insert({ name: name.trim(), subject: subject.trim() || null, body: body.trim(), scope: 'private', owner_id: user.id, show_in_shopify: showInShopify });
        if (insertError) throw insertError;
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Button title="Abbrechen" variant="ghost" onPress={onClose} />
          <Text style={styles.headerTitle}>{isEditing ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</Text>
          <Button title="Speichern" onPress={handleSave} isLoading={isSubmitting} />
        </View>
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <Input label="Name" placeholder="z.B. Standard-Antwort" value={name} onChangeText={setName} />
          <Input label="Betreff (optional)" placeholder="Re: {{subject}}" value={subject} onChangeText={setSubject} />
          <Input label="Text" placeholder="Vorlagentext schreiben..." value={body} onChangeText={setBody} multiline style={styles.bodyInput} />
          
          <View style={styles.variablesContainer}>
            <Text style={styles.variablesTitle}>Verfügbare Variablen:</Text>
            <View style={styles.variablesList}>
              <Text style={styles.variableItem}><Text style={styles.variableCode}>{"{{subject}}"}</Text> - Ursprünglicher Betreff</Text>
              <Text style={styles.variableItem}><Text style={styles.variableCode}>{"{{customerName}}"}</Text> - Name des Kunden</Text>
              <Text style={styles.variableItem}><Text style={styles.variableCode}>{"{{orderNumber}}"}</Text> - Bestellnummer</Text>
              <Text style={styles.variableItem}><Text style={styles.variableCode}>{"{{agentName}}"}</Text> - Dein Name</Text>
            </View>
          </View>

          <View style={styles.switchContainer}>
            <View style={styles.switchTextContainer}>
              <Text style={styles.switchLabel}>In Shopify anzeigen</Text>
              <Text style={styles.switchDescription}>Macht diese Vorlage im E-Mail Formular in Shopify verfügbar.</Text>
            </View>
            <Switch
              value={showInShopify}
              onValueChange={setShowInShopify}
              trackColor={{ false: Colors.border, true: Colors.primary }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
  },
  headerTitle: { fontFamily: FontFamily, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  content: { flex: 1, padding: Spacing.lg },
  bodyInput: { minHeight: 200, textAlignVertical: 'top' },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: Spacing.md,
    borderRadius: BorderRadius.md, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.error,
  },
  errorText: { color: Colors.error, fontFamily: FontFamily, fontSize: FontSize.sm },
  switchContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.md,
  },
  switchTextContainer: { flex: 1, paddingRight: Spacing.md },
  switchLabel: { fontFamily: FontFamily, fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
  switchDescription: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  variablesContainer: {
    backgroundColor: Colors.surfaceHover, padding: Spacing.md, borderRadius: BorderRadius.md,
    marginTop: -Spacing.sm, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  variablesTitle: { fontFamily: FontFamily, fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary, marginBottom: Spacing.xs },
  variablesList: { paddingLeft: Spacing.xs },
  variableItem: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
  variableCode: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: FontWeight.bold, color: Colors.primary },
});
