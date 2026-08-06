import { useEffect } from 'react';
import { Stack as ExpoStack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../lib/constants';
import { GlobalComposer } from '../components/email/GlobalComposer';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { OfflineBanner } from '../components/ui/OfflineBanner';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  usePushNotifications(); // <-- ADDED THIS
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isAuthenticated && inAuthGroup) {
      // Redirect away from login screen
      router.replace('/(app)');
    } else if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login screen
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading, segments]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <ExpoStack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <ExpoStack.Screen name="(auth)" options={{ headerShown: false }} />
        <ExpoStack.Screen name="(app)" options={{ headerShown: false }} />
      </ExpoStack>
      <GlobalComposer />
      <OfflineBanner />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Sentry.wrap(RootLayout);
