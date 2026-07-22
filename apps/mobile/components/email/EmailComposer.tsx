import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Modal, SafeAreaView, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, FontFamily } from '../../lib/constants';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { Email } from '../../stores/emailStore';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { Platform, useWindowDimensions } from 'react-native';
import { DraggableWindow } from '../ui/DraggableWindow';
import { ChatFeed } from '../chat/ChatFeed';
import { useComposerStore } from '../../stores/composerStore';
import { useInboxes } from '../../hooks/useInboxes';
import { useSignatures } from '../../hooks/useSignatures';

interface EmailComposerProps {
  visible: boolean;
  onClose: () => void;
  mode: 'reply' | 'forward' | 'new';
  sourceEmail?: Email;
  inboxId: string;
  draftToResume?: any;
}

import { useDraft } from '../../hooks/useDraft';

export function EmailComposer({ visible, onClose, mode, sourceEmail, inboxId, draftToResume }: EmailComposerProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' || Platform.OS === 'macos' || width > 768;

  const { draft, saveDraft, deleteDraft, isLoading: draftLoading } = useDraft(
    inboxId, 
    sourceEmail?.thread_id,
    { 
      fetchExisting: !!draftToResume, 
      draftId: draftToResume?.id 
    }
  );

  const { inboxes } = useInboxes();
  const { signatures } = useSignatures();

  // Create quoting for reply/forward
  const originalBody = sourceEmail?.body_text || '';
  const quotedBody = originalBody.split('\n').map(line => `> ${line}`).join('\n');
  const initialBody = (mode === 'reply' || mode === 'forward') ? `\n\n${quotedBody}` : '';

  const [to, setTo] = useState(
    mode === 'reply' 
      ? (sourceEmail?.direction === 'outbound' && sourceEmail?.to_addresses?.length 
          ? sourceEmail.to_addresses[0] 
          : sourceEmail?.from_address || '') 
      : ''
  );
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(
    mode === 'reply' ? (sourceEmail?.subject?.startsWith('Re:') ? sourceEmail.subject : `Re: ${sourceEmail?.subject}`) :
    mode === 'forward' ? `Fwd: ${sourceEmail?.subject}` : ''
  );
  const [body, setBody] = useState(initialBody);
  const [isSending, setIsSending] = useState(false);
  
  // Attachments
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        const newAttachments = [...attachments];
        
        for (const asset of result.assets) {
          const fileExt = asset.name.split('.').pop() || '';
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `drafts/${fileName}`; // Store in drafts prefix initially

          // Read file (react-native / expo handling for fetch)
          const response = await fetch(asset.uri);
          const blob = await response.blob();

          const { data, error } = await supabase.storage
            .from('email_attachments')
            .upload(filePath, blob, {
              contentType: asset.mimeType || 'application/octet-stream',
            });

          if (error) {
            console.error('Upload error:', error);
            alert(`Upload von ${asset.name} fehlgeschlagen.`);
          } else if (data) {
            newAttachments.push({
              file_name: asset.name,
              content_type: asset.mimeType || 'application/octet-stream',
              size_bytes: asset.size || blob.size,
              storage_path: data.path,
              is_inline: false,
            });
          }
        }
        
        setAttachments(newAttachments);
        setIsUploading(false);
      }
    } catch (e) {
      console.error(e);
      setIsUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    const newAtt = [...attachments];
    newAtt.splice(index, 1);
    setAttachments(newAtt);
  };

  // Load draft data when it arrives
  useEffect(() => {
    if (draft) {
      if (draft.to_addresses && draft.to_addresses.length > 0) setTo(draft.to_addresses.join(', '));
      if (draft.cc_addresses && draft.cc_addresses.length > 0) setCc(draft.cc_addresses.join(', '));
      if (draft.subject) setSubject(draft.subject);
      if (draft.body_text) setBody(draft.body_text);
    }
  }, [draft?.id]);

  // Load signature
  useEffect(() => {
    if (visible && !draftToResume && !draft) {
      const activeInbox = inboxes.find(i => i.id === inboxId);
      if (activeInbox?.signature_id) {
        const sig = signatures.find(s => s.id === activeInbox.signature_id);
        if (sig && sig.content_text) {
          const sigText = `\n\n-- \n${sig.content_text}`;
          if (!body.includes(sigText)) {
            setBody(prev => sigText + prev);
          }
        }
      }
    }
  }, [visible, inboxId, inboxes, signatures, draftToResume, draft]);

  // Auto-save logic
  useEffect(() => {
    if (draftLoading || !visible) return;

    const timer = setTimeout(() => {
      // Only save if there's actual user input (different from initial defaults)
      if (to || cc || subject || (body && body !== initialBody)) {
        saveDraft({
          to_addresses: to ? to.split(',').map(s => s.trim()).filter(Boolean) : [],
          cc_addresses: cc ? cc.split(',').map(s => s.trim()).filter(Boolean) : [],
          subject,
          body_text: body,
          in_reply_to: mode === 'reply' ? sourceEmail?.message_id : undefined,
        });
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [to, cc, subject, body, draftLoading, visible, saveDraft]);

  const handleSend = async () => {
    if (!to || !subject || !body) {
      alert('Bitte fülle alle Pflichtfelder aus (An, Betreff, Text).');
      return;
    }

    setIsSending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const toAddresses = to.split(',').map(s => s.trim()).filter(Boolean);
      const ccAddresses = cc.split(',').map(s => s.trim()).filter(Boolean);

      const payload = {
        inboxId,
        to: toAddresses,
        cc: ccAddresses,
        subject,
        bodyText: body,
        inReplyTo: mode === 'reply' ? sourceEmail?.message_id : undefined,
        references: mode === 'reply' ? sourceEmail?.message_id : undefined,
        attachments, // Pass to backend
      };

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
      
      const response = await fetch(`${apiUrl}/api/mail/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session?.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Senden');
      }

      await deleteDraft(); // Clean up draft after sending
      onClose();
    } catch (error: any) {
      alert('Fehler beim Senden: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const composerContent = (
    <SafeAreaView style={[styles.container, isDesktop && styles.desktopContainer]}>
      <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {mode === 'reply' ? 'Antworten' : mode === 'forward' ? 'Weiterleiten' : 'Neue E-Mail'}
          </Text>
          <Button 
            title="Senden" 
            size="sm" 
            onPress={handleSend} 
            isLoading={isSending} 
            disabled={!to || !subject || !body || isSending} 
          />
        </View>

        <View style={styles.form}>
          <View style={styles.inputRow}>
            <Text style={styles.label}>An:</Text>
            <TextInput 
              style={styles.input} 
              value={to} 
              onChangeText={setTo} 
              placeholder="empfaenger@beispiel.de"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.label}>Cc:</Text>
            <TextInput 
              style={styles.input} 
              value={cc} 
              onChangeText={setCc} 
              placeholder="optional@beispiel.de"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.label}>Betreff:</Text>
            <TextInput 
              style={styles.input} 
              value={subject} 
              onChangeText={setSubject} 
              placeholder="Betreff"
            />
          </View>

          <TextInput 
            style={styles.bodyInput} 
            value={body} 
            onChangeText={setBody} 
            multiline 
            placeholder="Schreibe deine Nachricht hier..."
            textAlignVertical="top"
          />

          <View style={styles.footer}>
            <View style={styles.attachmentList}>
              {attachments.map((att, index) => (
                <View key={index} style={styles.attachmentChip}>
                  <Feather name="file" size={14} color={Colors.textSecondary} />
                  <Text style={styles.attachmentChipText} numberOfLines={1}>{att.file_name}</Text>
                  <TouchableOpacity onPress={() => removeAttachment(index)}>
                    <Feather name="x" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.attachBtn} 
              onPress={handlePickDocument}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Feather name="paperclip" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
    </SafeAreaView>
  );

  const macHeader = (
    <View style={styles.macHeader}>
      <View style={styles.macButtons}>
        <TouchableOpacity onPress={onClose} style={[styles.macButton, { backgroundColor: '#FF5F56' }]} />
        <View style={[styles.macButton, { backgroundColor: '#FFBD2E' }]} />
        <View style={[styles.macButton, { backgroundColor: '#27C93F' }]} />
      </View>
      <Text style={styles.macTitle}>
        {mode === 'reply' ? 'Antworten' : mode === 'forward' ? 'Weiterleiten' : 'Neue E-Mail'}
      </Text>
      <View style={{ width: 60 }} />
    </View>
  );

  if (!visible) return null;

  if (isDesktop) {
    return (
      <DraggableWindow 
        initialWidth={900} 
        initialHeight={600}
        headerComponent={macHeader}
      >
        <View style={styles.desktopLayout}>
          <View style={styles.desktopLeft}>
            {composerContent}
          </View>
          <View style={styles.desktopRight}>
            {sourceEmail ? (
              <ChatFeed 
                emailId={sourceEmail.id} 
                emails={[sourceEmail]} 
                inboxId={inboxId} 
                threadId={sourceEmail.thread_id || sourceEmail.id} 
                onEmailStatusChange={() => {}}
                headerComponent={
                  <View style={{ padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                    <Text style={{ fontWeight: '600' }}>Chat with your team...</Text>
                  </View>
                }
              />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: Colors.textTertiary }}>Kein Thread für Chat vorhanden.</Text>
              </View>
            )}
          </View>
        </View>
      </DraggableWindow>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      {composerContent}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  closeText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  title: {
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  form: {
    flex: 1,
    padding: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingVertical: Spacing.sm,
  },
  label: {
    width: 60,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    padding: 0, // override default padding
  },
  bodyInput: {
    flex: 1,
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.sm,
  },
  attachmentList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHover,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
    maxWidth: 150,
  },
  attachmentChipText: {
    fontSize: 12,
    color: Colors.text,
    flex: 1,
  },
  attachBtn: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  desktopContainer: {
    backgroundColor: '#FFF',
  },
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopLeft: {
    flex: 6,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  desktopRight: {
    flex: 4,
    backgroundColor: Colors.background,
  },
  macHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  macButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: Spacing.xs,
    width: 60,
  },
  macButton: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  macTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  }
});
