import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { useSignatures, Signature } from '../../../hooks/useSignatures';
import { useInboxes } from '../../../hooks/useInboxes';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';

export default function SignaturesSettingsScreen() {
  const { user } = useAuthStore();
  const { signatures, refetch: refetchSignatures } = useSignatures();
  const { inboxes, refetch: refetchInboxes } = useInboxes();

  const [selectedItem, setSelectedItem] = useState<'you' | 'org'>('you');

  const personalSignatures = signatures.filter(s => s.scope === 'private');
  const orgSignatures = signatures.filter(s => s.scope === 'team');

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

  // When modal opens, populate state
  const handleEdit = (sig: Signature) => {
    setSignatureName(sig.name);
    setSignatureTextState(sig.content_text);
    
    const relatedInboxes = inboxes.filter(i => i.signature_id === sig.id);
    const inboxMap: Record<string, boolean> = {};
    relatedInboxes.forEach(i => inboxMap[i.id] = true);
    setSelectedInboxes(inboxMap);
    
    setIsModalVisible(true);
  };

  const handleToggleInbox = (inboxId: string) => {
    setSelectedInboxes(prev => ({ ...prev, [inboxId]: !prev[inboxId] }));
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

      // 2. Update aliases (inboxes)
      const currentlyAssigned = inboxes.filter(i => i.signature_id === activeSignature.id);
      for (const inbox of currentlyAssigned) {
        if (!selectedInboxes[inbox.id]) {
          await supabase.from('inboxes').update({ signature_id: null }).eq('id', inbox.id);
        }
      }
      
      for (const [inboxId, isChecked] of Object.entries(selectedInboxes)) {
        if (isChecked) {
          await supabase.from('inboxes').update({ signature_id: activeSignature.id }).eq('id', inboxId);
        }
      }

      Alert.alert('Erfolg', 'Signatur wurde aktualisiert.');
      setIsModalVisible(false);
      refetchSignatures();
      refetchInboxes();
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSignature = async (scope: 'private' | 'team') => {
    try {
      const { data, error } = await supabase.from('signatures').insert([{
        owner_id: scope === 'private' ? user?.id : null,
        team_id: null,
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
    Alert.alert('Löschen bestätigen', 'Willst du diese Signatur wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('signatures').delete().eq('id', id);
          refetchSignatures();
          if (selectedSignatureId === id) setSelectedSignatureId(null);
        } catch (e: any) {
          Alert.alert('Fehler', e.message);
        }
      }}
    ]);
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
                  {selectedItem === 'you' ? (
                    <View style={[styles.headerAvatar, { backgroundColor: '#00B388', width: 40, height: 40, borderRadius: 20 }]}>
                      <Text style={[styles.headerAvatarText, { fontSize: 16 }]}>TR</Text>
                    </View>
                  ) : (
                    <View style={[styles.headerAvatar, { backgroundColor: '#F06A6A', width: 40, height: 40, borderRadius: 20 }]}>
                      <Text style={[styles.headerAvatarText, { fontSize: 16 }]}>CC</Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.modalTitle}>{selectedItem === 'you' ? 'Du' : 'CF Celle GmbH'}</Text>
                    <Text style={styles.modalSubtitle}>{selectedItem === 'you' ? 'Persönliche Signatur bearbeiten' : 'Geteilte Signatur bearbeiten'}</Text>
                  </View>
                </View>
              </View>

              {modalTab === 'signature' ? (
                <View style={styles.modalBody}>
                  {selectedItem === 'you' ? (
                    <>
                      <Text style={styles.modalLabel}>Beschreibung</Text>
                      <TextInput 
                        style={styles.modalInput} 
                        value={signatureName}
                        onChangeText={setSignatureName}
                      />
                      <Text style={[styles.modalLabel, { marginTop: Spacing.xl }]}>Inhalt</Text>
                    </>
                  ) : (
                    <Text style={styles.modalLabel}>Signaturvorschau</Text>
                  )}
                  
                  <View style={styles.textAreaContainer}>
                    <ScrollView>
                      {selectedItem === 'you' ? (
                        <TextInput 
                          style={styles.textAreaText} 
                          multiline 
                          value={signatureTextState}
                          onChangeText={setSignatureTextState}
                        />
                      ) : (
                        <Text style={styles.textAreaText}>{signatureTextState}</Text>
                      )}
                    </ScrollView>
                  </View>
                </View>
              ) : (
                <View style={styles.modalBody}>
                  <View style={styles.infoBoxTop}>
                    <Text style={styles.infoIconBox}>❔</Text>
                    <Text style={styles.infoText}>Wähle die Aliasse aus, für die diese Signatur verwendet werden soll.</Text>
                  </View>

                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderText, { flex: 2 }]}>Aliasse</Text>
                      <Text style={[styles.tableHeaderText, { flex: 3 }]}>Typ</Text>
                      <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'center' }]}>Anwenden</Text>
                    </View>
                    
                    {inboxes.map(inbox => {
                      const isChecked = !!selectedInboxes[inbox.id];
                      return (
                        <TouchableOpacity 
                          key={inbox.id} 
                          style={styles.tableRow}
                          onPress={() => handleToggleInbox(inbox.id)}
                        >
                          <Text style={[styles.tableCellText, { flex: 2 }]} numberOfLines={1}>{inbox.email_address}</Text>
                          <Text style={[styles.tableCellText, { flex: 3 }]} numberOfLines={1}>{inbox.name} ({inbox.type})</Text>
                          <View style={{ width: 80, alignItems: 'center' }}>
                            {isChecked ? (
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
                    
                    {inboxes.length === 0 && (
                      <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                        <Text style={{ color: Colors.textTertiary, fontFamily: FontFamily }}>Keine Aliasse vorhanden.</Text>
                      </View>
                    )}
                  </View>
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
              <Text style={styles.userAvatarText}>{user?.email?.substring(0,2).toUpperCase() || 'TR'}</Text>
            </View>
            <View>
              <Text style={[styles.sidebarItemTitle, selectedItem === 'you' && styles.sidebarItemTitleActive]}>Du</Text>
              <Text style={[styles.sidebarItemSubtitle, selectedItem === 'you' && styles.sidebarItemSubtitleActive]}>{personalSignatures.length} Signaturen</Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.sidebarSectionTitle, { marginTop: Spacing.md }]}>Organisations-Signaturen</Text>
          <TouchableOpacity 
            style={[styles.sidebarItem, selectedItem === 'org' && styles.sidebarItemActive]}
            onPress={() => setSelectedItem('org')}
          >
            <View style={styles.orgAvatar}>
              <Text style={styles.orgAvatarText}>OR</Text>
            </View>
            <View>
              <Text style={[styles.sidebarItemTitle, selectedItem === 'org' && styles.sidebarItemTitleActive]}>Team Signaturen</Text>
              <Text style={[styles.sidebarItemSubtitle, selectedItem === 'org' && styles.sidebarItemSubtitleActive]}>{orgSignatures.length} Signaturen</Text>
            </View>
          </TouchableOpacity>
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
                <Text style={styles.headerAvatarText}>{user?.email?.substring(0,2).toUpperCase() || 'TR'}</Text>
              </View>
            ) : (
              <View style={[styles.headerAvatar, { backgroundColor: '#F06A6A' }]}>
                <Text style={styles.headerAvatarText}>OR</Text>
              </View>
            )}
            <View>
              <Text style={styles.mainHeaderTitle}>{selectedItem === 'you' ? 'Du' : 'Team Signaturen'}</Text>
              <Text style={styles.mainHeaderSubtitle}>Signaturen</Text>
            </View>
          </View>
        </View>
        
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
                  {sigInboxes.length > 0 && (
                    <View style={styles.expandedContent}>
                      <Text style={styles.expandedLabel}>Aliasse, die diese Signatur verwenden:</Text>
                      {sigInboxes.map(inbox => (
                        <View key={inbox.id} style={styles.aliasPillRow}>
                          <View style={styles.emailAvatarSmall}>
                            <Text style={styles.emailAvatarTextSmall}>{inbox.name.substring(0, 2).toUpperCase()}</Text>
                          </View>
                          <Text style={styles.aliasPillTextSecondary}>{inbox.name} &lt;{inbox.email_address}&gt;</Text>
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
});
