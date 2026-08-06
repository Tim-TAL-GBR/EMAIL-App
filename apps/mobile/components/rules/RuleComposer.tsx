import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontFamily, FontSize, FontWeight } from '../../lib/constants';
import { RuleCondition, RuleAction, useRuleStore, RuleTriggerType, RuleMatchType } from '../../stores/ruleStore';
import { useAuthStore } from '../../stores/authStore';
import { useLabelStore } from '../../stores/useLabelStore';
import { Button } from '../ui/Button';

interface RuleComposerProps {
  visible: boolean;
  onClose: () => void;
  teamId?: string | null;
  initialCondition?: RuleCondition;
}

export function RuleComposer({ visible, onClose, teamId, initialCondition }: RuleComposerProps) {
  const [name, setName] = useState('');
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [actions, setActions] = useState<RuleAction[]>([]);
  const { createRule } = useRuleStore();
  const { labels, fetchLabels } = useLabelStore();
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (visible) {
      if (teamId) fetchLabels(teamId);
      setName('');
      setConditions(initialCondition ? [initialCondition] : [{ field: 'from', operator: 'contains', value: '' }]);
      setActions([{ type: 'add_label', value: '' }]);
    }
  }, [visible, initialCondition]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Fehler', 'Bitte gib der Regel einen Namen.');
      return;
    }

    const { error } = await createRule({
      team_id: teamId || null,
      owner_id: teamId ? null : (user?.id || null),
      scope: teamId ? 'team' : 'private',
      name,
      description: '',
      trigger_type: 'incoming',
      conditions_match_type: 'all',
      conditions: conditions.filter(c => c.value.trim() !== ''),
      actions: actions.filter(a => a.type === 'mark_read' || a.type === 'archive' || a.type === 'star' || (a.value && a.value.trim() !== '')),
      is_active: true
    });

    if (error) {
      Alert.alert('Fehler', error.message);
    } else {
      Alert.alert('Erfolg', 'Regel wurde erstellt!');
      onClose();
    }
  };

  const addCondition = () => setConditions([...conditions, { field: 'subject', operator: 'contains', value: '' }]);
  const removeCondition = (index: number) => setConditions(conditions.filter((_, i) => i !== index));

  const addAction = () => setActions([...actions, { type: 'mark_read' }]);
  const removeAction = (index: number) => setActions(actions.filter((_, i) => i !== index));

  const renderCondition = (cond: RuleCondition, index: number) => (
    <View key={`cond-${index}`} style={styles.rowItem}>
      <View style={styles.inputsRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={cond.field}
          onChangeText={(v) => {
            const newConds = [...conditions];
            newConds[index].field = v as any;
            setConditions(newConds);
          }}
          placeholder="Feld (from, subject...)"
        />
        <TextInput
          style={[styles.input, { flex: 1, marginHorizontal: Spacing.xs }]}
          value={cond.operator}
          onChangeText={(v) => {
            const newConds = [...conditions];
            newConds[index].operator = v as any;
            setConditions(newConds);
          }}
          placeholder="Operator"
        />
        <TextInput
          style={[styles.input, { flex: 2 }]}
          value={cond.value}
          onChangeText={(v) => {
            const newConds = [...conditions];
            newConds[index].value = v;
            setConditions(newConds);
          }}
          placeholder="Wert"
        />
      </View>
      <TouchableOpacity onPress={() => removeCondition(index)} style={styles.removeBtn}>
        <Feather name="minus-circle" size={20} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );

  const renderAction = (act: RuleAction, index: number) => (
    <View key={`act-${index}`} style={styles.rowItem}>
      <View style={styles.inputsRow}>
        <TextInput
          style={[styles.input, { flex: 1, marginRight: Spacing.xs }]}
          value={act.type}
          onChangeText={(v) => {
            const newActs = [...actions];
            newActs[index].type = v as any;
            setActions(newActs);
          }}
          placeholder="Aktion (add_label, mark_read...)"
        />
        {act.type === 'add_label' && (
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={act.value}
            onChangeText={(v) => {
              const newActs = [...actions];
              newActs[index].value = v;
              setActions(newActs);
            }}
            placeholder="Label ID"
          />
        )}
      </View>
      <TouchableOpacity onPress={() => removeAction(index)} style={styles.removeBtn}>
        <Feather name="minus-circle" size={20} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );

  // AI WARNING: DO NOT ADD presentationStyle="pageSheet" or "formSheet" here. Using it with transparent={true} causes EXC_BAD_ACCESS native crashes on macOS Catalyst!
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Neue Regel erstellen</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
            <Text style={styles.label}>Regel-Name</Text>
            <TextInput
              style={[styles.input, { marginBottom: Spacing.lg }]}
              placeholder="z.B. Rechnungen automatisch verschieben"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.sectionTitle}>Wenn (Bedingungen)</Text>
            {conditions.map(renderCondition)}
            <TouchableOpacity style={styles.addBtn} onPress={addCondition}>
              <Feather name="plus" size={16} color={Colors.primary} />
              <Text style={styles.addBtnText}>Bedingung hinzufügen</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Dann (Aktionen)</Text>
            {actions.map(renderAction)}
            <TouchableOpacity style={styles.addBtn} onPress={addAction}>
              <Feather name="plus" size={16} color={Colors.primary} />
              <Text style={styles.addBtnText}>Aktion hinzufügen</Text>
            </TouchableOpacity>
            
            {labels.length > 0 && (
              <View style={styles.helpBox}>
                <Text style={styles.helpText}>Verfügbare Labels für "add_label":</Text>
                {labels.map(l => (
                  <Text key={l.id} style={styles.helpText}>- {l.name}: {l.id}</Text>
                ))}
              </View>
            )}

          </ScrollView>

          <View style={styles.footer}>
            <Button title="Abbrechen" variant="secondary" onPress={onClose} style={{ flex: 1, marginRight: Spacing.sm }} />
            <Button title="Regel speichern" onPress={handleSave} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    flex: 1,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  label: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  sectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  inputsRow: {
    flex: 1,
    flexDirection: 'row',
  },
  removeBtn: {
    padding: Spacing.sm,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  addBtnText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  helpBox: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: '#F5F5F5',
    borderRadius: BorderRadius.md,
  },
  helpText: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
  }
});
