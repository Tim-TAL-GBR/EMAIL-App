import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, BorderRadius } from '../../lib/constants';
import { Draft } from '../../hooks/useDraft';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface DraftListItemProps {
  draft: Draft;
  onPress: () => void;
}

export function DraftListItem({ draft, onPress }: DraftListItemProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.recipient} numberOfLines={1}>
            Entwurf {draft.to_addresses && draft.to_addresses.length > 0 ? `an ${draft.to_addresses.join(', ')}` : '(Kein Empfänger)'}
          </Text>
          <Text style={styles.time}>
            {draft.updated_at ? formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true, locale: de }) : ''}
          </Text>
        </View>
        <Text style={styles.subject} numberOfLines={1}>
          {draft.subject || '(Kein Betreff)'}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {draft.body_text || '(Kein Inhalt)'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  recipient: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  time: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  subject: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  preview: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
});
