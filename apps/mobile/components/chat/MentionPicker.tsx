import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontFamily, BorderRadius, Shadows } from '../../lib/constants';
import { Avatar } from '../ui/Avatar';
import { useInboxStore } from '../../stores/inboxStore';

interface Profile {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface MentionPickerProps {
  query: string;
  onSelect: (user: Profile) => void;
  visible: boolean;
  inboxId: string;
}

export function MentionPicker({ query, onSelect, visible, inboxId }: MentionPickerProps) {
  const [users, setUsers] = useState<Profile[]>([]);

  useEffect(() => {
    if (visible) {
      fetchUsers();
    }
  }, [visible, query]);

  const fetchUsers = async () => {
    let q = supabase.from('profiles').select('*');
    
    // Filter by organization if the inbox belongs to one
    const inbox = useInboxStore.getState().getInboxById(inboxId);
    if (inbox?.team?.id) {
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', inbox.team.id);
        
      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        q = q.in('id', userIds);
      } else {
        // If team has no members (shouldn't happen), return empty
        setUsers([]);
        return;
      }
    }
    
    if (query) {
      q = q.or(`display_name.ilike.%${query}%,email.ilike.%${query}%`);
    }
    
    const { data } = await q.limit(5);
    setUsers(data || []);
  };

  if (!visible || users.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const name = item.display_name || 'Unbekannt';
          return (
            <TouchableOpacity 
              style={styles.row} 
              onPress={() => onSelect(item)}
            >
              <Avatar uri={item.avatar_url} name={name} size={24} />
              <Text style={styles.nameText}>{name}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: '100%',
    left: Spacing.sm,
    right: Spacing.sm,
    marginBottom: Spacing.xs,
    backgroundColor: '#FFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    maxHeight: 200,
    ...Shadows.subtle,
    zIndex: 1000,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  nameText: {
    fontFamily: FontFamily,
    fontSize: 14,
    color: Colors.text,
    marginLeft: Spacing.sm,
    fontWeight: '500',
  }
});
