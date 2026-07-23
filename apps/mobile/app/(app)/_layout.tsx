import React from 'react';
import { View, useWindowDimensions, StyleSheet, Platform } from 'react-native';
import { Stack, Slot, usePathname } from 'expo-router';
import { Colors } from '../../lib/constants';
import { DesktopLayout } from '../../components/layout/DesktopLayout';
import { Onboarding } from '../../components/layout/Onboarding';
import { useInboxes } from '../../hooks/useInboxes';

const isMac = Platform.OS === 'macos';
const BREAKPOINT_TABLET = 768;
const BREAKPOINT_DESKTOP = 1024;

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { inboxes, isLoading } = useInboxes();

  const isDesktop = isMac || width >= BREAKPOINT_DESKTOP;
  
  // Only use the 3-pane layout for the main inbox/email views
  const isSettings = pathname.startsWith('/settings');

  if (inboxes.length === 0 && !isLoading && !isSettings) {
    return <Onboarding />;
  }

  if (isDesktop && !isSettings) {
    return (
      <DesktopLayout>
        <Slot />
      </DesktopLayout>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Stack screenOptions={{ 
          headerShown: true,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.background },
        }}>
          <Stack.Screen name="index" options={{ title: 'TeamMail' }} />
          <Stack.Screen name="inbox/list" options={{ title: 'Inbox' }} />
          <Stack.Screen name="email/[emailId]" options={{ 
            title: 'E-Mail Details',
            headerShown: !isMac,
          }} />
          <Stack.Screen name="settings" options={{ title: 'Einstellungen', headerShown: false }} />
          <Stack.Screen name="templates/index" options={{ title: 'Vorlagen' }} />
        </Stack>
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
  content: {
    flex: 1,
  },
  contentWithSidebar: {
    maxWidth: isMac ? undefined : 800,
  },
});
