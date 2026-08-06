import React, { useState } from 'react';
import { useLabels } from '../../../hooks/useLabels';
import { useEmailLabels } from '../../../hooks/useEmailLabels';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, useWindowDimensions } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { useInboxes } from '../../../hooks/useInboxes';

export default function LabelsSettingsScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { inboxes } = useInboxes();
  const teamName = React.useMemo(() => {
    const teams = new Map<string, string>();
    inboxes.forEach(i => { if (i.team?.name && !teams.has(i.team.id)) teams.set(i.team.id, i.team.name); });
    return teams.values().next().value || 'Organisation';
  }, [inboxes]);

  const [selectedItem, setSelectedItem] = useState<string>('org');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#00B388');
  const [isCreating, setIsCreating] = useState(false);

  const activeEmailInboxId = React.useMemo(() => {
    if (selectedItem.startsWith('email_')) return selectedItem.replace('email_', '');
    return null;
  }, [selectedItem]);

  const { folders: emailLabels, createFolder, deleteFolder, isLoading: emailLabelsLoading } = useEmailLabels(activeEmailInboxId);

  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      await createFolder(newFolderName.trim());
      setShowCreateFolderModal(false);
      setNewFolderName('');
    } catch (e) {
      // Error handled in hook
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleDeleteFolder = (folderPath: string, name: string) => {
    Alert.alert('Ordner löschen', `Möchten Sie den E-Mail-Ordner "${name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => deleteFolder(folderPath) }
    ]);
  };

  const teamId = React.useMemo(() => {
    for (const i of inboxes) {
      if (i.team?.id) return i.team.id;
    }
    return null;
  }, [inboxes]);

  const { labels: orgLabels, fetchLabels, createLabel, deleteLabel } = useLabels(teamId);
  React.useEffect(() => { fetchLabels(); }, [fetchLabels]);

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    setIsCreating(true);
    try {
      await createLabel(newLabelName.trim(), newLabelColor);
      setShowCreateModal(false);
      setNewLabelName('');
      setNewLabelColor('#00B388');
    } catch (e) {
      // Error handled in hook
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteLabel = (id: string, name: string) => {
    Alert.alert('Label löschen', `Möchten Sie das Label "${name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => deleteLabel(id) }
    ]);
  };

  const renderOrgContent = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.infoBox}>
        <Text style={styles.infoIconBox}>❔</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoText}>
            Organisations-Labels sind exklusiv für Missive und werden nicht mit einem E-Mail-Konto synchronisiert. Sie können auf E-Mails, Chats, SMS-Unterhaltungen usw. angewendet werden.
          </Text>
          <TouchableOpacity style={{ marginTop: Spacing.sm }}>
            <Text style={styles.linkTextBlue}>Mehr erfahren</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Organisations-Labels</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.headerIconButton}>
            <Text style={styles.headerIconButtonText}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButtonSecondary} onPress={() => setShowCreateModal(true)}>
            <Text style={styles.addButtonSecondaryText}>⊕ Label erstellen</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
          <Text style={[styles.tableHeaderText, { width: 100, textAlign: 'right' }]}>Geteilt mit</Text>
          <Text style={[styles.tableHeaderText, { width: 40 }]}></Text>
        </View>
        
        {orgLabels.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: Colors.textTertiary }}>Keine Labels vorhanden</Text>
          </View>
        ) : (
          orgLabels.map(label => (
            <View key={label.id} style={styles.tableRow}>
              <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.tagIcon, { color: label.color || '#666' }]}>🏷</Text>
                <Text style={styles.tableCellText}>{label.name}</Text>
              </View>
              <View style={{ width: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
              </View>
              <View style={{ width: 40, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => handleDeleteLabel(label.id, label.name)}>
                  <Text style={styles.moreIcon}>⋯</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderEmailContent = () => {
    const activeInbox = inboxes.find(i => `email_${i.id}` === selectedItem) || inboxes[0];
    return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.infoBox}>
        <Text style={styles.infoIconBox}>❔</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoText}>
            Diese E-Mail-Labels werden mit dem <Text style={{fontWeight: 'bold'}}>{activeInbox?.email_address}</Text> E-Mail-Konto synchronisiert. Sie werden mit allen geteilt, die Zugriff auf dieses Konto haben.
          </Text>
          <TouchableOpacity style={{ marginTop: Spacing.sm }}>
            <Text style={styles.linkTextBlue}>Mehr erfahren</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>E-Mail-Labels</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.headerIconButton}>
            <Text style={styles.headerIconButtonText}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButtonSecondary} onPress={() => setShowCreateFolderModal(true)}>
            <Text style={styles.addButtonSecondaryText}>⊕ Label erstellen</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Name</Text>
        </View>
        
        {emailLabelsLoading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : emailLabels.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: Colors.textTertiary }}>Keine Ordner gefunden</Text>
          </View>
        ) : (
          emailLabels.map((folder) => (
            <View key={folder.path} style={styles.tableRow}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.tagIcon, { color: Colors.textTertiary }]}>{folder.specialUse ? '📁' : '🏷'}</Text>
                <Text style={styles.tableCellText}>{folder.name}</Text>
              </View>
              <View style={{ width: 40, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => handleDeleteFolder(folder.path, folder.name)}>
                  <Text style={styles.moreIcon}>⋯</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
    );
  };

  return (
    <View style={[styles.container, isMobile && { flexDirection: 'column' }]}>
      {/* Sidebar */}
      <View style={[styles.sidebar, isMobile && { width: '100%', borderRightWidth: 0 }]}>
        <ScrollView style={styles.sidebarContent}>
          <View style={styles.searchWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput 
              style={styles.searchInput} 
              placeholder="Labels suchen..." 
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          
          <Text style={styles.sidebarSectionTitle}>E-Mail-Konten</Text>
          {inboxes.map((inbox) => {
            const isSelected = selectedItem === `email_${inbox.id}`;
            const abbr = inbox.name ? inbox.name.substring(0, 2).toUpperCase() : inbox.email_address.substring(0, 2).toUpperCase();
            
            return (
              <TouchableOpacity 
                key={inbox.id}
                style={[styles.sidebarItem, isSelected && styles.sidebarItemActive]}
                onPress={() => setSelectedItem(`email_${inbox.id}`)}
              >
                <View style={styles.emailAvatar}>
                  <Text style={styles.emailAvatarText}>{abbr}</Text>
                </View>
                <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                  <Text style={[styles.sidebarItemTitle, isSelected && styles.sidebarItemTitleActive]} numberOfLines={1}>{inbox.email_address}</Text>
                  <Text style={[styles.sidebarItemSubtitle, isSelected && styles.sidebarItemSubtitleActive]}>Labels verwalten</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <Text style={[styles.sidebarSectionTitle, { marginTop: Spacing.md }]}>Organisationen</Text>
          <TouchableOpacity 
            style={[styles.sidebarItem, selectedItem === 'org' && styles.sidebarItemActive]}
            onPress={() => setSelectedItem('org')}
          >
            <View style={styles.orgAvatar}>
              <Text style={styles.orgAvatarText}>{teamName.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={[styles.sidebarItemTitle, selectedItem === 'org' && styles.sidebarItemTitleActive]}>{teamName}</Text>
              <Text style={[styles.sidebarItemSubtitle, selectedItem === 'org' && styles.sidebarItemSubtitleActive]}>{orgLabels.length} labels</Text>
            </View>
          </TouchableOpacity>

        </ScrollView>
        <TouchableOpacity style={styles.sidebarFooter} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.sidebarFooterText}>Label erstellen</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <View style={styles.mainHeader}>
          <View style={styles.headerTitleRow}>
            {selectedItem === 'org' ? (
              <>
                <View style={styles.headerAvatar}>
                  <Text style={styles.headerAvatarText}>{teamName.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.mainHeaderTitle}>{teamName}</Text>
                  <Text style={styles.mainHeaderSubtitle}>Labels</Text>
                </View>
              </>
            ) : (
              (() => {
                const activeInbox = inboxes.find(i => `email_${i.id}` === selectedItem) || inboxes[0];
                const abbr = activeInbox?.name ? activeInbox.name.substring(0, 2).toUpperCase() : (activeInbox?.email_address.substring(0, 2).toUpperCase() || 'EM');
                return (
                <>
                  <View style={[styles.headerAvatar, { backgroundColor: '#FFF', borderWidth: 1, borderColor: Colors.border }]}>
                    <Text style={[styles.headerAvatarText, { color: Colors.primary }]}>{abbr}</Text>
                  </View>
                  <View>
                    <Text style={styles.mainHeaderTitle}>{activeInbox?.email_address || 'E-Mail Konto'}</Text>
                    <Text style={styles.mainHeaderSubtitle}>Konto Labels</Text>
                  </View>
                </>
                );
              })()
            )}
          </View>
        </View>
        
        {selectedItem === 'org' ? renderOrgContent() : renderEmailContent()}
      </View>

      {/* Create Label Modal */}
      <Modal visible={showCreateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Neues Label erstellen</Text>
            
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newLabelName}
              onChangeText={setNewLabelName}
              placeholder="z.B. Wichtig"
              autoFocus
            />

            <Text style={styles.modalLabel}>Farbe</Text>
            <View style={styles.colorPicker}>
              {['#00B388', '#1E90FF', '#7B68EE', '#F06A6A', '#FFA500', '#808080'].map(color => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorOption, { backgroundColor: color }, newLabelColor === color && styles.colorOptionSelected]}
                  onPress={() => setNewLabelColor(color)}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalCancelBtnText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSubmitBtn, (!newLabelName.trim() || isCreating) && { opacity: 0.5 }]} onPress={handleCreateLabel} disabled={!newLabelName.trim() || isCreating}>
                {isCreating ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Erstellen</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Create Email Folder Modal */}
      <Modal visible={showCreateFolderModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Neuen IMAP-Ordner erstellen</Text>
            
            <Text style={styles.modalLabel}>Ordnername</Text>
            <TextInput
              style={styles.modalInput}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="z.B. Projekte"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCreateFolderModal(false)}>
                <Text style={styles.modalCancelBtnText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSubmitBtn, (!newFolderName.trim() || isCreatingFolder) && { opacity: 0.5 }]} onPress={handleCreateFolder} disabled={!newFolderName.trim() || isCreatingFolder}>
                {isCreatingFolder ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Erstellen</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.xl,
    width: 400,
    maxWidth: '90%',
  },
  modalTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  modalLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  colorPicker: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  modalCancelBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  modalCancelBtnText: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  modalSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: 8,
  },
  modalSubmitBtnText: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#FFF',
  },
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
    fontWeight: 'bold',
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
  },
  sidebarItemActive: {
    backgroundColor: Colors.info,
  },
  emailAvatar: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  emailAvatarText: {
    color: Colors.primary,
    fontFamily: FontFamily,
    fontSize: 10,
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
  sidebarItemTitleActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  sidebarItemSubtitle: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  sidebarItemSubtitleActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  sidebarFooter: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  sidebarFooterText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
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
    backgroundColor: '#F06A6A',
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
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#BFE0FF',
    borderRadius: 8,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
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
  linkTextBlue: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
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
  headerIconButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  headerIconButtonText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
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
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tagIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  tableCellText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  moreIcon: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  userAvatarText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: 10,
    fontWeight: 'bold',
  },
});
