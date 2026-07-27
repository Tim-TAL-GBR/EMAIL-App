import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { useAuthStore } from '../../../stores/authStore';

export default function SecuritySettingsScreen() {
  const { user, updatePassword, resetPasswordForEmail } = useAuthStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Extract name for avatar
  const nameParts = (user?.user_metadata?.display_name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Fehler', 'Das neue Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    setIsUpdatingPassword(true);
    const { error } = await updatePassword(newPassword);
    setIsUpdatingPassword(false);
    if (error) {
      Alert.alert('Fehler', error.message);
    } else {
      Alert.alert('Erfolg', 'Passwort wurde aktualisiert.');
      setOldPassword('');
      setNewPassword('');
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setIsSendingReset(true);
    const { error } = await resetPasswordForEmail(user.email);
    setIsSendingReset(false);
    if (error) {
      Alert.alert('Fehler', error.message);
    } else {
      Alert.alert('Erfolg', 'Anweisungen zum Zurücksetzen des Passworts wurden gesendet.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {firstName.charAt(0).toUpperCase()}{lastName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Du</Text>
          <Text style={styles.headerSubtitle}>Login & Sicherheit</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        
        {/* Email */}
        <View style={styles.sectionRow}>
          <View style={styles.iconPlaceholder} />
          <View style={styles.sectionContent}>
            <Text style={styles.label}>Login-E-Mail</Text>
            <Text style={styles.valueText}>{user?.email}</Text>
          </View>
        </View>

        {/* Password Update */}
        <View style={styles.sectionRow}>
          <View style={styles.iconPlaceholder} />
          <View style={styles.sectionContent}>
            <TextInput
              style={styles.input}
              placeholder="Altes Passwort"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
            />
            <TextInput
              style={styles.input}
              placeholder="Neues Passwort"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <View style={styles.checkboxRow}>
              <View style={styles.checkbox} />
              <Text style={styles.checkboxLabel}>Aus allen anderen Sitzungen abmelden</Text>
            </View>
            <TouchableOpacity 
              style={[styles.buttonPrimary, isUpdatingPassword && styles.buttonDisabled]}
              onPress={handleUpdatePassword}
              disabled={isUpdatingPassword}
            >
              <Text style={styles.buttonPrimaryText}>
                {isUpdatingPassword ? 'Wird aktualisiert...' : 'Passwort bestätigen'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Forgot Password */}
        <View style={styles.sectionRow}>
          <View style={styles.iconPlaceholder} />
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>Passwort vergessen?</Text>
            <Text style={styles.description}>
              Eine E-Mail mit einem Link zum Zurücksetzen deines Passworts wird an {user?.email} gesendet.
            </Text>
            <TouchableOpacity 
              style={[styles.buttonSecondary, isSendingReset && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={isSendingReset}
            >
              <Text style={styles.buttonSecondaryText}>
                {isSendingReset ? 'Wird gesendet...' : 'Anweisungen senden'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2FA */}
        <View style={styles.sectionRow}>
          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconText}>2FA</Text>
          </View>
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>Zwei-Faktor-Authentifizierung</Text>
            <Text style={styles.description}>
              Die Zwei-Faktor-Authentifizierung (2FA) verbessert die Sicherheit deines Kontos durch einen zweiten Schritt beim Login. Du musst zusätzlich zu deinem Passwort einen temporären Code eingeben, der auf deinem Smartphone generiert wird.
            </Text>
            <TouchableOpacity>
              <Text style={styles.linkText}>Zwei-Faktor-Authentifizierung aktivieren</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* OAuth */}
        <View style={styles.sectionRow}>
          <View style={styles.iconPlaceholder} />
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>Konto über OAuth sichern</Text>
            <Text style={styles.description}>
              Dies aktualisiert deine TeamMail-E-Mail-Adresse und deaktiviert den Login via E-Mail/Passwort.
            </Text>
            <View style={styles.oauthRow}>
              <TouchableOpacity style={styles.oauthButton}>
                <Text style={styles.oauthButtonText}>Mit Google anmelden</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.oauthButton}>
                <Text style={styles.oauthButtonText}>Mit Apple anmelden</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.checkboxRow}>
              <View style={styles.checkboxChecked} />
              <Text style={styles.checkboxLabel}>Aus allen anderen Sitzungen abmelden</Text>
            </View>
          </View>
        </View>

        {/* Active Sessions */}
        <View style={styles.sectionRow}>
          <View style={styles.iconPlaceholder} />
          <View style={styles.sectionContent}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Andere aktive Sitzungen</Text>
            </View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>IP-Adresse</Text>
              <Text style={[styles.tableHeaderText, { flex: 3 }]}>Gerät</Text>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Zuletzt aktiv</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCellText, styles.linkText, { flex: 2 }]}>149.233.220.64</Text>
              <Text style={[styles.tableCellText, { flex: 3 }]}>iOS (iPhone) 18.7</Text>
              <Text style={[styles.tableCellText, { flex: 2 }]}>19. Jul. 2026, 16:38</Text>
            </View>
            <TouchableOpacity style={styles.marginTop}>
              <Text style={styles.dangerText}>Alle widerrufen</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Export Data */}
        <View style={styles.sectionRow}>
          <View style={styles.iconPlaceholder} />
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>Daten exportieren</Text>
            <Text style={styles.description}>
              Exportiere deine Daten in einem maschinenlesbaren Format. Sobald der Export bereit ist, erhältst du eine Benachrichtigung im Eingang. Exporte sind auf einen pro Tag und Typ beschränkt.
            </Text>
            <View style={styles.tagsRow}>
              <View style={styles.tag}><Text style={styles.tagText}>Kommentare</Text></View>
              <View style={styles.tag}><Text style={styles.tagText}>Kontakte</Text></View>
              <View style={styles.tag}><Text style={styles.tagText}>Unterhaltungen</Text></View>
              <View style={styles.tag}><Text style={styles.tagText}>E-Mail-Adressen</Text></View>
              <View style={styles.tag}><Text style={styles.tagText}>Regeln</Text></View>
            </View>
          </View>
        </View>

        {/* Delete Account */}
        <View style={styles.sectionRow}>
          <View style={styles.iconPlaceholder} />
          <View style={styles.sectionContent}>
            <View style={styles.flexRowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>TeamMail-Konto löschen</Text>
                <Text style={styles.description}>
                  Lösche dein TeamMail-Konto ({user?.user_metadata?.display_name || user?.email}) und alle damit verbundenen Daten dauerhaft.
                </Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.dangerText}>Löschen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    color: '#FFF',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
  headerTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    maxWidth: Layout.maxContentWidth,
  },
  sectionRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  iconPlaceholder: {
    width: 32,
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  iconText: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.bold,
  },
  sectionContent: {
    flex: 1,
  },
  label: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  valueText: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
  sectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  description: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.md,
    color: Colors.text,
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    marginBottom: Spacing.sm,
    maxWidth: 400,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  checkboxChecked: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: Colors.border, // Simulate disabled checked state
    marginRight: Spacing.sm,
  },
  checkboxLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  buttonPrimary: {
    backgroundColor: Colors.text,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPrimaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.background,
  },
  buttonSecondary: {
    backgroundColor: Colors.surfaceHover,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  buttonSecondaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  linkText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
  },
  oauthRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 6,
  },
  oauthButtonText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
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
  },
  tableCellText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  dangerText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.error,
  },
  marginTop: {
    marginTop: Spacing.md,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  tagText: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  flexRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
});
