import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { supabase } from '../../lib/supabase';

interface Attachment {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  is_inline: boolean;
}

interface AttachmentPreviewProps {
  attachment: Attachment;
  onPress?: (attachment: Attachment) => void;
}

export function AttachmentPreview({ attachment, onPress }: AttachmentPreviewProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUrl() {
      if (!attachment.storage_path) {
        setIsLoading(false);
        return;
      }
      
      const { data, error } = await supabase.storage
        .from('email_attachments')
        .createSignedUrl(attachment.storage_path, 3600); // 1 hour expiry
        
      if (data?.signedUrl) {
        setSignedUrl(data.signedUrl);
      }
      setIsLoading(false);
    }
    
    fetchUrl();
  }, [attachment.storage_path]);

  const isImage = attachment.content_type?.startsWith('image/');
  
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleOpen = () => {
    if (onPress) {
      onPress(attachment);
    } else if (signedUrl) {
      Linking.openURL(signedUrl);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={handleOpen}
      activeOpacity={0.8}
    >
      {isImage ? (
        <View style={styles.imagePreviewContainer}>
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : signedUrl ? (
            <Image 
              source={{ uri: signedUrl }} 
              style={styles.imagePreview} 
              resizeMode="cover" 
            />
          ) : (
            <Feather name="image" size={24} color={Colors.textSecondary} />
          )}
        </View>
      ) : (
        <View style={styles.fileIconContainer}>
          <Feather 
            name={attachment.content_type?.includes('pdf') ? 'file-text' : 'file'} 
            size={24} 
            color={Colors.primary} 
          />
        </View>
      )}

      <View style={styles.details}>
        <Text style={styles.fileName} numberOfLines={1}>
          {attachment.file_name}
        </Text>
        <Text style={styles.fileSize}>
          {formatSize(attachment.size_bytes)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    backgroundColor: '#fff',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  imagePreviewContainer: {
    height: 120,
    width: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  fileIconContainer: {
    height: 120,
    width: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  details: {
    padding: Spacing.sm,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  fileName: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  fileSize: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: Colors.textTertiary,
  },
});
