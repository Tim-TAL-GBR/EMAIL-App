import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, ActivityIndicator, Platform, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, FontFamily, FontSize } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import * as Linking from 'expo-linking';
import { File, Paths } from 'expo-file-system';

interface Attachment {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  is_inline: boolean;
}

interface AttachmentPreviewModalProps {
  visible: boolean;
  attachment: Attachment | null;
  onClose: () => void;
}

export function AttachmentPreviewModal({ visible, attachment, onClose }: AttachmentPreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && attachment) {
      loadUrl();
    } else {
      setSignedUrl(null);
    }
  }, [visible, attachment]);

  const loadUrl = async () => {
    if (!attachment) return;
    setLoading(true);
    try {
      // Create a signed URL valid for 60 seconds
      const { data, error } = await supabase
        .storage
        .from('email_attachments')
        .createSignedUrl(attachment.storage_path, 60);
      
      if (error) throw error;
      setSignedUrl(data.signedUrl);
    } catch (e) {
      console.error('Error generating signed URL:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!attachment) return;
    try {
      const { data, error } = await supabase
        .storage
        .from('email_attachments')
        .createSignedUrl(attachment.storage_path, 120, { download: attachment.file_name });
      if (error) throw error;

      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.download = attachment.file_name;
        a.click();
      } else {
        const dest = new File(Paths.document, attachment.file_name);
        const file = await File.downloadFileAsync(data.signedUrl, dest, { idempotent: true });
        Linking.openURL(file.uri);
      }
    } catch (e) {
      console.error('Download failed:', e);
      Alert.alert('Download fehlgeschlagen', 'Die Datei konnte nicht heruntergeladen werden.');
    }
  };

  if (!attachment) return null;

  const isImage = attachment.content_type.startsWith('image/');
  const isPdf = attachment.content_type === 'application/pdf';
  const isWeb = Platform.OS === 'web';

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Feather name="x" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>{attachment.file_name}</Text>
            <Text style={styles.subtitle}>{(attachment.size_bytes / 1024 / 1024).toFixed(2)} MB</Text>
          </View>

        </View>

        <View style={styles.content}>
          {loading && <ActivityIndicator size="large" color="#FFF" />}
          
          {!loading && signedUrl && isImage && (
            <Image 
              source={{ uri: signedUrl }} 
              style={styles.image} 
              resizeMode="contain" 
            />
          )}

          {!loading && signedUrl && isPdf && isWeb && (
            <View style={styles.pdfContainer}>
              <iframe 
                src={signedUrl} 
                style={{ width: '100%', height: '100%', border: 'none' }} 
                title="PDF Preview"
              />
            </View>
          )}

          {!loading && signedUrl && !isImage && (
            <View style={styles.fallbackContainer}>
              {!(isPdf && isWeb) && (
                <>
                  <Feather name="file" size={64} color="#CCC" />
                  <Text style={styles.fallbackText}>Keine Vorschau verfügbar</Text>
                </>
              )}
              <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                <Text style={styles.downloadButtonText}>Datei öffnen / herunterladen</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.xl, // For notch/status bar in mobile
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iconButton: {
    padding: Spacing.sm,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  title: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#CCC',
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfContainer: {
    flex: 1,
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    alignItems: 'center',
    paddingBottom: Spacing.lg,
  },
  fallbackText: {
    color: '#CCC',
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  downloadButton: {
    backgroundColor: Colors.info,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 8,
  },
  downloadButtonText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
  }
});
