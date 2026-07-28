import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import { useInboxes } from '../../hooks/useInboxes';
import { useSignatures, Signature } from '../../hooks/useSignatures';

interface TeamMember {
  id: string;
  email: string;
  display_name: string | null;
}

interface UserEmailSetting {
  id: string;
  user_id: string;
  inbox_id: string;
  signature_id: string | null;
  display_name: string | null;
  reply_to: string | null;
}

interface Props {
  teamId: string;
}

export function UserEmailAssignments({ teamId }: Props) {
  const { inboxes } = useInboxes();
  const { signatures } = useSignatures();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [settings, setSettings] = useState<UserEmailSetting[]>([]);
  const [aliases, setAliases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const teamInboxes = inboxes.filter(i => i.team?.id === teamId);
  const teamSignatures = signatures.filter(s => s.scope === 'team');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabaseClient = supabase;

    const [membersRes, settingsRes, aliasesRes] = await Promise.all([
      supabaseClient
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', teamId),
      supabaseClient
        .from('user_email_settings')
        .select('id, user_id, inbox_id, signature_id, display_name, reply_to')
        .in('inbox_id', teamInboxes.map(i => i.id)),
      supabaseClient
        .from('inbox_aliases')
        .select('id, inbox_id, email_address, name, user_id, signature_id')
        .in('inbox_id', teamInboxes.map(i => i.id)),
    ]);

    if (membersRes.data) {
      const userIds = membersRes.data.map(m => m.user_id);
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setMembers(
        membersRes.data
          .map(m => ({
            id: m.user_id,
            email: profileMap.get(m.user_id)?.email || 'unbekannt',
            display_name: profileMap.get(m.user_id)?.display_name || null,
            role: m.role,
          }))
          .filter(Boolean) as TeamMember[]
      );
    }

    if (settingsRes.data) {
      setSettings(settingsRes.data);
    }
    if (aliasesRes.data) {
      setAliases(aliasesRes.data);
    }

    setIsLoading(false);
  }, [teamId, teamInboxes.length]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdate = async (userId: string, inboxId: string, field: string, value: string | null) => {
    const existing = settings.find(s => s.user_id === userId && s.inbox_id === inboxId);

    if (existing) {
      const { error } = await supabase
        .from('user_email_settings')
        .update({ [field]: value })
        .eq('id', existing.id);
      if (error) {
        Alert.alert('Fehler', error.message);
        return;
      }
      setSettings(prev =>
        prev.map(s => s.id === existing.id ? { ...s, [field]: value } : s)
      );
    } else {
      const payload: any = { user_id: userId, inbox_id: inboxId };
      payload[field] = value;
      const { data, error } = await supabase
        .from('user_email_settings')
        .insert(payload)
        .select()
        .single();
      if (error) {
        Alert.alert('Fehler', error.message);
        return;
      }
      setSettings(prev => [...prev, data]);
    }
  };

  const handleAssignAlias = async (aliasId: string, userId: string | null) => {
    const { error } = await supabase
      .from('inbox_aliases')
      .update({ user_id: userId })
      .eq('id', aliasId);
    if (error) {
      Alert.alert('Fehler', error.message);
      return;
    }
    setAliases(prev => prev.map(a => a.id === aliasId ? { ...a, user_id: userId } : a));
  };

  const getSetting = (userId: string, inboxId: string) =>
    settings.find(s => s.user_id === userId && s.inbox_id === inboxId);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Lade Zuweisungen...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>❔</Text>
        <Text style={styles.infoText}>
          Weise jedem Team-Mitglied eine eigene Signatur und einen Anzeigenamen pro E-Mail-Adresse zu. Diese Einstellungen gelten nur für den jeweiligen Nutzer.
        </Text>
      </View>

      {teamInboxes.map(inbox => (
        <View key={inbox.id} style={styles.inboxSection}>
          <View style={styles.inboxHeader}>
            <View style={[styles.inboxAvatar, { backgroundColor: Colors.info }]}>
              <Text style={styles.inboxAvatarText}>{inbox.name.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.inboxName}>{inbox.email_address}</Text>
              <Text style={styles.inboxSubtext}>{inbox.name}</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Nutzer</Text>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Anzeigename</Text>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Signatur</Text>
            </View>

            {members.map(member => {
              const setting = getSetting(member.id, inbox.id);
              return (
                <View key={member.id} style={styles.tableRow}>
                  <Text style={[styles.tableCellText, { flex: 2 }]} numberOfLines={1}>
                    {member.display_name || member.email.split('@')[0]}
                  </Text>

                  <TextInput
                    style={[styles.cellInput, { flex: 2 }]}
                    placeholder="Name"
                    placeholderTextColor={Colors.textTertiary}
                    value={setting?.display_name || ''}
                    onChangeText={(text) => handleUpdate(member.id, inbox.id, 'display_name', text || null)}
                    onBlur={() => {}}
                  />

                  <View style={{ flex: 2 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {teamSignatures.map(sig => {
                        const isActive = setting?.signature_id === sig.id;
                        return (
                          <TouchableOpacity
                            key={sig.id}
                            style={[styles.sigChip, isActive && styles.sigChipActive]}
                            onPress={() => handleUpdate(member.id, inbox.id, 'signature_id', isActive ? null : sig.id)}
                          >
                            <Text style={[styles.sigChipText, isActive && styles.sigChipTextActive]} numberOfLines={1}>
                              {sig.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {teamSignatures.length === 0 && (
                        <Text style={styles.noSigsText}>Keine Team-Signaturen</Text>
                      )}
                    </ScrollView>
                  </View>
                </View>
              );
            })}

            {members.length === 0 && (
              <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                <Text style={{ color: Colors.textTertiary, fontFamily: FontFamily }}>Keine Team-Mitglieder gefunden.</Text>
              </View>
            )}
          </View>

          {(() => {
            const inboxAliases = aliases.filter(a => a.inbox_id === inbox.id);
            if (inboxAliases.length === 0) return null;
            return (
              <View style={[styles.inboxSection, { marginTop: Spacing.sm, marginBottom: 0 }]}>
                <Text style={[styles.inboxSubtext, { marginBottom: Spacing.sm, fontWeight: 'bold' }]}>Aliase</Text>
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, { flex: 2 }]}>Adresse</Text>
                    <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
                    <Text style={[styles.tableHeaderText, { flex: 2 }]}>Zugewiesener Nutzer</Text>
                  </View>
                  {inboxAliases.map(alias => (
                    <View key={alias.id} style={styles.tableRow}>
                      <Text style={[styles.tableCellText, { flex: 2 }]} numberOfLines={1}>{alias.email_address}</Text>
                      <Text style={[styles.tableCellText, { flex: 2 }]} numberOfLines={1}>{alias.name || '-'}</Text>
                      <View style={{ flex: 2 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {members.map(member => {
                            const isActive = alias.user_id === member.id;
                            return (
                              <TouchableOpacity
                                key={member.id}
                                style={[styles.sigChip, isActive && styles.sigChipActive]}
                                onPress={() => handleAssignAlias(alias.id, isActive ? null : member.id)}
                              >
                                <Text style={[styles.sigChipText, isActive && styles.sigChipTextActive]} numberOfLines={1}>
                                  {member.display_name || member.email.split('@')[0]}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}
        </View>
      ))}

      {teamInboxes.length === 0 && (
        <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
          <Text style={{ color: Colors.textTertiary, fontFamily: FontFamily }}>Keine E-Mail-Konten in diesem Team.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.xl, maxWidth: 900, alignSelf: 'center', width: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: Colors.textSecondary, fontFamily: FontFamily, fontSize: FontSize.sm },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.xl,
    backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  infoIcon: { fontSize: FontSize.md, marginRight: Spacing.sm, color: Colors.info },
  infoText: { flex: 1, fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  inboxSection: { marginBottom: Spacing.xl },
  inboxHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md,
  },
  inboxAvatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  inboxAvatarText: { color: '#FFF', fontFamily: FontFamily, fontSize: FontSize.xs, fontWeight: 'bold' },
  inboxName: { fontFamily: FontFamily, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  inboxSubtext: { fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  table: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row', padding: Spacing.sm, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tableHeaderText: {
    fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textSecondary,
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.sm,
    paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  tableCellText: {
    fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text,
  },
  cellInput: {
    fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4,
    marginHorizontal: 4,
  },
  sigChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: 12,
    backgroundColor: Colors.surfaceHover, borderWidth: 1, borderColor: Colors.border,
    marginRight: Spacing.xs,
  },
  sigChipActive: {
    backgroundColor: Colors.info, borderColor: Colors.info,
  },
  sigChipText: {
    fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.text,
  },
  sigChipTextActive: {
    color: '#FFF',
  },
  noSigsText: {
    fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textTertiary,
  },
});
