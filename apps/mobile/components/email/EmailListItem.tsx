import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, BorderRadius } from '../../lib/constants';
import { StatusBadge } from '../ui/StatusBadge';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../ui/Avatar';

import { Thread } from '../../stores/emailStore';

interface EmailListItemProps {
  thread: Thread;
  onPress: () => void;
  isSelected?: boolean;
  onContextMenu?: (thread: Thread, position: { x: number, y: number }) => void;
}

export const EmailListItem = React.memo(function EmailListItem({ thread, onPress, isSelected = false, onContextMenu }: EmailListItemProps) {
  const isUnread = !thread.is_read;
  
  const dateObj = thread.latestEmail.received_at ? parseISO(thread.latestEmail.received_at) : new Date();
  const formattedTime = format(dateObj, 'HH:mm');

  // Get sender name/address
  let fromLabel = thread.latestEmail.from_address;
  if (thread.participants.length > 1) {
    const others = thread.participants.filter(p => p !== thread.latestEmail.from_address);
    if (others.length > 0) {
      fromLabel = `${thread.latestEmail.from_address}, ${others[0]}${others.length > 1 ? '...' : ''}`;
    }
  }

  // Extract name for avatar (e.g. "Max Kemper" from "Max Kemper <max@...>")
  const nameMatch = fromLabel.match(/^"?([^"<]+)"?\s*</);
  const displayName = nameMatch ? nameMatch[1].trim() : fromLabel.split('@')[0];

  const threadCount = thread.emails.length;
  
  // Extract assignments to show as small avatars
  const assignments = thread.latestEmail.email_assignments || [];

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && styles.containerSelected
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      // @ts-ignore - Support for Web/macOS native context menu
      onContextMenu={(e: any) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(thread, { 
            x: e.nativeEvent?.pageX || e.clientX || 0, 
            y: e.nativeEvent?.pageY || e.clientY || 0 
          });
        }
      }}
      onLongPress={(e) => {
        if (onContextMenu) {
          onContextMenu(thread, { 
            x: e.nativeEvent.pageX, 
            y: e.nativeEvent.pageY 
          });
        }
      }}
    >
      <View style={styles.leftCol}>
        {isUnread && <View style={[styles.unreadDot, isSelected && styles.unreadDotSelected]} />}
        {!isUnread && <View style={styles.unreadDotPlaceholder} />}
        
        <Avatar name={displayName} size={28} />
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text 
            style={[
              styles.fromText, 
              isUnread && styles.textBold,
              isSelected && styles.textSelected
            ]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text style={[styles.dateText, isSelected && styles.textSelectedTertiary, isUnread && styles.textBold]}>
            {formattedTime}
          </Text>
        </View>
        
        <View style={styles.subjectRow}>
          <Text 
            style={[
              styles.subjectText, 
              isUnread && styles.textBold,
              isSelected && styles.textSelected
            ]}
            numberOfLines={1}
          >
            {thread.subject}
          </Text>
          
          <View style={styles.tagsContainer}>
            {threadCount > 1 && (
              <View style={styles.threadBadge}>
                <Text style={styles.threadBadgeText}>{threadCount}</Text>
              </View>
            )}
            
            {/* Real assignee badges based on assignments array */}
            {assignments.map((a: any, idx: number) => {
              // Extract initials from assigned_to_profile name or fallback
              const assignedName = a.assigned_to_profile?.display_name || 'U';
              const initials = assignedName.substring(0, 2).toUpperCase();
              
              // Simple color mapping based on first letter
              const colors = ['#00B388', '#8B5CF6', '#F59E0B', '#EF4444', '#3B82F6'];
              const colorIndex = initials.charCodeAt(0) % colors.length;
              const bgColor = colors[colorIndex];
              
              return (
                <View 
                  key={a.id || idx} 
                  style={[
                    styles.assignmentBadge, 
                    { backgroundColor: bgColor },
                    idx > 0 && { marginLeft: -6 }
                  ]}
                >
                  <Text style={styles.assignmentBadgeText}>{initials}</Text>
                </View>
              );
            })}

            {thread.latestEmail.status === 'done' && (
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>bearbeitet</Text>
              </View>
            )}
          </View>
        </View>
        
        <Text style={[styles.previewText, isSelected && styles.textSelectedSecondary]} numberOfLines={1}>
          {thread.latestEmail.snippet || ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    paddingRight: Spacing.md,
    paddingLeft: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.background,
    marginHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.sm,
    ...(Platform.OS === 'web' ? { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } : { elevation: 1 }),
  },
  containerSelected: {
    backgroundColor: '#E6F0FF', // Light blue background matching screenshot
    borderBottomColor: 'transparent',
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: 44,
    paddingTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.info, // Blue dot
    marginTop: 10,
    marginRight: 4,
  },
  unreadDotPlaceholder: {
    width: 8,
    marginRight: 4,
  },
  unreadDotSelected: {
    backgroundColor: Colors.info,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  fromText: {
    flex: 1,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginRight: Spacing.sm,
  },
  dateText: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  subjectText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
    flexShrink: 1,
    marginRight: Spacing.xs,
  },
  previewText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  textBold: {
    fontWeight: 'bold',
    color: Colors.text,
  },
  textSelected: {
    color: Colors.text,
  },
  textSelectedSecondary: {
    color: Colors.textSecondary,
  },
  textSelectedTertiary: {
    color: Colors.info,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  threadBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  threadBadgeText: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  assignmentBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00B388',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  assignmentBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  statusPill: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#31C48D',
  },
  statusPillText: {
    color: '#03543F',
    fontSize: 9,
    fontWeight: '600',
  },
});
