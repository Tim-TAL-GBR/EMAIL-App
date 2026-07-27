import React, { useState, useCallback } from 'react';
import { View, StyleSheet, SectionList, RefreshControl, ScrollView, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Colors, Spacing, FontSize, FontWeight } from '../../lib/constants';
import { useEmails } from '../../hooks/useEmails';
import { useDraftsList } from '../../hooks/useDraftsList';
import { useAuthStore } from '../../stores/authStore';
import { useNavigationStore } from '../../stores/navigationStore';
import { EmailListItem } from '../email/EmailListItem';
import { DraftListItem } from '../email/DraftListItem';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { PopoverMenu } from '../ui/PopoverMenu';
import { Alert, LayoutRectangle } from 'react-native';
import { useLabelStore } from '../../stores/useLabelStore';
import { useEmailStore } from '../../stores/emailStore';
import type { Thread } from '../../stores/emailStore';
import { useInboxes } from '../../hooks/useInboxes';
import { EmailAssignment } from '../email/EmailAssignment';
import { supabase } from '../../lib/supabase';
import { RuleComposer } from '../rules/RuleComposer';
import { RuleCondition } from '../../stores/ruleStore';
import { useComposerStore } from '../../stores/composerStore';
import { Feather } from '@expo/vector-icons';
import { TouchableOpacity, ActivityIndicator } from 'react-native';

interface InboxListProps {
  isDesktop?: boolean;
}

export function InboxList({ isDesktop = false }: InboxListProps) {
  const router = useRouter();
  const { activeContextType, activeContextId, activeFilter, selectedEmailId, setEmailId } = useNavigationStore();
  
  const { inboxes } = useInboxes();
  
  const inboxIds = React.useMemo(() => {
    if (activeContextType === 'team') {
      return inboxes
        .filter(i => i.type === 'shared' && i.team?.id === activeContextId)
        .map(i => i.id);
    } else if (activeContextType === 'private_inbox') {
      return activeContextId ? [activeContextId] : [];
    } else if (activeContextType === 'global_inbox' || activeContextType === 'label') {
      return inboxes.map(i => i.id);
    }
    return [];
  }, [inboxes, activeContextType, activeContextId]);

  const labelId = activeContextType === 'label' ? activeContextId : undefined;
  const { threads, isLoading, isLoadingMore, hasMoreEmails, fetchMoreEmails, refetch } = useEmails(inboxIds, labelId, activeContextType, activeFilter);
  const { drafts, isLoading: draftsLoading, refetch: refetchDrafts } = useDraftsList(inboxIds);
  const { session, user } = useAuthStore();
  const { openComposer } = useComposerStore();

  const { labels, addLabelToEmail } = useLabelStore();
  const { updateEmailStatus, toggleStar, deleteEmail, markAsRead, togglePinThread, pinnedThreads } = useEmailStore();

  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuRect, setContextMenuRect] = useState<LayoutRectangle>();
  const [contextMenuThread, setContextMenuThread] = useState<Thread | null>(null);

  const [contextLabelMenuVisible, setContextLabelMenuVisible] = useState(false);
  const [contextMoveMenuVisible, setContextMoveMenuVisible] = useState(false);
  const [contextSnoozeMenuVisible, setContextSnoozeMenuVisible] = useState(false);
  const [contextAssignVisible, setContextAssignVisible] = useState(false);
  const [ruleComposerVisible, setRuleComposerVisible] = useState(false);
  const [ruleInitialCondition, setRuleInitialCondition] = useState<RuleCondition>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchText, setSearchText] = useState('');

  const triggerSync = async () => {
    if (!activeContextId || activeContextType !== 'private_inbox') return;
    setIsSyncing(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/inboxes/${activeContextId}/reconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      if (response.ok) {
        setTimeout(() => {
           handleRefresh();
           setIsSyncing(false);
        }, 2000);
      } else {
        setIsSyncing(false);
      }
    } catch (e) {
      console.error(e);
      setIsSyncing(false);
    }
  };

  const handleContextMenu = (thread: Thread, position: { x: number, y: number }) => {
    setContextMenuThread(thread);
    setContextMenuRect({
      x: position.x,
      y: position.y,
      width: 0,
      height: 0
    });
    setContextMenuVisible(true);
  };

  const handleRefresh = async () => {
    if (activeContextType && activeContextId) {
      await refetch();
      await refetchDrafts();
    }
  };

  const handleSnooze = async (hours: number = 0, days: number = 0, targetDayOfWeek?: number, targetHour: number = 8) => {
    if (!contextMenuThread) return;
    const d = new Date();
    if (hours > 0) d.setHours(d.getHours() + hours);
    if (days > 0) d.setDate(d.getDate() + days);
    
    if (targetDayOfWeek !== undefined) {
      d.setDate(d.getDate() + 1);
      while (d.getDay() !== targetDayOfWeek) {
        d.setDate(d.getDate() + 1);
      }
      d.setHours(targetHour, 0, 0, 0);
    } else if (days > 0) {
      d.setHours(targetHour, 0, 0, 0);
    }
    
    const { snoozeEmail } = useEmailStore.getState();
    await snoozeEmail(contextMenuThread.latestEmail.id, d);
    setContextSnoozeMenuVisible(false);
    Alert.alert('Zurückgestellt', `E-Mail taucht wieder auf am ${d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}`);
  };

  const handleAssignInList = async (userId: string) => {
    if (!contextMenuThread) return;
    await supabase.from('email_assignments').insert({
      email_id: contextMenuThread.latestEmail.id,
      assigned_to: userId,
      assigned_by: user?.id,
    });
    // Optimistic refetch or simple alert
    handleRefresh();
  };

  const filteredThreads = React.useMemo(() => {
    return (threads ?? []).filter(t => {
    if (t.latestEmail.snooze_until && new Date(t.latestEmail.snooze_until) > new Date()) {
      return false;
    }

    const assignments = t.latestEmail.email_assignments || [];
    const isAssignedToMe = assignments.some(a => a.assigned_to === user?.id);
    const isAssignedToAnyone = assignments.length > 0;

    if (activeContextType === 'global_inbox') {
      const inbox = inboxes.find(i => i.id === t.latestEmail.inbox_id);
      const isPrivate = inbox?.type === 'private';
      
      if (!isPrivate && !isAssignedToMe) {
        return false;
      }
    }

    if (!activeFilter || activeFilter === 'all' || activeFilter === 'drafts') {
      if (searchText) {
        const q = searchText.toLowerCase();
        const subjectMatch = t.subject?.toLowerCase().includes(q);
        const fromMatch = t.latestEmail.from_address?.toLowerCase().includes(q);
        if (!subjectMatch && !fromMatch) return false;
      }
      return true;
    }
    
    if (activeFilter === 'needs_attention') {
      if (t.latestEmail.status === 'done') return false;
      const passes = !isAssignedToAnyone || isAssignedToMe;
      if (searchText) {
        const q = searchText.toLowerCase();
        const subjectMatch = t.subject?.toLowerCase().includes(q);
        const fromMatch = t.latestEmail.from_address?.toLowerCase().includes(q);
        return passes && (subjectMatch || fromMatch);
      }
      return passes;
    }
    
    if (activeFilter === 'assigned_to_me') {
      if (searchText) {
        const q = searchText.toLowerCase();
        const subjectMatch = t.subject?.toLowerCase().includes(q);
        const fromMatch = t.latestEmail.from_address?.toLowerCase().includes(q);
        return isAssignedToMe && (subjectMatch || fromMatch);
      }
      return isAssignedToMe;
    }
    if (activeFilter === 'assigned_to_others') {
      const passes = isAssignedToAnyone && !isAssignedToMe;
      if (searchText) {
        const q = searchText.toLowerCase();
        const subjectMatch = t.subject?.toLowerCase().includes(q);
        const fromMatch = t.latestEmail.from_address?.toLowerCase().includes(q);
        return passes && (subjectMatch || fromMatch);
      }
      return passes;
    }
    if (activeFilter === 'sent') {
      const passes = t.latestEmail.direction === 'outbound';
      if (searchText) {
        const q = searchText.toLowerCase();
        const subjectMatch = t.subject?.toLowerCase().includes(q);
        const fromMatch = t.latestEmail.from_address?.toLowerCase().includes(q);
        return passes && (subjectMatch || fromMatch);
      }
      return passes;
    }
    if (activeFilter === 'trash') {
      const passes = t.latestEmail.is_deleted === true;
      if (searchText) {
        const q = searchText.toLowerCase();
        const subjectMatch = t.subject?.toLowerCase().includes(q);
        const fromMatch = t.latestEmail.from_address?.toLowerCase().includes(q);
        return passes && (subjectMatch || fromMatch);
      }
      return passes;
    }
    if (activeFilter === 'archived') {
      const passes = t.latestEmail.is_archived === true;
      if (searchText) {
        const q = searchText.toLowerCase();
        const subjectMatch = t.subject?.toLowerCase().includes(q);
        const fromMatch = t.latestEmail.from_address?.toLowerCase().includes(q);
        return passes && (subjectMatch || fromMatch);
      }
      return passes;
    }
    
    const passes = t.latestEmail.status === activeFilter;
    if (searchText) {
      const q = searchText.toLowerCase();
      const subjectMatch = t.subject?.toLowerCase().includes(q);
      const fromMatch = t.latestEmail.from_address?.toLowerCase().includes(q);
      return passes && (subjectMatch || fromMatch);
    }
    return passes;
    });
  }, [threads, searchText, activeFilter, activeContextType, activeContextId, inboxes, user?.id]);

  const handleEmailPress = (id: string) => {
    if (isDesktop) {
      setEmailId(id);
    } else {
      router.push(`/email/${id}`);
    }
  };

  const openComposerForDraft = (draft: any) => {
    openComposer({
      mode: draft.in_reply_to ? 'reply' : 'new',
      inboxId: draft.inbox_id || (activeContextType === 'private_inbox' ? activeContextId! : ''),
      sourceEmail: draft ? { thread_id: draft.thread_id, message_id: draft.in_reply_to } as any : undefined,
      draftToResume: draft
    });
  };

  // Group threads
  const getSectionTitle = (dateStr: string | undefined) => {
    if (!dateStr) return 'Older';
    const dateObj = parseISO(dateStr);
    if (isToday(dateObj)) return 'Today';
    if (isYesterday(dateObj)) return 'Yesterday';
    return format(dateObj, 'MMMM');
  };

  const sections = React.useMemo(() => {
    if (activeFilter === 'drafts') {
      return [{ title: 'Drafts', data: drafts || [] }];
    }
    const grouped = filteredThreads.reduce((acc, thread) => {
      const title = getSectionTitle(thread.latestEmail?.received_at);
      if (!acc[title]) acc[title] = [];
      acc[title].push(thread);
      return acc;
    }, {} as Record<string, typeof filteredThreads>);

    return Object.keys(grouped).map(title => ({
      title,
      data: grouped[title]
    }));
  }, [filteredThreads, drafts, activeFilter]);

  return (
    <View style={styles.container}>
      {activeContextType === 'private_inbox' && (
        <View style={styles.syncHeader}>
          <TouchableOpacity 
            onPress={triggerSync} 
            disabled={isSyncing}
            style={styles.syncIconButton}
            activeOpacity={0.7}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={Colors.textSecondary} style={{ transform: [{ scale: 0.7 }] }} />
            ) : (
              <Feather name="refresh-cw" size={12} color={Colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.searchContainer}>
        <Feather name="search" size={16} color={Colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Betreb oder Absender suchen..."
          placeholderTextColor={Colors.textTertiary}
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
            <Feather name="x" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
      <SectionList
        sections={sections as any}
        keyExtractor={(item: any) => item.id || item.thread_id || item.latestEmail?.id || `fallback-${item.subject}`}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          if (activeFilter === 'drafts') {
            return <DraftListItem draft={item as any} onPress={() => openComposerForDraft(item)} />;
          }
          return (
            <EmailListItem 
              thread={item as any} 
              isSelected={item.id === selectedEmailId}
              onPress={() => handleEmailPress(item.id)} 
              onContextMenu={handleContextMenu}
            />
          );
        }}
        refreshControl={
          <RefreshControl 
            refreshing={activeFilter === 'drafts' ? draftsLoading : isLoading} 
            onRefresh={handleRefresh} 
          />
        }
        onEndReached={() => {
          if (activeFilter !== 'drafts' && hasMoreEmails && !isLoadingMore) {
            fetchMoreEmails();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={{ padding: Spacing.md, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState icon="" title="Keine E-Mails" subtitle="Dieser Ordner ist leer." />
        }
        stickySectionHeadersEnabled={false}
      />

      <View style={styles.floatingButtons}>
        <Button 
          title="Neue E-Mail" 
          onPress={() => openComposer({
            mode: 'new',
            inboxId: activeContextType === 'private_inbox' ? activeContextId! : '',
          })} 
          style={styles.composeBtnInner}
        />
      </View>

      <PopoverMenu
        visible={contextMenuVisible}
        onClose={() => setContextMenuVisible(false)}
        anchorRect={contextMenuRect}
        width={240}
        items={[
          { id: 'reply', label: 'Antworten', icon: 'corner-up-left', onPress: () => { 
            setContextMenuVisible(false);
            if (contextMenuThread) {
              openComposer({
                mode: 'reply',
                inboxId: contextMenuThread.latestEmail.inbox_id,
                sourceEmail: contextMenuThread.latestEmail
              });
            }
          } },
          { id: 'fwd', label: 'Weiterleiten', icon: 'corner-up-right', onPress: () => Alert.alert('Info', 'Weiterleiten ausgewählt') },
          { id: 'resend', label: 'Erneut senden', icon: 'rotate-cw', onPress: () => Alert.alert('Info', 'Erneut senden ausgewählt') },
          { id: 'pin', label: contextMenuThread && pinnedThreads.some(p => p.thread_id === contextMenuThread.id) ? 'Loslösen (Unpin)' : 'Anpinnen (Pin)', icon: 'bookmark', onPress: () => {
            setContextMenuVisible(false);
            if (contextMenuThread) {
              togglePinThread(contextMenuThread.id, contextMenuThread.subject);
            }
          } },
          { id: 'archive', label: 'Schließen / Archivieren', icon: 'check', onPress: () => {
            if (contextMenuThread) updateEmailStatus(contextMenuThread.latestEmail.id, 'done');
          } },
          { id: 'snooze', label: 'Snooze', icon: 'clock', onPress: () => {
            setContextMenuVisible(false);
            setTimeout(() => setContextSnoozeMenuVisible(true), 300);
          } },
          { id: 'star', label: contextMenuThread?.is_starred ? 'Stern entfernen' : 'Stern markieren', icon: 'star', onPress: () => {
            if (contextMenuThread) toggleStar(contextMenuThread.latestEmail.id);
          } },
          { id: 'trash', label: 'Löschen', icon: 'trash-2', destructive: true, onPress: () => {
            if (contextMenuThread) deleteEmail(contextMenuThread.latestEmail.id);
          } },
          { id: 'read', label: contextMenuThread?.is_read ? 'Als ungelesen markieren' : 'Als gelesen markieren', icon: 'mail', onPress: () => {
            // we don't have mark as unread in store yet, so just alert or mark read
            if (contextMenuThread && !contextMenuThread.is_read) {
              markAsRead(contextMenuThread.latestEmail.id);
            } else {
              Alert.alert('Info', 'Als ungelesen markieren ausgewählt');
            }
          } },
          { id: 'label', label: 'Label vergeben', icon: 'tag', onPress: () => {
            setContextMenuVisible(false);
            setTimeout(() => setContextLabelMenuVisible(true), 300);
          } },
          { id: 'move', label: 'Verschieben nach', icon: 'folder', onPress: () => {
            setContextMenuVisible(false);
            setTimeout(() => setContextMoveMenuVisible(true), 300);
          } },
          { id: 'assign', label: 'Zuweisen an...', icon: 'user', onPress: () => {
            setContextMenuVisible(false);
            setTimeout(() => setContextAssignVisible(true), 300);
          } },
          { id: 'rule', label: 'Regel erstellen', icon: 'filter', onPress: () => {
            setContextMenuVisible(false);
            if (contextMenuThread) {
              setRuleInitialCondition({ field: 'from', operator: 'equals', value: contextMenuThread.latestEmail.from_address });
              setTimeout(() => setRuleComposerVisible(true), 300);
            }
          } },
        ]}
      />

      <PopoverMenu
        visible={contextLabelMenuVisible}
        onClose={() => setContextLabelMenuVisible(false)}
        anchorRect={contextMenuRect}
        width={220}
        items={
          labels.length > 0 ? labels.map(l => ({
            id: l.id,
            label: l.name,
            icon: 'folder',
            onPress: async () => {
              if (contextMenuThread) {
                const res = await addLabelToEmail(contextMenuThread.latestEmail.id, l.id);
                if (res.error) Alert.alert('Fehler', res.error.message);
                else Alert.alert('Erfolg', `Label "${l.name}" hinzugefügt.`);
              }
              setContextLabelMenuVisible(false);
            }
          })) : [{ id: 'empty', label: 'Keine Labels vorhanden', onPress: () => {} }]
        }
      />

      <PopoverMenu
        visible={contextMoveMenuVisible}
        onClose={() => setContextMoveMenuVisible(false)}
        anchorRect={contextMenuRect}
        width={220}
        items={
          labels.length > 0 ? labels.map(l => ({
            id: l.id,
            label: l.name,
            icon: 'arrow-right-circle',
            onPress: async () => {
              if (contextMenuThread) {
                const res = await addLabelToEmail(contextMenuThread.latestEmail.id, l.id);
                if (res.error) {
                  Alert.alert('Fehler', res.error.message);
                } else {
                  await updateEmailStatus(contextMenuThread.latestEmail.id, 'done');
                  Alert.alert('Verschoben', `Die E-Mail wurde nach "${l.name}" verschoben.`);
                }
              }
              setContextMoveMenuVisible(false);
            }
          })) : [{ id: 'empty', label: 'Keine Ordner vorhanden', onPress: () => {} }]
        }
      />
      <PopoverMenu
        visible={contextSnoozeMenuVisible}
        onClose={() => setContextSnoozeMenuVisible(false)}
        anchorRect={contextMenuRect}
        width={180}
        items={[
          { id: '1', label: 'Heute später', icon: 'sunset', onPress: () => handleSnooze(2, 0) },
          { id: '2', label: 'Morgen', icon: 'sunrise', onPress: () => handleSnooze(0, 1, undefined, 8) },
          { id: '3', label: 'Dieses Wochenende', icon: 'coffee', onPress: () => handleSnooze(0, 0, 6, 9) },
          { id: '4', label: 'Nächste Woche', icon: 'calendar', onPress: () => handleSnooze(0, 0, 1, 8) },
          { id: '5', label: 'Irgendwann', icon: 'clock', onPress: () => handleSnooze(0, 30) },
        ]}
      />

      {/* Hidden assignment component just for the modal picker */}
      <View style={{ display: 'none' }}>
        {contextMenuThread && (
          <EmailAssignment
            emailId={contextMenuThread.latestEmail.id}
            inboxId={contextMenuThread.latestEmail.inbox_id}
            onAssign={handleAssignInList}
            onUnassign={async () => {
              await supabase
                .from('email_assignments')
                .delete()
                .eq('email_id', contextMenuThread!.latestEmail.id)
                .eq('assigned_to', user?.id);
              setContextAssignVisible(false);
              handleRefresh();
            }}
            externalVisible={contextAssignVisible}
            onCloseExternal={() => setContextAssignVisible(false)}
          />
        )}
      </View>

      <RuleComposer
        visible={ruleComposerVisible}
        onClose={() => setRuleComposerVisible(false)}
        teamId={contextMenuThread?.latestEmail.team_id}
        initialCondition={ruleInitialCondition}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  sectionHeader: {
    backgroundColor: '#FFF',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: 2,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  composeButton: {
    // keeping for backwards compatibility if needed
  },
  floatingButtons: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    flexDirection: 'row',
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  composeBtnInner: {
    // inner styles if needed
  },
  syncHeader: {
    position: 'absolute',
    top: 6,
    right: 12,
    zIndex: 10,
  },
  syncIconButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    height: 36,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    padding: 0,
  },
  clearButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
  }
});
