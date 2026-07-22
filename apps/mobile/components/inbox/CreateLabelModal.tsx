import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors, Spacing, FontFamily, BorderRadius, Shadows, FontSize } from '../../lib/constants';

interface CreateLabelModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string) => Promise<void>;
}

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6B7280'];

export function CreateLabelModal({ visible, onClose, onCreate }: CreateLabelModalProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      await onCreate(name.trim(), selectedColor);
      setName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Erstellen des Labels');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Neues Label erstellen</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Name des Labels..."
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="sentences"
          />

          <Text style={styles.subtitle}>Farbe wählen</Text>
          <View style={styles.colorGrid}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorCircle,
                  { backgroundColor: c },
                  selectedColor === c && styles.colorCircleSelected
                ]}
                onPress={() => setSelectedColor(c)}
              />
            ))}
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.buttonCancel} onPress={onClose} disabled={isLoading}>
              <Text style={styles.buttonCancelText}>Abbrechen</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.buttonCreate, !name.trim() && styles.buttonDisabled]} 
              onPress={handleCreate}
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.buttonCreateText}>Erstellen</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadows.medium,
  },
  title: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  subtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: Colors.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  buttonCancel: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  buttonCancelText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily,
    fontWeight: '600',
  },
  buttonCreate: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonCreateText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
});
