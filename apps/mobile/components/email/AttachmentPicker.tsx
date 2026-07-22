import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Colors, Spacing, BorderRadius, FontFamily, FontSize, FontWeight } from '../../lib/constants';

interface Attachment {
  name: string;
  size: number;
  uri: string;
  mimeType: string;
}

interface AttachmentPickerProps {
  attachments: Attachment[];
  onAdd: (files: Attachment[]) => void;
  onRemove: (index: number) => void;
}

export function AttachmentPicker({ attachments, onAdd, onRemove }: AttachmentPickerProps) {
  const handlePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (!result.canceled) {
        const files: Attachment[] = result.assets.map((a) => ({
          name: a.name,
          size: a.size || 0,
          uri: a.uri,
          mimeType: a.mimeType || 'application/octet-stream',
        }));
      onAdd(files);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={handlePick}>
        <Text style={styles.addButtonText}>+ Anhang hinzufügen</Text>
      </TouchableOpacity>
      {attachments.map((file, index) => (
        <View key={index} style={styles.fileRow}>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
            <Text style={styles.fileSize}>{formatSize(file.size)}</Text>
          </View>
          <TouchableOpacity onPress={() => onRemove(index)} style={styles.removeButton}>
            <Text style={styles.removeText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  addButton: {
    padding: Spacing.md, backgroundColor: Colors.surfaceHover, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center',
  },
  addButtonText: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.primary },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.sm,
    marginTop: Spacing.xs, backgroundColor: Colors.surfaceHover, borderRadius: BorderRadius.sm,
  },
  fileInfo: { flex: 1, marginRight: Spacing.sm },
  fileName: { fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.text },
  fileSize: { fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textTertiary },
  removeButton: { padding: Spacing.xs },
  removeText: { fontSize: FontSize.md, color: Colors.error },
});
