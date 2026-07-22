import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { usePathname } from 'expo-router';
import { Colors } from '../../lib/constants';
import { InboxSidebar } from '../../components/inbox/InboxSidebar';
import { InboxList } from '../../components/inbox/InboxList';
import { EmailView } from '../../components/email/EmailView';
import { useNavigationStore } from '../../stores/navigationStore';

interface DesktopLayoutProps {
  children?: React.ReactNode;
}

export function DesktopLayout({ children }: DesktopLayoutProps) {
  const { activeContextType, activeContextId, selectedEmailId } = useNavigationStore();

  const pathname = usePathname();
  const isTasks = pathname.includes('/tasks');
  const isCalendars = pathname.includes('/calendars');

  return (
    <View style={styles.container}>
      {/* Pane 1: Sidebar */}
      <View style={styles.sidebarPane}>
        <InboxSidebar isDesktop />
      </View>

      {/* Right Content */}
      {isTasks || isCalendars ? (
        <View style={styles.fullPane}>
          {children}
        </View>
      ) : (
        <>
          {/* Always render children (Slot) so Expo Router doesn't crash, just hide it */}
          <View style={{ display: 'none' }}>
            {children}
          </View>
          
          {/* Pane 2: Email List */}
          <View style={styles.listPane}>
            {activeContextType && activeContextId ? (
              <InboxList isDesktop />
            ) : (
              <View style={styles.emptyPane}>
                <Text style={styles.emptyText}>Wähle ein Postfach aus</Text>
              </View>
            )}
          </View>

          {/* Pane 3: Email Detail & Chat */}
          <View style={styles.detailPane}>
            {selectedEmailId ? (
              <EmailView emailId={selectedEmailId} />
            ) : (
              <View style={styles.emptyPane}>
                <Text style={styles.emptyText}>Wähle eine E-Mail aus</Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  sidebarPane: {
    width: 280,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  fullPane: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listPane: {
    width: 350,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.background,
  },
  detailPane: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyPane: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: 16,
  }
});
