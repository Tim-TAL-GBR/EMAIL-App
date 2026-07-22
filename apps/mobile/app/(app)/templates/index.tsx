import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, BorderRadius, Shadows } from '../../../lib/constants';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TemplateModal } from '../../../components/template/TemplateModal';
import { supabase } from '../../../lib/supabase';

interface Template {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  scope: 'private' | 'team';
}

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const { data } = await supabase
      .from('templates')
      .select('*')
      .or(`owner_id.eq.${user.id},scope.eq.team`)
      .order('name');
    setTemplates((data as Template[]) ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleDelete = async (id: string) => {
    await supabase.from('templates').delete().eq('id', id);
    fetchTemplates();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={templates}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => { setEditing(item); setShowModal(true); }}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardScope}>{item.scope === 'team' ? 'Team' : 'Privat'}</Text>
            </View>
            {item.subject && <Text style={styles.cardSubject}>{item.subject}</Text>}
            <Text style={styles.cardPreview} numberOfLines={2}>{item.body}</Text>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
              <Text style={styles.deleteText}>Löschen</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState icon="" title="Keine Vorlagen" subtitle="Erstelle deine erste Antwortvorlage." />
          ) : null
        }
      />
      <View style={styles.fabContainer}>
        <Button title="+ Neue Vorlage" onPress={() => { setEditing(null); setShowModal(true); }} />
      </View>
      <TemplateModal
        visible={showModal}
        onClose={() => { setShowModal(false); setEditing(null); fetchTemplates(); }}
        template={editing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadows.subtle,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  cardName: { fontFamily: FontFamily, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  cardScope: { fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textTertiary, textTransform: 'uppercase' },
  cardSubject: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.primary, marginBottom: Spacing.xs },
  cardPreview: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  deleteButton: { marginTop: Spacing.md, alignSelf: 'flex-end' },
  deleteText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.error },
  fabContainer: { position: 'absolute', bottom: Spacing.xl, right: Spacing.xl },
});
