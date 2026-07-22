import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';

const TABS = [
  'Allgemein', 'Erscheinungsbild', 'Kalender', 'Composer', 'Kontakte', 
  'Benachrichtigungen', 'Tastenkürzel', 'Snoozes', 'Suche', 'Wischgesten'
];

export default function PreferencesSettingsScreen() {
  const [activeTab, setActiveTab] = useState('Allgemein');

  const renderContent = () => {
    if (activeTab === 'Allgemein') {
      return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.card}>
            <SettingToggle label="TeamMail als Standard-E-Mail-Programm festlegen" />
            <SettingToggle label="Badge-Zähler im Dock anzeigen" initialValue={true} />
            <SettingToggle label="Zuletzt geöffnete Ansicht beim Beenden merken" />
            <SettingToggle label="App beenden, wenn das Hauptfenster geschlossen wird" />
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Speicherort für Downloads</Text>
              <View style={styles.rowRight}>
                <Text style={styles.actionText}>Öffnen</Text>
                <Text style={styles.settingValue}>Downloads ↕</Text>
              </View>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Speicherort für Anhänge</Text>
              <View style={styles.rowRight}>
                <Text style={styles.actionText}>Öffnen</Text>
                <Text style={styles.settingValue}>teammail ↕</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Aktionen</Text>
          <View style={styles.card}>
            <SettingToggle label="Unterhaltungen beim Öffnen als gelesen markieren" initialValue={true} />
            <SettingToggle label="Unterhaltungen beim Archivieren, Schließen oder Löschen als gelesen markieren" initialValue={true} />
            <SettingToggle label="Unterhaltungen beim Kommentieren nach oben verschieben" />
            <SettingToggle label="Anhänge immer in Quick Look vorschauen" />
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Rückgängig-Banner anzeigen</Text>
              <Text style={styles.settingValue}>10 Sekunden ↕</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Bei Doppelklick auf Unterhaltung</Text>
              <Text style={styles.settingValue}>In neuem Fenster öffnen ↕</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Beim Archivieren einer Unterhaltung</Text>
              <Text style={styles.settingValue}>Verschieben je nach vorheriger Richtung ↕</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Beim Ziehen einer Unterhaltung</Text>
              <Text style={styles.settingValue}>Verschieben ↕</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Unterhaltungen öffnen bei</Text>
              <Text style={styles.settingValue}>Erstem ungelesenen Eintrag ↕</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Beobachten</Text>
          <View style={styles.card}>
            <SettingToggle label="Unterhaltungen beim Kommentieren automatisch beobachten" />
            <SettingToggle label="Unterhaltungen beim Erstellen einer Aufgabe automatisch beobachten" initialValue={true} />
            <SettingToggle label="Unterhaltungen beim Starten eines Entwurfs automatisch beobachten" />
            <SettingToggle label="Unterhaltungen, die ich erstelle, automatisch beobachten" />
          </View>
          
          <Text style={styles.sectionTitle}>Nachfragen</Text>
          <View style={styles.card}>
            <SettingToggle label="„Was ist neu?“-Popup nach Update anzeigen" initialValue={true} />
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Archivieren von zugewiesenen Unterhaltungen im Eingang</Text>
              <Text style={styles.settingValue}>Nachfragen ↕</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Löschen von Unterhaltungen in einem Team-Postfach</Text>
              <Text style={styles.settingValue}>Löschen ↕</Text>
            </View>
          </View>
          
          <Text style={styles.sectionTitle}>Marketing-Zustimmung</Text>
          <View style={styles.card}>
            <SettingToggle label="Anonymisierte Anmelde- und Abodaten mit Werbeplattformen teilen, um unsere Anzeigen zielgerichteter zu machen." />
          </View>
        </ScrollView>
      );
    }

    return (
      <View style={styles.centerContent}>
        <Text style={styles.emptyText}>Einstellungen für {activeTab} folgen in Kürze.</Text>
      </View>
    );
  };

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
        {renderContent()}
      </View>
    </View>
  );
}

function SettingToggle({ label, initialValue = false }: { label: string, initialValue?: boolean }) {
  const [value, setValue] = useState(initialValue);
  return (
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, { flex: 1, marginRight: Spacing.md }]}>{label}</Text>
      <Switch 
        value={value} 
        onValueChange={setValue}
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
    borderBottomColor: Colors.border,
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
  settingValue: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
});
