import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontFamily, FontWeight } from '../../lib/constants';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function OfflineBanner() {
  const netInfo = useNetInfo();
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  
  // We consider it offline if isConnected is explicitly false
  // (null means it's still initializing)
  useEffect(() => {
    if (netInfo.isConnected === false) {
      setIsOffline(true);
    } else if (netInfo.isConnected === true) {
      setIsOffline(false);
    }
  }, [netInfo.isConnected]);

  const translateY = useSharedValue(-100);

  useEffect(() => {
    if (isOffline) {
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      translateY.value = withTiming(-100, { duration: 300 });
    }
  }, [isOffline, translateY]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
    <Animated.View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? insets.top || 40 : 10 }, animatedStyle]}>
      <View style={styles.inner}>
        <Feather name="wifi-off" size={16} color="#FFFFFF" style={styles.icon} />
        <Text style={styles.text}>Keine Internetverbindung</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#EF4444', // Red-500
    zIndex: 9999, // Ensure it's above everything
    elevation: 10,
    paddingBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  text: {
    color: '#FFFFFF',
    fontFamily: FontFamily,
    fontWeight: FontWeight.medium,
    fontSize: FontSize.sm,
  },
});
