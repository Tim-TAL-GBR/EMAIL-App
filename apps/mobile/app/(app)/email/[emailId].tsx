import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../lib/constants';
import { EmailView } from '../../../components/email/EmailView';

export default function EmailScreen() {
  const { emailId } = useLocalSearchParams<{ emailId: string }>();

  if (!emailId) return null;

  return (
    <View style={styles.container}>
      <EmailView emailId={emailId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  }
});

