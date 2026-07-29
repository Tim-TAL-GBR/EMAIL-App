import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, Shadows, BorderRadius } from '../../lib/constants';
import { ChatMessage } from './ChatMessage';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useComments } from '../../hooks/useComments';
import { EmptyState } from '../ui/EmptyState';
import { Email } from '../../stores/emailStore';
import { EmailDetail } from '../email/EmailDetail';
import { useDraft } from '../../hooks/useDraft';
import { DraftListItem } from '../email/DraftListItem';
import { MentionPicker } from './MentionPicker';

interface ChatFeedProps {
  emailId: string;
  emails: Email[];
  inboxId: string;
  threadId: string;
  onEmailStatusChange: (id: string, status: 'open' | 'in_progress' | 'done') => void;
  onDraftPress?: (draft: any) => void;
  headerComponent?: React.ReactElement;
}

export function ChatFeed({ emailId, emails, inboxId, threadId, onEmailStatusChange, onDraftPress, headerComponent }: ChatFeedProps) {
  const { comments, isLoading, addComment } = useComments(emailId);
  const { draft, deleteDraft } = useDraft(inboxId, threadId);
  const [newComment, setNewComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const timeline = React.useMemo(() => {
    const items: Array<{ type: 'email' | 'comment' | 'draft', id: string, date: number, data: any }> = [];
    emails.forEach(e => {
      items.push({ type: 'email', id: `email-${e.id}`, date: new Date(e.received_at).getTime(), data: e });
    });
    comments.forEach(c => {
      items.push({ type: 'comment', id: `comment-${c.id}`, date: new Date(c.created_at).getTime(), data: c });
    });
    if (draft) {
      items.push({ type: 'draft', id: `draft-${draft.id}`, date: new Date(draft.updated_at || Date.now()).getTime(), data: draft });
    }
    return items.sort((a, b) => a.date - b.date);
  }, [emails, comments, draft]);

  const handleTextChange = (text: string) => {
    setNewComment(text);
    const mentionMatch = text.match(/(?:^|\s)@([^\s]*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentionPicker(true);
    } else {
      setShowMentionPicker(false);
    }
  };

  const handleMentionSelect = (user: any) => {
    const match = newComment.match(/(?:^|\s)@([^\s]*)$/);
    if (match) {
      const start = newComment.lastIndexOf('@' + match[1]);
      const newText = newComment.substring(0, start) + `@${user.display_name || 'Unbekannt'} ` + newComment.substring(start + match[0].length);
      setNewComment(newText);
      setMentionedUsers([...mentionedUsers, user.id]);
    }
    setShowMentionPicker(false);
  };

  const handleSend = async () => {
    if (!newComment.trim()) return;
    const text = newComment;
    const currentMentions = [...mentionedUsers];
    setNewComment('');
    setMentionedUsers([]);
    setShowMentionPicker(false);
    
    // Pass mentions to addComment
    const { error } = await addComment(text, currentMentions);
    if (error) {
      alert('Fehler beim Senden: ' + error.message);
      setNewComment(text); // revert
      setMentionedUsers(currentMentions);
    } else {
      // Optionally scroll to end after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'email') {
      const lastEmailId = [...timeline].reverse().find(i => i.type === 'email')?.id;
      const isLastEmail = item.id === lastEmailId;
      return <EmailDetail email={item.data as any} initiallyCollapsed={!isLastEmail} onStatusChange={(status) => onEmailStatusChange(item.data.id, status)} />
    } else if (item.type === 'draft') {
      return (
        <View style={styles.draftContainer}>
          <DraftListItem
            draft={item.data as any}
            onPress={() => onDraftPress && onDraftPress(item.data)}
            onDelete={deleteDraft}
          />
        </View>
      )
    } else {
      return <ChatMessage comment={item.data as any} />
    }
  }, [timeline, onEmailStatusChange, onDraftPress, deleteDraft]);

  if (isLoading && comments.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState icon="⏳" title="Lade Kommentare..." />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={timeline} // chronological order
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={
          <EmptyState icon="💬" title="Keine Nachrichten" subtitle="Dies ist eine leere Konversation." />
        }
      />
      <View style={styles.inputContainer}>
        <MentionPicker 
          visible={showMentionPicker} 
          query={mentionQuery} 
          onSelect={handleMentionSelect} 
        />
        <View style={styles.inputWrapper}>
          <Input
            placeholder="Chat with your team..."
            value={newComment}
            onChangeText={handleTextChange}
            style={styles.input}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          {newComment.trim().length > 0 ? (
            <Button 
              title="Senden" 
              size="sm"
              variant="primary"
              onPress={handleSend} 
              style={styles.sendButton}
            />
          ) : (
            <View style={styles.inputIcons}>
              <Feather name="smile" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <Feather name="check-circle" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <Feather name="plus-circle" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: Spacing.sm,
  },
  draftContainer: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputContainer: {
    padding: Spacing.sm,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: 'transparent',
    borderWidth: 0,
    fontSize: 14,
  },
  inputIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inputIcon: {
    padding: 4,
  },
  sendButton: {
    marginLeft: Spacing.sm,
  },
});
