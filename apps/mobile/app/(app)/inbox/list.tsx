import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../../lib/constants';
import { InboxList } from '../../../components/inbox/InboxList';

export default function InboxListScreen() {
  return (
    <View style={styles.container}>
      <InboxList />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
