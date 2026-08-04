import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineSyncStore } from '../stores/offlineSyncStore';
import { Colors } from '../lib/constants';

export const OfflineIndicator = () => {
  const [isOffline, setIsOffline] = useState(false);
  const syncQueue = useOfflineSyncStore((state) => state.syncQueue);
  const queueLength = useOfflineSyncStore((state) => state.queue.length);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
      
      if (!offline) {
        // We came back online, sync the queue
        syncQueue();
      }
    });

    return () => unsubscribe();
  }, [syncQueue]);

  if (!isOffline) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Keine Internetverbindung. {queueLength > 0 ? `(${queueLength} Änderungen warten)` : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ef4444',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
});
