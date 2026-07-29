import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, TextInput, Modal, SafeAreaView, TouchableOpacity, Text, ActivityIndicator, Alert, Platform, useWindowDimensions, ScrollView } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, FontFamily } from '../../lib/constants';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { Email } from '../../stores/emailStore';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { DraggableWindow } from '../ui/DraggableWindow';
import { ChatFeed } from '../chat/ChatFeed';
import { useEmailStore } from '../../stores/emailStore';
import { useComposerStore } from '../../stores/composerStore';
import { useInboxes } from '../../hooks/useInboxes';
import { useSignatures } from '../../hooks/useSignatures';
import { useDraft } from '../../hooks/useDraft';

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'https://mail.tim-regener.com';
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailComposerProps {
  visible: boolean;
  onClose: () => void;
  mode: 'reply' | 'forward' | 'new';
  sourceEmail?: Email;
  inboxId: string;
  draftToResume?: any;
}

function extractEmail(str?: string) {
  try {
    if (!str) return '';
    const match = str.match(/<([^>]+)>/);
    return match ? match[1].trim() : str.trim();
  } catch { return ''; }
}

function formatSender(alias: { email_address: string; name?: string }, defaultName?: string) {
  const name = alias.name && alias.name !== 'Standard' ? alias.name : defaultName;
  return name ? `${name} <${alias.email_address}>` : alias.email_address;
}

function isValidEmail(v: string) {
  return EMAIL_REGEX.test(v.trim());
}

function parseEmailList(str: string) {
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function findInvalidEmails(str: string) {
  return parseEmailList(str).filter(e => !isValidEmail(e));
}

function findMissingAttachmentRefs(body: string, attachments: { file_name: string }[]) {
  const newText = body.split('\n>')[0];
  const lower = newText.toLowerCase();
  const hintWords = ['anhang', 'attachment', 'datei', 'siehe anbei', 'beigefügt', 'beilage', 'pdf', 'dokument'];
  const hasHint = hintWords.some(w => lower.includes(w));
  if (!hasHint) return [];
  if (attachments.length > 0) return [];
  return ['Der Text erwähnt Anhänge, aber es wurden keine Dateien angehängt.'];
}

export function EmailComposer({ visible, onClose, mode, sourceEmail, inboxId, draftToResume }: EmailComposerProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' || Platform.OS === 'macos' || width > 768;

  // Prevent browser autofill on web

  const { draft, saveDraft, deleteDraft, isLoading: draftLoading } = useDraft(
    inboxId,
    sourceEmail?.thread_id,
    { fetchExisting: !!draftToResume, draftId: draftToResume?.id }
  );

  const { inboxes } = useInboxes();
  const { signatures } = useSignatures();
  const [userSigSettings, setUserSigSettings] = useState<any>(null);
  const [senderAddress, setSenderAddress] = useState('');
  const [senderAliases, setSenderAliases] = useState<{ email_address: string; name?: string; inboxName: string; inboxId: string }[]>([]);
  const [showSenderPicker, setShowSenderPicker] = useState(false);

  const activeInboxId = inboxId || (inboxes && inboxes.length > 0 ? inboxes[0].id : '');

  // Form state
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);

  const [templates, setTemplates] = useState<{ id: string; name: string; subject?: string; body: string }[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>(null);

  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Reset form state immediately when sourceEmail/mode changes (catches all edge cases)
  const resetKey = `${sourceEmail?.id || 'none'}-${mode}`;
  const prevResetKey = useRef<string | null>(null);
  if (!draftToResume && prevResetKey.current !== resetKey) {
    prevResetKey.current = resetKey;
    const newTo = mode === 'reply'
      ? extractEmail(sourceEmail?.direction === 'outbound' && sourceEmail?.to_addresses?.length
          ? sourceEmail.to_addresses[0]
          : sourceEmail?.from_address)
      : '';
    const newSubject = mode === 'reply'
      ? (sourceEmail?.subject?.startsWith('Re:') ? sourceEmail.subject : `Re: ${sourceEmail?.subject}`)
      : mode === 'forward' ? `Fwd: ${sourceEmail?.subject}` : '';
    const origBody = sourceEmail?.body_text || '';
    const quoted = origBody.split('\n').map(l => `> ${l}`).join('\n');
    const newBody = (mode === 'reply' || mode === 'forward') ? `\n\n${quoted}` : '';
    setTo(newTo);
    setCc('');
    setBcc('');
    setShowBcc(false);
    setSubject(newSubject);
    setBody(newBody);
    setAttachments([]);
    setUploadProgress({});
    setSenderAddress('');
  }

  // Autocomplete: collect all known email addresses from loaded threads
  const threads = useEmailStore(s => s.threads);
  const allContacts = useMemo(() => {
    const seen = new Map<string, { address: string; count: number; lastSeen: string }>();
    threads.forEach(t => {
      (t.participants || []).forEach(addr => {
        const lower = addr.toLowerCase();
        const existing = seen.get(lower);
        if (existing) {
          existing.count++;
          if (t.latestEmail?.received_at && t.latestEmail.received_at > existing.lastSeen) {
            existing.lastSeen = t.latestEmail.received_at;
          }
        } else {
          seen.set(lower, { address: addr, count: 1, lastSeen: t.latestEmail?.received_at || '' });
        }
      });
    });
    return Array.from(seen.values()).sort((a, b) => b.count - a.count);
  }, [threads]);

  const [autocompleteField, setAutocompleteField] = useState<'to' | 'cc' | 'bcc' | null>(null);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');

  function getCurrentWord(value: string, cursorPos?: number) {
    const parts = value.split(',');
    const current = (parts[parts.length - 1] || '').trim();
    return current;
  }

  const autocompleteSuggestions = useMemo(() => {
    if (!autocompleteQuery || autocompleteQuery.length < 1) return [];
    const q = autocompleteQuery.toLowerCase();
    return allContacts.filter(c => c.address.toLowerCase().includes(q)).slice(0, 8);
  }, [autocompleteQuery, allContacts]);

  function replaceLastWord(value: string, newWord: string) {
    const parts = value.split(',');
    parts[parts.length - 1] = newWord;
    return parts.join(', ');
  }

  const originalBody = sourceEmail?.body_text || '';
  const quotedBody = useMemo(() => originalBody.split('\n').map(line => `> ${line}`).join('\n'), [originalBody]);
  const initialBody = (mode === 'reply' || mode === 'forward') ? `\n\n${quotedBody}` : '';

  // Pre-fill subject/to when opening or switching emails
  useEffect(() => {
    if (!draftToResume && !draft) {
      setTo(mode === 'reply'
        ? extractEmail(sourceEmail?.direction === 'outbound' && sourceEmail?.to_addresses?.length
            ? sourceEmail.to_addresses[0]
            : sourceEmail?.from_address)
        : '');
      setCc('');
      setBcc('');
      setShowBcc(false);
      setSubject(
        mode === 'reply' ? (sourceEmail?.subject?.startsWith('Re:') ? sourceEmail.subject : `Re: ${sourceEmail?.subject}`) :
        mode === 'forward' ? `Fwd: ${sourceEmail?.subject}` : ''
      );
      setBody(initialBody);
      setAttachments([]);
      setUploadProgress({});
    }
  }, [visible, sourceEmail?.id, mode, draftToResume?.id]);

  // Load draft data
  useEffect(() => {
    if (draft) {
      if (draft.to_addresses?.length) setTo(draft.to_addresses.join(', '));
      if (draft.cc_addresses?.length) setCc(draft.cc_addresses.join(', '));
      if (draft.subject) setSubject(draft.subject);
      if (draft.body_text) setBody(draft.body_text);
    }
  }, [draft?.id]);

  // Sender aliases
  useEffect(() => {
    if (!activeInboxId || !visible) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_email_settings')
        .select('display_name, signature_id, reply_to, signature:signatures(id, name, content_text)')
        .eq('inbox_id', activeInboxId)
        .eq('user_id', user.id)
        .maybeSingle();
      setUserSigSettings(data);
    })();
  }, [activeInboxId, visible]);

  useEffect(() => {
    if (!inboxes.length || !visible) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const inboxIds = inboxes.map(i => i.id);
      const { data: aliasesData } = await supabase
        .from('inbox_aliases')
        .select('email_address, name, user_id, inbox_id')
        .in('inbox_id', inboxIds);
      const allAliases = aliasesData || [];
      const userAliases = allAliases.filter(a => !a.user_id || a.user_id === user.id);

      const result: { email_address: string; name?: string; inboxName: string; inboxId: string }[] = [];
      const seen = new Set<string>();
      for (const inbox of inboxes) {
        const inboxKey = inbox.email_address.toLowerCase();
        if (!seen.has(inboxKey)) {
          seen.add(inboxKey);
          const inboxLabel = inbox.name && inbox.name !== inbox.email_address ? inbox.name : undefined;
          result.push({ email_address: inbox.email_address, name: inboxLabel, inboxName: inbox.name, inboxId: inbox.id });
        }
        for (const alias of userAliases) {
          if (alias.inbox_id === inbox.id) {
            const key = alias.email_address.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              result.push({ email_address: alias.email_address, name: alias.name || undefined, inboxName: inbox.name, inboxId: inbox.id });
            }
          }
        }
      }
      setSenderAliases(result);

      try {
        // In reply mode, prefer the inbox that received the original email
        if (mode === 'reply' && sourceEmail && Array.isArray(result)) {
          const targetAddress = sourceEmail.direction === 'inbound'
            ? (Array.isArray(sourceEmail.to_addresses) ? sourceEmail.to_addresses[0] : '')
            : (sourceEmail.from_address || '');
          if (targetAddress) {
            const match = result.find(a => a && a.email_address && a.email_address.toLowerCase() === targetAddress.toLowerCase());
            if (match) {
              const displayName = match.name || undefined;
              setSenderAddress(displayName ? `${displayName} <${match.email_address}>` : match.email_address);
              return;
            }
          }
        }

        const currentEmail = extractEmail(senderAddress);
        const stillValid = result.some(a => a.email_address === currentEmail);
        if (!senderAddress || !stillValid) {
          const activeInbox = inboxes.find(i => i.id === activeInboxId);
          const primary = activeInbox || inboxes[0];
          const displayName = userSigSettings?.display_name || (primary?.name !== primary?.email_address ? primary?.name : undefined);
          setSenderAddress(displayName ? `${displayName} <${primary?.email_address}>` : primary?.email_address || '');
        }
      } catch (e) {
        console.warn('[EmailComposer] Error setting sender address:', e);
      }
    })();
  }, [inboxes, visible, userSigSettings, mode, sourceEmail]);

  // Signature on open
  useEffect(() => {
    if (visible && !draftToResume && !draft && activeInboxId) {
      let sigText: string | null = null;
      if (userSigSettings?.signature?.content_text) {
        sigText = userSigSettings.signature.content_text;
      } else if (userSigSettings?.signature_id) {
        const userSig = signatures.find(s => s.id === userSigSettings.signature_id);
        if (userSig?.content_text) sigText = userSig.content_text;
      }
      if (!sigText) {
        const activeInbox = inboxes.find(i => i.id === activeInboxId);
        if (activeInbox?.signature_id) {
          const sig = signatures.find(s => s.id === activeInbox.signature_id);
          if (sig?.content_text) sigText = sig.content_text;
        }
      }
      if (sigText) {
        const formatted = `\n\n-- \n${sigText}`;
        setBody(prev => prev.includes(formatted) ? prev : prev + formatted);
      }
    }
  }, [visible, mode, activeInboxId, inboxes, signatures, draftToResume, draft, userSigSettings, sourceEmail?.id]);

  // Fetch templates
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${API_URL}/api/templates`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` },
        });
        const json = await res.json();
        if (json.templates) setTemplates(json.templates);
      } catch (e) {
        console.warn('[EmailComposer] Failed to fetch templates:', e);
      }
    })();
  }, [visible]);

  // Auto-save with indicator
  useEffect(() => {
    if (draftLoading || !visible) return;
    const timer = setTimeout(async () => {
      if (to || cc || bcc || subject || (body && body !== initialBody)) {
        setSaveStatus('saving');
        await saveDraft({
          to_addresses: parseEmailList(to),
          cc_addresses: parseEmailList(cc),
          subject,
          body_text: body,
          in_reply_to: mode === 'reply' ? sourceEmail?.message_id : undefined,
        });
        setSaveStatus('saved');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [to, cc, bcc, subject, body, draftLoading, visible, saveDraft]);

  const resetSaveStatus = useCallback(() => {
    if (saveStatus === 'saved') setSaveStatus(null);
  }, [saveStatus]);

  const onToChange = useCallback((v: string) => { setTo(v); setAutocompleteField('to'); setAutocompleteQuery(getCurrentWord(v)); resetSaveStatus(); }, [resetSaveStatus]);
  const onCcChange = useCallback((v: string) => { setCc(v); setAutocompleteField('cc'); setAutocompleteQuery(getCurrentWord(v)); resetSaveStatus(); }, [resetSaveStatus]);
  const onBccChange = useCallback((v: string) => { setBcc(v); setAutocompleteField('bcc'); setAutocompleteQuery(getCurrentWord(v)); resetSaveStatus(); }, [resetSaveStatus]);
  const onSubjectChange = useCallback((v: string) => { setSubject(v); resetSaveStatus(); }, [resetSaveStatus]);
  const onBodyChange = useCallback((v: string) => { setBody(v); resetSaveStatus(); }, [resetSaveStatus]);

  const selectSuggestion = useCallback((address: string) => {
    switch (autocompleteField) {
      case 'to': setTo(prev => replaceLastWord(prev, address)); break;
      case 'cc': setCc(prev => replaceLastWord(prev, address)); break;
      case 'bcc': setBcc(prev => replaceLastWord(prev, address)); break;
    }
    setAutocompleteField(null);
    setAutocompleteQuery('');
  }, [autocompleteField]);

  const invalidTo = useMemo(() => to ? findInvalidEmails(to) : [], [to]);
  const invalidCc = useMemo(() => cc ? findInvalidEmails(cc) : [], [cc]);
  const invalidBcc = useMemo(() => bcc ? findInvalidEmails(bcc) : [], [bcc]);
  const hasInvalidEmails = invalidTo.length > 0 || invalidCc.length > 0 || invalidBcc.length > 0;
  const hasUploading = Object.values(uploadProgress).some(p => p < 100) || isUploading;

  // Attachment handling with size limit + progress
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const tooBig = result.assets.filter(a => (a.size || 0) > MAX_ATTACHMENT_SIZE);
      if (tooBig.length > 0) {
        Alert.alert(
          'Datei zu groß',
          `${tooBig.map(a => a.name).join(', ')} überschreitet das Limit von 25 MB.`
        );
      }

      const validAssets = result.assets.filter(a => (a.size || 0) <= MAX_ATTACHMENT_SIZE);
      if (validAssets.length === 0) return;

      setIsUploading(true);
      const newAttachments = [...attachments];

      for (const asset of validAssets) {
        const fileExt = asset.name.split('.').pop() || '';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `drafts/${fileName}`;

        setUploadProgress(prev => ({ ...prev, [asset.name]: 0 }));

        const response = await fetch(asset.uri);
        const blob = await response.blob();

        const { data, error } = await supabase.storage
          .from('email_attachments')
          .upload(filePath, blob, {
            contentType: asset.mimeType || 'application/octet-stream',
          });

        if (error) {
          console.error('Upload error:', error);
          Alert.alert('Upload fehlgeschlagen', `${asset.name}: ${error.message}`);
        } else if (data) {
          newAttachments.push({
            file_name: asset.name,
            content_type: asset.mimeType || 'application/octet-stream',
            size_bytes: asset.size || blob.size,
            storage_path: data.path,
            is_inline: false,
          });
        }
        setUploadProgress(prev => ({ ...prev, [asset.name]: 100 }));
      }

      setAttachments(newAttachments);
      setIsUploading(false);
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

  // Scan body for filenames not attached
  const missingRefs = useMemo(() => {
    const names = attachments.map(a => a.file_name);
    return findMissingAttachmentRefs(body, attachments);
  }, [body, attachments]);

  const handleSend = useCallback(async () => {
    // 1. Check uploading
    if (hasUploading) {
      Alert.alert('Upload läuft', 'Bitte warte, bis alle Anhänge hochgeladen sind.');
      return;
    }

    // 2. Check missing attachment refs
    if (missingRefs.length > 0) {
      // keep but don't block — just visual warning
    }

    // 3. Validate emails
    if (hasInvalidEmails) {
      Alert.alert(
        'Ungültige E-Mail-Adressen',
        `Bitte korrigiere: ${[...invalidTo, ...invalidCc, ...invalidBcc].join(', ')}`
      );
      return;
    }

    const toAddresses = parseEmailList(to);

    // 4. Check empty to
    if (toAddresses.length === 0) {
      Alert.alert('Fehlender Empfänger', 'Bitte gib mindestens einen Empfänger an.');
      return;
    }

    // 5. Check empty subject with confirmation
    if (!subject?.trim()) {
      const confirmed = await new Promise(resolve => {
        Alert.alert(
          'Ohne Betreff senden?',
          'Möchtest du die E-Mail wirklich ohne Betreff senden?',
          [
            { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Trotzdem senden', onPress: () => resolve(true) },
          ]
        );
      });
      if (!confirmed) return;
    }

    // 6. Check empty body with confirmation
    if (!body?.trim()) {
      const confirmed = await new Promise(resolve => {
        Alert.alert(
          'Leere Nachricht senden?',
          'Möchtest du die E-Mail wirklich ohne Text senden?',
          [
            { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Trotzdem senden', onPress: () => resolve(true) },
          ]
        );
      });
      if (!confirmed) return;
    }

    setIsSending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const ccAddresses = parseEmailList(cc);
      const bccAddresses = parseEmailList(bcc);

      const payload = {
        inboxId: activeInboxId,
        to: toAddresses,
        cc: ccAddresses,
        bcc: bccAddresses,
        subject,
        bodyText: body,
        inReplyTo: mode === 'reply' ? sourceEmail?.message_id : undefined,
        references: mode === 'reply' ? sourceEmail?.message_id : undefined,
        attachments,
        fromAddress: senderAddress || undefined,
      };

      const response = await fetch(`${API_URL}/api/mail/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session?.access_token}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Senden');
      }

      await deleteDraft();
      onClose();
    } catch (error: any) {
      Alert.alert('Fehler beim Senden', error.message);
    } finally {
      setIsSending(false);
    }
  }, [to, cc, bcc, subject, body, attachments, senderAddress, activeInboxId, mode, sourceEmail, hasUploading, hasInvalidEmails, invalidTo, invalidCc, invalidBcc, missingRefs, deleteDraft, onClose]);

  // Keyboard shortcut: Cmd+Enter / Ctrl+Enter to send (web)
  useEffect(() => {
    if (!visible || !isDesktop) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, isDesktop, handleSend]);

  const handleAiSuggest = useCallback(async () => {
    setAiSuggestion(null);
    setAiError(null);
    setAiLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht authentifiziert');
      const res = await fetch(`${API_URL}/api/ai/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          subject: sourceEmail?.subject || subject,
          bodyText: sourceEmail?.body_text || body,
          fromAddress: sourceEmail?.from_address,
          inboxId: inboxId || activeInboxId,
          templates: templates.slice(0, 5).map(t => ({ name: t.name, subject: t.subject, body: t.body })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Fehler bei der KI-Anfrage');
      setAiSuggestion(json.suggestion);
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }, [sourceEmail, subject, body, templates, inboxId, activeInboxId]);

  const composerContent = (
    <SafeAreaView style={[styles.container, isDesktop && styles.desktopContainer]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>Abbrechen</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>
            {mode === 'reply' ? 'Antworten' : mode === 'forward' ? 'Weiterleiten' : 'Neue E-Mail'}
          </Text>
          {saveStatus === 'saving' && <Text style={styles.saveStatus}>Speichert…</Text>}
          {saveStatus === 'saved' && <Text style={[styles.saveStatus, { color: Colors.success }]}>Gespeichert</Text>}
        </View>
        <Button
          title="Senden"
          size="sm"
          onPress={handleSend}
          isLoading={isSending}
          disabled={isSending || hasUploading}
        />
      </View>

      <View style={styles.form}>
        <View style={styles.inputRow}>
          <Text style={styles.label}>Von:</Text>
          <TouchableOpacity
            style={[styles.input, styles.senderPicker]}
            onPress={() => setShowSenderPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.senderText} numberOfLines={1}>
              {senderAddress || 'Laden...'}
            </Text>
            <Feather name="chevron-down" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.label}>An:</Text>
          <View style={{ flex: 1 }}>
            <TextInput
              style={[styles.input, invalidTo.length > 0 && { color: Colors.error }]}
              value={to}
              onChangeText={onToChange}
              onFocus={() => { setAutocompleteField('to'); setAutocompleteQuery(getCurrentWord(to)); }}
              onBlur={() => setTimeout(() => setAutocompleteField(null), 200)}
              placeholder="E-Mail-Adressen"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={254}
            />
            {invalidTo.length > 0 && (
              <Text style={styles.validationHint}>{invalidTo.join(', ')}</Text>
            )}
            {autocompleteField === 'to' && autocompleteSuggestions.length > 0 && (
              <View style={styles.autocompleteDropdown}>
                {autocompleteSuggestions.map(s => (
                  <TouchableOpacity key={s.address} style={styles.autocompleteItem} onPress={() => selectSuggestion(s.address)}>
                    <Text style={styles.autocompleteText} numberOfLines={1}>{s.address}</Text>
                    {s.count > 1 && <Text style={styles.autocompleteCount}>{s.count}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.label}>Cc:</Text>
          <View style={{ flex: 1 }}>
            <TextInput
              style={[styles.input, invalidCc.length > 0 && { color: Colors.error }]}
              value={cc}
              onChangeText={onCcChange}
              onFocus={() => { setAutocompleteField('cc'); setAutocompleteQuery(getCurrentWord(cc)); }}
              onBlur={() => setTimeout(() => setAutocompleteField(null), 200)}
              placeholder="E-Mail-Adressen"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={254}
            />
            {invalidCc.length > 0 && (
              <Text style={styles.validationHint}>{invalidCc.join(', ')}</Text>
            )}
            {autocompleteField === 'cc' && autocompleteSuggestions.length > 0 && (
              <View style={styles.autocompleteDropdown}>
                {autocompleteSuggestions.map(s => (
                  <TouchableOpacity key={s.address} style={styles.autocompleteItem} onPress={() => selectSuggestion(s.address)}>
                    <Text style={styles.autocompleteText} numberOfLines={1}>{s.address}</Text>
                    {s.count > 1 && <Text style={styles.autocompleteCount}>{s.count}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => setShowBcc(!showBcc)} style={{ paddingLeft: Spacing.sm }}>
            <Text style={{ fontSize: FontSize.xs, color: Colors.info }}>Bcc</Text>
          </TouchableOpacity>
        </View>

        {showBcc && (
          <View style={styles.inputRow}>
            <Text style={styles.label}>Bcc:</Text>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.input, invalidBcc.length > 0 && { color: Colors.error }]}
                value={bcc}
                onChangeText={onBccChange}
                onFocus={() => { setAutocompleteField('bcc'); setAutocompleteQuery(getCurrentWord(bcc)); }}
                onBlur={() => setTimeout(() => setAutocompleteField(null), 200)}
                placeholder="E-Mail-Adressen"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={254}
              />
              {invalidBcc.length > 0 && (
                <Text style={styles.validationHint}>{invalidBcc.join(', ')}</Text>
              )}
              {autocompleteField === 'bcc' && autocompleteSuggestions.length > 0 && (
                <View style={styles.autocompleteDropdown}>
                  {autocompleteSuggestions.map(s => (
                    <TouchableOpacity key={s.address} style={styles.autocompleteItem} onPress={() => selectSuggestion(s.address)}>
                      <Text style={styles.autocompleteText} numberOfLines={1}>{s.address}</Text>
                      {s.count > 1 && <Text style={styles.autocompleteCount}>{s.count}</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.inputRow}>
          <Text style={styles.label}>Betreff:</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={onSubjectChange}
            placeholder="Betreff"
            maxLength={500}
          />
        </View>

          <TextInput
          style={styles.bodyInput}
          value={body}
          onChangeText={onBodyChange}
          multiline
          placeholder="Schreibe deine Nachricht hier..."
          textAlignVertical="top"
          maxLength={100000}
        />

        {aiError && (
          <View style={styles.aiErrorBox}>
            <Feather name="alert-circle" size={14} color={Colors.error} />
            <Text style={styles.aiErrorText}>{aiError}</Text>
          </View>
        )}
        {aiSuggestion && (
          <View style={styles.aiSuggestionBox}>
            <View style={styles.aiSuggestionHeader}>
              <Feather name="zap" size={14} color={Colors.primary} />
              <Text style={styles.aiSuggestionTitle}>KI-Vorschlag</Text>
            </View>
            <ScrollView style={styles.aiSuggestionScroll}>
              <Text style={styles.aiSuggestionText}>{aiSuggestion}</Text>
            </ScrollView>
            <View style={styles.aiSuggestionActions}>
              <TouchableOpacity
                style={styles.aiSuggestionBtn}
                onPress={() => { setBody(prev => prev + '\n\n' + aiSuggestion); setAiSuggestion(null); }}
              >
                <Text style={styles.aiSuggestionBtnText}>Übernehmen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aiSuggestionDismiss}
                onPress={() => setAiSuggestion(null)}
              >
                <Text style={styles.aiSuggestionDismissText}>Verwerfen</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {missingRefs.length > 0 && (
          <View style={styles.warningBar}>
            <Feather name="alert-triangle" size={14} color={Colors.warning} />
            <Text style={styles.warningText}>{missingRefs[0]}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.attachmentList}>
            {attachments.map((att, index) => (
              <View key={index} style={styles.attachmentChip}>
                <Feather name="file" size={14} color={Colors.textSecondary} />
                <Text style={styles.attachmentChipText} numberOfLines={1}>{att.file_name}</Text>
                {(uploadProgress[att.file_name] ?? 100) < 100 && (
                  <ActivityIndicator size="small" color={Colors.info} />
                )}
                <TouchableOpacity onPress={() => removeAttachment(index)}>
                  <Feather name="x" size={14} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={() => setShowTemplatePicker(true)}
              activeOpacity={0.6}
            >
              <Feather name="file-text" size={18} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.attachBtn, aiLoading && styles.attachBtnDisabled]}
              onPress={handleAiSuggest}
              activeOpacity={0.6}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Feather name="zap" size={18} color={Colors.primary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={handlePickDocument}
              disabled={isUploading}
              activeOpacity={0.6}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Feather name="paperclip" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );

  const templatePickerModal = (
    <Modal visible={showTemplatePicker} transparent animationType="fade" onRequestClose={() => setShowTemplatePicker(false)}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowTemplatePicker(false)}>
        <View style={styles.pickerContainer} onStartShouldSetResponder={() => true}>
          <Text style={styles.pickerTitle}>Vorlage auswählen</Text>
          {templates.length === 0 ? (
            <View style={{ padding: Spacing.lg, alignItems: 'center' }}>
              <Text style={{ color: Colors.textTertiary }}>Keine Vorlagen vorhanden</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 320 }}>
              {templates.map(tpl => (
                <TouchableOpacity
                  key={tpl.id}
                  style={styles.pickerOption}
                  onPress={() => {
                    if (tpl.subject) setSubject(tpl.subject);
                    setBody(tpl.body);
                    setShowTemplatePicker(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerOptionText} numberOfLines={1}>{tpl.name}</Text>
                    {tpl.subject && (
                      <Text style={{ fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 }} numberOfLines={1}>
                        {tpl.subject}
                      </Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={14} color={Colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const senderPickerModal = (
    <Modal visible={showSenderPicker} transparent animationType="fade">
      <TouchableOpacity
        style={styles.pickerOverlay}
        activeOpacity={1}
        onPress={() => setShowSenderPicker(false)}
      >
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>Absender wählen</Text>
          <View style={{ maxHeight: 300 }}>
            {senderAliases.map((alias, i) => {
              const isSelected = extractEmail(senderAddress) === alias.email_address;
              const formatted = alias.name ? `${alias.name} <${alias.email_address}>` : alias.email_address;
              return (
                <TouchableOpacity
                  key={alias.email_address}
                  style={[styles.pickerOption, isSelected && styles.pickerOptionActive]}
                  onPress={() => { setSenderAddress(formatted); setShowSenderPicker(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerOptionText, isSelected && styles.pickerOptionTextActive]} numberOfLines={1}>
                      {formatted}
                    </Text>
                    <Text style={{ fontSize: FontSize.xs, color: isSelected ? '#FFFFFF' : Colors.textTertiary, marginTop: 2 }}>
                      {alias.inboxName}
                    </Text>
                  </View>
                  {isSelected && <Feather name="check" size={16} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
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
    return (<>
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
      {senderPickerModal}
      {templatePickerModal}
    </> );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      {composerContent}
      {senderPickerModal}
      {templatePickerModal}
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
  headerCenter: {
    alignItems: 'center',
  },
  saveStatus: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
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
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingVertical: Spacing.sm,
  },
  label: {
    width: 60,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    paddingTop: 6,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    padding: 2,
  },
  validationHint: {
    fontSize: FontSize.xs,
    color: Colors.error,
    marginTop: 2,
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
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHover,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
    maxWidth: 180,
  },
  attachmentChipText: {
    fontSize: 12,
    color: Colors.text,
    flex: 1,
  },
  warningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.warning + '15',
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  warningText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    flex: 1,
  },
  autocompleteDropdown: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  autocompleteText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    flex: 1,
  },
  autocompleteCount: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm,
  },
  attachBtn: {
    padding: Spacing.md,
    marginLeft: Spacing.sm,
    borderRadius: BorderRadius.sm,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHover,
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
  },
  senderPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  senderText: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '90%',
    maxWidth: 400,
    maxHeight: '60%',
  },
  pickerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  pickerOptionActive: {
    backgroundColor: Colors.primary,
  },
  pickerOptionText: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
  pickerOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: FontWeight.medium,
  },
  aiErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: Colors.error + '15',
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  aiErrorText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    flex: 1,
  },
  attachBtnDisabled: {
    opacity: 0.5,
  },
  aiSuggestionBox: {
    backgroundColor: Colors.primaryLight + '10',
    borderWidth: 1,
    borderColor: Colors.primaryLight + '30',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  aiSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  aiSuggestionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  aiSuggestionScroll: {
    maxHeight: 200,
  },
  aiSuggestionText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  aiSuggestionActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  aiSuggestionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  aiSuggestionBtnText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  aiSuggestionDismiss: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiSuggestionDismissText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
});
