import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../../lib/constants';
import { useInboxes } from '../../../../hooks/useInboxes';
import { supabase } from '../../../../lib/supabase';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function AccountsSettingsScreen() {
  const { inboxes, isLoading, refetch } = useInboxes();
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'Konto' | 'Postfächer' | 'Zugangsdaten' | 'Mitglieder'>('Konto');
  const [editingAlias, setEditingAlias] = useState(false);

  // Modal for new Inbox
  const [isAddingInbox, setIsAddingInbox] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newInboxEmail, setNewInboxEmail] = useState('');
  const [newInboxName, setNewInboxName] = useState('');
  const [newInboxType, setNewInboxType] = useState<'private' | 'shared'>('private');
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Credentials state
  const [imapHost, setImapHost] = useState('');
  const [imapUser, setImapUser] = useState('');
  const [imapPass, setImapPass] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [imapSecure, setImapSecure] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpSecure, setSmtpSecure] = useState(true);

  // Mailbox folders
  const [folderArchive, setFolderArchive] = useState('');
  const [folderSent, setFolderSent] = useState('');
  const [folderTrash, setFolderTrash] = useState('');
  const [folderSpam, setFolderSpam] = useState('');
  const [folderDrafts, setFolderDrafts] = useState('');
  const [folderInbox, setFolderInbox] = useState('');
  const [isSavingFolders, setIsSavingFolders] = useState(false);

  // IMAP Folders Modal State
  const [imapFolders, setImapFolders] = useState<{path: string, name: string, specialUse?: string}[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [folderSelectModalOpen, setFolderSelectModalOpen] = useState(false);
  const [folderSelectTarget, setFolderSelectTarget] = useState<'folderArchive' | 'folderSent' | 'folderTrash' | 'folderSpam' | 'folderDrafts' | 'folderInbox' | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);


  const [isSavingCreds, setIsSavingCreds] = useState(false);

  // Account Settings state
  const [accountName, setAccountName] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSharingModalOpen, setIsSharingModalOpen] = useState(false);
  const [shareTargetTeamId, setShareTargetTeamId] = useState<string | null>(null);
  const [isSubmittingShare, setIsSubmittingShare] = useState(false);
  const [aliases, setAliases] = useState<any[]>([]);
  const [isFetchingAliases, setIsFetchingAliases] = useState(false);
  const [isAddingAlias, setIsAddingAlias] = useState(false);
  const [newAliasEmail, setNewAliasEmail] = useState('');
  const [newAliasName, setNewAliasName] = useState('');
  const [newAliasUserId, setNewAliasUserId] = useState<string | null>(null);
  const [isSubmittingAlias, setIsSubmittingAlias] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveDate, setArchiveDate] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Members modal
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'member'>('member');
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);

  // Group inboxes
  const personalInboxes = inboxes.filter(i => i.type === 'private');
  const sharedInboxes = inboxes.filter(i => i.type === 'shared');

  const account = React.useMemo(() => inboxes.find(i => i.id === activeAccountId), [inboxes, activeAccountId]);
  const isShared = account?.type === 'shared';
  
  // Set default active if none selected
  React.useEffect(() => {
    if (inboxes.length > 0 && !activeAccountId) {
      setActiveAccountId(inboxes[0].id);
    }
  }, [inboxes, activeAccountId]);

  React.useEffect(() => {
    if ((isAddingInbox || isSharingModalOpen) && teams.length === 0) {
      supabase.from('teams').select('*').then(({ data }) => {
        if (data) {
          setTeams(data);
          if (data.length > 0) {
            setSelectedTeamId(data[0].id);
            setShareTargetTeamId(data[0].id);
          }
        }
      });
    }
  }, [isAddingInbox, isSharingModalOpen]);

  React.useEffect(() => {
    if (account) {
      setImapHost(account.imap_host || '');
      setImapUser(account.imap_user || account.email_address || '');
      setImapPass(account.imap_pass || '');
      setImapPort(account.imap_port?.toString() || '993');
      setImapSecure(account.imap_secure !== false);
      setSmtpHost(account.smtp_host || '');
      setSmtpUser(account.smtp_user || account.email_address || '');
      setSmtpPass(account.smtp_pass || '');
      setSmtpPort(account.smtp_port?.toString() || '465');
      setSmtpSecure(account.smtp_secure !== false);
      
      setAccountName(account.name || '');

      setFolderArchive(account.folder_archive || '');
      setFolderSent(account.folder_sent || '');
      setFolderTrash(account.folder_trash || '');
      setFolderSpam(account.folder_spam || '');
      setFolderDrafts(account.folder_drafts || '');
      setFolderInbox(account.folder_inbox || '');
    }
  }, [account]);

  const fetchImapFolders = async () => {
    if (!account) return;
    setIsLoadingFolders(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/inboxes/${account.id}/folders`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Fehler beim Laden');
      setImapFolders(json.folders || []);
      setFolderError(null);
    } catch (e: any) {
      console.warn("Error fetching folders", e);
      setFolderError(e.message || "Unbekannter Fehler");
    } finally {
      setIsLoadingFolders(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'Postfächer' && imapFolders.length === 0) {
      fetchImapFolders();
    }
  }, [account, activeTab]);

  const fetchAliases = async () => {
    if (!account) return;
    setIsFetchingAliases(true);
    try {
      const { data, error } = await supabase
        .from('inbox_aliases')
        .select('*, profiles:user_id(id, email, display_name)')
        .eq('inbox_id', account.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setAliases(data || []);
    } catch (e) {
      console.error('Error fetching aliases:', e);
    } finally {
      setIsFetchingAliases(false);
    }
  };

  React.useEffect(() => {
    fetchAliases();
  }, [account]);

  const handlePickAvatar = async () => {
    if (!account) return;
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploadingAvatar(true);
        const asset = result.assets[0];
        
        // Upload base64 image to Supabase Storage
        const fileExt = asset.uri.split('.').pop() || 'jpg';
        const fileName = `${account.id}-${Date.now()}.${fileExt}`;
        const filePath = `inboxes/${fileName}`;
        
        // Convert base64 to buffer for upload
        const base64Data = asset.base64!;
        // The React Native environment requires we use base64 upload or fetch blob
        // Using decode function
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decodeURIComponent(escape(atob(base64Data))), {
            contentType: `image/${fileExt}`,
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from('inboxes')
          .update({ avatar_url: publicUrl })
          .eq('id', account.id);

        if (updateError) throw updateError;
        
        Alert.alert('Erfolg', 'Profilbild erfolgreich aktualisiert');
        refetch();
      }
    } catch (e: any) {
      Alert.alert('Fehler', 'Fehler beim Hochladen: ' + (e.message || 'Unbekannt'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleShareAccount = async () => {
    if (!account || !shareTargetTeamId) return;
    setIsSubmittingShare(true);
    try {
      const authData = await supabase.auth.getUser();
      const userId = authData.data.user?.id;
      if (!userId) throw new Error('Nicht eingeloggt');

      // Update type to shared, set team_id
      const { error: updateError } = await supabase.from('inboxes').update({
        type: 'shared',
        team_id: shareTargetTeamId
      }).eq('id', account.id);

      if (updateError) throw updateError;

      // Make sure the current owner is still an admin of the shared inbox
      const { error: memberError } = await supabase.from('inbox_members').insert([{
        inbox_id: account.id,
        user_id: userId,
        role: 'admin'
      }]);
      
      if (memberError && memberError.code !== '23505') { // Ignore unique constraint if already member
        console.error('Member error:', memberError);
      }

      setIsSharingModalOpen(false);
      Alert.alert('Erfolg', 'Das Konto wurde freigegeben!');
      refetch();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Freigabe fehlgeschlagen');
    } finally {
      setIsSubmittingShare(false);
    }
  };

  const handleAddAlias = async () => {
    if (!account || !newAliasEmail.trim()) return;
    setIsSubmittingAlias(true);
    try {
      const { error } = await supabase.from('inbox_aliases').insert([{
        inbox_id: account.id,
        email_address: newAliasEmail.trim().toLowerCase(),
        name: newAliasName.trim() || account.name || '',
        user_id: newAliasUserId || null,
      }]);
      if (error) throw error;
      
      Alert.alert('Erfolg', 'Alias wurde erfolgreich hinzugefügt!');
      setNewAliasEmail('');
      setNewAliasName('');
      setNewAliasUserId(null);
      setIsAddingAlias(false);
      fetchAliases();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Konnte Alias nicht hinzufügen');
    } finally {
      setIsSubmittingAlias(false);
    }
  };

  const handleArchiveBulk = async () => {
    if (!account || !archiveDate) return;
    setIsArchiving(true);
    try {
      // Basic date validation
      if (isNaN(Date.parse(archiveDate))) {
        throw new Error('Ungültiges Datum. Bitte YYYY-MM-DD verwenden.');
      }
      const backendUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'https://mail.tim-regener.com';
      const response = await fetch(`${backendUrl}/api/inboxes/${account.id}/archive-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ beforeDate: archiveDate })
      });
      if (!response.ok) throw new Error('Fehler bei der Archivierung');
      const data = await response.json();
      Alert.alert('Erfolg', `${data.count} E-Mails wurden archiviert.`);
      setIsArchiveModalOpen(false);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setIsSavingCreds(false);
    }
  };

  const handleUpdateFolders = async () => {
    if (!account) return;
    setIsSavingFolders(true);
    try {
      const { error } = await supabase.from('inboxes').update({
        folder_archive: folderArchive.trim() || null,
        folder_sent: folderSent.trim() || null,
        folder_trash: folderTrash.trim() || null,
        folder_spam: folderSpam.trim() || null,
        folder_drafts: folderDrafts.trim() || null,
        folder_inbox: folderInbox.trim() || null,
      }).eq('id', account.id);
      
      if (error) throw error;
      Alert.alert('Erfolg', 'Postfachverhalten erfolgreich gespeichert!');
      refetch();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Fehler', error.message || 'Konnte Postfachverhalten nicht speichern');
    } finally {
      setIsSavingFolders(false);
    }
  };


  const handleSaveAccount = async () => {
    if (!account) return;
    setIsSavingAccount(true);
    try {
      const { error } = await supabase.from('inboxes').update({
        name: accountName,
      }).eq('id', account.id);
      
      if (error) throw error;
      Alert.alert('Erfolg', 'Kontoeinstellungen wurden gespeichert!');
      setEditingAlias(false); // Close alias modal if open
      refetch();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!account) return;
    setIsSavingCreds(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht eingeloggt');

      const backendUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/inboxes/${account.id}/credentials`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          imapHost,
          imapUser,
          imapPass,
          imapPort: parseInt(imapPort, 10) || 993,
          imapSecure,
          smtpHost,
          smtpUser,
          smtpPass,
          smtpPort: parseInt(smtpPort, 10) || 465,
          smtpSecure,
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler beim Speichern');

      // Trigger IMAP reconnect on backend
      await fetch(`${backendUrl}/api/inboxes/${account.id}/reconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      Alert.alert('Erfolg', 'Zugangsdaten wurden gespeichert!');
      refetch();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen');
    } finally {
      setIsSavingCreds(false);
    }
  };

  const setSyncSinceAndReconnect = async (days: number) => {
    if (!account) return;
    try {
      let sync_since = null;
      if (days > 0) {
        const d = new Date();
        d.setDate(d.getDate() - days);
        sync_since = d.toISOString();
      }

      const { error } = await supabase
        .from('inboxes')
        .update({ sync_since })
        .eq('id', account.id);

      if (error) throw error;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Use EXPO_PUBLIC_SERVER_URL or fallback to localhost
        const backendUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
        fetch(`${backendUrl}/api/inboxes/${account.id}/reconnect`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }).catch(e => console.log('Reconnect fetch error:', e));
      }

      Alert.alert('Import gestartet', 'Der E-Mail-Verlauf wird nun im Hintergrund importiert. Dies kann einige Minuten dauern.');
      refetch();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Import fehlgeschlagen');
    }
  };

  const handleAddMember = async () => {
    if (!account || !newMemberEmail.trim()) return;
    setIsSubmittingMember(true);
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_SERVER_URL}/api/inboxes/${account.id}/members/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ email: newMemberEmail, role: newMemberRole })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler beim Einladen');

      Alert.alert('Erfolg', 'Mitglied eingeladen!');
      setNewMemberEmail('');
      setNewMemberRole('member');
      setIsAddingMember(false);
      refetch();
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setIsSubmittingMember(false);
    }
  };

  const handleChangeMemberRole = async (memberId: string, role: string) => {
    if (!account) return;
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_SERVER_URL}/api/inboxes/${account.id}/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ role })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler beim Ändern der Rolle');
      refetch();
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!account) return;
    Alert.alert('Entfernen', 'Soll dieses Mitglied wirklich entfernt werden?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: async () => {
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_SERVER_URL}/api/inboxes/${account.id}/members/${memberId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            }
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Fehler beim Entfernen');
          refetch();
        } catch (e: any) {
          Alert.alert('Fehler', e.message);
        }
      }}
    ]);
  };

  const handleAddInbox = async () => {
    if (!newInboxEmail.trim() || !newInboxName.trim()) return;
    setIsSubmitting(true);
    setAddError(null);
    try {
      const authData = await supabase.auth.getUser();
      const userId = authData.data.user?.id;
      if (!userId) throw new Error('Nicht eingeloggt');

      let currentTeamId = selectedTeamId;
      if (!currentTeamId) {
        // Fallback: Create a personal team if the user has none
        const newTeamId = generateUUID();
        const { error: teamError } = await supabase.from('teams').insert([{
          id: newTeamId,
          name: 'Personal Team',
          slug: `personal-${userId}-${Date.now()}`
        }]);
        if (teamError) throw teamError;
        
        await supabase.from('team_members').insert([{
          team_id: newTeamId,
          user_id: userId,
          role: 'admin'
        }]);
        currentTeamId = newTeamId;
        setSelectedTeamId(currentTeamId);
      }

      const insertData = {
        name: newInboxName.trim(),
        email_address: newInboxEmail.trim().toLowerCase(),
        type: newInboxType,
        team_id: currentTeamId,
        owner_id: newInboxType === 'private' ? userId : null,
      };

      const { data, error } = await supabase.from('inboxes').insert([insertData]).select().single();
      if (error) throw error;
      
      // Auto-add to inbox_members if shared
      if (newInboxType === 'shared') {
        await supabase.from('inbox_members').insert([{
          inbox_id: data.id,
          user_id: userId,
          role: 'admin'
        }]);
      }

      setIsAddingInbox(false);
      setNewInboxEmail('');
      setNewInboxName('');
      refetch();
      setActiveAccountId(data.id);
      Alert.alert('Erfolg', 'Konto wurde erfolgreich hinzugefügt!');
    } catch (error: any) {
      console.error(error);
      setAddError(error.message || 'Konnte Konto nicht hinzufügen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderShareModal = () => (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContainer, { width: 400, height: 300, flexDirection: 'column' }]}>
        <View style={styles.modalSidebarHeader}>
          <Text style={styles.modalSidebarTitle}>Konto freigeben</Text>
          <TouchableOpacity onPress={() => setIsSharingModalOpen(false)}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ padding: Spacing.xl }}>
          <Text style={styles.description}>
            Wenn du dieses Konto freigibst, wird es in ein geteiltes Postfach umgewandelt. 
            Bitte wähle die Organisation, der dieses Konto zugewiesen werden soll:
          </Text>
          
          <View style={{ marginTop: Spacing.lg, marginBottom: Spacing.xl }}>
            <Text style={styles.settingLabel}>Organisation wählen</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: Spacing.xs }}>
              {teams.map(team => (
                <TouchableOpacity 
                  key={team.id}
                  style={[styles.buttonSecondary, { marginRight: Spacing.sm }, shareTargetTeamId === team.id && { borderColor: Colors.info, backgroundColor: Colors.info + '10' }]}
                  onPress={() => setShareTargetTeamId(team.id)}
                >
                  <Text style={[styles.buttonSecondaryText, shareTargetTeamId === team.id && { color: Colors.info }]}>{team.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity 
            style={[styles.buttonPrimary, { alignSelf: 'flex-start' }, isSubmittingShare && { opacity: 0.7 }]}
            onPress={handleShareAccount}
            disabled={isSubmittingShare}
          >
            {isSubmittingShare ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={styles.buttonPrimaryText}>Konto freigeben</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );

  const renderAddAliasModal = () => (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContainer, { width: 500, height: 350, flexDirection: 'column' }]}>
        <View style={styles.modalSidebarHeader}>
          <Text style={styles.modalSidebarTitle}>Alias hinzufügen</Text>
          <TouchableOpacity onPress={() => setIsAddingAlias(false)}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ padding: Spacing.xl }}>
          <Text style={styles.description}>Füge eine E-Mail-Adresse hinzu, über die du mit diesem Konto senden und empfangen möchtest.</Text>
          
          <Text style={[styles.settingLabel, { marginTop: Spacing.lg }]}>Name / Bezeichnung</Text>
          <TextInput 
            style={[styles.input, { marginBottom: Spacing.md }]} 
            placeholder="z.B. Newsletter Empfang" 
            value={newAliasName}
            onChangeText={setNewAliasName}
          />

          <Text style={styles.settingLabel}>E-Mail Adresse</Text>
          <TextInput 
            style={[styles.input, { marginBottom: Spacing.xl }]} 
            placeholder="alias@domain.de" 
            keyboardType="email-address"
            autoCapitalize="none"
            value={newAliasEmail}
            onChangeText={setNewAliasEmail}
          />

          {teamMembers.length > 0 && (
            <>
              <Text style={styles.settingLabel}>Zugewiesener Nutzer (optional)</Text>
              <View style={{ marginBottom: Spacing.xl }}>
                <TouchableOpacity
                  style={[styles.input, { padding: Spacing.sm, marginBottom: Spacing.xs }]}
                  onPress={() => setNewAliasUserId(null)}
                >
                  <Text style={{ color: !newAliasUserId ? Colors.info : Colors.text, fontFamily: FontFamily, fontSize: FontSize.sm }}>
                    Kein Nutzer zugewiesen
                  </Text>
                </TouchableOpacity>
                {teamMembers.map((m: any) => (
                  <TouchableOpacity
                    key={m.user_id || m.id}
                    style={[styles.input, { padding: Spacing.sm, marginBottom: Spacing.xs, borderColor: newAliasUserId === (m.user_id || m.id) ? Colors.info : Colors.border }]}
                    onPress={() => setNewAliasUserId(m.user_id || m.id)}
                  >
                    <Text style={{ color: newAliasUserId === (m.user_id || m.id) ? Colors.info : Colors.text, fontFamily: FontFamily, fontSize: FontSize.sm }}>
                      {m.display_name || 'Unbekannt'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity 
            style={[styles.buttonPrimary, { alignSelf: 'flex-start' }, isSubmittingAlias && { opacity: 0.7 }]}
            onPress={handleAddAlias}
            disabled={isSubmittingAlias}
          >
            {isSubmittingAlias ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={styles.buttonPrimaryText}>Speichern</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );

  const renderAddMemberModal = () => (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContainer, { width: 400, height: 350, flexDirection: 'column' }]}>
        <View style={styles.modalSidebarHeader}>
          <Text style={styles.modalSidebarTitle}>Mitglied einladen</Text>
          <TouchableOpacity onPress={() => setIsAddingMember(false)}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ padding: Spacing.xl }}>
          <Text style={styles.settingLabel}>E-Mail Adresse</Text>
          <TextInput 
            style={[styles.input, { marginBottom: Spacing.xl }]} 
            placeholder="kollege@domain.de" 
            keyboardType="email-address"
            autoCapitalize="none"
            value={newMemberEmail}
            onChangeText={setNewMemberEmail}
          />
          
          <Text style={styles.settingLabel}>Rolle</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl }}>
            <TouchableOpacity 
              style={[styles.buttonSecondary, newMemberRole === 'member' && { borderColor: Colors.info, backgroundColor: Colors.info + '10' }]} 
              onPress={() => setNewMemberRole('member')}
            >
              <Text style={[styles.buttonSecondaryText, newMemberRole === 'member' && { color: Colors.info }]}>Mitglied</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.buttonSecondary, newMemberRole === 'admin' && { borderColor: Colors.info, backgroundColor: Colors.info + '10' }]} 
              onPress={() => setNewMemberRole('admin')}
            >
              <Text style={[styles.buttonSecondaryText, newMemberRole === 'admin' && { color: Colors.info }]}>Admin</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.buttonPrimary, { alignSelf: 'flex-start' }, isSubmittingMember && { opacity: 0.7 }]}
            onPress={handleAddMember}
            disabled={isSubmittingMember}
          >
            {isSubmittingMember ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={styles.buttonPrimaryText}>Einladen</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );

  const renderFolderSelectModal = () => (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContainer, { width: 400, height: 500, flexDirection: 'column' }]}>
        <View style={styles.modalSidebarHeader}>
          <Text style={styles.modalSidebarTitle}>Ordner auswählen</Text>
          <TouchableOpacity onPress={() => setFolderSelectModalOpen(false)}>
            <Text style={{ color: Colors.textSecondary, fontSize: FontSize.lg }}>×</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, padding: Spacing.md }}>
          {isLoadingFolders ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
          ) : folderError ? (
            <Text style={{ textAlign: 'center', color: Colors.error || 'red', marginTop: Spacing.xl }}>
              Fehler: {folderError}
            </Text>
          ) : imapFolders.length === 0 ? (
            <Text style={{ textAlign: 'center', color: Colors.textSecondary, marginTop: Spacing.xl }}>
              Keine Ordner gefunden oder IMAP-Zugangsdaten fehlen.
            </Text>
          ) : (
            imapFolders.map(folder => (
              <TouchableOpacity
                key={folder.path}
                style={{
                  padding: Spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.border,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}
                onPress={() => {
                  if (folderSelectTarget === 'folderArchive') setFolderArchive(folder.path);
                  if (folderSelectTarget === 'folderSent') setFolderSent(folder.path);
                  if (folderSelectTarget === 'folderTrash') setFolderTrash(folder.path);
                  if (folderSelectTarget === 'folderSpam') setFolderSpam(folder.path);
                  if (folderSelectTarget === 'folderDrafts') setFolderDrafts(folder.path);
                  if (folderSelectTarget === 'folderInbox') setFolderInbox(folder.path);
                  setFolderSelectModalOpen(false);
                }}
              >
                <Text style={{ fontFamily: FontFamily, fontSize: FontSize.md, color: Colors.text }}>
                  {folder.name || folder.path}
                </Text>
                {folder.specialUse && (
                  <Text style={{ fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textTertiary, marginLeft: Spacing.sm }}>
                    ({folder.specialUse})
                  </Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );

  const renderArchiveModal = () => (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContainer, { width: 400, height: 300, flexDirection: 'column' }]}>
        <View style={styles.modalSidebarHeader}>
          <Text style={styles.modalSidebarTitle}>Massenarchivierung</Text>
          <TouchableOpacity onPress={() => setIsArchiveModalOpen(false)}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ padding: Spacing.xl }}>
          <Text style={styles.description}>Alle E-Mails VOR diesem Datum werden archiviert (Status: done).</Text>
          
          <Text style={[styles.settingLabel, { marginTop: Spacing.lg }]}>Datum (YYYY-MM-DD)</Text>
          <TextInput 
            style={[styles.input, { marginBottom: Spacing.xl }]} 
            placeholder="2024-01-01" 
            value={archiveDate}
            onChangeText={setArchiveDate}
          />

          <TouchableOpacity 
            style={[styles.buttonPrimary, { alignSelf: 'flex-start' }, isArchiving && { opacity: 0.7 }]}
            onPress={handleArchiveBulk}
            disabled={isArchiving}
          >
            {isArchiving ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={styles.buttonPrimaryText}>Archivieren</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );

  const renderHistoryModal = () => (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContainer, { width: 350, height: 400, flexDirection: 'column' }]}>
        <View style={styles.modalSidebarHeader}>
          <Text style={styles.modalSidebarTitle}>E-Mail-Verlauf importieren</Text>
          <TouchableOpacity onPress={() => setIsHistoryModalOpen(false)}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ padding: Spacing.xl }}>
          <Text style={[styles.description, { marginBottom: Spacing.xl }]}>
            Wie weit in der Vergangenheit möchtest du E-Mails importieren?
          </Text>
          
          {[
            { label: '1 Monat', days: 30 },
            { label: '3 Monate', days: 90 },
            { label: '6 Monate', days: 180 },
            { label: '1 Jahr', days: 365 },
            { label: 'Alle', days: 0 }
          ].map(opt => (
            <TouchableOpacity 
              key={opt.label}
              style={[styles.buttonSecondary, { marginBottom: Spacing.sm, width: '100%', alignItems: 'center' }]}
              onPress={() => {
                setIsHistoryModalOpen(false);
                setSyncSinceAndReconnect(opt.days);
              }}
            >
              <Text style={styles.buttonSecondaryText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderAddInboxModal = () => (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContainer, { width: 500, height: 500, flexDirection: 'column' }]}>
        <View style={styles.modalSidebarHeader}>
          <Text style={styles.modalSidebarTitle}>Konto hinzufügen</Text>
          <TouchableOpacity onPress={() => setIsAddingInbox(false)}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ padding: Spacing.xl }}>
          <Text style={styles.settingLabel}>Konto-Art</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl }}>
            <TouchableOpacity 
              style={[styles.buttonSecondary, newInboxType === 'private' && { borderColor: Colors.info, backgroundColor: Colors.info + '10' }]} 
              onPress={() => setNewInboxType('private')}
            >
              <Text style={[styles.buttonSecondaryText, newInboxType === 'private' && { color: Colors.info }]}>Persönlich</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.buttonSecondary, newInboxType === 'shared' && { borderColor: Colors.info, backgroundColor: Colors.info + '10' }]} 
              onPress={() => setNewInboxType('shared')}
            >
              <Text style={[styles.buttonSecondaryText, newInboxType === 'shared' && { color: Colors.info }]}>Geteilt</Text>
            </TouchableOpacity>
          </View>

          {newInboxType === 'shared' && (
            <View style={{ marginBottom: Spacing.md }}>
              <Text style={styles.settingLabel}>Organisation</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: Spacing.xs }}>
                {teams.map(team => (
                  <TouchableOpacity 
                    key={team.id}
                    style={[styles.buttonSecondary, { marginRight: Spacing.sm }, selectedTeamId === team.id && { borderColor: Colors.info, backgroundColor: Colors.info + '10' }]}
                    onPress={() => setSelectedTeamId(team.id)}
                  >
                    <Text style={[styles.buttonSecondaryText, selectedTeamId === team.id && { color: Colors.info }]}>{team.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={styles.settingLabel}>Name / Beschreibung</Text>
          <TextInput 
            style={[styles.input, { marginBottom: Spacing.md }]} 
            placeholder="z.B. Support oder Arbeit" 
            value={newInboxName}
            onChangeText={setNewInboxName}
          />

          <Text style={styles.settingLabel}>E-Mail Adresse</Text>
          <TextInput 
            style={[styles.input, { marginBottom: Spacing.md }]} 
            placeholder="beispiel@domain.de" 
            keyboardType="email-address"
            autoCapitalize="none"
            value={newInboxEmail}
            onChangeText={setNewInboxEmail}
          />
          
          {addError && (
            <Text style={{ color: Colors.error, marginTop: Spacing.md, fontSize: FontSize.sm }}>
              {addError}
            </Text>
          )}
        </ScrollView>
        <View style={[styles.modalFooter, { borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.md, justifyContent: 'flex-end', flexDirection: 'row' }]}>
          <TouchableOpacity onPress={() => setIsAddingInbox(false)} style={{ marginRight: Spacing.xl, justifyContent: 'center' }}>
            <Text style={styles.dangerText}>Abbrechen</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.buttonPrimary, (!newInboxEmail || !newInboxName || isSubmitting) && { opacity: 0.5 }]}
            onPress={handleAddInbox}
            disabled={!newInboxEmail || !newInboxName || isSubmitting}
          >
            <Text style={styles.buttonPrimaryText}>{isSubmitting ? '...' : 'Hinzufügen'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderEditAliasModal = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        {/* Modal Sidebar */}
        <View style={styles.modalSidebar}>
          <View style={styles.modalSidebarHeader}>
            <Text style={styles.modalSidebarTitle}>Alias bearbeiten</Text>
            <TouchableOpacity onPress={() => setEditingAlias(false)}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            <TouchableOpacity 
              style={[styles.modalTab, true && styles.modalTabActive]}
              onPress={() => {}}
            >
              <Text style={[styles.modalTabText, true && styles.modalTabTextActive]}>Alias</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Modal Content */}
        <View style={styles.modalMain}>
          <View style={styles.modalMainHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.avatarMock, { marginRight: Spacing.md }]}><Text style={styles.avatarMockText}>{account?.name?.substring(0, 2).toUpperCase()}</Text></View>
              <View>
                <Text style={styles.mainHeaderTitle}>{account?.email_address}</Text>
                <Text style={styles.mainHeaderSubtitle}>{account?.type}</Text>
              </View>
            </View>
          </View>
          
          <ScrollView style={styles.scroll} contentContainerStyle={styles.modalContentPad}>
            <Text style={styles.sectionTitle}>Allgemein</Text>
            <View style={styles.card}>
              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Adresse</Text>
                <Text style={styles.settingSubLabel}>Du hast delegierten Zugriff, die Adresse kann nicht bearbeitet werden.</Text>
                <TextInput style={[styles.input, { backgroundColor: Colors.background }]} editable={false} value={account?.email_address} />
              </View>
              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Name</Text>
                <Text style={styles.settingSubLabel}>Der Name, der auf deinen gesendeten E-Mails erscheint.</Text>
                <TextInput style={styles.input} value={accountName} onChangeText={setAccountName} placeholder="Tim Regener" />
              </View>
              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Beschreibung</Text>
                <Text style={styles.settingSubLabel}>Unterscheide deine Aliase im Composer. Dies wird von den Empfängern nicht gesehen.</Text>
                <TextInput style={styles.input} placeholder='z.B. "Lange Signatur"' placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Optionen</Text>
            <View style={styles.card}>
              <View style={styles.settingRowModal}>
                <Text style={styles.settingLabel}>Diesen Alias im "Von"-Feld des Composers ausblenden</Text>
                <Switch trackColor={{ false: Colors.border, true: Colors.info }} thumbColor="#FFF" ios_backgroundColor={Colors.border} />
              </View>
              <View style={styles.settingRowModalBorderFree}>
                <Text style={styles.settingLabel}>Beim Antworten niemals automatisch als Absender auswählen</Text>
                <Switch trackColor={{ false: Colors.border, true: Colors.info }} thumbColor="#FFF" ios_backgroundColor={Colors.border} />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Auto Cc / Bcc</Text>
            <View style={styles.card}>
              <Text style={styles.settingSubLabel}>Füge beim Senden über diesen Alias automatisch Empfänger in die Felder Cc oder Bcc ein.</Text>
              <View style={{ marginTop: Spacing.md }}>
                <Text style={styles.settingLabel}>Cc</Text>
                <TextInput style={styles.input} />
              </View>
              <View style={{ marginTop: Spacing.md }}>
                <Text style={styles.settingLabel}>Bcc</Text>
                <TextInput style={styles.input} />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity onPress={() => setEditingAlias(false)}>
              <Text style={styles.dangerText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginLeft: Spacing.xl }} onPress={handleSaveAccount} disabled={isSavingAccount}>
              <Text style={[styles.linkText, { color: Colors.textTertiary }, isSavingAccount && { opacity: 0.5 }]}>
                {isSavingAccount ? "Speichert..." : "Aktualisieren"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  const handleDeleteAccount = async () => {
    if (!account) return;
    Alert.alert('Konto löschen', `Möchtest du das Konto ${account.email_address} wirklich löschen? Alle E-Mails werden ebenfalls gelöscht.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
          try {
            const backendUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(`${backendUrl}/api/inboxes/${account.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${session?.access_token}` },
            });
            const result = await response.json();
            if (!response.ok) {
              Alert.alert('Fehler', result.error || 'Löschen fehlgeschlagen');
              return;
            }
            Alert.alert('Erfolg', 'Konto gelöscht');
            const remaining = inboxes.filter(i => i.id !== account.id);
            if (remaining.length > 0) setActiveAccountId(remaining[0].id);
            else setActiveAccountId(null);
            refetch();
          } catch (e: any) {
            Alert.alert('Fehler', e.message || 'Löschen fehlgeschlagen');
          }
      }}
    ]);
  };

  const renderAccountTab = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Freigabe</Text>
      <View style={styles.card}>
        {!isShared ? (
          <View style={styles.flexRowBetween}>
            <Text style={styles.description}>Dieses Konto und seine Nachrichten sind privat für dich.</Text>
            <TouchableOpacity style={styles.buttonSecondary} onPress={() => setIsSharingModalOpen(true)}>
              <Text style={styles.buttonSecondaryText}>👥 Konto freigeben</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.description}>
              Geteilt mit <Text style={styles.bold}>{account?.team?.name}</Text>
            </Text>
            <Text style={styles.description}>Alle Teammitglieder können dieses Postfach einsehen.</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Allgemein</Text>
      <View style={styles.card}>
        <View style={styles.settingBlock}>
          <Text style={styles.settingLabel}>Kontobeschreibung</Text>
          <Text style={styles.settingSubLabel}>Wird in der Seitenleiste und in Menüs angezeigt</Text>
          <TextInput 
            style={styles.input} 
            placeholder="z.B. Arbeit" 
            placeholderTextColor={Colors.textTertiary}
            value={accountName}
            onChangeText={setAccountName}
          />
        </View>
        <View style={styles.settingBlock}>
          <Text style={styles.settingLabel}>Avatar</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xs }}>
            {account?.avatar_url ? (
              <Image source={{ uri: account.avatar_url }} style={{ width: 48, height: 48, borderRadius: 24 }} />
            ) : (
              <View style={[styles.avatarMock, { width: 48, height: 48, borderRadius: 24 }]}><Text style={styles.avatarMockText}>{account?.name?.substring(0, 2).toUpperCase()}</Text></View>
            )}
            <TouchableOpacity 
              style={styles.buttonSecondaryAvatar} 
              onPress={handlePickAvatar}
              disabled={isUploadingAvatar}
            >
              {isUploadingAvatar ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={styles.buttonSecondaryText}>Bild hochladen</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.buttonPrimary, { alignSelf: 'flex-start', marginTop: Spacing.md }, isSavingAccount && { opacity: 0.7 }]}
          onPress={handleSaveAccount}
          disabled={isSavingAccount}
        >
          {isSavingAccount ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <Text style={styles.buttonPrimaryText}>Änderungen speichern</Text>
          )}
        </TouchableOpacity>
      </View>

      {!isShared && (
        <>
          <Text style={styles.sectionTitle}>E-Mail-Verlauf</Text>
          <View style={styles.card}>
            <View style={[styles.flexRowBetween, { marginTop: Spacing.md }]}>
              <Text style={styles.settingLabel}>Letzte importieren:</Text>
              <TouchableOpacity onPress={() => setIsHistoryModalOpen(true)}>
                <Text style={[styles.settingValue, { color: Colors.primary }]}>Auswählen ↕</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      <View style={styles.flexRowBetween}>
        <View>
          <Text style={styles.sectionTitle}>Aliase</Text>
          <Text style={styles.settingSubLabel}>Name, Signatur, Auto Cc / Bcc</Text>
        </View>
        <TouchableOpacity onPress={async () => {
          if (account?.team?.id) {
            const { data: { session } } = await supabase.auth.getSession();
            const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'https://mail.tim-regener.com';
            const res = await fetch(`${API_URL}/api/teams/${account.team.id}/members`, {
              headers: { 'Authorization': `Bearer ${session?.access_token}` },
            });
            if (res.ok) {
              const members = await res.json();
              setTeamMembers(members || []);
            }
          }
          setIsAddingAlias(true);
        }}>
          <Text style={styles.linkText}>⊕ Alias hinzufügen</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 2 }]}>Adresse</Text>
          <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Zugewiesen</Text>
          <Text style={[styles.tableHeaderText, { width: 80 }]}></Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={[styles.tableCellText, { flex: 2 }]}>{account?.email_address}</Text>
          <Text style={[styles.tableCellText, { flex: 2 }]}>{account?.name}</Text>
          <Text style={[styles.tableCellText, { flex: 1 }]}></Text>
          <View style={{ width: 80, flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm }}>
            <TouchableOpacity onPress={() => setEditingAlias(true)}>
              <Text style={styles.linkText}>Bearbeiten</Text>
            </TouchableOpacity>
            {!isShared && (
              <TouchableOpacity onPress={() => Alert.alert('Fehler', 'Der Haupt-Alias des Kontos kann nicht gelöscht werden.')}>
                <Text style={styles.dangerText}>Löschen</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {isFetchingAliases ? (
          <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.md }} />
        ) : (
          aliases.map((alias) => (
            <View key={alias.id} style={styles.tableRow}>
              <Text style={[styles.tableCellText, { flex: 2 }]}>{alias.email_address}</Text>
              <Text style={[styles.tableCellText, { flex: 2 }]}>{alias.name}</Text>
              <Text style={[styles.tableCellText, { flex: 1 }]}>{alias.profiles?.display_name || '-'}</Text>
              <View style={{ width: 80, flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm }}>
                <TouchableOpacity onPress={async () => {
                  if (!alias.user_id) {
                    setNewAliasUserId(null);
                  } else {
                    setNewAliasUserId(alias.user_id);
                  }
                  setNewAliasEmail(alias.email_address);
                  setNewAliasName(alias.name || '');
                  if (account?.team?.id) {
                    const { data: { session } } = await supabase.auth.getSession();
                    const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'https://mail.tim-regener.com';
                    const res = await fetch(`${API_URL}/api/teams/${account.team.id}/members`, {
                      headers: { 'Authorization': `Bearer ${session?.access_token}` },
                    });
                    if (res.ok) {
                      const members = await res.json();
                      setTeamMembers(members || []);
                    }
                  }
                  Alert.alert(
                    'Alias bearbeiten',
                    `E-Mail: ${alias.email_address}\nAktueller Nutzer: ${alias.profiles?.display_name || 'Keiner'}`,
                    [
                      { text: 'Zuweisung entfernen', onPress: async () => {
                        const { error } = await supabase.from('inbox_aliases').update({ user_id: null }).eq('id', alias.id);
                        if (error) { Alert.alert('Fehler', error.message); return; }
                        fetchAliases();
                      }},
                      { text: 'Abbrechen', style: 'cancel' },
                    ]
                  );
                }}>
                  <Text style={styles.linkText}>Bearbeiten</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => {
                  try {
                    const { error } = await supabase.from('inbox_aliases').delete().eq('id', alias.id);
                    if (error) throw error;
                    fetchAliases();
                  } catch (e: any) {
                    Alert.alert('Fehler', e.message || 'Löschen fehlgeschlagen');
                  }
                }}>
                  <Text style={styles.dangerText}>Löschen</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Massenarchivierung</Text>
      <View style={styles.card}>
        <View style={styles.flexRowBetween}>
          <Text style={styles.description}>Wähle ein Datum, um ältere E-Mails im Eingang dieses Kontos massenhaft zu archivieren.</Text>
          <TouchableOpacity onPress={() => setIsArchiveModalOpen(true)}>
            <Text style={[styles.settingValue, { color: Colors.info }]}>Datum wählen...</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Konto löschen</Text>
      <View style={styles.card}>
        <View style={styles.flexRowBetween}>
          <Text style={styles.description}>Nachrichten und alle mit diesem Konto verbundenen Daten entfernen.</Text>
          <TouchableOpacity onPress={handleDeleteAccount}>
            <Text style={styles.dangerText}>Löschen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const openFolderSelect = (target: 'folderArchive' | 'folderSent' | 'folderTrash' | 'folderSpam' | 'folderDrafts' | 'folderInbox') => {
    setFolderSelectTarget(target);
    setFolderSelectModalOpen(true);
    if (imapFolders.length === 0) {
      fetchImapFolders();
    }
  };

  const renderMailboxesTab = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Postfachverhalten</Text>
      <View style={styles.card}>
        <View style={styles.mailboxRow}>
          <View style={{ flex: 1, paddingRight: Spacing.md }}>
            <Text style={styles.settingLabel}>📥 Posteingang</Text>
            <Text style={styles.settingSubLabel}>E-Mails, die du empfängst, werden in diesem Postfach gespeichert.</Text>
          </View>
          <TouchableOpacity 
            style={[styles.input, { width: 150, marginTop: 0, justifyContent: 'center' }]} 
            onPress={() => openFolderSelect('folderInbox')}
          >
            <Text style={{ color: folderInbox ? Colors.text : Colors.textTertiary }} numberOfLines={1}>
              {folderInbox || 'Auswählen...'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.mailboxRow}>
          <View style={{ flex: 1, paddingRight: Spacing.md }}>
            <Text style={styles.settingLabel}>📝 Entwürfe</Text>
            <Text style={styles.settingSubLabel}>E-Mails, die du schreibst, aber noch nicht sendest, werden in diesem Postfach gespeichert.</Text>
          </View>
          <TouchableOpacity 
            style={[styles.input, { width: 150, marginTop: 0, justifyContent: 'center' }]} 
            onPress={() => openFolderSelect('folderDrafts')}
          >
            <Text style={{ color: folderDrafts ? Colors.text : Colors.textTertiary }} numberOfLines={1}>
              {folderDrafts || 'Auswählen...'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.mailboxRow}>
          <View style={{ flex: 1, paddingRight: Spacing.md }}>
            <Text style={styles.settingLabel}>🗃 Archiv</Text>
            <Text style={styles.settingSubLabel}>E-Mails, die du archivierst, werden in dieses Postfach verschoben.</Text>
          </View>
          <TouchableOpacity 
            style={[styles.input, { width: 150, marginTop: 0, justifyContent: 'center' }]} 
            onPress={() => openFolderSelect('folderArchive')}
          >
            <Text style={{ color: folderArchive ? Colors.text : Colors.textTertiary }} numberOfLines={1}>
              {folderArchive || 'Auswählen...'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.mailboxRow}>
          <View style={{ flex: 1, paddingRight: Spacing.md }}>
            <Text style={styles.settingLabel}>🚀 Gesendet</Text>
            <Text style={styles.settingSubLabel}>E-Mails, die du sendest, werden in diesem Postfach gespeichert.</Text>
          </View>
          <TouchableOpacity 
            style={[styles.input, { width: 150, marginTop: 0, justifyContent: 'center' }]} 
            onPress={() => openFolderSelect('folderSent')}
          >
            <Text style={{ color: folderSent ? Colors.text : Colors.textTertiary }} numberOfLines={1}>
              {folderSent || 'Auswählen...'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.mailboxRow}>
          <View style={{ flex: 1, paddingRight: Spacing.md }}>
            <Text style={styles.settingLabel}>🗑 Papierkorb</Text>
            <Text style={styles.settingSubLabel}>E-Mails, die du löschst, werden in dieses Postfach verschoben.</Text>
          </View>
          <TouchableOpacity 
            style={[styles.input, { width: 150, marginTop: 0, justifyContent: 'center' }]} 
            onPress={() => openFolderSelect('folderTrash')}
          >
            <Text style={{ color: folderTrash ? Colors.text : Colors.textTertiary }} numberOfLines={1}>
              {folderTrash || 'Auswählen...'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.mailboxRowBorderFree}>
          <View style={{ flex: 1, paddingRight: Spacing.md }}>
            <Text style={styles.settingLabel}>🚫 Spam</Text>
            <Text style={styles.settingSubLabel}>E-Mails, die du als Spam markierst, werden in dieses Postfach verschoben.</Text>
          </View>
          <TouchableOpacity 
            style={[styles.input, { width: 150, marginTop: 0, justifyContent: 'center' }]} 
            onPress={() => openFolderSelect('folderSpam')}
          >
            <Text style={{ color: folderSpam ? Colors.text : Colors.textTertiary }} numberOfLines={1}>
              {folderSpam || 'Auswählen...'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.buttonPrimary, { alignSelf: 'center', marginTop: Spacing.xl }, isSavingFolders && { opacity: 0.7 }]}
        onPress={handleUpdateFolders}
        disabled={isSavingFolders}
      >
        {isSavingFolders ? (
          <ActivityIndicator color={Colors.surface} />
        ) : (
          <Text style={styles.buttonPrimaryText}>Änderungen speichern</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderCredentialsTab = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.credentialsGrid}>
        <View style={styles.credentialsCol}>
          <Text style={styles.sectionTitle}>IMAP</Text>
          <Text style={styles.settingSubLabel}>Eingehende E-Mails</Text>
          <View style={styles.card}>
            <Text style={styles.settingLabel}>Hostname</Text>
            <TextInput style={styles.input} value={imapHost} onChangeText={setImapHost} placeholder="imap.beispiel.de" autoCapitalize="none" />
            <Text style={styles.settingLabel}>Benutzername</Text>
            <TextInput style={styles.input} value={imapUser} onChangeText={setImapUser} autoCapitalize="none" />
            <Text style={styles.settingLabel}>Passwort</Text>
            <TextInput style={styles.input} value={imapPass} onChangeText={setImapPass} secureTextEntry placeholder="********" />
            <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Port</Text>
                <TextInput style={styles.input} value={imapPort} onChangeText={setImapPort} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Verschlüsselung</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingLeft: 5 }}>
                  <Switch value={imapSecure} onValueChange={setImapSecure} />
                  <Text style={{ marginLeft: Spacing.sm, color: Colors.text, fontFamily: FontFamily, fontSize: FontSize.sm }}>
                    {imapSecure ? 'SSL/TLS' : 'Keine'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
        
        <View style={styles.credentialsCol}>
          <Text style={styles.sectionTitle}>SMTP</Text>
          <Text style={styles.settingSubLabel}>Ausgehende E-Mails</Text>
          <View style={styles.card}>
            <Text style={styles.settingLabel}>Hostname</Text>
            <TextInput style={styles.input} value={smtpHost} onChangeText={setSmtpHost} placeholder="smtp.beispiel.de" autoCapitalize="none" />
            <Text style={styles.settingLabel}>Benutzername</Text>
            <TextInput style={styles.input} value={smtpUser} onChangeText={setSmtpUser} autoCapitalize="none" />
            <Text style={styles.settingLabel}>Passwort</Text>
            <TextInput style={styles.input} value={smtpPass} onChangeText={setSmtpPass} secureTextEntry placeholder="********" />
            <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Port</Text>
                <TextInput style={styles.input} value={smtpPort} onChangeText={setSmtpPort} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Verschlüsselung</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingLeft: 5 }}>
                  <Switch value={smtpSecure} onValueChange={setSmtpSecure} />
                  <Text style={{ marginLeft: Spacing.sm, color: Colors.text, fontFamily: FontFamily, fontSize: FontSize.sm }}>
                    {smtpSecure ? 'SSL/TLS' : 'Keine'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
      
      <TouchableOpacity 
        style={[styles.buttonPrimary, { alignSelf: 'center', marginTop: Spacing.xl }, isSavingCreds && { opacity: 0.7 }]}
        onPress={handleSaveCredentials}
        disabled={isSavingCreds}
      >
        {isSavingCreds ? (
          <ActivityIndicator color={Colors.surface} />
        ) : (
          <Text style={styles.buttonPrimaryText}>Änderungen speichern</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* List Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchPlaceholder}>🔍 Konten suchen...</Text>
        </View>
        <ScrollView>
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: Spacing.xl }} />
          ) : (
            <>
              <View style={styles.listSection}>
                <Text style={styles.listSectionTitle}>Persönliche Konten</Text>
                {personalInboxes.map(acc => (
                  <TouchableOpacity 
                    key={acc.id} 
                    style={[styles.accountItem, activeAccountId === acc.id && styles.accountItemActive]}
                    onPress={() => { setActiveAccountId(acc.id); setActiveTab('Konto'); }}
                  >
                    <Text style={[styles.accountItemText, activeAccountId === acc.id && styles.accountItemTextActive]}>
                      {acc.email_address}
                    </Text>
                  </TouchableOpacity>
                ))}
                {personalInboxes.length === 0 && (
                  <Text style={[styles.accountItemDesc, { paddingHorizontal: Spacing.md, color: Colors.textTertiary }]}>Keine persönlichen Konten</Text>
                )}
              </View>

              <View style={styles.listSection}>
                <Text style={styles.listSectionTitle}>Geteilte Konten</Text>
                {sharedInboxes.map(acc => (
                  <TouchableOpacity 
                    key={acc.id} 
                    style={[styles.accountItem, activeAccountId === acc.id && styles.accountItemActive]}
                    onPress={() => { setActiveAccountId(acc.id); setActiveTab('Konto'); }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={styles.avatarMock}>
                        <Text style={styles.avatarMockText}>{acc.name.substring(0, 2).toUpperCase()}</Text>
                      </View>
                      <View>
                        <Text style={[styles.accountItemDesc, activeAccountId === acc.id && styles.accountItemTextActive]}>
                          {acc.name}
                        </Text>
                        <Text style={[styles.accountItemEmail, activeAccountId === acc.id && styles.accountItemTextActive]}>
                          {acc.email_address}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
                {sharedInboxes.length === 0 && (
                  <Text style={[styles.accountItemDesc, { paddingHorizontal: Spacing.md, color: Colors.textTertiary }]}>Keine geteilten Konten</Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
        <TouchableOpacity style={styles.addAccountBtn} onPress={() => setIsAddingInbox(true)}>
          <Text style={styles.addAccountText}>Konto hinzufügen</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {account ? (
          <>
            <View style={styles.mainHeader}>
              <Text style={styles.mainHeaderTitle}>{account.email_address}</Text>
              <Text style={styles.mainHeaderSubtitle}>{account.type === 'private' ? 'IMAP-Konto' : 'Geteiltes Konto'}</Text>
              
              <View style={styles.tabsRow}>
                {['Konto', 'Postfächer', 'Zugangsdaten', ...(isShared ? ['Mitglieder'] : [])].map((tab) => (
                  <TouchableOpacity 
                    key={tab} 
                    style={[styles.tab, activeTab === tab && styles.tabActive]}
                    onPress={() => setActiveTab(tab as any)}
                  >
                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {activeTab === 'Konto' && renderAccountTab()}
            {activeTab === 'Postfächer' && renderMailboxesTab()}
            {activeTab === 'Zugangsdaten' && renderCredentialsTab()}
            {activeTab === 'Mitglieder' && (
              <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <View style={styles.flexRowBetween}>
                  <View>
                    <Text style={styles.sectionTitle}>Mitglieder</Text>
                    <Text style={styles.settingSubLabel}>Wer Zugriff auf dieses Postfach hat</Text>
                  </View>
                  <TouchableOpacity onPress={() => setIsAddingMember(true)}>
                    <Text style={styles.linkText}>⊕ Mitglied einladen</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.card}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name / E-Mail</Text>
                    <Text style={[styles.tableHeaderText, { flex: 1 }]}>Rolle</Text>
                    <Text style={[styles.tableHeaderText, { width: 140 }]}></Text>
                  </View>
                  {account?.inbox_members?.map((mem: any) => {
                    const prof = mem.profiles;
                    const displayName = prof?.display_name || 'Unbekannt';
                    return (
                      <View key={mem.user_id} style={styles.tableRow}>
                        <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                          {prof?.avatar_url ? (
                            <Image source={{ uri: prof.avatar_url }} style={{ width: 24, height: 24, borderRadius: 12, marginRight: Spacing.sm }} />
                          ) : (
                            <View style={[styles.avatarMock, { marginRight: Spacing.sm }]}><Text style={styles.avatarMockText}>{displayName?.substring(0,2).toUpperCase()}</Text></View>
                          )}
                          <Text style={styles.tableCellText}>{displayName}</Text>
                        </View>
                        <Text style={[styles.tableCellText, { flex: 1 }]}>{mem.role}</Text>
                        <View style={{ width: 140, flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm }}>
                          <TouchableOpacity onPress={() => handleChangeMemberRole(mem.user_id, mem.role === 'admin' ? 'member' : 'admin')}>
                            <Text style={styles.linkText}>{mem.role === 'admin' ? 'Als Member' : 'Als Admin'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleRemoveMember(mem.user_id)}>
                            <Text style={styles.dangerText}>Entfernen</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </>
        ) : (
          <View style={styles.centerContent}>
            <Text style={styles.emptyText}>Wähle ein Konto aus</Text>
          </View>
        )}
      </View>
      {isSharingModalOpen && renderShareModal()}
      {isAddingAlias && renderAddAliasModal()}
      {isArchiveModalOpen && renderArchiveModal()}
      {folderSelectModalOpen && renderFolderSelectModal()}
      {isHistoryModalOpen && renderHistoryModal()}
      {isAddingMember && renderAddMemberModal()}
      
      {/* Moved modals to end for proper z-index stacking */}
      {isAddingInbox && renderAddInboxModal()}
      {editingAlias && renderEditAliasModal()}
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
    display: 'flex',
    flexDirection: 'column',
  },
  searchContainer: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchPlaceholder: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  listSection: {
    marginTop: Spacing.md,
  },
  listSectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    fontWeight: FontWeight.bold,
  },
  accountItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.xs,
    borderRadius: 6,
    marginBottom: Spacing.xs,
  },
  accountItemActive: {
    backgroundColor: Colors.info,
  },
  accountItemText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  accountItemTextActive: {
    color: '#FFF',
  },
  accountItemDesc: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.text,
  },
  accountItemEmail: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  avatarMock: {
    width: 24,
    height: 24,
    backgroundColor: '#E53935',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  avatarMockText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 10,
  },
  addAccountBtn: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  addAccountText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
    fontWeight: FontWeight.bold,
  },
  main: {
    flex: 1,
  },
  mainHeader: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    marginBottom: Spacing.lg,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  tabActive: {
    backgroundColor: Colors.info,
  },
  tabText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  sectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    padding: Spacing.md,
  },
  description: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  bold: {
    fontWeight: FontWeight.bold,
  },
  flexRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: Colors.surfaceHover,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: 6,
  },
  buttonSecondaryAvatar: {
    backgroundColor: Colors.surfaceHover,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  buttonSecondaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
    fontWeight: 'bold',
  },
  settingBlock: {
    marginBottom: Spacing.md,
  },
  settingLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  settingSubLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.sm,
    color: Colors.text,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  settingValue: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  settingValueBox: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  linkText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
  },
  dangerText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.error,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tableHeaderText: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  tableCellText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  mailboxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  mailboxRowBorderFree: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  credentialsGrid: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  credentialsCol: {
    flex: 1,
  },
  buttonPrimary: {
    backgroundColor: Colors.info,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: 16,
  },
  buttonPrimaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFF',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
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
    backgroundColor: Colors.background,
    borderRadius: 12,
    flexDirection: 'row',
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
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  closeIcon: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  modalTab: {
    padding: Spacing.md,
  },
  modalTabActive: {
    backgroundColor: Colors.info,
  },
  modalTabText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  modalTabTextActive: {
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
  modalMain: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalMainHeader: {
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalContentPad: {
    padding: Spacing.xl,
  },
  settingRowModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  settingRowModalBorderFree: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
});
