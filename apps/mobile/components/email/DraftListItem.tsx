import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, BorderRadius } from '../../lib/constants';
import { Draft } from '../../hooks/useDraft';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Feather } from '@expo/vector-icons';

interface DraftListItemProps {
  draft: Draft;
  onPress: () => void;
  onDelete?: () => void;
}

export function DraftListItem({ draft, onPress, onDelete }: DraftListItemProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.pressableArea} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.header}>
          <Text style={styles.recipient} numberOfLines={1}>
            Entwurf {draft.to_addresses && draft.to_addresses.length > 0 ? `an ${draft.to_addresses.join(', ')}` : '(Kein Empfänger)'}
          </Text>
        </View>
        <Text style={styles.subject} numberOfLines={1}>
          {draft.subject || '(Kein Betreff)'}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {draft.body_text || '(Kein Inhalt)'}
        </Text>
      </TouchableOpacity>
      <View style={styles.sidebar}>
        <Text style={styles.time}>
          {draft.updated_at ? formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true, locale: de }) : ''}
        </Text>
        {onDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="trash-2" size={14} color={Colors.error} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pressableArea: {
    flex: 1,
    padding: Spacing.md,
  },
  sidebar: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: Spacing.md,
    gap: Spacing.xs,
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
  deleteBtn: {
    padding: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
