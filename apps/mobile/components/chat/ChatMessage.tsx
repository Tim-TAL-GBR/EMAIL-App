import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, BorderRadius } from '../../lib/constants';
import { Avatar } from '../ui/Avatar';

interface ChatMessageProps {
  comment: {
    author: {
      display_name: string | null;
      avatar_url: string | null;
      email: string;
    };
    body: string;
    created_at: string | null;
  };
}

export function ChatMessage({ comment }: ChatMessageProps) {
  const authorName = comment.author?.display_name || comment.author?.email || 'Unknown User';
  const formattedDate = comment.created_at
    ? format(parseISO(comment.created_at), 'MMM d, HH:mm')
    : '';

  const isSystemEvent = comment.body.includes('Conversation was') || comment.body.includes('You closed');

  if (isSystemEvent) {
    return (
      <View style={styles.eventContainer}>
        <Text style={styles.eventTimestamp}>{formattedDate}</Text>
        <View style={styles.eventBodyRow}>
          <Text style={styles.eventText}>{comment.body}</Text>
        </View>
      </View>
    );
  }

  const renderMessageBody = (text: string) => {
    const mentionRegex = /(@[A-Za-zäöüÄÖÜß]+(?: [A-Za-zäöüÄÖÜß]+)?)/g;
    const parts = text.split(mentionRegex);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <Text key={index} style={styles.mentionBadge}>
            {part}
          </Text>
        );
      }
      return <Text key={index}>{part}</Text>;
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eventTimestamp}>{formattedDate}</Text>
      <View style={styles.messageRow}>
        <Avatar uri={comment.author?.avatar_url} name={authorName} size={24} />
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>
            <Text style={styles.authorName}>{authorName} </Text>
            {renderMessageBody(comment.body)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center', // Centers the timestamp
  },
  eventContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  eventTimestamp: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  eventBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventText: {
    fontFamily: FontFamily,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  messageRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  bubble: {
    backgroundColor: '#F3F4F6', // Light gray like Missive
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: Spacing.sm,
    maxWidth: '85%',
  },
  bubbleText: {
    fontFamily: FontFamily,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  authorName: {
    fontWeight: 'bold',
  },
  mentionBadge: {
    backgroundColor: '#E0F2FE', // Light blue background
    color: '#0284C7', // Darker blue text
    fontWeight: '600',
    overflow: 'hidden',
  },
});
