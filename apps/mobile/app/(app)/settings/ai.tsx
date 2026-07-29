import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout, BorderRadius } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';
import { Feather } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';

interface ContextEntry {
  id: string;
  topic: string;
  content: string;
  created_at: string;
  updated_at: string | null;
}

interface Org {
  id: string;
  name: string;
  myRole: string;
}

const SUGGESTED_TOPICS = [
  'Allgemein',
  'Produkte & Dienstleistungen',
  'Preise & Angebote',
  'Versand & Lieferung',
  'Rückgaben & Garantie',
  'Öffnungszeiten',
  'Zahlungsarten',
  'Technischer Support',
];

export default function AISettingsScreen() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const [rules, setRules] = useState<Record<string, any>>({});
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);

  const selectedOrg = orgs.find(o => o.id === selectedOrgId);

  const fetchOrgs = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_URL}/api/teams`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const teams = await res.json();
      const orgList = (Array.isArray(teams) ? teams : []).filter((t: any) => !t.parent_id);
      setOrgs(orgList);
      if (orgList.length > 0) {
        setSelectedOrgId(orgList[0].id);
        setIsAdmin(['owner', 'admin'].includes(orgList[0].myRole));
      }
    } catch (e) {
      console.warn('[AI] Failed to fetch orgs:', e);
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  const fetchOrgSettings = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const [ctxRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/api/ai/org/${selectedOrgId}/context`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${API_URL}/api/ai/org/${selectedOrgId}/settings`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);
      const ctxJson = await ctxRes.json();
      if (ctxJson.entries) setEntries(ctxJson.entries);
      const settingsJson = await settingsRes.json();
      if (settingsJson.settings?.openai_api_key) {
        setApiKey(settingsJson.settings.openai_api_key);
      } else {
        setApiKey('');
      }
      if (settingsJson.settings?.settings) {
        setRules(settingsJson.settings.settings);
      } else {
        setRules({});
      }
    } catch (e) {
      console.warn('[AI] Failed to fetch org settings:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  useEffect(() => {
    if (selectedOrgId) {
      setLoading(true);
      fetchOrgSettings();
    }
  }, [selectedOrgId, fetchOrgSettings]);

  const handleOrgChange = (org: Org) => {
    setSelectedOrgId(org.id);
    setIsAdmin(['owner', 'admin'].includes(org.myRole));
    setEditingId(null);
    setTopic('');
    setContent('');
  };

  const handleSaveApiKey = async () => {
    if (!selectedOrgId) { Alert.alert('Fehler', 'Keine Organisation ausgewählt'); return; }
    setSavingKey(true);
    setApiKeySaved(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { Alert.alert('Fehler', 'Nicht angemeldet – bitte Seite neu laden'); setSavingKey(false); return; }
      const res = await fetch(`${API_URL}/api/ai/org/${selectedOrgId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ openai_api_key: apiKey }),
      });
      if (!res.ok) {
        const err = await res.json();
        Alert.alert('Fehler', err.error || 'Speichern fehlgeschlagen');
        setSavingKey(false);
        return;
      }
      setApiKeySaved(true);
      setSavingKey(false);
      setTimeout(() => setApiKeySaved(false), 2000);
    } catch (err: any) {
      Alert.alert('Fehler', err.message);
      setSavingKey(false);
    }
  };

  const handleSaveRules = async () => {
    if (!selectedOrgId) { Alert.alert('Fehler', 'Keine Organisation ausgewählt'); return; }
    setRulesSaving(true);
    setRulesSaved(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { Alert.alert('Fehler', 'Nicht angemeldet – bitte Seite neu laden'); setRulesSaving(false); return; }
      const res = await fetch(`${API_URL}/api/ai/org/${selectedOrgId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ settings: rules }),
      });
      if (!res.ok) {
        const err = await res.json();
        Alert.alert('Fehler', err.error || 'Speichern fehlgeschlagen');
        setRulesSaving(false);
        return;
      }
      setRulesSaved(true);
      setRulesSaving(false);
      setTimeout(() => setRulesSaved(false), 2000);
    } catch (err: any) {
      Alert.alert('Fehler', err.message);
      setRulesSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedOrgId) return;
    if (!topic.trim() || !content.trim()) {
      Alert.alert('Fehler', 'Thema und Inhalt dürfen nicht leer sein.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const baseUrl = `${API_URL}/api/ai/org/${selectedOrgId}/context`;
      const url = editingId ? `${baseUrl}/${editingId}` : baseUrl;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ topic: topic.trim(), content: content.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        Alert.alert('Fehler', err.error || 'Speichern fehlgeschlagen');
        return;
      }
      setEditingId(null);
      setTopic('');
      setContent('');
      await fetchOrgSettings();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: ContextEntry) => {
    setEditingId(entry.id);
    setTopic(entry.topic);
    setContent(entry.content);
  };

  const handleDelete = (id: string) => {
    if (!selectedOrgId) return;
    Alert.alert('Löschen', 'Diesen Kontext-Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          await fetch(`${API_URL}/api/ai/org/${selectedOrgId}/context/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          await fetchOrgSettings();
        },
      },
    ]);
  };

  const handleNew = () => {
    setEditingId('');
    setTopic('');
    setContent('');
  };

  if (loadingOrgs) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // No orgs → show user-level fallback
  if (orgs.length === 0) {
    return <UserLevelAISettings />;
  }

  // Show org-level editing form
  if (editingId !== null || (topic && editingId === null)) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setEditingId(null); setTopic(''); setContent(''); }} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{editingId ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</Text>
        </View>

        <Text style={styles.label}>Thema</Text>
        <View style={styles.topicSuggestions}>
          {SUGGESTED_TOPICS.filter(t => !editingId || t === topic).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.topicChip, topic === t && styles.topicChipActive]}
              onPress={() => setTopic(t)}
            >
              <Text style={[styles.topicChipText, topic === t && styles.topicChipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.textInput}
          value={topic}
          onChangeText={setTopic}
          placeholder="Oder eigenes Thema eingeben…"
          placeholderTextColor={Colors.textTertiary}
        />

        <Text style={styles.label}>Inhalt</Text>
        <Text style={styles.hint}>
          Beschreibe hier, worauf die KI bei diesem Thema achten soll.
          Z.B. Produktdetails, Versandkosten, Rückgabebedingungen, etc.
        </Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          placeholder="Gib hier den Kontext ein…"
          placeholderTextColor={Colors.textTertiary}
        />

        <TouchableOpacity
          style={[styles.saveBtn, (!topic.trim() || !content.trim()) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!topic.trim() || !content.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>Speichern</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Künstliche Intelligenz</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>KI Antwortvorschläge</Text>
        <Text style={styles.cardDescription}>
          Konfiguriere hier die KI für deine Organisation und für dich persönlich.
          Der Org-API-Key wird bevorzugt verwendet, fällt auf deinen persönlichen Key zurück.
          Kontext-Einträge von Organisation und Benutzer werden beide in den Prompt eingemischt.
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Organisation</Text>
        <View style={styles.orgList}>
          {orgs.map(org => (
            <TouchableOpacity
              key={org.id}
              style={[styles.orgOption, selectedOrgId === org.id && styles.orgOptionActive]}
              onPress={() => handleOrgChange(org)}
            >
              <Text style={[styles.orgOptionText, selectedOrgId === org.id && styles.orgOptionTextActive]}>
                {org.name}
              </Text>
              {['owner', 'admin'].includes(org.myRole) && (
                <Text style={styles.orgBadge}>Admin</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>OpenAI API Key (Organisation)</Text>
        <Text style={styles.hint}>
          Dieser Key wird für alle E-Mail-Antworten in dieser Organisation genutzt.
          Hol dir einen Key unter{' '}
          <Text style={{ color: Colors.primary }}>platform.openai.com/api-keys</Text>
          {!isAdmin && (
            <Text style={{ color: Colors.textTertiary }}>
              {'\n'}Nur Admins können den API-Key bearbeiten.
            </Text>
          )}
        </Text>
        <View style={styles.apiKeyRow}>
          <TextInput
            style={[styles.textInput, { flex: 1 }]}
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry={!showApiKey}
            placeholder="sk-..."
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            editable={isAdmin}
          />
          <TouchableOpacity style={styles.apiKeyToggle} onPress={() => setShowApiKey(!showApiKey)}>
            <Feather name={showApiKey ? 'eye-off' : 'eye'} size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {isAdmin && (
          <TouchableOpacity
            style={[styles.saveBtn, savingKey && styles.saveBtnDisabled]}
            onPress={handleSaveApiKey}
            disabled={savingKey}
          >
            {savingKey ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : apiKeySaved ? (
              <Text style={styles.saveBtnText}>Gespeichert ✓</Text>
            ) : (
              <Text style={styles.saveBtnText}>API Key speichern</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>KI-Regeln</Text>
        <Text style={styles.hint}>
          Lege fest, wie die KI Antworten formulieren soll.
        </Text>

        <View style={styles.ruleRow}>
          <Text style={styles.ruleLabel}>Keine Grußformel ausgeben</Text>
          <Switch
            value={!!rules.no_greeting}
            onValueChange={v => setRules(prev => ({ ...prev, no_greeting: v }))}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={rules.no_greeting ? Colors.primary : Colors.textTertiary}
            disabled={!isAdmin}
          />
        </View>

        <View style={styles.ruleRow}>
          <Text style={styles.ruleLabel}>Keine Signatur ausgeben</Text>
          <Switch
            value={!!rules.no_signature}
            onValueChange={v => setRules(prev => ({ ...prev, no_signature: v }))}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={rules.no_signature ? Colors.primary : Colors.textTertiary}
            disabled={!isAdmin}
          />
        </View>

        <Text style={styles.ruleSubLabel}>Anrede</Text>
        <View style={styles.ruleOptions}>
          <TouchableOpacity
            style={[styles.ruleOption, rules.salutation_form === 'formal' && styles.ruleOptionActive]}
            onPress={() => setRules(prev => ({ ...prev, salutation_form: 'formal' }))}
            disabled={!isAdmin}
          >
            <Feather name={rules.salutation_form === 'formal' ? 'check-circle' : 'circle'} size={16} color={rules.salutation_form === 'formal' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.ruleOptionText, rules.salutation_form === 'formal' && styles.ruleOptionTextActive]}>Sie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ruleOption, rules.salutation_form === 'informal' && styles.ruleOptionActive]}
            onPress={() => setRules(prev => ({ ...prev, salutation_form: 'informal' }))}
            disabled={!isAdmin}
          >
            <Feather name={rules.salutation_form === 'informal' ? 'check-circle' : 'circle'} size={16} color={rules.salutation_form === 'informal' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.ruleOptionText, rules.salutation_form === 'informal' && styles.ruleOptionTextActive]}>Du</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ruleRow}>
          <Text style={styles.ruleLabel}>Kundenname in Begrüßung</Text>
          <Switch
            value={!!rules.include_customer_name}
            onValueChange={v => setRules(prev => ({ ...prev, include_customer_name: v }))}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={rules.include_customer_name ? Colors.primary : Colors.textTertiary}
            disabled={!isAdmin}
          />
        </View>

        <Text style={styles.ruleSubLabel}>Tonfall</Text>
        <View style={styles.ruleOptions}>
          <TouchableOpacity
            style={[styles.ruleOption, rules.tone === 'friendly' && styles.ruleOptionActive]}
            onPress={() => setRules(prev => ({ ...prev, tone: 'friendly' }))}
            disabled={!isAdmin}
          >
            <Feather name={rules.tone === 'friendly' ? 'check-circle' : 'circle'} size={16} color={rules.tone === 'friendly' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.ruleOptionText, rules.tone === 'friendly' && styles.ruleOptionTextActive]}>Freundlich</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ruleOption, rules.tone === 'professional' && styles.ruleOptionActive]}
            onPress={() => setRules(prev => ({ ...prev, tone: 'professional' }))}
            disabled={!isAdmin}
          >
            <Feather name={rules.tone === 'professional' ? 'check-circle' : 'circle'} size={16} color={rules.tone === 'professional' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.ruleOptionText, rules.tone === 'professional' && styles.ruleOptionTextActive]}>Sachlich</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ruleOption, (!rules.tone || rules.tone === 'neutral') && styles.ruleOptionActive]}
            onPress={() => setRules(prev => ({ ...prev, tone: 'neutral' }))}
            disabled={!isAdmin}
          >
            <Feather name={!rules.tone || rules.tone === 'neutral' ? 'check-circle' : 'circle'} size={16} color={!rules.tone || rules.tone === 'neutral' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.ruleOptionText, (!rules.tone || rules.tone === 'neutral') && styles.ruleOptionTextActive]}>Neutral</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ruleRow}>
          <Text style={styles.ruleLabel}>Emojis erlauben</Text>
          <Switch
            value={!!rules.allow_emoji}
            onValueChange={v => setRules(prev => ({ ...prev, allow_emoji: v }))}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={rules.allow_emoji ? Colors.primary : Colors.textTertiary}
            disabled={!isAdmin}
          />
        </View>

        <Text style={styles.ruleSubLabel}>Antwortlänge</Text>
        <View style={styles.ruleOptions}>
          <TouchableOpacity
            style={[styles.ruleOption, rules.response_length === 'short' && styles.ruleOptionActive]}
            onPress={() => setRules(prev => ({ ...prev, response_length: 'short' }))}
            disabled={!isAdmin}
          >
            <Feather name={rules.response_length === 'short' ? 'check-circle' : 'circle'} size={16} color={rules.response_length === 'short' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.ruleOptionText, rules.response_length === 'short' && styles.ruleOptionTextActive]}>Kurz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ruleOption, (!rules.response_length || rules.response_length === 'medium') && styles.ruleOptionActive]}
            onPress={() => setRules(prev => ({ ...prev, response_length: 'medium' }))}
            disabled={!isAdmin}
          >
            <Feather name={!rules.response_length || rules.response_length === 'medium' ? 'check-circle' : 'circle'} size={16} color={!rules.response_length || rules.response_length === 'medium' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.ruleOptionText, (!rules.response_length || rules.response_length === 'medium') && styles.ruleOptionTextActive]}>Mittel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ruleOption, rules.response_length === 'detailed' && styles.ruleOptionActive]}
            onPress={() => setRules(prev => ({ ...prev, response_length: 'detailed' }))}
            disabled={!isAdmin}
          >
            <Feather name={rules.response_length === 'detailed' ? 'check-circle' : 'circle'} size={16} color={rules.response_length === 'detailed' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.ruleOptionText, rules.response_length === 'detailed' && styles.ruleOptionTextActive]}>Ausführlich</Text>
          </TouchableOpacity>
        </View>

        {isAdmin && (
          <TouchableOpacity
            style={[styles.saveBtn, rulesSaving && styles.saveBtnDisabled]}
            onPress={handleSaveRules}
            disabled={rulesSaving}
          >
            {rulesSaving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : rulesSaved ? (
              <Text style={styles.saveBtnText}>Gespeichert ✓</Text>
            ) : (
              <Text style={styles.saveBtnText}>Regeln speichern</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Kontext-Einträge ({entries.length})</Text>
        {isAdmin && (
          <TouchableOpacity style={styles.addBtn} onPress={handleNew}>
            <Feather name="plus" size={18} color={Colors.primary} />
            <Text style={styles.addBtnText}>Hinzufügen</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="info" size={24} color={Colors.textTertiary} />
          {isAdmin ? (
            <Text style={styles.emptyText}>
              Noch keine Kontext-Einträge für diese Organisation. Erstelle den ersten, damit die KI
              bessere Antwortvorschläge liefern kann.
            </Text>
          ) : (
            <Text style={styles.emptyText}>
              Noch keine Kontext-Einträge für diese Organisation. Bitte wende dich an einen Admin.
            </Text>
          )}
        </View>
      ) : (
        entries.map(entry => (
          <View key={entry.id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <View style={styles.entryTopicBadge}>
                <Text style={styles.entryTopicText}>{entry.topic}</Text>
              </View>
              {isAdmin && (
                <View style={styles.entryActions}>
                  <TouchableOpacity onPress={() => handleEdit(entry)} style={styles.iconBtn}>
                    <Feather name="edit-2" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(entry.id)} style={styles.iconBtn}>
                    <Feather name="trash-2" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <Text style={styles.entryContent} numberOfLines={3}>{entry.content}</Text>
          </View>
        ))
      )}

      <View style={styles.divider} />
      <PersonalAISection />
    </ScrollView>
  );
}

function PersonalAISection() {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const [ctxRes, prefsRes] = await Promise.all([
        fetch(`${API_URL}/api/ai/context`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${API_URL}/api/user-preferences`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);
      const ctxJson = await ctxRes.json();
      if (ctxJson.entries) setEntries(ctxJson.entries);
      const prefsJson = await prefsRes.json();
      if (prefsJson.preferences?.openai_api_key) {
        setApiKey(prefsJson.preferences.openai_api_key);
      }
    } catch (e) {
      console.warn('[AI] Failed to fetch personal:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveApiKey = async () => {
    setSavingKey(true);
    setApiKeySaved(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { Alert.alert('Fehler', 'Nicht angemeldet – bitte Seite neu laden'); setSavingKey(false); return; }
      const res = await fetch(`${API_URL}/api/user-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ preferences: { openai_api_key: apiKey } }),
      });
      if (!res.ok) {
        const err = await res.json();
        Alert.alert('Fehler', err.error || 'Speichern fehlgeschlagen');
        setSavingKey(false);
        return;
      }
      setApiKeySaved(true);
      setSavingKey(false);
      setTimeout(() => setApiKeySaved(false), 2000);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
      setSavingKey(false);
    }
  };

  const handleSave = async () => {
    if (!topic.trim() || !content.trim()) {
      Alert.alert('Fehler', 'Thema und Inhalt dürfen nicht leer sein.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const url = editingId
        ? `${API_URL}/api/ai/context/${editingId}`
        : `${API_URL}/api/ai/context`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ topic: topic.trim(), content: content.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        Alert.alert('Fehler', err.error || 'Speichern fehlgeschlagen');
        return;
      }
      setEditingId(null);
      setTopic('');
      setContent('');
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: ContextEntry) => {
    setEditingId(entry.id);
    setTopic(entry.topic);
    setContent(entry.content);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Löschen', 'Diesen persönlichen Kontext-Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          await fetch(`${API_URL}/api/ai/context/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          await fetchData();
        },
      },
    ]);
  };

  const handleNew = () => {
    setEditingId(null);
    setTopic('');
    setContent('');
  };

  if (editingId !== null || (topic && editingId === null)) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setEditingId(null); setTopic(''); setContent(''); }} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{editingId ? 'Persönlichen Eintrag bearbeiten' : 'Neuer persönlicher Eintrag'}</Text>
        </View>
        <Text style={styles.label}>Thema</Text>
        <View style={styles.topicSuggestions}>
          {SUGGESTED_TOPICS.filter(t => !editingId || t === topic).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.topicChip, topic === t && styles.topicChipActive]}
              onPress={() => setTopic(t)}
            >
              <Text style={[styles.topicChipText, topic === t && styles.topicChipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.textInput}
          value={topic}
          onChangeText={setTopic}
          placeholder="Oder eigenes Thema eingeben…"
          placeholderTextColor={Colors.textTertiary}
        />
        <Text style={styles.label}>Inhalt</Text>
        <Text style={styles.hint}>
          Beschreibe hier, worauf die KI bei diesem Thema achten soll.
          Z.B. Produktdetails, Versandkosten, Rückgabebedingungen, etc.
        </Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          placeholder="Gib hier den Kontext ein…"
          placeholderTextColor={Colors.textTertiary}
        />
        <TouchableOpacity
          style={[styles.saveBtn, (!topic.trim() || !content.trim()) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!topic.trim() || !content.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>Speichern</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>OpenAI API Key (Persönlich)</Text>
        <Text style={styles.hint}>
          Wird nur verwendet, wenn kein Org-API-Key gesetzt ist.
        </Text>
        <View style={styles.apiKeyRow}>
          <TextInput
            style={[styles.textInput, { flex: 1 }]}
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry={!showApiKey}
            placeholder="sk-..."
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.apiKeyToggle} onPress={() => setShowApiKey(!showApiKey)}>
            <Feather name={showApiKey ? 'eye-off' : 'eye'} size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, savingKey && styles.saveBtnDisabled]}
          onPress={handleSaveApiKey}
          disabled={savingKey}
        >
          {savingKey ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : apiKeySaved ? (
            <Text style={styles.saveBtnText}>Gespeichert ✓</Text>
          ) : (
            <Text style={styles.saveBtnText}>API Key speichern</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Persönliche Kontext-Einträge ({entries.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleNew}>
          <Feather name="plus" size={18} color={Colors.primary} />
          <Text style={styles.addBtnText}>Hinzufügen</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="info" size={24} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>
            Noch keine persönlichen Kontext-Einträge. Diese werden zusätzlich zu den
            Organisations-Einträgen in den Prompt eingemischt.
          </Text>
        </View>
      ) : (
        entries.map(entry => (
          <View key={entry.id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <View style={styles.entryTopicBadge}>
                <Text style={styles.entryTopicText}>{entry.topic}</Text>
              </View>
              <View style={styles.entryActions}>
                <TouchableOpacity onPress={() => handleEdit(entry)} style={styles.iconBtn}>
                  <Feather name="edit-2" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(entry.id)} style={styles.iconBtn}>
                  <Feather name="trash-2" size={16} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.entryContent} numberOfLines={3}>{entry.content}</Text>
          </View>
        ))
      )}
    </View>
  );
}

// User-level fallback for users without an org
function UserLevelAISettings() {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const [ctxRes, prefsRes] = await Promise.all([
        fetch(`${API_URL}/api/ai/context`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${API_URL}/api/user-preferences`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);
      const ctxJson = await ctxRes.json();
      if (ctxJson.entries) setEntries(ctxJson.entries);
      const prefsJson = await prefsRes.json();
      if (prefsJson.preferences?.openai_api_key) {
        setApiKey(prefsJson.preferences.openai_api_key);
      }
    } catch (e) {
      console.warn('[AI] Failed to fetch:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSaveApiKey = async () => {
    setSavingKey(true);
    setApiKeySaved(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { Alert.alert('Fehler', 'Nicht angemeldet – bitte Seite neu laden'); setSavingKey(false); return; }
      const res = await fetch(`${API_URL}/api/user-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ preferences: { openai_api_key: apiKey } }),
      });
      if (!res.ok) {
        const err = await res.json();
        Alert.alert('Fehler', err.error || 'Speichern fehlgeschlagen');
        setSavingKey(false);
        return;
      }
      setApiKeySaved(true);
      setSavingKey(false);
      setTimeout(() => setApiKeySaved(false), 2000);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
      setSavingKey(false);
    }
  };

  const handleSave = async () => {
    if (!topic.trim() || !content.trim()) {
      Alert.alert('Fehler', 'Thema und Inhalt dürfen nicht leer sein.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const url = editingId
        ? `${API_URL}/api/ai/context/${editingId}`
        : `${API_URL}/api/ai/context`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ topic: topic.trim(), content: content.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        Alert.alert('Fehler', err.error || 'Speichern fehlgeschlagen');
        return;
      }
      setEditingId(null);
      setTopic('');
      setContent('');
      await fetchEntries();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: ContextEntry) => {
    setEditingId(entry.id);
    setTopic(entry.topic);
    setContent(entry.content);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Löschen', 'Diesen Kontext-Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          await fetch(`${API_URL}/api/ai/context/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          await fetchEntries();
        },
      },
    ]);
  };

  const handleNew = () => {
    setEditingId(null);
    setTopic('');
    setContent('');
  };

  if (editingId !== null || (topic && editingId === null)) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setEditingId(null); setTopic(''); setContent(''); }} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{editingId ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</Text>
        </View>
        <Text style={styles.label}>Thema</Text>
        <View style={styles.topicSuggestions}>
          {SUGGESTED_TOPICS.filter(t => !editingId || t === topic).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.topicChip, topic === t && styles.topicChipActive]}
              onPress={() => setTopic(t)}
            >
              <Text style={[styles.topicChipText, topic === t && styles.topicChipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.textInput}
          value={topic}
          onChangeText={setTopic}
          placeholder="Oder eigenes Thema eingeben…"
          placeholderTextColor={Colors.textTertiary}
        />
        <Text style={styles.label}>Inhalt</Text>
        <Text style={styles.hint}>
          Beschreibe hier, worauf die KI bei diesem Thema achten soll.
          Z.B. Produktdetails, Versandkosten, Rückgabebedingungen, etc.
        </Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          placeholder="Gib hier den Kontext ein…"
          placeholderTextColor={Colors.textTertiary}
        />
        <TouchableOpacity
          style={[styles.saveBtn, (!topic.trim() || !content.trim()) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!topic.trim() || !content.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>Speichern</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Künstliche Intelligenz</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>KI Antwortvorschläge</Text>
        <Text style={styles.cardDescription}>
          Du bist keiner Organisation zugeordnet. Die Einstellungen gelten daher nur für dich persönlich.
          Tritt einer Organisation bei, um gemeinsame KI-Einstellungen zu nutzen.
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>OpenAI API Key</Text>
        <Text style={styles.hint}>
          Hol dir einen Key unter{' '}
          <Text style={{ color: Colors.primary }}>platform.openai.com/api-keys</Text>
        </Text>
        <View style={styles.apiKeyRow}>
          <TextInput
            style={[styles.textInput, { flex: 1 }]}
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry={!showApiKey}
            placeholder="sk-..."
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.apiKeyToggle} onPress={() => setShowApiKey(!showApiKey)}>
            <Feather name={showApiKey ? 'eye-off' : 'eye'} size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, savingKey && styles.saveBtnDisabled]}
          onPress={handleSaveApiKey}
          disabled={savingKey}
        >
          {savingKey ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : apiKeySaved ? (
            <Text style={styles.saveBtnText}>Gespeichert ✓</Text>
          ) : (
            <Text style={styles.saveBtnText}>API Key speichern</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Kontext-Einträge ({entries.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleNew}>
          <Feather name="plus" size={18} color={Colors.primary} />
          <Text style={styles.addBtnText}>Hinzufügen</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="info" size={24} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>
            Noch keine Kontext-Einträge. Erstelle den ersten, damit die KI
            bessere Antwortvorschläge liefern kann.
          </Text>
        </View>
      ) : (
        entries.map(entry => (
          <View key={entry.id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <View style={styles.entryTopicBadge}>
                <Text style={styles.entryTopicText}>{entry.topic}</Text>
              </View>
              <View style={styles.entryActions}>
                <TouchableOpacity onPress={() => handleEdit(entry)} style={styles.iconBtn}>
                  <Feather name="edit-2" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(entry.id)} style={styles.iconBtn}>
                  <Feather name="trash-2" size={16} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.entryContent} numberOfLines={3}>{entry.content}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xl,
    maxWidth: Layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  backBtn: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  title: {
    fontFamily: FontFamily,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  cardDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: Spacing.sm,
  },
  addBtnText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  entryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  entryTopicBadge: {
    backgroundColor: Colors.primaryLight + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  entryTopicText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  entryActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconBtn: {
    padding: Spacing.xs,
  },
  entryContent: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
    lineHeight: 16,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  textArea: {
    minHeight: 150,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  topicSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  topicChip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  topicChipActive: {
    backgroundColor: Colors.primaryLight + '20',
    borderColor: Colors.primary,
  },
  topicChipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  topicChipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  apiKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  apiKeyToggle: {
    padding: Spacing.sm,
  },
  orgList: {
    gap: Spacing.sm,
  },
  orgOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orgOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '10',
  },
  orgOptionText: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },
  orgOptionTextActive: {
    color: Colors.primary,
  },
  orgBadge: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    backgroundColor: Colors.primaryLight + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xl,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  ruleLabel: {
    fontSize: FontSize.sm,
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.md,
  },
  ruleSubLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  ruleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  ruleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  ruleOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '10',
  },
  ruleOptionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  ruleOptionTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
});
