import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontFamily } from '../../lib/constants';
import { useSignatureStore, Signature } from '../../stores/signatureStore';
import { Button } from '../ui/Button';

interface SignatureSettingsProps {
  teamId?: string; // If passed, we can create team signatures.
}

export function SignatureSettings({ teamId }: SignatureSettingsProps) {
  const { signatures, fetchSignatures, createSignature, updateSignature, deleteSignature, isLoading } = useSignatureStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [contentText, setContentText] = useState('');
  const [scope, setScope] = useState<'private' | 'team'>('private');

  useEffect(() => {
    fetchSignatures();
  }, []);

  const handleEdit = (sig: Signature) => {
    setEditingId(sig.id);
    setName(sig.name);
    setContentText(sig.content_text);
    setScope(sig.scope);
    setIsEditing(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setName('');
    setContentText('');
    setScope('private');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !contentText.trim()) {
      Alert.alert('Fehler', 'Name und Inhalt dürfen nicht leer sein.');
      return;
    }

    const payload = {
      name,
      content_text: contentText,
      scope,
      team_id: scope === 'team' ? teamId : null,
    };

    let error;
    if (editingId) {
      const res = await updateSignature(editingId, payload);
      error = res.error;
    } else {
      const res = await createSignature(payload);
      error = res.error;
    }

    if (error) {
      Alert.alert('Fehler beim Speichern', error.message);
    } else {
      setIsEditing(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Löschen', 'Möchtest du diese Signatur wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => deleteSignature(id) }
    ]);
  };

  if (isEditing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{editingId ? 'Signatur bearbeiten' : 'Neue Signatur'}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Name der Signatur</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="z.B. Standard, Privat, Support..."
          />

          <Text style={styles.label}>Sichtbarkeit</Text>
          <View style={styles.scopeContainer}>
            <TouchableOpacity 
              style={[styles.scopeBtn, scope === 'private' && styles.scopeBtnActive]}
              onPress={() => setScope('private')}
            >
              <Text style={[styles.scopeBtnText, scope === 'private' && styles.scopeBtnTextActive]}>Nur für mich</Text>
            </TouchableOpacity>
            {teamId && (
              <TouchableOpacity 
                style={[styles.scopeBtn, scope === 'team' && styles.scopeBtnActive]}
                onPress={() => setScope('team')}
              >
                <Text style={[styles.scopeBtnText, scope === 'team' && styles.scopeBtnTextActive]}>Fürs ganze Team</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.label}>Signaturtext (Plain Text)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={contentText}
            onChangeText={setContentText}
            placeholder="Mit freundlichen Grüßen..."
            multiline
            textAlignVertical="top"
          />

          <Button title="Speichern" onPress={handleSave} style={{ marginTop: Spacing.md }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Signaturen</Text>
        <TouchableOpacity onPress={handleNew} style={styles.addButton}>
          <Feather name="plus" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={signatures}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.sigCard}>
            <View style={styles.sigInfo}>
              <View style={styles.sigTitleRow}>
                <Text style={styles.sigName}>{item.name}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.scope === 'team' ? 'Team' : 'Privat'}</Text>
                </View>
              </View>
              <Text style={styles.sigPreview} numberOfLines={2}>{item.content_text}</Text>
            </View>
            <View style={styles.sigActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleEdit(item)}>
                <Feather name="edit-2" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item.id)}>
                <Feather name="trash-2" size={16} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Keine Signaturen vorhanden.</Text>}
        contentContainerStyle={{ padding: Spacing.md }}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: '#FFF',
  },
  title: {
    fontFamily: FontFamily,
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  addButton: {
    padding: Spacing.xs,
  },
  form: {
    padding: Spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: {
    height: 150,
  },
  scopeContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  scopeBtn: {
    flex: 1,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  scopeBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: '#F0F7FF',
  },
  scopeBtnText: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  scopeBtnTextActive: {
    color: Colors.primary,
  },
  sigCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  sigInfo: {
    flex: 1,
  },
  sigTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sigName: {
    fontWeight: '600',
    fontSize: 16,
    color: Colors.text,
    marginRight: Spacing.sm,
  },
  badge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  sigPreview: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sigActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconBtn: {
    padding: Spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: Spacing.xl,
  },
});
