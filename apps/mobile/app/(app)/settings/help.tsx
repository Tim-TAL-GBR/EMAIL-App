import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';

export default function HelpSettingsScreen() {
  const [selectedItem, setSelectedItem] = useState<'support' | 'guides' | 'roadmap'>('support');

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarContent}>
          <TouchableOpacity 
            style={[styles.sidebarItem, selectedItem === 'support' && styles.sidebarItemActive]}
            onPress={() => setSelectedItem('support')}
          >
            <Text style={[styles.sidebarItemTitle, selectedItem === 'support' && styles.sidebarItemTitleActive]}>Support</Text>
            <Text style={[styles.sidebarItemSubtitle, selectedItem === 'support' && styles.sidebarItemSubtitleActive]}>Kontaktiere uns</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.sidebarItem, selectedItem === 'guides' && styles.sidebarItemActive]}
            onPress={() => setSelectedItem('guides')}
          >
            <Text style={[styles.sidebarItemTitle, selectedItem === 'guides' && styles.sidebarItemTitleActive]}>Anleitungen</Text>
            <Text style={[styles.sidebarItemSubtitle, selectedItem === 'guides' && styles.sidebarItemSubtitleActive]}>Dokumentation und Tutorials</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.sidebarItem, selectedItem === 'roadmap' && styles.sidebarItemActive]}
            onPress={() => setSelectedItem('roadmap')}
          >
            <Text style={[styles.sidebarItemTitle, selectedItem === 'roadmap' && styles.sidebarItemTitleActive]}>Roadmap</Text>
            <Text style={[styles.sidebarItemSubtitle, selectedItem === 'roadmap' && styles.sidebarItemSubtitleActive]}>Funktionswünsche</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {selectedItem === 'support' && (
            <>
              {/* Help Center */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Hilfe-Center</Text>
                <View style={styles.card}>
                  <Text style={styles.cardText}>
                    Für häufig gestellte Fragen und allgemeine Informationen besuche unser <Text style={styles.linkText}>Hilfe-Center</Text>.
                  </Text>
                </View>
              </View>

              {/* Feedback & Support */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Feedback & Support</Text>
                <View style={styles.card}>
                  <Text style={styles.cardText}>
                    Bei Fragen oder Problemen schreibe uns eine <Text style={styles.linkText}>E-Mail</Text>.
                  </Text>
                </View>
              </View>

              {/* Current version */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Aktuelle Version</Text>
                <View style={styles.card}>
                  <Text style={styles.cardText}>v11.32.1</Text>
                </View>
              </View>

              {/* Cache storage */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cache-Speicher</Text>
                <View style={styles.card}>
                  <Text style={styles.cardText}>
                    38.9MB (<Text style={styles.linkText}>Leeren</Text>)
                  </Text>
                </View>
              </View>

              {/* About TeamMail */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Über TeamMail</Text>
                <View style={styles.pillContainer}>
                  <TouchableOpacity style={styles.pill}>
                    <Text style={styles.pillText}>Startseite</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pill}>
                    <Text style={styles.pillText}>Status</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pill}>
                    <Text style={styles.pillText}>Datenschutzrichtlinie</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pill}>
                    <Text style={styles.pillText}>Sicherheit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pill}>
                    <Text style={styles.pillText}>Nutzungsbedingungen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {selectedItem === 'guides' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Anleitungen</Text>
              <View style={styles.card}>
                <Text style={styles.cardText}>Hier findest du bald unsere ausführliche Dokumentation und Tutorials.</Text>
              </View>
            </View>
          )}

          {selectedItem === 'roadmap' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Roadmap</Text>
              <View style={styles.card}>
                <Text style={styles.cardText}>Hier kannst du künftig neue Funktionen vorschlagen und abstimmen.</Text>
              </View>
            </View>
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
  },
  sidebarContent: {
    flex: 1,
    paddingTop: Spacing.md,
  },
  sidebarItem: {
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: 6,
  },
  sidebarItemActive: {
    backgroundColor: Colors.info,
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
    marginTop: 2,
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
  main: {
    flex: 1,
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
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
  },
  cardText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  linkText: {
    color: Colors.info,
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pill: {
    backgroundColor: '#F0F8FF',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFE0FF',
  },
  pillText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
  },
});
