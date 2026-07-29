import { API_URL } from "@/lib/constants";
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, LayoutRectangle, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../lib/constants';
import { EmailDetail } from '../email/EmailDetail';
import { ChatFeed } from '../chat/ChatFeed';
import { useEmailStore } from '../../stores/emailStore';
import { Button } from '../ui/Button';
import { EmailAssignment } from './EmailAssignment';
import { supabase } from '../../lib/supabase';
import { PopoverMenu, MenuItem } from '../ui/PopoverMenu';
import { RuleComposer } from '../rules/RuleComposer';
import { RuleCondition } from '../../stores/ruleStore';
import { useComposerStore } from '../../stores/composerStore';

import { useLabelStore } from '../../stores/useLabelStore';
import { TaskComposer } from '../tasks/TaskComposer';
import { ShopifyCustomerCard } from '../integrations/ShopifyCustomerCard';

interface EmailViewProps {
  emailId: string;
}

export function EmailView({ emailId: threadId }: EmailViewProps) {
  const { threads, updateEmailStatus, archiveEmail, deleteEmail, snoozeEmail, markAsRead, pinnedThreads, togglePinThread } = useEmailStore();
  const [assignments, setAssignments] = useState<any[]>([]);
  const { labels, addLabelToEmail, fetchLabels } = useLabelStore();

  const selectedThread = threads.find(t => t.id === threadId);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (threadId && selectedThread) {
        if (selectedThread.latestEmail && !selectedThread.latestEmail.is_read) {
          const { error } = await supabase
            .from('emails')
            .update({ is_read: true })
            .eq('id', selectedThread.latestEmail.id);
          
          if (!error && isMounted) {
            useEmailStore.getState().updateEmail({ id: selectedThread.latestEmail.id, is_read: true } as any);
          }
        }

        if (!isMounted || !selectedThread.latestEmail) return;
        loadAssignments(selectedThread.latestEmail.id);
        
        const teamId = selectedThread.latestEmail.team_id;
        if (teamId) {
          if (isMounted) fetchLabels(teamId);
        } else {
          supabase.from('inboxes').select('team_id').eq('id', selectedThread.latestEmail.inbox_id).single().then(({data}) => {
            if (data?.team_id && isMounted) fetchLabels(data.team_id);
          });
        }

        if (selectedThread.latestEmail.from_address && teamId && isMounted) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            
            const res = await fetch(`${API_URL}/api/shopify/customer?email=${encodeURIComponent(selectedThread.latestEmail.from_address)}&team_id=${teamId}`, {
              headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (!isMounted) return;
            if (res.status === 404) {
              setShopifyResult({ connected: false, hasCustomer: false });
            } else if (res.ok) {
              const json = await res.json();
              setShopifyResult({ connected: true, hasCustomer: !!json.customer });
            }
          } catch (err) {
            console.error('Shopify fetch error:', err);
          }
        }
      }
    };
    run();
    return () => { isMounted = false; };
  }, [threadId]);

  const loadAssignments = async (emailId: string) => {
    const { data: assignmentsData, error } = await supabase
      .from('email_assignments')
      .select('*')
      .eq('email_id', emailId);
      
    if (error || !assignmentsData) {
      setAssignments([]);
      return;
    }
    
    if (assignmentsData.length === 0) {
      setAssignments([]);
      return;
    }
    
    const userIds = assignmentsData.map(a => a.assigned_to);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url')
      .in('id', userIds);
      
    const merged = assignmentsData.map(a => {
      const p = profiles?.find(prof => prof.id === a.assigned_to);
      return {
        ...a,
        assigned_to_profile: p || null
      };
    });
    
    setAssignments((merged as any) ?? []);
  };

  const { openComposer } = useComposerStore();

  const [snoozeMenuVisible, setSnoozeMenuVisible] = useState(false);
  const [snoozeRect, setSnoozeRect] = useState<LayoutRectangle>();
  const snoozeRef = useRef<View>(null);

  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [moreRect, setMoreRect] = useState<LayoutRectangle>();
  const moreRef = useRef<View>(null);

  const [labelMenuVisible, setLabelMenuVisible] = useState(false);
  const [moveMenuVisible, setMoveMenuVisible] = useState(false);

  const [ruleComposerVisible, setRuleComposerVisible] = useState(false);
  const [ruleInitialCondition, setRuleInitialCondition] = useState<RuleCondition>({ field: 'from', operator: 'equals', value: '' });
  const [taskComposerVisible, setTaskComposerVisible] = useState(false);
  const [showShopifyPanel, setShowShopifyPanel] = useState(false);
  const [shopifyResult, setShopifyResult] = useState<{ connected: boolean; hasCustomer: boolean } | null>(null);

  const handleStatusChange = async (id: string, status: 'open' | 'in_progress' | 'done') => {
    await updateEmailStatus(id, status);
  };

  if (!selectedThread) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const isPinned = pinnedThreads.some(p => p.thread_id === selectedThread.id);

  const currentAssignee = assignments.length > 0
    ? {
        id: assignments[0].assigned_to,
        name: assignments[0].assigned_to_profile?.display_name || 'Unbekannt',
      }
    : null;

  const handleAssign = async (userId: string) => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      
      const response = await fetch(`${API_URL}/api/emails/${selectedThread.latestEmail.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ assignedTo: userId })
      });
      
      if (!response.ok) {
        throw new Error('Fehler bei der Zuweisung');
      }
      
      await loadAssignments(selectedThread.latestEmail.id);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    }
  };

  const handleUnassign = async () => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      
      const response = await fetch(`${API_URL}/api/emails/${selectedThread.latestEmail.id}/unassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Fehler beim Aufheben der Zuweisung');
      }
      
      await loadAssignments(selectedThread.latestEmail.id);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    }
  };

  const openSnoozeMenu = () => {
    snoozeRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setSnoozeRect({ x: pageX, y: pageY, width, height });
      setSnoozeMenuVisible(true);
    });
  };

  const openMoreMenu = () => {
    moreRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setMoreRect({ x: pageX, y: pageY, width, height });
      setMoreMenuVisible(true);
    });
  };

  const handleSnooze = async (hours: number = 0, days: number = 0, targetDayOfWeek?: number, targetHour: number = 8) => {
    const d = new Date();
    if (hours > 0) d.setHours(d.getHours() + hours);
    if (days > 0) d.setDate(d.getDate() + days);
    
    if (targetDayOfWeek !== undefined) {
      // Find the next target day of week
      d.setDate(d.getDate() + 1); // start from tomorrow to ensure we don't pick today if it's currently that day
      while (d.getDay() !== targetDayOfWeek) {
        d.setDate(d.getDate() + 1);
      }
      d.setHours(targetHour, 0, 0, 0);
    } else if (days > 0) {
      d.setHours(targetHour, 0, 0, 0);
    }
    
    await snoozeEmail(selectedThread.latestEmail.id, d);
    setSnoozeMenuVisible(false);
    Alert.alert('Zurückgestellt', `E-Mail taucht wieder auf am ${d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}`);
  };

  return (
    <View style={styles.container}>
      <View style={{ flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column' }}>
        <View style={{ flex: 1 }}>
          <ChatFeed 
        emailId={selectedThread.emails[0].id} 
        emails={selectedThread.emails}
        inboxId={selectedThread.latestEmail.inbox_id}
        threadId={selectedThread.id}
        onEmailStatusChange={handleStatusChange}
        onDraftPress={(draft) => {
          openComposer({
            mode: draft.in_reply_to ? 'reply' : 'new',
            inboxId: selectedThread.latestEmail.inbox_id,
            sourceEmail: draft ? { thread_id: draft.thread_id, message_id: draft.in_reply_to } as any : undefined,
            draftToResume: draft
          });
        }}
        headerComponent={
          <View style={styles.threadContainer}>
            <View style={styles.actionBar}>
              <View style={styles.actionLeft}>
                <View style={styles.assignmentWrapper}>
                  <EmailAssignment
                    emailId={selectedThread.latestEmail.id}
                    inboxId={selectedThread.latestEmail.inbox_id}
                    currentAssignee={currentAssignee}
                    onAssign={handleAssign}
                    onUnassign={handleUnassign}
                  />
                </View>
                
                <TouchableOpacity 
                  style={[styles.statusBadge, selectedThread.latestEmail.status === 'done' && styles.statusBadgeDone]} 
                  onPress={() => handleStatusChange(selectedThread.latestEmail.id, selectedThread.latestEmail.status === 'done' ? 'open' : 'done')}
                >
                  <Text style={[styles.statusBadgeText, selectedThread.latestEmail.status === 'done' && styles.statusBadgeTextDone]}>
                    {selectedThread.latestEmail.status === 'done' ? 'Reopen' : 'Close'}
                  </Text>
                  <Feather name="chevron-down" size={12} color={selectedThread.latestEmail.status === 'done' ? Colors.primary : Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.actionRight}>
                <TouchableOpacity style={styles.iconButton} onPress={() => {
                  openComposer({
                    mode: 'reply',
                    inboxId: selectedThread.latestEmail.inbox_id,
                    sourceEmail: selectedThread.latestEmail
                  });
                }}>
                  <Feather name="corner-up-left" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
                
                <View ref={snoozeRef} collapsable={false}>
                  <TouchableOpacity style={styles.iconButton} onPress={openSnoozeMenu}>
                    <Feather name="clock" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity style={styles.iconButton} onPress={() => archiveEmail(selectedThread.latestEmail.id)}>
                  <Feather name="archive" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => deleteEmail(selectedThread.latestEmail.id)}>
                  <Feather name="trash-2" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
                
                <View ref={moreRef} collapsable={false}>
                  <TouchableOpacity style={styles.iconButton} onPress={openMoreMenu}>
                    <Feather name="more-horizontal" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.subjectContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <Text style={styles.subjectText} numberOfLines={1}>{selectedThread.subject}</Text>
                {shopifyResult?.connected && (
                  <TouchableOpacity
                    style={[styles.shopifyChip, showShopifyPanel && styles.shopifyChipActive, shopifyResult.hasCustomer && !showShopifyPanel && styles.shopifyChipFound, !shopifyResult.hasCustomer && !showShopifyPanel && styles.shopifyChipNotFound]}
                    onPress={() => setShowShopifyPanel(!showShopifyPanel)}
                  >
                    <Feather name="shopping-bag" size={13} color={showShopifyPanel ? '#FFF' : !shopifyResult.hasCustomer ? '#C62828' : '#96BF48'} />
                    <Text style={[styles.shopifyChipText, showShopifyPanel && styles.shopifyChipTextActive, !shopifyResult.hasCustomer && !showShopifyPanel && styles.shopifyChipTextNotFound]}>Shopify</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        }
      />
      </View>
      
      {Platform.OS === 'web' && showShopifyPanel && selectedThread?.latestEmail && (
        <View style={{ width: 320, borderLeftWidth: 1, borderColor: Colors.borderLight, backgroundColor: '#FAFAFA', padding: Spacing.md }}>
          <ShopifyCustomerCard 
            email={selectedThread.latestEmail.from_address} 
            teamId={selectedThread.latestEmail.team_id}
            detectedOrderNumber={selectedThread.subject.match(/#\d{4,}/)?.[0]}
          />
        </View>
      )}
      </View>

      <PopoverMenu
        visible={snoozeMenuVisible}
        onClose={() => setSnoozeMenuVisible(false)}
        anchorRect={snoozeRect}
        width={180}
        items={[
          { id: '1', label: 'Heute später', icon: 'sunset', onPress: () => handleSnooze(2, 0) },
          { id: '2', label: 'Morgen', icon: 'sunrise', onPress: () => handleSnooze(0, 1, undefined, 8) },
          { id: '3', label: 'Dieses Wochenende', icon: 'coffee', onPress: () => handleSnooze(0, 0, 6, 9) },
          { id: '4', label: 'Nächste Woche', icon: 'calendar', onPress: () => handleSnooze(0, 0, 1, 8) },
          { id: '5', label: 'Irgendwann', icon: 'clock', onPress: () => handleSnooze(0, 30) },
        ]}
      />

      <PopoverMenu
        visible={moreMenuVisible}
        onClose={() => setMoreMenuVisible(false)}
        anchorRect={moreRect}
        width={200}
        items={[
          { id: 'reply', label: 'Antworten', icon: 'corner-up-left', onPress: () => {
            setMoreMenuVisible(false);
            openComposer({
              mode: 'reply',
              inboxId: selectedThread.latestEmail.inbox_id,
              sourceEmail: selectedThread.latestEmail
            });
          } },
          { id: 'fwd', label: 'Weiterleiten', icon: 'corner-up-right', onPress: () => Alert.alert('Info', 'Weiterleiten ausgewählt') },
          { id: 'resend', label: 'Erneut senden', icon: 'rotate-cw', onPress: () => Alert.alert('Info', 'Erneut senden ausgewählt') },
          { id: 'pin', label: isPinned ? 'Von Favoriten entfernen' : 'In Favoriten anpinnen', icon: 'star', onPress: () => {
            setMoreMenuVisible(false);
            togglePinThread(selectedThread.id, selectedThread.latestEmail?.subject || 'Ohne Betreff');
          } },
          { id: 'label', label: 'Label vergeben', icon: 'tag', onPress: () => {
            setMoreMenuVisible(false);
            setTimeout(() => setLabelMenuVisible(true), 300);
          } },
          { id: 'move', label: 'Verschieben nach', icon: 'folder', onPress: () => {
            setMoreMenuVisible(false);
            setTimeout(() => setMoveMenuVisible(true), 300);
          } },
          { id: 'rule', label: 'Regel erstellen', icon: 'filter', onPress: () => {
            setMoreMenuVisible(false);
            setRuleInitialCondition({ field: 'from', operator: 'equals', value: selectedThread.latestEmail.from_address });
            setTimeout(() => setRuleComposerVisible(true), 300);
          } },
          { id: 'task', label: 'Als Task anlegen', icon: 'check-square', onPress: () => {
            setMoreMenuVisible(false);
            setTimeout(() => setTaskComposerVisible(true), 300);
          } },
          { id: 'trash', label: 'Löschen', icon: 'trash-2', destructive: true, onPress: () => deleteEmail(selectedThread.latestEmail.id) },
        ]}
      />

      <PopoverMenu
        visible={labelMenuVisible}
        onClose={() => setLabelMenuVisible(false)}
        anchorRect={moreRect}
        width={220}
        items={
          labels.length > 0 ? labels.map(l => ({
            id: l.id,
            label: l.name,
            icon: 'folder',
            onPress: async () => {
              const res = await addLabelToEmail(selectedThread.latestEmail.id, l.id);
              if (res.error) Alert.alert('Fehler', res.error.message);
              else Alert.alert('Erfolg', `Label "${l.name}" hinzugefügt.`);
              setLabelMenuVisible(false);
            }
          })) : [{ id: 'empty', label: 'Keine Labels vorhanden', onPress: () => {} }]
        }
      />

      <PopoverMenu
        visible={moveMenuVisible}
        onClose={() => setMoveMenuVisible(false)}
        anchorRect={moreRect}
        width={220}
        items={
          labels.length > 0 ? labels.map(l => ({
            id: l.id,
            label: l.name,
            icon: 'arrow-right-circle',
            onPress: async () => {
              const res = await addLabelToEmail(selectedThread.latestEmail.id, l.id);
              if (res.error) {
                Alert.alert('Fehler', res.error.message);
              } else {
                await updateEmailStatus(selectedThread.latestEmail.id, 'done');
                Alert.alert('Verschoben', `Die E-Mail wurde nach "${l.name}" verschoben.`);
              }
              setMoveMenuVisible(false);
            }
          })) : [{ id: 'empty', label: 'Keine Ordner vorhanden', onPress: () => {} }]
        }
      />

      <RuleComposer
        visible={ruleComposerVisible}
        onClose={() => setRuleComposerVisible(false)}
        teamId={selectedThread.latestEmail.team_id}
        initialCondition={ruleInitialCondition}
      />

      {selectedThread.latestEmail && (
        <TaskComposer
          visible={taskComposerVisible}
          onClose={() => setTaskComposerVisible(false)}
          linkedEmailId={selectedThread.latestEmail.id}
          teamId={selectedThread.latestEmail.team_id}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  threadContainer: {
    paddingBottom: Spacing.sm,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  subjectContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  subjectText: {
    fontFamily: FontFamily,
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
  },
  shopifyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#96BF48',
    backgroundColor: '#F0F8E8',
  },
  shopifyChipActive: {
    backgroundColor: '#96BF48',
    borderColor: '#96BF48',
  },
  shopifyChipFound: {
    backgroundColor: '#E8F5E9',
    borderColor: '#96BF48',
  },
  shopifyChipNotFound: {
    backgroundColor: '#FFEBEE',
    borderColor: '#C62828',
  },
  shopifyChipText: {
    fontSize: 11,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: '#96BF48',
  },
  shopifyChipTextActive: {
    color: '#FFF',
  },
  shopifyChipTextNotFound: {
    color: '#C62828',
  },
  iconButton: {
    padding: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignmentWrapper: {
    marginRight: Spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: Spacing.sm,
    gap: 4,
  },
  statusBadgeDone: {
    backgroundColor: '#E6F4EA',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statusBadgeTextDone: {
    color: Colors.primary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
