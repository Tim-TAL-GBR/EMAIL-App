import React, { useState, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, BorderRadius, Shadows } from '../../lib/constants';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmailAssignment } from './EmailAssignment';
import { supabase } from '../../lib/supabase';
import { useComposerStore } from '../../stores/composerStore';

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?\/?>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '');
}
import { useEmailStore } from '../../stores/emailStore';
import { useInboxes } from '../../hooks/useInboxes';
import { Feather } from '@expo/vector-icons';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { AttachmentPreview } from './AttachmentPreview';

interface EmailDetailData {
  id: string;
  inbox_id: string;
  from_address: string;
  to_addresses?: string[];
  cc_addresses?: string[] | null;
  subject: string | null;
  body_text: string | null;
  body_html?: string | null;
  snippet?: string | null;
  received_at: string | null;
  status: 'open' | 'in_progress' | 'done';
  email_attachments?: {
    id: string;
    file_name: string;
    content_type: string;
    size_bytes: number;
    storage_path: string;
    is_inline: boolean;
  }[];
}

interface EmailDetailProps {
  email: EmailDetailData;
  initiallyCollapsed?: boolean;
  onStatusChange: (status: 'open' | 'in_progress' | 'done') => void;
}

export function EmailDetail({ email, initiallyCollapsed = false, onStatusChange }: EmailDetailProps) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);
  const { archiveEmail, deleteEmail } = useEmailStore();
  const { openComposer } = useComposerStore();

  useEffect(() => {
    loadAssignments();
  }, [email.id]);

  const loadAssignments = async () => {
    const { data } = await supabase
      .from('email_assignments')
      .select('*')
      .eq('email_id', email.id);
    setAssignments((data as any) ?? []);
  };

  const [fullBody, setFullBody] = useState<{ html?: string | null, text?: string | null }>({ 
    html: email.body_html, 
    text: email.body_text 
  });
  const [isLoadingBody, setIsLoadingBody] = useState(false);

  useEffect(() => {
    if (!isCollapsed && (fullBody.html === undefined && fullBody.text === undefined)) {
      loadBody();
    }
  }, [isCollapsed, email.id]);

  const loadBody = async () => {
    setIsLoadingBody(true);
    const { data, error } = await supabase
      .from('emails')
      .select('body_html, body_text')
      .eq('id', email.id)
      .single();
    if (data && !error) {
      setFullBody({ html: data.body_html, text: data.body_text });
    }
    setIsLoadingBody(false);
  };

  const { inboxes } = useInboxes();
  const inboxName = inboxes?.find(i => i.id === email.inbox_id)?.name || 'Inbox';

  const toDisplay = email.to_addresses?.length ? email.to_addresses : [];
  const formattedDate = email.received_at ? format(parseISO(email.received_at), 'MMM d, HH:mm') : '';

  const parseSenderName = (fromAddress?: string) => {
    if (!fromAddress) return 'Unbekannt';
    const match = fromAddress.match(/^(.*?)\s*<.*>$/);
    if (match && match[1].trim()) return match[1].replace(/['"]/g, '').trim();
    return fromAddress.split('@')[0];
  };
 
  const senderName = parseSenderName(email.from_address);
  const senderInitials = senderName.substring(0, 2).toUpperCase();
  const plainBody = email.snippet || '';
  const attachments = email.email_attachments || [];

  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null);
  const [webViewHeight, setWebViewHeight] = useState(100);

  const handleAttachmentPress = (attachment: any) => {
    setSelectedAttachment(attachment);
    setPreviewVisible(true);
  };

  if (isCollapsed) {
    return (
      <TouchableOpacity style={styles.cardCollapsed} onPress={() => setIsCollapsed(false)} activeOpacity={0.7}>
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarTextSmall}>{senderInitials}</Text>
        </View>
        <View style={styles.collapsedContent}>
          <View style={styles.collapsedHeaderRow}>
            <Text style={styles.senderName} numberOfLines={1}>{senderName}</Text>
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
          <View style={styles.collapsedSnippetRow}>
            <Text style={styles.snippetText} numberOfLines={1}>{plainBody}</Text>
            <View style={styles.collapsedRightRow}>
              {attachments.length > 0 && <Feather name="paperclip" size={12} color={Colors.textTertiary} />}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <TouchableOpacity
          style={styles.collapsibleArea}
          onPress={() => setIsCollapsed(true)}
          activeOpacity={0.8}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{senderInitials}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.senderNameBold}>{senderName}</Text>
            <View style={styles.headerSubtitleRow}>
              <Text style={styles.toInfo}>
                {toDisplay.length > 0 ? `To: ${toDisplay.join(', ')}` : inboxName}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <Text style={styles.dateText}>{formattedDate}</Text>
          <TouchableOpacity
            style={styles.replyBtn}
            onPress={() => openComposer({ mode: 'reply', inboxId: email.inbox_id, sourceEmail: email as any })}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather name="corner-up-left" size={14} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.bodyContainer}>
        {isLoadingBody ? (
          <View style={{ padding: Spacing.md }}>
            <Text style={{ color: Colors.textSecondary }}>Lade Nachricht...</Text>
          </View>
        ) : fullBody.html ? (
          Platform.OS === 'web' ? (
            <iframe
              srcDoc={`
                <!DOCTYPE html>
                <html>
                <head>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #333; margin: 0; padding: 0; word-wrap: break-word; }
                    img { max-width: 100%; height: auto; }
                    a { color: #0066cc; text-decoration: none; }
                  </style>
                </head>
                <body>
                  ${sanitizeHtml(fullBody.html)}
                </body>
                </html>
              `}
              style={{ width: '100%', minHeight: 500, border: 'none', backgroundColor: 'transparent' }}
            />
          ) : (
            <WebView
              source={{ html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #333; margin: 0; padding: 0; word-wrap: break-word; }
                    img { max-width: 100%; height: auto; }
                    a { color: #0066cc; text-decoration: none; }
                  </style>
                </head>
                <body>
                  ${sanitizeHtml(fullBody.html)}
                  <script>
                    window.ReactNativeWebView.postMessage(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight).toString());
                  </script>
                </body>
                </html>
              ` }}
              style={{ width: '100%', height: webViewHeight, backgroundColor: 'transparent' }}
              originWhitelist={['*']}
              scalesPageToFit={false}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              onMessage={(event) => {
                const height = parseInt(event.nativeEvent.data, 10);
                if (!isNaN(height) && height > 0) {
                  setWebViewHeight(height + 20);
                }
              }}
            />
          )
        ) : (
          <Text style={styles.bodyText}>{fullBody.text || ''}</Text>
        )}
      </View>

      {attachments.length > 0 && (
        <View style={styles.attachmentsContainer}>
          {attachments.map(att => (
            <AttachmentPreview 
              key={att.id} 
              attachment={att} 
              onPress={handleAttachmentPress} 
            />
          ))}
        </View>
      )}

      <AttachmentPreviewModal 
        visible={previewVisible} 
        attachment={selectedAttachment} 
        onClose={() => {
          setPreviewVisible(false);
          setSelectedAttachment(null);
        }} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.md,
    ...Platform.select({
      ios: Shadows.subtle,
      android: { elevation: 1 },
    }),
  },
  cardCollapsed: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'flex-start',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingBottom: Spacing.md,
  },
  collapsibleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#2A56C6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#2A56C6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  avatarTextSmall: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  collapsedContent: {
    flex: 1,
  },

  replyBtn: {
    padding: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapsedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapsedRightRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapsedSnippetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  senderName: {
    fontFamily: FontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  senderNameBold: {
    fontFamily: FontFamily,
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
  },
  toInfo: {
    fontFamily: FontFamily,
    fontSize: 12,
    color: Colors.textTertiary,
  },
  dateText: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    padding: Spacing.xs,
  },
  actionBtnCollapsed: {
    paddingHorizontal: 4,
  },
  snippetText: {
    fontFamily: FontFamily,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  bodyContainer: {
    marginTop: Spacing.xs,
  },
  bodyText: {
    fontFamily: FontFamily,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  attachmentsContainer: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.md,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    paddingRight: Spacing.md,
    width: '48%',
  },
  attachmentIconBox: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontFamily: FontFamily,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text,
  },
  attachmentSize: {
    fontFamily: FontFamily,
    fontSize: 10,
    color: Colors.textTertiary,
  }
});
