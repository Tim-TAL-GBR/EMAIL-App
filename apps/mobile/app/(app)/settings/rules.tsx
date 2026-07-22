import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { useRules, Rule, RuleCondition, RuleAction } from '../../../hooks/useRules';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';

export default function RulesSettingsScreen() {
  const { user } = useAuthStore();
  const { rules, refetch: refetchRules } = useRules();
  
  const personalRules = rules.filter(r => r.scope === 'private');
  const orgRules = rules.filter(r => r.scope === 'team');
  
  const [selectedItem, setSelectedItem] = useState<'you' | 'org'>('you');
  const [activeTab, setActiveTab] = useState('All');
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // Rule Editor State
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState<'incoming' | 'outgoing' | 'user_action'>('incoming');
  const [ruleMatchType, setRuleMatchType] = useState<'all' | 'any'>('all');
  const [ruleConditions, setRuleConditions] = useState<RuleCondition[]>([]);
  const [ruleActions, setRuleActions] = useState<RuleAction[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openModalForNew = (trigger: 'incoming' | 'outgoing' | 'user_action') => {
    setEditingRuleId(null);
    setRuleName(trigger === 'incoming' ? 'Neue Eingangs-Regel' : 'Neue Regel');
    setRuleDescription('');
    setRuleTrigger(trigger);
    setRuleMatchType('all');
    setRuleConditions([{ field: 'from', operator: 'contains', value: '' }]);
    setRuleActions([{ type: 'add_label', value: '' }]);
    setIsDropdownVisible(false);
    setIsModalVisible(true);
  };

  const openModalForEdit = (rule: Rule) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleDescription(rule.description || '');
    setRuleTrigger(rule.trigger_type);
    setRuleMatchType(rule.conditions_match_type);
    setRuleConditions(rule.conditions || []);
    setRuleActions(rule.actions || []);
    setIsDropdownVisible(false);
    setIsModalVisible(true);
  };

  const handleSaveRule = async () => {
    if (!ruleName) {
      Alert.alert('Fehler', 'Bitte gib einen Namen für die Regel ein.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const scope = selectedItem === 'you' ? 'private' : 'team';
      const payload = {
        name: ruleName,
        description: ruleDescription,
        trigger_type: ruleTrigger,
        conditions_match_type: ruleMatchType,
        conditions: ruleConditions,
        actions: ruleActions,
        is_active: true
      };

      if (editingRuleId) {
        const { error } = await supabase.from('rules').update(payload).eq('id', editingRuleId);
        if (error) throw error;
        Alert.alert('Erfolg', 'Regel aktualisiert.');
      } else {
        const { error } = await supabase.from('rules').insert([{
          owner_id: scope === 'private' ? user?.id : null,
          scope: scope,
          ...payload
        }]);
        if (error) throw error;
        Alert.alert('Erfolg', 'Regel erstellt.');
      }
      
      setIsModalVisible(false);
      refetchRules();
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    Alert.alert('Regel löschen', 'Bist du sicher?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('rules').delete().eq('id', id);
          refetchRules();
        } catch (e: any) {
          Alert.alert('Fehler', e.message);
        }
      }}
    ]);
  };
   return (
    <View style={styles.container}>
      {/* Modal Overlay */}
      {isModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.modalTitleIcon}>⋮⋮</Text>
                <Text style={styles.modalTitle}>
                  <Text style={{fontWeight: 'bold'}}>{ruleTrigger === 'incoming' ? 'Eingehende E-Mail' : ruleTrigger === 'outgoing' ? 'Ausgehende E-Mail' : 'Benutzeraktion'}</Text> Regel
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Name</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="Name der Regel..." 
                placeholderTextColor={Colors.textTertiary}
                value={ruleName}
                onChangeText={setRuleName}
              />
              <Text style={[styles.modalLabel, { marginTop: Spacing.md }]}>Beschreibung</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="Ein paar Wörter zur Beschreibung dieser Regel..." 
                placeholderTextColor={Colors.textTertiary}
                value={ruleDescription}
                onChangeText={setRuleDescription}
              />

              <Text style={[styles.modalLabel, { marginTop: Spacing.xl }]}>Bedingungen</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
                <TouchableOpacity style={styles.dropdownInput} onPress={() => setRuleMatchType(ruleMatchType === 'all' ? 'any' : 'all')}>
                  <Text style={styles.dropdownInputText}>{ruleMatchType === 'all' ? 'Alle' : 'Irgendeine'}</Text>
                  <Text style={styles.dropdownInputCaret}>⌄</Text>
                </TouchableOpacity>
                <Text style={styles.modalText}>dieser Bedingungen müssen zutreffen:</Text>
              </View>

              {ruleConditions.map((cond, index) => (
                <View key={`cond-${index}`} style={styles.conditionRow}>
                  <TextInput 
                    style={[styles.conditionInput, { flex: 0.5, marginRight: Spacing.sm }]} 
                    value={cond.field} 
                    onChangeText={(val) => {
                      const newConds = [...ruleConditions];
                      newConds[index].field = val;
                      setRuleConditions(newConds);
                    }}
                    placeholder="Feld (z.B. from)"
                  />
                  <TextInput 
                    style={[styles.conditionInput, { flex: 0.5, marginRight: Spacing.sm }]} 
                    value={cond.operator} 
                    onChangeText={(val) => {
                      const newConds = [...ruleConditions];
                      newConds[index].operator = val;
                      setRuleConditions(newConds);
                    }}
                    placeholder="Operator (z.B. is)"
                  />
                  <TextInput 
                    style={styles.conditionInput} 
                    value={cond.value}
                    onChangeText={(val) => {
                      const newConds = [...ruleConditions];
                      newConds[index].value = val;
                      setRuleConditions(newConds);
                    }}
                    placeholder="Wert"
                  />
                  <TouchableOpacity onPress={() => {
                    const newConds = [...ruleConditions];
                    newConds.splice(index, 1);
                    setRuleConditions(newConds);
                  }}>
                    <Text style={styles.actionIcon}>−</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => setRuleConditions([...ruleConditions, { field: '', operator: '', value: '' }])}>
                <Text style={[styles.actionIcon, { marginLeft: 0, marginTop: Spacing.xs }]}>+ Bedingung hinzufügen</Text>
              </TouchableOpacity>

              <Text style={[styles.modalLabel, { marginTop: Spacing.xl }]}>Aktionen</Text>
              {ruleActions.map((action, index) => (
                <View key={`act-${index}`} style={styles.conditionRow}>
                  <TextInput 
                    style={[styles.conditionInput, { flex: 0.5, marginRight: Spacing.sm }]} 
                    value={action.type} 
                    onChangeText={(val) => {
                      const newActs = [...ruleActions];
                      newActs[index].type = val;
                      setRuleActions(newActs);
                    }}
                    placeholder="Aktion (z.B. add_label)"
                  />
                  <TextInput 
                    style={styles.conditionInput} 
                    value={action.value}
                    onChangeText={(val) => {
                      const newActs = [...ruleActions];
                      newActs[index].value = val;
                      setRuleActions(newActs);
                    }}
                    placeholder="Wert (z.B. label_id)"
                  />
                  <TouchableOpacity onPress={() => {
                    const newActs = [...ruleActions];
                    newActs.splice(index, 1);
                    setRuleActions(newActs);
                  }}>
                    <Text style={styles.actionIcon}>−</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => setRuleActions([...ruleActions, { type: '', value: '' }])}>
                <Text style={[styles.actionIcon, { marginLeft: 0, marginTop: Spacing.xs }]}>+ Aktion hinzufügen</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalButtonSecondaryText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleSaveRule} disabled={isSubmitting}>
                <Text style={styles.modalButtonPrimaryText}>{isSubmitting ? '...' : (editingRuleId ? 'Aktualisieren' : 'Erstellen')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarContent}>
          <View style={styles.searchWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput 
              style={styles.searchInput} 
              placeholder="Regeln suchen..." 
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          
          <Text style={styles.sidebarSectionTitle}>Persönliche Regeln</Text>
          <TouchableOpacity 
            style={[styles.sidebarItem, selectedItem === 'you' && styles.sidebarItemActive]}
            onPress={() => setSelectedItem('you')}
          >
            <View style={[styles.userAvatar, { backgroundColor: '#00B388', width: 28, height: 28, borderRadius: 14 }]}>
              <Text style={[styles.userAvatarText, { fontSize: 12 }]}>{user?.email?.substring(0,2).toUpperCase() || 'TR'}</Text>
            </View>
            <View>
              <Text style={[styles.sidebarItemTitle, selectedItem === 'you' && styles.sidebarItemTitleActive]}>Du</Text>
              <Text style={[styles.sidebarItemSubtitle, selectedItem === 'you' && styles.sidebarItemSubtitleActive]}>{personalRules.length} Regeln</Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.sidebarSectionTitle, { marginTop: Spacing.md }]}>Organisations-Regeln</Text>
          <TouchableOpacity 
            style={[styles.sidebarItem, selectedItem === 'org' && styles.sidebarItemActive]}
            onPress={() => setSelectedItem('org')}
          >
            <View style={styles.orgAvatar}>
              <Text style={styles.orgAvatarText}>OR</Text>
            </View>
            <View>
              <Text style={[styles.sidebarItemTitle, selectedItem === 'org' && styles.sidebarItemTitleActive]}>Team Regeln</Text>
              <Text style={[styles.sidebarItemSubtitle, selectedItem === 'org' && styles.sidebarItemSubtitleActive]}>{orgRules.length} Regeln</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sidebarFooterWrapper}>
          <TouchableOpacity style={styles.sidebarFooter} onPress={() => setIsDropdownVisible(!isDropdownVisible)}>
            <Text style={styles.sidebarFooterText}>Regel erstellen ⌄</Text>
          </TouchableOpacity>

          {/* Create Rule Dropdown Menu */}
          {isDropdownVisible && (
            <View style={styles.dropdownMenu}>
              <View style={styles.dropdownSearchWrapper}>
                <Text style={styles.dropdownSearchIcon}>🔍</Text>
                <TextInput style={styles.dropdownSearchInput} placeholder="Suchen" placeholderTextColor={Colors.textTertiary} />
              </View>
              <ScrollView style={{ maxHeight: 300 }}>
                <Text style={styles.dropdownSectionTitle}>Eingehende Nachrichten</Text>
                <TouchableOpacity style={styles.dropdownItem} onPress={() => openModalForNew('incoming')}>
                  <Text style={styles.dropdownItemText}>Eingehende E-Mail Regel</Text>
                </TouchableOpacity>
                
                <Text style={[styles.dropdownSectionTitle, { marginTop: Spacing.sm }]}>Ausgehende Nachrichten</Text>
                <TouchableOpacity style={styles.dropdownItem} onPress={() => openModalForNew('outgoing')}>
                  <Text style={styles.dropdownItemText}>Ausgehende E-Mail Regel</Text>
                </TouchableOpacity>

                <Text style={[styles.dropdownSectionTitle, { marginTop: Spacing.sm }]}>Benutzeraktionen</Text>
                <TouchableOpacity style={styles.dropdownItem} onPress={() => openModalForNew('user_action')}>
                  <Text style={styles.dropdownItemText}>Benutzeraktion Regel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <View style={styles.mainHeader}>
          <View style={styles.headerTitleRow}>
            {selectedItem === 'you' ? (
              <View style={[styles.headerAvatar, { backgroundColor: '#00B388' }]}>
                <Text style={styles.headerAvatarText}>{user?.email?.substring(0,2).toUpperCase() || 'TR'}</Text>
              </View>
            ) : (
              <View style={[styles.headerAvatar, { backgroundColor: '#F06A6A' }]}>
                <Text style={styles.headerAvatarText}>OR</Text>
              </View>
            )}
            <View>
              <Text style={styles.mainHeaderTitle}>{selectedItem === 'you' ? 'Du' : 'Team Regeln'}</Text>
              <Text style={styles.mainHeaderSubtitle}>Regeln</Text>
            </View>
          </View>
        </View>
        
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.warningBox}>
            <Text style={styles.warningIconBox}>❕</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.warningText}>
                Du kannst Regeln 30 Tage lang testen. Danach werden sie deaktiviert, es sei denn, du führst ein Upgrade auf den <Text style={{fontWeight: 'bold'}}>Productive</Text>-Plan durch.
              </Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoIconBox}>❔</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoText}>
                <Text style={{fontWeight: 'bold'}}>Persönliche Regeln</Text> gelten für <Text style={{fontWeight: 'bold'}}>private</Text> Unterhaltungen. Verwende Organisations-Regeln für geteilte Unterhaltungen.
              </Text>
              <TouchableOpacity style={{ marginTop: Spacing.sm }}>
                <Text style={styles.linkTextBlue}>Mehr erfahren</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tabsContainer}>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'All' && styles.tabButtonActive]} onPress={() => setActiveTab('All')}>
                <Text style={[styles.tabText, activeTab === 'All' && styles.tabTextActive]}>Alle Regeln</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'incoming' && styles.tabButtonActive]} onPress={() => setActiveTab('incoming')}>
                <View style={[styles.dot, { backgroundColor: '#00B388' }]} />
                <Text style={[styles.tabText, activeTab === 'incoming' && styles.tabTextActive]}>Eingehend</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'outgoing' && styles.tabButtonActive]} onPress={() => setActiveTab('outgoing')}>
                <View style={[styles.dot, { backgroundColor: '#1E90FF' }]} />
                <Text style={[styles.tabText, activeTab === 'outgoing' && styles.tabTextActive]}>Ausgehend</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'user_action' && styles.tabButtonActive]} onPress={() => setActiveTab('user_action')}>
                <View style={[styles.dot, { backgroundColor: '#7B68EE' }]} />
                <Text style={[styles.tabText, activeTab === 'user_action' && styles.tabTextActive]}>Benutzeraktion</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.createRuleButtonInline} onPress={() => setIsDropdownVisible(true)}>
              <Text style={styles.createRuleButtonInlineText}>⊕ Regel erstellen</Text>
            </TouchableOpacity>
          </View>

          {/* List of Rules */}
          {(() => {
            const listToMap = (selectedItem === 'you' ? personalRules : orgRules).filter(r => activeTab === 'All' ? true : r.trigger_type === activeTab);
            
            if (listToMap.length === 0) {
              return (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>Noch keine Regeln</Text>
                </View>
              );
            }
            
            return listToMap.map(rule => (
              <View key={rule.id} style={[styles.emptyCard, { marginBottom: Spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View>
                  <Text style={{ fontFamily: FontFamily, fontSize: FontSize.md, fontWeight: 'bold', color: Colors.text }}>{rule.name}</Text>
                  <Text style={{ fontFamily: FontFamily, fontSize: FontSize.sm, color: Colors.textSecondary }}>{rule.description || 'Keine Beschreibung'}</Text>
                  <Text style={{ fontFamily: FontFamily, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 4 }}>
                    Auslöser: {rule.trigger_type} • {rule.conditions.length} Bedingungen • {rule.actions.length} Aktionen
                  </Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity onPress={() => openModalForEdit(rule)} style={{ marginRight: Spacing.md }}>
                    <Text style={{ color: Colors.info, fontWeight: 'bold' }}>Bearbeiten</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteRule(rule.id)}>
                    <Text style={{ color: Colors.error, fontWeight: 'bold' }}>Löschen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ));
          })()}

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  sidebar: {
    width: 260,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  sidebarContent: {
    flex: 1,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    margin: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  sidebarSectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
  },
  sidebarItemActive: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
    backgroundColor: Colors.info,
  },
  orgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F06A6A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  orgAvatarText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    fontWeight: 'bold',
  },
  sidebarItemTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  sidebarItemSubtitle: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  sidebarItemTitleActive: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: '#FFF',
  },
  sidebarItemSubtitleActive: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  sidebarFooterWrapper: {
    position: 'relative',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sidebarFooter: {
    padding: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  sidebarFooterText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
  },
  dropdownMenu: {
    position: 'absolute',
    bottom: '100%',
    right: Spacing.md,
    left: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  dropdownSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownSearchIcon: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginRight: Spacing.sm,
  },
  dropdownSearchInput: {
    flex: 1,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  dropdownSectionTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
  },
  dropdownItem: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
  },
  dropdownItemText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  main: {
    flex: 1,
  },
  mainHeader: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  headerAvatarText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: 'bold',
  },
  mainHeaderTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  mainHeaderSubtitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFBE6',
    borderWidth: 1,
    borderColor: '#FFE58F',
    borderRadius: 8,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  warningIconBox: {
    fontSize: FontSize.md,
    marginRight: Spacing.sm,
    color: '#FAAD14',
  },
  warningText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#BFE0FF',
    borderRadius: 8,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  infoIconBox: {
    fontSize: FontSize.md,
    marginRight: Spacing.sm,
    color: Colors.info,
  },
  infoText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  linkTextBlue: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.info,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHover,
    borderRadius: 20,
    padding: 4,
    marginBottom: Spacing.sm,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  tabButtonActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  tabText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.text,
    fontWeight: 'bold',
  },
  createRuleButtonInline: {
    paddingHorizontal: Spacing.md,
  },
  createRuleButtonInlineText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.info,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.lg,
  },
  emptyCardText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  userAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontWeight: 'bold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: 600,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  modalTitleIcon: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    marginRight: Spacing.sm,
  },
  modalTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  closeIcon: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: Spacing.xl,
    paddingTop: 0,
  },
  modalLabel: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.info,
    borderRadius: 6,
    padding: Spacing.sm,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHover,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginRight: Spacing.sm,
  },
  dropdownInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHover,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    marginRight: Spacing.sm,
  },
  dropdownInputText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
    marginRight: 4,
  },
  dropdownInputCaret: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  modalText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  actionIcon: {
    fontSize: 16,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm,
    paddingHorizontal: 4,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  conditionInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    padding: 6,
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
  },
  modalButtonSecondary: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginRight: Spacing.md,
  },
  modalButtonSecondaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  modalButtonPrimary: {
    backgroundColor: Colors.info,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: 6,
  },
  modalButtonPrimaryText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
});
