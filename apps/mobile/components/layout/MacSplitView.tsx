import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Colors, Layout, Spacing } from '../../lib/constants';
import { InboxSidebar } from '../inbox/InboxSidebar';

interface MacSplitViewProps {
  inboxId: string | null;
  emailId: string | null;
  onSelectInbox: (id: string) => void;
  onSelectEmail: (id: string) => void;
  inboxList: React.ReactNode;
  emailDetail: React.ReactNode | null;
}

const SIDEBAR_WIDTH = Layout.sidebarWidth;
const LIST_MIN_WIDTH = 280;
const DETAIL_MIN_WIDTH = 400;

export function MacSplitView({
  inboxId,
  emailId,
  onSelectInbox,
  onSelectEmail,
  inboxList,
  emailDetail,
}: MacSplitViewProps) {
  const [listWidth, setListWidth] = useState(320);

  if (Platform.OS !== 'macos') return null;

  return (
    <View style={styles.container}>
      <InboxSidebar />
      <View style={[styles.middleColumn, { width: listWidth }]}>
        {inboxList}
      </View>
      <View style={styles.detailColumn}>
        {emailDetail}
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
  middleColumn: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  detailColumn: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
