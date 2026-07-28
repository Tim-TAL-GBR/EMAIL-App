import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal } from 'react-native';
import { Colors, Spacing, BorderRadius, FontFamily, FontSize, FontWeight } from '../../lib/constants';
import { Avatar } from '../ui/Avatar';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Feather } from '@expo/vector-icons';

interface TeamMember {
  user_id: string;
  role: string;
  profile: {
    id: string;
    display_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface EmailAssignmentProps {
  emailId: string;
  inboxId: string;
  currentAssignee?: { id: string; name: string } | null;
  onAssign: (userId: string) => Promise<void>;
  onUnassign: () => Promise<void>;
  externalVisible?: boolean;
  onCloseExternal?: () => void;
}

export function EmailAssignment({ emailId, inboxId, currentAssignee, onAssign, onUnassign, externalVisible, onCloseExternal }: EmailAssignmentProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (externalVisible !== undefined) {
      setShowPicker(externalVisible);
    }
  }, [externalVisible]);

  useEffect(() => {
    if (!showPicker) return;
    loadMembers();
  }, [showPicker]);

  const loadMembers = async () => {
    setIsLoading(true);
    const { data: memberData, error } = await supabase
      .from('inbox_members')
      .select('user_id, role')
      .eq('inbox_id', inboxId);
      
    if (error || !memberData) {
      setIsLoading(false);
      return;
    }

    const userIds = memberData.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url')
      .in('id', userIds);

    const merged = memberData.map(m => {
      const p = profiles?.find(prof => prof.id === m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        profile: p ? {
          id: p.id,
          display_name: p.display_name,
          email: p.email,
          avatar_url: p.avatar_url
        } : { id: m.user_id, display_name: null, email: 'Unbekannt', avatar_url: null }
      };
    });

    setMembers(merged as any);
    setIsLoading(false);
  };

  const handleSelect = async (userId: string) => {
    setShowPicker(false);
    onCloseExternal?.();
    await onAssign(userId);
  };

  const handleUnassign = async () => {
    setShowPicker(false);
    onCloseExternal?.();
    await onUnassign();
  };

  const closePicker = () => {
    setShowPicker(false);
    onCloseExternal?.();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.assigneeRow} onPress={() => setShowPicker(true)}>
        {currentAssignee ? (
          <>
            <Avatar name={currentAssignee.name} size={16} />
            <Text style={styles.assigneeName} numberOfLines={1}>{currentAssignee.name}</Text>
          </>
        ) : (
          <>
            <Feather name="user" size={12} color={Colors.textSecondary} />
            <Text style={styles.unassigned}>Nicht zugewiesen</Text>
          </>
        )}
        <Feather name="chevron-down" size={12} color={Colors.textSecondary} style={{ marginLeft: 2 }} />
      </TouchableOpacity>

      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet" transparent onRequestClose={closePicker}>
        <View style={styles.overlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Zuweisen an</Text>
              <TouchableOpacity onPress={closePicker}>
                <Text style={styles.closeText}>Fertig</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={members}
              keyExtractor={item => item.user_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.memberRow}
                  onPress={() => handleSelect(item.user_id)}
                >
                  <Avatar name={item.profile.display_name || 'Unbekannt'} size={36} />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{item.profile.display_name || 'Unbekannt'}</Text>
                    <Text style={styles.memberRole}>{item.role}</Text>
                  </View>
                  {item.user_id === currentAssignee?.id && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                isLoading ? <Text style={styles.loadingText}>Lade...</Text> : null
              }
            />
            {currentAssignee && (
              <TouchableOpacity style={styles.unassignButton} onPress={handleUnassign}>
                <Text style={styles.unassignText}>Zuweisung aufheben</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: Spacing.sm,
    gap: 4,
  },
  assigneeName: {
    fontFamily: FontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: 2,
    maxWidth: 100,
  },
  unassigned: {
    fontFamily: FontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  changeText: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '60%',
    paddingBottom: Spacing.xl,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  closeText: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  memberInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  memberName: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  memberRole: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'capitalize',
  },
  checkMark: {
    fontSize: FontSize.lg,
    color: Colors.primary,
  },
  loadingText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    padding: Spacing.xl,
  },
  unassignButton: {
    padding: Spacing.lg,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  unassignText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.error,
  },
});
