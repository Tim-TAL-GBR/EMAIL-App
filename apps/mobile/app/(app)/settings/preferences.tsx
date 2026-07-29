import { API_URL } from "@/lib/constants";
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';

const TABS = [
  'Allgemein', 'Erscheinungsbild', 'Kalender', 'Composer', 'Kontakte',
  'Benachrichtigungen', 'Tastenkürzel', 'Snoozes', 'Suche', 'Wischgesten'
];



type PrefValue = boolean | string | number;
type Preferences = Record<string, PrefValue>;

const DEFAULT_PREFS: Preferences = {
  markReadOnOpen: true,
  markReadOnArchive: true,
  moveOnComment: false,
  quickLookAttachments: false,
  undoDuration: 10,
  doubleClickAction: 'new_window',
  archiveDirection: 'previous',
  dragBehavior: 'move',
  openConversationAt: 'first_unread',
  watchOnComment: false,
  watchOnTask: true,
  watchOnDraft: false,
  watchOnCreate: false,
  showWhatsNew: true,
  archiveAssignedConfirm: 'ask',
  deleteTeamConfirm: 'delete',
  shareUsageData: false,
};

type DropdownOption = { label: string; value: string };

function Dropdown({ value, options, onChange }: { value: string; options: DropdownOption[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <View style={styles.dropdownWrapper}>
      <TouchableOpacity style={styles.dropdownButton} onPress={() => setOpen(!open)}>
        <Text style={styles.dropdownButtonText}>{selected?.label || value}</Text>
        <Text style={styles.dropdownArrow}>{open ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdownMenu}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.dropdownItem, opt.value === value && styles.dropdownItemActive]}
              onPress={() => { onChange(opt.value); setOpen(false); }}
            >
              <Text style={[styles.dropdownItemText, opt.value === value && styles.dropdownItemTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function PreferencesSettingsScreen() {
  const [activeTab, setActiveTab] = useState('Allgemein');
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(`${API_URL}/api/user-preferences`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (json.preferences) {
          setPrefs(prev => ({ ...prev, ...json.preferences }));
        }
      } catch { /* use defaults */ }
      setLoading(false);
    })();
  }, []);

  const updatePref = useCallback(async (key: string, value: PrefValue) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`${API_URL}/api/user-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ preferences: { [key]: value } }),
      });
    } catch { /* silently fail */ }
  }, []);

  const renderPlaceholder = () => (
    <View style={styles.centerContent}>
      <Text style={styles.placeholderIcon}>⚙</Text>
      <Text style={styles.placeholderTitle}>{activeTab}</Text>
      <Text style={styles.placeholderText}>Einstellungen für diesen Bereich folgen in Kürze.</Text>
    </View>
  );

  const renderGeneral = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>App</Text>
      <View style={styles.card}>
        <SettingToggle label="Badge-Zähler im Dock anzeigen" value={prefs.badgeCounter as boolean} onChange={v => updatePref('badgeCounter', v)} />
        <SettingToggle label="Zuletzt geöffnete Ansicht beim Beenden merken" value={prefs.rememberLastView as boolean} onChange={v => updatePref('rememberLastView', v)} />
        <SettingToggle label="App beenden, wenn das Hauptfenster geschlossen wird" value={prefs.closeOnMainWindowClose as boolean} onChange={v => updatePref('closeOnMainWindowClose', v)} />

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Speicherort für Downloads</Text>
          <View style={styles.rowRight}>
            <TouchableOpacity><Text style={styles.actionText}>Öffnen</Text></TouchableOpacity>
            <Dropdown value={prefs.downloadLocation as string || 'Downloads'} options={[
              { label: 'Downloads', value: 'Downloads' },
              { label: 'Desktop', value: 'Desktop' },
              { label: 'Benutzerdefiniert…', value: 'custom' },
            ]} onChange={v => updatePref('downloadLocation', v)} />
          </View>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Speicherort für Anhänge</Text>
          <View style={styles.rowRight}>
            <TouchableOpacity><Text style={styles.actionText}>Öffnen</Text></TouchableOpacity>
            <Dropdown value={prefs.attachmentLocation as string || 'teammail'} options={[
              { label: 'teammail', value: 'teammail' },
              { label: 'Downloads', value: 'Downloads' },
              { label: 'Desktop', value: 'Desktop' },
              { label: 'Benutzerdefiniert…', value: 'custom' },
            ]} onChange={v => updatePref('attachmentLocation', v)} />
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Aktionen</Text>
      <View style={styles.card}>
        <SettingToggle label="Unterhaltungen beim Öffnen als gelesen markieren" value={prefs.markReadOnOpen as boolean} onChange={v => updatePref('markReadOnOpen', v)} />
        <SettingToggle label="Unterhaltungen beim Archivieren, Schließen oder Löschen als gelesen markieren" value={prefs.markReadOnArchive as boolean} onChange={v => updatePref('markReadOnArchive', v)} />
        <SettingToggle label="Unterhaltungen beim Kommentieren nach oben verschieben" value={prefs.moveOnComment as boolean} onChange={v => updatePref('moveOnComment', v)} />
        <SettingToggle label="Anhänge immer in Quick Look vorschauen" value={prefs.quickLookAttachments as boolean} onChange={v => updatePref('quickLookAttachments', v)} />

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Rückgängig-Banner anzeigen</Text>
          <Dropdown value={String(prefs.undoDuration)} options={[
            { label: '5 Sekunden', value: '5' },
            { label: '10 Sekunden', value: '10' },
            { label: '15 Sekunden', value: '15' },
            { label: '30 Sekunden', value: '30' },
            { label: 'Aus', value: '0' },
          ]} onChange={v => updatePref('undoDuration', Number(v))} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Bei Doppelklick auf Unterhaltung</Text>
          <Dropdown value={prefs.doubleClickAction as string} options={[
            { label: 'In neuem Fenster öffnen', value: 'new_window' },
            { label: 'Im aktuellen Fenster öffnen', value: 'same_window' },
            { label: 'Nichts tun', value: 'none' },
          ]} onChange={v => updatePref('doubleClickAction', v)} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Beim Archivieren einer Unterhaltung</Text>
          <Dropdown value={prefs.archiveDirection as string} options={[
            { label: 'Verschieben je nach vorheriger Richtung', value: 'previous' },
            { label: 'Zur nächsten wechseln', value: 'next' },
            { label: 'Zur vorherigen wechseln', value: 'prev' },
          ]} onChange={v => updatePref('archiveDirection', v)} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Beim Ziehen einer Unterhaltung</Text>
          <Dropdown value={prefs.dragBehavior as string} options={[
            { label: 'Verschieben', value: 'move' },
            { label: 'Kopieren', value: 'copy' },
          ]} onChange={v => updatePref('dragBehavior', v)} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Unterhaltungen öffnen bei</Text>
          <Dropdown value={prefs.openConversationAt as string} options={[
            { label: 'Erstem ungelesenen Eintrag', value: 'first_unread' },
            { label: 'Neuestem Eintrag', value: 'newest' },
            { label: 'Ältestem Eintrag', value: 'oldest' },
          ]} onChange={v => updatePref('openConversationAt', v)} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Beobachten</Text>
      <View style={styles.card}>
        <SettingToggle label="Unterhaltungen beim Kommentieren automatisch beobachten" value={prefs.watchOnComment as boolean} onChange={v => updatePref('watchOnComment', v)} />
        <SettingToggle label="Unterhaltungen beim Erstellen einer Aufgabe automatisch beobachten" value={prefs.watchOnTask as boolean} onChange={v => updatePref('watchOnTask', v)} />
        <SettingToggle label="Unterhaltungen beim Starten eines Entwurfs automatisch beobachten" value={prefs.watchOnDraft as boolean} onChange={v => updatePref('watchOnDraft', v)} />
        <SettingToggle label="Unterhaltungen, die ich erstelle, automatisch beobachten" value={prefs.watchOnCreate as boolean} onChange={v => updatePref('watchOnCreate', v)} />
      </View>

      <Text style={styles.sectionTitle}>Nachfragen</Text>
      <View style={styles.card}>
        <SettingToggle label="„Was ist neu?“-Popup nach Update anzeigen" value={prefs.showWhatsNew as boolean} onChange={v => updatePref('showWhatsNew', v)} />
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Archivieren von zugewiesenen Unterhaltungen im Eingang</Text>
          <Dropdown value={prefs.archiveAssignedConfirm as string} options={[
            { label: 'Nachfragen', value: 'ask' },
            { label: 'Immer archivieren', value: 'always' },
            { label: 'Nicht archivieren', value: 'never' },
          ]} onChange={v => updatePref('archiveAssignedConfirm', v)} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Löschen von Unterhaltungen in einem Team-Postfach</Text>
          <Dropdown value={prefs.deleteTeamConfirm as string} options={[
            { label: 'Löschen', value: 'delete' },
            { label: 'Nachfragen', value: 'ask' },
          ]} onChange={v => updatePref('deleteTeamConfirm', v)} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Marketing-Zustimmung</Text>
      <View style={styles.card}>
        <SettingToggle label="Anonymisierte Anmelde- und Abodaten mit Werbeplattformen teilen, um unsere Anzeigen zielgerichteter zu machen." value={prefs.shareUsageData as boolean} onChange={v => updatePref('shareUsageData', v)} />
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchPlaceholder}>🔍 Einstellungen durchsuchen...</Text>
        </View>
        <ScrollView>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.main}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{activeTab}</Text>
        </View>
        {loading ? (
          <View style={styles.centerContent}>
            <Text style={styles.placeholderText}>Lade Einstellungen...</Text>
          </View>
        ) : activeTab === 'Allgemein' ? renderGeneral() : renderPlaceholder()}
      </View>
    </View>
  );
}

function SettingToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, { flex: 1, marginRight: Spacing.md }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.info }}
        thumbColor="#FFF"
        ios_backgroundColor={Colors.border}
      />
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
    width: 220,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
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
  tabItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.xs,
    marginTop: Spacing.xs,
    borderRadius: 6,
  },
  tabItemActive: {
    backgroundColor: Colors.info,
  },
  tabLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  tabLabelActive: {
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
  main: {
    flex: 1,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    maxWidth: 700,
  },
  sectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  settingLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  actionText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
  },
  dropdownWrapper: {
    position: 'relative',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHover,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    gap: 4,
  },
  dropdownButtonText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  dropdownArrow: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
    minWidth: 200,
  },
  dropdownItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownItemActive: {
    backgroundColor: Colors.surfaceHover,
  },
  dropdownItemText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  dropdownItemTextActive: {
    fontWeight: FontWeight.bold,
    color: Colors.info,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  placeholderIcon: {
    fontSize: 32,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  placeholderTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  placeholderText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
