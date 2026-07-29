import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { useSignatures, Signature } from '../../../hooks/useSignatures';
import { useInboxes } from '../../../hooks/useInboxes';
import { useTeams } from '../../../hooks/useTeams';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { UserEmailAssignments } from '../../../components/settings/UserEmailAssignments';

export default function SignaturesSettingsScreen() {
  const { user } = useAuthStore();
  const { signatures, refetch: refetchSignatures } = useSignatures();
  const { inboxes, refetch: refetchInboxes } = useInboxes();
  const { orgs, getSubTeams, teams: allHookTeams } = useTeams();

  const [selectedItem, setSelectedItem] = useState<'you' | 'org'>('you');
  const [orgTab, setOrgTab] = useState<'signatures' | 'assignments'>('signatures');

  const personalSignatures = signatures.filter(s => s.scope === 'private');

  const allTeams = React.useMemo(() => {
    const result: { id: string; name: string; parent_id: string | null }[] = [];
    for (const org of orgs) {
      result.push({ id: org.id, name: org.name, parent_id: null });
      const subs = getSubTeams(org.id);
      for (const sub of subs) {
        result.push({ id: sub.id, name: sub.name, parent_id: sub.parent_id });
      }
    }
    // Add orphans (teams without an org)
    for (const t of allHookTeams) {
      if (!result.find(r => r.id === t.id)) {
        result.push({ id: t.id, name: t.name, parent_id: t.parent_id });
      }
    }
    return result;
  }, [orgs, allHookTeams, getSubTeams]);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedTeamId && allTeams.length > 0) {
      setSelectedTeamId(allTeams[0].id);
    }
  }, [allTeams, selectedTeamId]);

  const selectedTeam = allTeams.find(t => t.id === selectedTeamId);
  // For orgs, show signatures of all sub-teams too
  const orgSignatures = React.useMemo(() => {
    if (!selectedTeam) return [];
    if (selectedTeam.parent_id) {
      return signatures.filter(s => s.scope === 'team' && s.team_id === selectedTeamId);
    }
    // Org selected – include sub-team signatures
    const teamIds = [selectedTeam.id, ...getSubTeams(selectedTeam.id).map(s => s.id)];
    return signatures.filter(s => s.scope === 'team' && s.team_id && teamIds.includes(s.team_id));
  }, [signatures, selectedTeam, selectedTeamId, getSubTeams]);

  interface InboxAlias {
    id: string;
    inbox_id: string;
    email_address: string;
    name: string | null;
    signature_id: string | null;
  }
  const [aliases, setAliases] = useState<InboxAlias[]>([]);

  const fetchAliases = async () => {
    const { data } = await supabase.from('inbox_aliases').select('id, inbox_id, email_address, name, signature_id');
    if (data) setAliases(data);
  };

  useEffect(() => { fetchAliases(); }, []);

  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);
  
  // Set default selection
  useEffect(() => {
    if (!selectedSignatureId && signatures.length > 0) {
      setSelectedSignatureId(signatures[0].id);
    }
  }, [signatures, selectedSignatureId]);

  const activeSignature = signatures.find(s => s.id === selectedSignatureId);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalTab, setModalTab] = useState<'signature' | 'aliases'>('signature');

  const [signatureTextState, setSignatureTextState] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedInboxes, setSelectedInboxes] = useState<Record<string, boolean>>({});
  const [selectedAliases, setSelectedAliases] = useState<Record<string, boolean>>({});

  // When modal opens, populate state
  const handleEdit = (sig: Signature) => {
    setSignatureName(sig.name);
    setSignatureTextState(sig.content_text);
    
    const relatedInboxes = inboxes.filter(i => i.signature_id === sig.id);
    const inboxMap: Record<string, boolean> = {};
    relatedInboxes.forEach(i => inboxMap[i.id] = true);
    setSelectedInboxes(inboxMap);

    const relatedAliases = aliases.filter(a => a.signature_id === sig.id);
    const aliasMap: Record<string, boolean> = {};
    relatedAliases.forEach(a => aliasMap[a.id] = true);
    setSelectedAliases(aliasMap);
    
    setIsModalVisible(true);
  };

  const handleToggleInbox = (inboxId: string) => {
    setSelectedInboxes(prev => ({ ...prev, [inboxId]: !prev[inboxId] }));
  };

  const handleToggleAlias = (aliasId: string) => {
    setSelectedAliases(prev => ({ ...prev, [aliasId]: !prev[aliasId] }));
  };

  const handleUpdateSignature = async () => {
    if (!activeSignature) return;
    setIsSubmitting(true);
    try {
      // 1. Update signature content
      const { error: sigError } = await supabase
        .from('signatures')
        .update({ name: signatureName, content_text: signatureTextState })
        .eq('id', activeSignature.id);
      if (sigError) throw sigError;

      // 2. Update inbox assignments
      const currentlyAssignedInboxes = inboxes.filter(i => i.signature_id === activeSignature.id);
      for (const inbox of currentlyAssignedInboxes) {
        if (!selectedInboxes[inbox.id]) {
          await supabase.from('inboxes').update({ signature_id: null }).eq('id', inbox.id);
        }
      }
      
      for (const [inboxId, isChecked] of Object.entries(selectedInboxes)) {
        if (isChecked) {
          await supabase.from('inboxes').update({ signature_id: activeSignature.id }).eq('id', inboxId);
        }
      }

      // 3. Update alias assignments
      const currentlyAssignedAliases = aliases.filter(a => a.signature_id === activeSignature.id);
      for (const alias of currentlyAssignedAliases) {
        if (!selectedAliases[alias.id]) {
          await supabase.from('inbox_aliases').update({ signature_id: null }).eq('id', alias.id);
        }
      }

      for (const [aliasId, isChecked] of Object.entries(selectedAliases)) {
        if (isChecked) {
          await supabase.from('inbox_aliases').update({ signature_id: activeSignature.id }).eq('id', aliasId);
        }
      }

      Alert.alert('Erfolg', 'Signatur wurde aktualisiert.');
      setIsModalVisible(false);
      refetchSignatures();
      refetchInboxes();
      fetchAliases();
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSignature = async (scope: 'private' | 'team') => {
    try {
      const teamId = scope === 'team' && selectedTeamId ? selectedTeamId : null;
      if (scope === 'team' && !teamId) {
        Alert.alert('Fehler', 'Kein Team gefunden. Bitte zuerst einem Team beitreten.');
        return;
      }
      const { data, error } = await supabase.from('signatures').insert([{
        owner_id: scope === 'private' ? user?.id : null,
        team_id: teamId,
        scope,
        name: scope === 'private' ? 'Neue Persönliche Signatur' : 'Neue Team Signatur',
        content_text: 'Ihre Signatur hier...'
      }]).select().single();
      
      if (error) throw error;
      setSelectedSignatureId(data.id);
      refetchSignatures();
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    }
  };

  const handleDeleteSignature = async (id: string) => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Willst du diese Signatur wirklich löschen?')
      : await new Promise(resolve => Alert.alert('Löschen bestätigen', 'Willst du diese Signatur wirklich löschen?', [
          { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Löschen', style: 'destructive', onPress: () => resolve(true) },
        ]));
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('signatures').delete().eq('id', id);
      if (error) throw error;
      refetchSignatures();
      refetchInboxes();
      fetchAliases();
      if (selectedSignatureId === id) setSelectedSignatureId(null);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Modal Overlay */}
      {isModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Sidebar */}
            <View style={styles.modalSidebar}>
              <View style={styles.modalSidebarHeader}>
                <Text style={styles.modalSidebarTitle}>{selectedItem === 'you' ? 'Signatur bearbeiten' : 'Geteilte Signatur bearbeiten'}</Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalSidebarNav}>
                <TouchableOpacity 
                  style={[styles.modalSidebarNavItem, modalTab === 'signature' && styles.modalSidebarNavItemActive]}
                  onPress={() => setModalTab('signature')}
                >
                  <Text style={[styles.modalSidebarNavText, modalTab === 'signature' && styles.modalSidebarNavTextActive]}>Signatur</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalSidebarNavItem, modalTab === 'aliases' && styles.modalSidebarNavItemActive]}
                  onPress={() => setModalTab('aliases')}
                >
                  <Text style={[styles.modalSidebarNavText, modalTab === 'aliases' && styles.modalSidebarNavTextActive]}>Auf Aliasse anwenden</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Modal Content */}
            <View style={styles.modalMain}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.headerAvatar, { backgroundColor: selectedItem === 'you' ? '#00B388' : '#F06A6A', width: 40, height: 40, borderRadius: 20 }]}>
                    <Text style={[styles.headerAvatarText, { fontSize: 16 }]}>{selectedItem === 'you' ? ((user?.user_metadata?.display_name || user?.email || 'DU').substring(0,2).toUpperCase()) : (selectedTeam?.name?.substring(0,2).toUpperCase() || 'OR')}</Text>
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>{selectedItem === 'you' ? 'Du' : (selectedTeam?.name || 'Organisation')}</Text>
                    <Text style={styles.modalSubtitle}>{selectedItem === 'you' ? 'Persönliche Signatur bearbeiten' : 'Geteilte Signatur bearbeiten'}</Text>
                  </View>
                </View>
              </View>

              {modalTab === 'signature' ? (
                <View style={styles.modalBody}>
                  <Text style={styles.modalLabel}>Beschreibung</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    value={signatureName}
                    onChangeText={setSignatureName}
                  />
                  <Text style={[styles.modalLabel, { marginTop: Spacing.xl }]}>Inhalt</Text>
                  
                  <View style={styles.textAreaContainer}>
                    <TextInput 
                      style={styles.textAreaText} 
                      multiline 
                      value={signatureTextState}
                      onChangeText={setSignatureTextState}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.modalBody}>
                  <View style={styles.infoBoxTop}>
                    <Text style={styles.infoIconBox}>❔</Text>
                    <Text style={styles.infoText}>Wähle die E-Mail-Adressen aus, für die diese Signatur verwendet werden soll.</Text>
                  </View>

                  <ScrollView>
                    {inboxes.map(inbox => {
                      const inboxAliases = aliases.filter(a => a.inbox_id === inbox.id);
                      const isMainChecked = !!selectedInboxes[inbox.id];
                      return (
                        <View key={inbox.id} style={{ marginBottom: Spacing.sm }}>
                          <TouchableOpacity 
                            style={[styles.tableRow, { backgroundColor: Colors.surfaceHover }]}
                            onPress={() => handleToggleInbox(inbox.id)}
                          >
                            <Text style={[styles.tableCellText, { flex: 2, fontWeight: 'bold' }]} numberOfLines={1}>{inbox.email_address}</Text>
                            <Text style={[styles.tableCellText, { flex: 3 }]} numberOfLines={1}>{inbox.name} ({inbox.type})</Text>
                            <View style={{ width: 80, alignItems: 'center' }}>
                              {isMainChecked ? (
                                <View style={styles.checkboxChecked}>
                                  <Text style={styles.checkmark}>✓</Text>
                                </View>
                              ) : (
                                <View style={styles.checkboxUnchecked} />
                              )}
                            </View>
                          </TouchableOpacity>
                          {inboxAliases.map(alias => {
                            const isAliasChecked = !!selectedAliases[alias.id];
                            return (
                              <TouchableOpacity 
                                key={alias.id} 
                                style={[styles.tableRow, { paddingLeft: Spacing.xl }]}
                                onPress={() => handleToggleAlias(alias.id)}
                              >
                                <Text style={[styles.tableCellText, { flex: 2 }]} numberOfLines={1}>{alias.email_address}</Text>
                                <Text style={[styles.tableCellText, { flex: 3, color: Colors.textSecondary }]} numberOfLines={1}>{alias.name || 'Alias'}</Text>
                                <View style={{ width: 80, alignItems: 'center' }}>
                                  {isAliasChecked ? (
                                    <View style={styles.checkboxChecked}>
                                      <Text style={styles.checkmark}>✓</Text>
                                    </View>
                                  ) : (
                                    <View style={styles.checkboxUnchecked} />
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      );
                    })}
                    
                    {inboxes.length === 0 && (
                      <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                        <Text style={{ color: Colors.textTertiary, fontFamily: FontFamily }}>Keine E-Mail-Adressen vorhanden.</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setIsModalVisible(false)}>
                  <Text style={styles.modalButtonSecondaryText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleUpdateSignature} disabled={isSubmitting}>
                  <Text style={styles.modalButtonPrimaryText}>{isSubmitting ? '...' : 'Aktualisieren'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarContent}>
          <View style={styles.searchWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput 
              style={styles.searchInput} 
              placeholder="Signaturen suchen..." 
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          
          <Text style={styles.sidebarSectionTitle}>Persönliche Signaturen</Text>
          <TouchableOpacity 
            style={[styles.sidebarItem, selectedItem === 'you' && styles.sidebarItemActive]}
            onPress={() => setSelectedItem('you')}
          >
            <View style={[styles.userAvatar, { backgroundColor: '#00B388' }]}>
              <Text style={styles.userAvatarText}>{(user?.user_metadata?.display_name || user?.email || 'UN').substring(0,2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={[styles.sidebarItemTitle, selectedItem === 'you' && styles.sidebarItemTitleActive]}>Du</Text>
              <Text style={[styles.sidebarItemSubtitle, selectedItem === 'you' && styles.sidebarItemSubtitleActive]}>{personalSignatures.length} Signaturen</Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.sidebarSectionTitle, { marginTop: Spacing.md }]}>Organisations-Signaturen</Text>
          {orgs.map((org) => {
            const orgSigs = signatures.filter(s => s.scope === 'team' && s.team_id === org.id);
            const subs = getSubTeams(org.id);
            const isOrgSelected = selectedItem === 'org' && selectedTeamId === org.id;
            return (
              <View key={org.id}>
                <TouchableOpacity 
                  style={[styles.sidebarItem, isOrgSelected && styles.sidebarItemActive]}
                  onPress={() => { setSelectedItem('org'); setSelectedTeamId(org.id); }}
                >
                  <View style={styles.orgAvatar}>
                    <Text style={styles.orgAvatarText}>{org.name.substring(0,2).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={[styles.sidebarItemTitle, isOrgSelected && styles.sidebarItemTitleActive]}>{org.name}</Text>
                    <Text style={[styles.sidebarItemSubtitle, isOrgSelected && styles.sidebarItemSubtitleActive]}>{orgSigs.length} Signaturen</Text>
                  </View>
                </TouchableOpacity>
                {subs.map(sub => {
                  const subSigs = signatures.filter(s => s.scope === 'team' && s.team_id === sub.id);
                  const isSubSelected = selectedItem === 'org' && selectedTeamId === sub.id;
                  return (
                    <TouchableOpacity 
                      key={sub.id}
                      style={[styles.sidebarItem, styles.subTeamItem, isSubSelected && styles.sidebarItemActive]}
                      onPress={() => { setSelectedItem('org'); setSelectedTeamId(sub.id); }}
                    >
                      <View style={[styles.orgAvatar, { width: 20, height: 20, marginLeft: Spacing.sm }]}>
                        <Text style={[styles.orgAvatarText, { fontSize: 10 }]}>{sub.name.substring(0,2).toUpperCase()}</Text>
                      </View>
                      <View>
                        <Text style={[styles.sidebarItemTitle, isSubSelected && styles.sidebarItemTitleActive]}>{sub.name}</Text>
                        <Text style={[styles.sidebarItemSubtitle, isSubSelected && styles.sidebarItemSubtitleActive]}>{subSigs.length} Signaturen</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
          {orgs.length === 0 && (
            <Text style={[styles.sidebarItemSubtitle, { marginHorizontal: Spacing.sm, marginTop: Spacing.xs }]}>Keine Organisationen</Text>
          )}
        </View>

        <View style={styles.sidebarFooterWrapper}>
          <TouchableOpacity style={styles.sidebarFooter} onPress={() => handleCreateSignature(selectedItem === 'you' ? 'private' : 'team')}>
            <Text style={styles.sidebarFooterText}>Signatur erstellen</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <View style={styles.mainHeader}>
          <View style={styles.headerTitleRow}>
            {selectedItem === 'you' ? (
              <View style={[styles.headerAvatar, { backgroundColor: '#00B388' }]}>
                <Text style={styles.headerAvatarText}>{(user?.user_metadata?.display_name || user?.email || 'DU').substring(0,2).toUpperCase()}</Text>
              </View>
            ) : (
              <View style={[styles.headerAvatar, { backgroundColor: '#F06A6A' }]}>
                <Text style={styles.headerAvatarText}>{(selectedTeam?.name || 'OR').substring(0,2).toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={styles.mainHeaderTitle}>{selectedItem === 'you' ? 'Du' : (selectedTeam?.name || 'Organisation')}</Text>
              <Text style={styles.mainHeaderSubtitle}>Signaturen</Text>
            </View>
          </View>
        </View>
        
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {selectedItem === 'org' && (
            <View style={styles.orgTabBar}>
              <TouchableOpacity
                style={[styles.orgTab, orgTab === 'signatures' && styles.orgTabActive]}
                onPress={() => setOrgTab('signatures')}
              >
                <Text style={[styles.orgTabText, orgTab === 'signatures' && styles.orgTabTextActive]}>Signaturen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.orgTab, orgTab === 'assignments' && styles.orgTabActive]}
                onPress={() => setOrgTab('assignments')}
              >
                <Text style={[styles.orgTabText, orgTab === 'assignments' && styles.orgTabTextActive]}>Nutzer zuweisen</Text>
              </TouchableOpacity>
            </View>
          )}

          {(selectedItem === 'you' || orgTab === 'signatures') && (
            <>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>Wiederverwendbare Signaturen</Text>
              <Text style={styles.questionIcon}>❔</Text>
            </View>
            <TouchableOpacity style={styles.addButtonSecondary} onPress={() => handleCreateSignature(selectedItem === 'you' ? 'private' : 'team')}>
              <Text style={styles.addButtonSecondaryText}>⊕ Signatur erstellen</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderText}>Name</Text>
            </View>

            {(selectedItem === 'you' ? personalSignatures : orgSignatures).map(sig => {
              const sigInboxes = inboxes.filter(i => i.signature_id === sig.id);
              const sigAliases = aliases.filter(a => a.signature_id === sig.id);
              const totalAssigned = sigInboxes.length + sigAliases.length;
              return (
                <React.Fragment key={sig.id}>
                  <View style={styles.tableRowActions}>
                    <Text style={styles.tableCellText}>{sig.name}</Text>
                    <View style={styles.rowActions}>
                      <TouchableOpacity onPress={() => handleEdit(sig)}>
                        <Text style={styles.actionTextBlue}>Bearbeiten</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteSignature(sig.id)}>
                        <Text style={styles.actionTextRed}>Löschen</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {totalAssigned > 0 && (
                    <View style={styles.expandedContent}>
                      <Text style={styles.expandedLabel}>E-Mail-Adressen mit dieser Signatur:</Text>
                      {sigInboxes.map(inbox => (
                        <View key={inbox.id} style={styles.aliasPillRow}>
                          <View style={styles.emailAvatarSmall}>
                            <Text style={styles.emailAvatarTextSmall}>{inbox.name.substring(0, 2).toUpperCase()}</Text>
                          </View>
                          <Text style={styles.aliasPillTextSecondary}>{inbox.name} &lt;{inbox.email_address}&gt;</Text>
                        </View>
                      ))}
                      {sigAliases.map(alias => (
                        <View key={alias.id} style={styles.aliasPillRow}>
                          <View style={styles.emailAvatarSmall}>
                            <Text style={styles.emailAvatarTextSmall}>{(alias.name || alias.email_address).substring(0, 2).toUpperCase()}</Text>
                          </View>
                          <Text style={styles.aliasPillTextSecondary}>{alias.name || alias.email_address} &lt;{alias.email_address}&gt;</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </React.Fragment>
              );
            })}
            
            {(selectedItem === 'you' ? personalSignatures : orgSignatures).length === 0 && (
              <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                <Text style={{ color: Colors.textTertiary, fontFamily: FontFamily }}>Keine Signaturen vorhanden.</Text>
              </View>
            )}

          </View>
            </>
          )}

          {selectedItem === 'org' && orgTab === 'assignments' && selectedTeamId && (
            <UserEmailAssignments teamId={selectedTeamId} />
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  sidebar: {
    width: 260,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  sidebarContent: {
    flex: 1,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    margin: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  sidebarSectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
  },
  sidebarItemActive: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
    backgroundColor: Colors.info,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  userAvatarText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    fontWeight: 'bold',
  },
  orgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F06A6A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  orgAvatarText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    fontWeight: 'bold',
  },
  sidebarItemTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  sidebarItemSubtitle: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  sidebarItemTitleActive: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: '#FFF',
  },
  sidebarItemSubtitleActive: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  sidebarFooterWrapper: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sidebarFooter: {
    padding: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  sidebarFooterText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
  },
  main: {
    flex: 1,
  },
  mainHeader: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  headerAvatarText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: 'bold',
  },
  mainHeaderTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  mainHeaderSubtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.text,
  },
  questionIcon: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm,
  },
  addButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFE0FF',
  },
  addButtonSecondaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.info,
  },
  table: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceHover,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableHeaderText: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  tableRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tableCellText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  actionTextBlue: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
  },
  actionTextRed: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.error,
  },
  expandedContent: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
  },
  expandedLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  aliasPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceHover,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 6,
  },
  aliasPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aliasPillText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginRight: Spacing.sm,
  },
  aliasPillTextSecondary: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
    marginRight: Spacing.sm,
  },
  aliasPillCaret: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  emailAvatarSmall: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  emailAvatarTextSmall: {
    color: '#E3000F',
    fontFamily: FontFamily,
    fontSize: 8,
    fontWeight: 'bold',
  },
  
  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: 800,
    height: 600,
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalSidebar: {
    width: 200,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  modalSidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalSidebarTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.text,
  },
  closeIcon: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  modalSidebarNav: {
    paddingTop: Spacing.sm,
  },
  modalSidebarNavItem: {
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
    marginBottom: 4,
  },
  modalSidebarNavItemActive: {
    backgroundColor: Colors.info,
  },
  modalSidebarNavText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  modalSidebarNavTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  modalMain: {
    flex: 1,
    backgroundColor: Colors.surface,
    justifyContent: 'space-between',
  },
  modalHeader: {
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalSubtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalBody: {
    flex: 1,
    padding: Spacing.xl,
  },
  modalLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.sm,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  textAreaContainer: {
    flex: 1,
    minHeight: 200,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.md,
  },
  textAreaText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 22,
    minHeight: 180,
    width: '100%',
  },
  infoBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  infoIconBox: {
    fontSize: FontSize.md,
    marginRight: Spacing.sm,
    color: Colors.info,
  },
  infoText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  checkboxChecked: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: Colors.info,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxUnchecked: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
  },
  modalButtonSecondary: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginRight: Spacing.md,
  },
  modalButtonSecondaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.error, // Red for cancel as per screenshot
  },
  modalButtonPrimary: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: 6,
  },
  modalButtonPrimaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  orgTabBar: {
    flexDirection: 'row',
    marginBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  orgTab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginRight: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  orgTabActive: {
    borderBottomColor: Colors.info,
  },
  orgTabText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  orgTabTextActive: {
    color: Colors.info,
    fontWeight: FontWeight.bold,
  },
  subTeamItem: {
    paddingLeft: Spacing.xl,
  },
});
