import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../lib/constants';
import { InboxSidebar } from '../../components/inbox/InboxSidebar';

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <InboxSidebar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
