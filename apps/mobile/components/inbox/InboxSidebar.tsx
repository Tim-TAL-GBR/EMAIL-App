import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout, Shadows } from '../../lib/constants';
import { useInboxes } from '../../hooks/useInboxes';
import { useAuthStore } from '../../stores/authStore';
import { useNavigationStore, ContextType, FilterType } from '../../stores/navigationStore';
import { useLabelStore } from '../../stores/useLabelStore';
import { useEmailStore } from '../../stores/emailStore';
import { useTeams } from '../../hooks/useTeams';
import { Avatar } from '../ui/Avatar';
import { Feather, Ionicons } from '@expo/vector-icons';
import { CreateLabelModal } from './CreateLabelModal';
import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';

interface InboxSidebarProps {
  isDesktop?: boolean;
}

export function InboxSidebar({ isDesktop = false }: InboxSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { inboxes } = useInboxes();
  const { user, signOut } = useAuthStore();
  const { activeContextType, activeContextId, activeFilter, activeMailbox, setContext } = useNavigationStore();
  
  const { labels, fetchLabels, createLabel } = useLabelStore();
  const { pinnedThreads, fetchPinnedThreads } = useEmailStore();
  const { teams: allTeams, orgs, getSubTeams } = useTeams();
  const [isCreateLabelModalOpen, setIsCreateLabelModalOpen] = useState(false);
  
  const [openEmailCount, setOpenEmailCount] = useState(0);
  const [openTaskCount, setOpenTaskCount] = useState(0);
  
  // Track which private inbox is expanded
  const [expandedPrivateInbox, setExpandedPrivateInbox] = useState<string | null>(null);
  // Track which org is expanded
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  // Track which team filter dropdown is open
  const [openTeamFilter, setOpenTeamFilter] = useState<string | null>(null);

  // IMAP folders per inbox (cached after first fetch)
  const [imapFolders, setImapFolders] = useState<Record<string, { path: string; name: string; specialUse?: string }[]>>({});

  const privateInboxes = inboxes.filter(i => i.type === 'private');

  // Group shared inboxes by team (for labels)
  const teamsMap = new Map<string, { id: string; name: string }>();
  inboxes.forEach(inbox => {
    if (inbox.type === 'shared' && inbox.team) {
      if (!teamsMap.has(inbox.team.id)) {
        teamsMap.set(inbox.team.id, inbox.team);
      }
    }
  });
  const teams = Array.from(teamsMap.values());

  // Fetch labels for the first team (for now, assume user is in one team)
  // Also fetch pinned threads
  React.useEffect(() => {
    if (teams.length > 0) {
      fetchLabels(teams[0].id);
    }
    fetchPinnedThreads();
    
    // Fetch counts
    const fetchCounts = async () => {
      const { count: emailsCount } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
        
      const { count: tasksCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
        
      setOpenEmailCount(emailsCount || 0);
      setOpenTaskCount(tasksCount || 0);
    };
    fetchCounts();
  }, [teams.length]);

  // Fetch IMAP folders when an inbox is expanded
  const fetchImapFolders = React.useCallback(async (inboxId: string) => {
    if (imapFolders[inboxId]) return; // already cached
    try {
      const res = await fetch(`${API_URL}/api/inboxes/${inboxId}/folders`);
      const json = await res.json();
      if (json.folders) {
        setImapFolders(prev => ({ ...prev, [inboxId]: json.folders }));
      }
    } catch (e) {
      console.warn("Fehler beim Laden der IMAP-Ordner:", e);
    }
  }, [imapFolders]);

  // Folders to show under "Weitere Ordner" (exclude special-use and known system folders)
  const getCustomFolders = (inboxId: string) => {
    const folders = imapFolders[inboxId] || [];
    const specialPaths = new Set<string>(['inbox']);
    const inbox = inboxes.find(i => i.id === inboxId);
    if (inbox?.folder_archive) specialPaths.add(inbox.folder_archive.toLowerCase());
    if (inbox?.folder_sent) specialPaths.add(inbox.folder_sent.toLowerCase());
    if (inbox?.folder_trash) specialPaths.add(inbox.folder_trash.toLowerCase());
    if (inbox?.folder_spam) specialPaths.add(inbox.folder_spam.toLowerCase());
    return folders.filter(f => !f.path.toLowerCase().startsWith('[gmail]') && !specialPaths.has(f.path.toLowerCase()) && !f.specialUse);
  };


  const handlePress = (type: ContextType, id: string, filter: FilterType) => {
    setContext(type, id, filter);
    if (!isDesktop) {
      router.push('/inbox/list');
    } else if (pathname.includes('/tasks') || pathname.includes('/calendars')) {
      // Wenn wir auf Desktop sind, aber gerade in den Tasks/Calendars stecken,
      // müssen wir die Route wieder auf Root zurücksetzen, damit das Email-Layout lädt.
      router.push('/');
    }
  };

  const renderFilterItem = (type: ContextType, id: string, filter: FilterType, label: string) => {
    const isActive = activeContextType === type && activeContextId === id && activeFilter === filter;
    return (
      <TouchableOpacity 
        key={filter}
        style={[styles.filterItem, isActive && styles.filterItemActive]} 
        onPress={() => handlePress(type, id, filter)}
      >
        <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  return (
    <View style={[styles.container, isDesktop && styles.desktopContainer]}>
      <View style={[styles.header, isDesktop && styles.desktopHeader]}>
        <Text style={styles.logoText}>TeamMail</Text>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.mainNavItem, activeContextType === 'global_inbox' && !activeFilter && styles.filterItemActive]}
            onPress={() => handlePress('global_inbox', 'global', 'needs_attention')}
          >
            <View style={styles.mainNavLeft}>
              <Feather name="inbox" size={16} color={Colors.primary} style={styles.mainNavIcon} />
              <Text style={[styles.mainNavText, activeContextType === 'global_inbox' && styles.mainNavTextActive]}>Inbox</Text>
            </View>
            <Text style={styles.countText}>{openEmailCount > 0 ? openEmailCount : ''}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.mainNavItem, pathname.includes('/tasks') && styles.filterItemActive]}
            onPress={() => router.push('/(app)/tasks')}
          >
            <View style={styles.mainNavLeft}>
              <Feather name="check-circle" size={16} color={pathname.includes('/tasks') ? Colors.primary : Colors.textTertiary} style={styles.mainNavIcon} />
              <Text style={[styles.mainNavText, pathname.includes('/tasks') && styles.mainNavTextActive]}>Tasks</Text>
            </View>
            <Text style={styles.countText}>{openTaskCount > 0 ? openTaskCount : ''}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.mainNavItem, pathname.includes('/calendars') && styles.filterItemActive]}
            onPress={() => router.push('/(app)/calendars')}
          >
            <View style={styles.mainNavLeft}>
              <Feather name="calendar" size={16} color={pathname.includes('/calendars') ? Colors.primary : Colors.textTertiary} style={styles.mainNavIcon} />
              <Text style={[styles.mainNavText, pathname.includes('/calendars') && styles.mainNavTextActive]}>Kalender</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.collapsibleHeader}>
            <Feather name="chevron-down" size={14} color={Colors.textTertiary} />
            <Text style={styles.sectionTitle}>All</Text>
          </TouchableOpacity>
          <View style={styles.indentContainer}>
            {privateInboxes.map(inbox => (
              <View key={inbox.id}>
                <TouchableOpacity 
                  style={[styles.accountItem, activeContextType === 'private_inbox' && activeContextId === inbox.id && !activeFilter && !activeMailbox && styles.filterItemActive]}
                  onPress={() => {
                    handlePress('private_inbox', inbox.id, 'needs_attention');
                    const willExpand = expandedPrivateInbox !== inbox.id;
                    setExpandedPrivateInbox(willExpand ? inbox.id : null);
                    if (willExpand) fetchImapFolders(inbox.id);
                  }}
                >
                  <Feather 
                    name={expandedPrivateInbox === inbox.id ? "chevron-down" : "chevron-right"} 
                    size={14} 
                    color={Colors.textTertiary} 
                    style={{ marginRight: Spacing.xs }}
                  />
                  <Feather name="hard-drive" size={14} color={Colors.textTertiary} style={styles.accountIcon} />
                  <Text style={[styles.accountText, activeContextType === 'private_inbox' && activeContextId === inbox.id && styles.mainNavTextActive]} numberOfLines={1}>
                    {inbox.email_address}
                  </Text>
                </TouchableOpacity>
                {expandedPrivateInbox === inbox.id && (
                  <View style={styles.filtersContainer}>
                    {renderFilterItem('private_inbox', inbox.id, 'needs_attention', 'Eingang')}
                    {renderFilterItem('private_inbox', inbox.id, 'drafts', 'Entwürfe')}
                    {renderFilterItem('private_inbox', inbox.id, 'sent', 'Gesendet')}
                    {renderFilterItem('private_inbox', inbox.id, 'archived', 'Archiviert')}
                    {renderFilterItem('private_inbox', inbox.id, 'trash', 'Papierkorb')}
                    {getCustomFolders(inbox.id).length > 0 && (
                      <>
                        <Text style={styles.folderSectionLabel}>Weitere Ordner</Text>
                        {getCustomFolders(inbox.id).map(folder => {
                          const isMailboxActive = activeMailbox === folder.path;
                          return (
                            <TouchableOpacity
                              key={folder.path}
                              style={[styles.filterItem, isMailboxActive && styles.filterItemActive]}
                              onPress={() => {
                                setContext('private_inbox', inbox.id, 'all');
                                useNavigationStore.getState().setMailbox(folder.path);
                                if (!isDesktop) router.push('/inbox/list');
                              }}
                            >
                              <Feather name="folder" size={14} color={isMailboxActive ? Colors.info : Colors.textTertiary} style={{ marginRight: Spacing.sm }} />
                              <Text style={[styles.filterLabel, isMailboxActive && styles.filterLabelActive]} numberOfLines={1}>
                                {folder.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.collapsibleHeaderRow}>
            <TouchableOpacity style={styles.collapsibleHeader}>
              <Feather name="chevron-down" size={14} color={Colors.textTertiary} />
              <Text style={styles.sectionTitle}>Ordner / Labels</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.addIconButton}
              onPress={() => setIsCreateLabelModalOpen(true)}
            >
              <Feather name="plus" size={14} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.indentContainer}>
            {labels.map(label => (
              <TouchableOpacity 
                key={label.id}
                style={[styles.accountItem, activeContextType === 'label' && activeContextId === label.id && styles.filterItemActive]}
                onPress={() => handlePress('label', label.id, 'all')}
              >
                <Feather name="folder" size={14} color={label.color || Colors.textTertiary} style={styles.accountIcon} />
                <Text style={[styles.accountText, activeContextType === 'label' && activeContextId === label.id && styles.mainNavTextActive]} numberOfLines={1}>
                  {label.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {pinnedThreads.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.collapsibleHeader}>
              <Feather name="chevron-down" size={14} color={Colors.textTertiary} />
              <Text style={styles.sectionTitle}>Favoriten</Text>
            </TouchableOpacity>
            <View style={styles.indentContainer}>
              {pinnedThreads.map(pin => (
                <TouchableOpacity 
                  key={pin.thread_id} 
                  style={[styles.accountItem]}
                  onPress={() => {
                    useNavigationStore.getState().setEmailId(pin.thread_id);
                    useEmailStore.getState().setActiveEmail(pin.thread_id);
                    if (!isDesktop) {
                      router.push(`/inbox/${pin.thread_id}` as any);
                    }
                  }}
                >
                  <Feather name="message-circle" size={14} color={Colors.textTertiary} style={styles.accountIcon} />
                  <Text style={[styles.accountText]} numberOfLines={1}>
                    {pin.subject || 'Ohne Betreff'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.subSectionTitle}>Organisationen</Text>
          {orgs.map(org => {
            const subTeams = getSubTeams(org.id);
            const isOrgExpanded = expandedOrg === org.id || activeContextType === 'org' && activeContextId === org.id;
            return (
              <View key={org.id} style={styles.teamSpace}>
                {/* Org Header */}
                <TouchableOpacity 
                  style={[styles.teamHeader, activeContextType === 'org' && activeContextId === org.id && !activeFilter && styles.filterItemActive]}
                  onPress={() => {
                    handlePress('org', org.id, 'needs_attention');
                    setExpandedOrg(isOrgExpanded ? null : org.id);
                  }}
                >
                  <Feather 
                    name={isOrgExpanded ? "chevron-down" : "chevron-right"} 
                    size={12} 
                    color={Colors.textTertiary} 
                    style={{ marginRight: 4 }}
                  />
                  <View style={[styles.teamAvatar, { backgroundColor: '#7B68EE' }]}>
                    <Feather name="briefcase" size={10} color="#FFF" />
                  </View>
                  <Text style={[styles.teamName, activeContextType === 'org' && activeContextId === org.id && styles.filterLabelActive]}>{org.name}</Text>
                </TouchableOpacity>

                {/* Org-level filters (when org is selected) */}
                {activeContextType === 'org' && activeContextId === org.id && (
                  <View style={styles.filtersContainer}>
                    {renderFilterItem('org', org.id, 'assigned_to_me', 'Zugewiesen an mich')}
                    {renderFilterItem('org', org.id, 'assigned_to_others', 'Zugewiesen an andere')}
                    {renderFilterItem('org', org.id, 'done', 'Abgeschlossen')}
                    {renderFilterItem('org', org.id, 'sent', 'Gesendet')}
                    {renderFilterItem('org', org.id, 'all', 'Alle')}
                  </View>
                )}

                {/* Sub-teams (when org is expanded) */}
                {isOrgExpanded && subTeams.map(team => (
                  <View key={team.id}>
                    <TouchableOpacity 
                      style={[styles.teamHeader, styles.subTeamHeader, activeContextType === 'team' && activeContextId === team.id && !activeFilter && styles.filterItemActive]}
                      onPress={() => {
                        handlePress('team', team.id, 'needs_attention');
                        setOpenTeamFilter(openTeamFilter === team.id ? null : team.id);
                      }}
                    >
                      <View style={[styles.teamAvatar, { backgroundColor: '#F06A6A' }]}>
                        <Feather name="users" size={10} color="#FFF" />
                      </View>
                      <Text style={[styles.teamName, activeContextType === 'team' && activeContextId === team.id && styles.filterLabelActive]}>{team.name}</Text>
                    </TouchableOpacity>

                    {/* Team filter dropdown */}
                    {activeContextType === 'team' && activeContextId === team.id && (
                      <View style={styles.filtersContainer}>
                        {renderFilterItem('team', team.id, 'assigned_to_me', 'Zugewiesen an mich')}
                        {renderFilterItem('team', team.id, 'assigned_to_others', 'Zugewiesen an andere')}
                        {renderFilterItem('team', team.id, 'done', 'Abgeschlossen')}
                        {renderFilterItem('team', team.id, 'sent', 'Gesendet')}
                        {renderFilterItem('team', team.id, 'all', 'Alle')}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {isProfileMenuOpen && (
          <View style={styles.profileMenu}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => { setIsProfileMenuOpen(false); router.push('/settings'); }}
            >
              <Feather name="settings" size={16} color={Colors.textSecondary} />
              <Text style={styles.menuText}>Einstellungen</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={() => { setIsProfileMenuOpen(false); signOut(); }}
            >
              <Feather name="log-out" size={16} color={Colors.error} />
              <Text style={[styles.menuText, { color: Colors.error }]}>Abmelden</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity 
          style={styles.userInfo} 
          activeOpacity={0.7}
          onPress={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
        >
          <Avatar 
            name={user?.user_metadata?.display_name || 'User'} 
            size={24} 
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.user_metadata?.display_name || 'Tim Regener'}
            </Text>
          </View>
          <Feather name={isProfileMenuOpen ? "chevron-down" : "chevron-up"} size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <CreateLabelModal
        visible={isCreateLabelModalOpen}
        onClose={() => setIsCreateLabelModalOpen(false)}
        onCreate={async (name, color) => {
          if (teams.length > 0) {
            await createLabel(teams[0].id, name, color);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: Layout.sidebarWidth,
    height: '100%',
    backgroundColor: '#F9FAFB', // Light gray background matching screenshot
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
  },
  desktopContainer: {
    width: '100%',
  },
  header: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  desktopHeader: {
    borderBottomWidth: 0,
  },
  logoText: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.text,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
    letterSpacing: 1,
    paddingHorizontal: Spacing.sm,
    textTransform: 'uppercase',
  },
  subSectionTitle: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
  },
  mainNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: 6,
    marginBottom: 2,
  },
  mainNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainNavIcon: {
    marginRight: Spacing.sm,
    width: 16,
    textAlign: 'center',
  },
  mainNavText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  mainNavTextActive: {
    fontWeight: '600',
  },
  countText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: 'bold',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    gap: 4,
  },
  collapsibleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: Spacing.md,
  },
  addIconButton: {
    padding: 4,
    marginBottom: Spacing.xs,
  },
  indentContainer: {
    paddingLeft: Spacing.xl,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: 6,
    marginBottom: 2,
  },
  accountIcon: {
    marginRight: Spacing.sm,
    width: 14,
    textAlign: 'center',
  },
  accountText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  teamSpace: {
    marginBottom: 2,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: 6,
  },
  subTeamHeader: {
    paddingLeft: Spacing.xl,
  },
  headerIcon: {
    marginRight: Spacing.sm,
  },
  teamAvatar: {
    width: 16,
    height: 16,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  teamName: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  filtersContainer: {
    paddingLeft: Spacing.xl,
    marginTop: 2,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: 6,
    marginBottom: 2,
  },
  filterItemActive: {
    backgroundColor: '#E6F0FF', // Light blue background for active
  },
  filterLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  filterLabelActive: {
    color: Colors.info, // Blue text for active
    fontWeight: '600',
  },
  footer: {
    padding: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: '#FFF',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: Spacing.sm,
    borderRadius: 6,
    gap: Spacing.sm,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  profileMenu: {
    position: 'absolute',
    bottom: '100%',
    left: Spacing.sm,
    right: Spacing.sm,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.xs,
    ...Platform.select({
      ios: Shadows.medium,
      android: { elevation: 4 },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 6,
    gap: Spacing.sm,
  },
  menuItemDanger: {
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  folderSectionLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  menuText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
