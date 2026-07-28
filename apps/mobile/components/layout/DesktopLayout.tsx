import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { usePathname } from 'expo-router';
import { Colors } from '../../lib/constants';
import { InboxSidebar } from '../../components/inbox/InboxSidebar';
import { InboxList } from '../../components/inbox/InboxList';
import { EmailView } from '../../components/email/EmailView';
import { TaskDetail } from '../../components/tasks/TaskDetail';
import { useNavigationStore } from '../../stores/navigationStore';
import { useTaskNavigation } from '../../stores/taskNavigationStore';
import { useTasks } from '../../hooks/useTasks';

interface DesktopLayoutProps {
  children?: React.ReactNode;
}

export function DesktopLayout({ children }: DesktopLayoutProps) {
  const { activeContextType, activeContextId, selectedEmailId } = useNavigationStore();
  const { selectedTaskId, setSelectedTaskId } = useTaskNavigation();

  const pathname = usePathname();
  const isTasks = pathname.includes('/tasks');
  const isCalendars = pathname.includes('/calendars');

  // Reset selected task when navigating away from tasks
  useEffect(() => {
    if (!isTasks) {
      setSelectedTaskId(null);
    }
  }, [isTasks]);

  return (
    <View style={styles.container}>
      {/* Pane 1: Sidebar */}
      <View style={styles.sidebarPane}>
        <InboxSidebar isDesktop />
      </View>

      {/* Right Content */}
      {isTasks ? (
        <>
          {/* Task List Pane */}
          <View style={styles.listPane}>
            {children}
          </View>

          {/* Task Detail Pane */}
          <View style={styles.detailPane}>
            {selectedTaskId ? (
              <TaskDetailPane taskId={selectedTaskId} />
            ) : (
              <View style={styles.emptyPane}>
                <Text style={styles.emptyText}>Wähle einen Task aus</Text>
              </View>
            )}
          </View>
        </>
      ) : isCalendars ? (
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

/** Helper component that fetches and renders task detail */
function TaskDetailPane({ taskId }: { taskId: string }) {
  const { tasks, reload } = useTasks();
  const { setSelectedTaskId } = useTaskNavigation();
  const task = tasks.find(t => t.id === taskId);

  if (!task) {
    return (
      <View style={styles.emptyPane}>
        <Text style={styles.emptyText}>Task wird geladen...</Text>
      </View>
    );
  }

  return (
    <TaskDetail
      task={task}
      onClose={() => setSelectedTaskId(null)}
      onRefresh={reload}
    />
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
    width: 450,
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
