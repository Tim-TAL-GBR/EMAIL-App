import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight, Layout } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/constants';

async function apiRequest(path: string, method = 'GET', body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(res.ok ? 'Ungültige Serverantwort' : 'Server nicht erreichbar oder fehlerhaft (HTML).'); }
  if (!res.ok) throw new Error(json.error || 'Unbekannter Fehler');
  return json;
}

export default function BillingSettingsScreen() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const activeOrg = React.useMemo(() => organizations.find(o => o.id === activeOrgId), [organizations, activeOrgId]);
  const teamId = activeOrg?.id;
  const teamName = activeOrg?.name || 'Organisation';

  useEffect(() => {
    async function loadOrgs() {
      try {
        const data = await apiRequest('/api/teams');
        const orgs = (data || []).filter((t: any) => !t.parent_id);
        setOrganizations(orgs);
        if (orgs.length > 0 && !activeOrgId) {
          setActiveOrgId(orgs[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadOrgs();
  }, []);

  useEffect(() => {
    async function loadBilling() {
      if (!teamId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user role in org
      const { data: member } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (member) setRole(member.role);
      else setRole(null);

      // Get subscription status
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('org_id', teamId)
        .maybeSingle();
      
      if (sub) setSubscription(sub);
      else setSubscription(null);

      setIsLoading(false);
    }

    loadBilling();
  }, [teamId]);

  const handleManageSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const endpoint = subscription?.stripe_customer_id 
        ? '/api/billing/customer-portal' 
        : '/api/billing/create-checkout-session';

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ orgId: teamId })
      });

      const data = await res.json();
      if (res.ok && data.url) {
        Linking.openURL(data.url);
      } else {
        throw new Error(data.error || 'Fehler beim Öffnen des Stripe-Portals');
      }
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    }
  };

  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarContent}>
          <View style={styles.searchWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput 
              style={styles.searchInput} 
              placeholder="Organisationen suchen..." 
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          
          {organizations.map(org => {
            const isActive = org.id === activeOrgId;
            return (
              <TouchableOpacity 
                key={org.id} 
                style={isActive ? styles.sidebarItemActive : styles.sidebarItem}
                onPress={() => setActiveOrgId(org.id)}
              >
                <View style={isActive ? styles.orgAvatarActive : styles.orgAvatar}>
                  <Text style={isActive ? styles.orgAvatarTextActive : styles.orgAvatarText}>{org.name.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={isActive ? styles.sidebarItemTitleActive : styles.sidebarItemTitle}>{org.name}</Text>
                  <Text style={isActive ? styles.sidebarItemSubtitleActive : styles.sidebarItemSubtitle}>
                    {isActive && subscription ? (subscription.plan === 'pro' ? 'Pro Plan' : 'Free Trial') : 'Organisation'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <View style={styles.mainHeader}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.headerAvatar, { backgroundColor: '#F06A6A' }]}>
              <Text style={styles.headerAvatarText}>{teamName.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.mainHeaderTitle}>{teamName}</Text>
              <Text style={styles.mainHeaderSubtitle}>Abrechnung</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.contentContainer}>
          {isLoading ? (
            <ActivityIndicator size="large" color={Colors.primary} />
          ) : !isOwnerOrAdmin ? (
            <View style={styles.messageContainer}>
              <Text style={styles.messageTitle}>Du bist nicht der Inhaber</Text>
              <Text style={styles.messageText}>
                Du kannst den Plan nicht ändern, Abrechnungsdetails aktualisieren oder Rechnungen herunterladen.
              </Text>
            </View>
          ) : (
            <View style={styles.billingCard}>
              <Text style={styles.planTitle}>Aktueller Plan: {subscription?.plan === 'pro' ? 'Pro (Flat-Rate)' : 'Free Trial'}</Text>
              <Text style={styles.planStatus}>
                Status: <Text style={{fontWeight: 'bold', color: subscription?.status === 'active' ? Colors.success : Colors.warning}}>{subscription?.status || 'trialing'}</Text>
              </Text>
              {subscription?.current_period_end && (
                <Text style={styles.planDate}>Nächste Abrechnung / Ende: {new Date(subscription.current_period_end).toLocaleDateString()}</Text>
              )}
              
              <TouchableOpacity style={styles.manageButton} onPress={handleManageSubscription}>
                <Text style={styles.manageButtonText}>
                  {subscription?.stripe_customer_id ? 'Abo verwalten' : 'Jetzt upgraden'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
    marginBottom: 4,
  },
  sidebarItemTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  sidebarItemSubtitle: {
    fontFamily: FontFamily,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  orgAvatarActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F06A6A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  orgAvatarTextActive: {
    color: '#FFF',
    fontFamily: FontFamily,
    fontSize: FontSize.xs,
    fontWeight: 'bold',
  },
  sidebarItemActive: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: 6,
    backgroundColor: Colors.info,
    marginBottom: 4,
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
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  messageContainer: {
    alignItems: 'center',
    maxWidth: 600,
  },
  messageTitle: {
    fontFamily: FontFamily,
    fontSize: FontSize.lg,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  messageText: {
    fontFamily: FontFamily,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
