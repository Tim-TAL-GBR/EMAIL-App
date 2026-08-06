import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, FontWeight } from '../lib/constants';
import { useInboxes } from '../hooks/useInboxes';
import { supabase } from '../lib/supabase';

export function SubscriptionBanner() {
  const { inboxes } = useInboxes();
  const router = useRouter();
  const [status, setStatus] = useState<string>('active');
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  const teamId = React.useMemo(() => {
    for (const inbox of inboxes) {
      if (inbox.team_id) return inbox.team_id;
    }
    return null;
  }, [inboxes]);

  useEffect(() => {
    async function checkSubscription() {
      if (!teamId) return;

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('org_id', teamId)
        .single();
      
      if (sub) {
        setStatus(sub.status);
        if (sub.status !== 'active' && sub.status !== 'trialing' && sub.current_period_end) {
          // If expired, calculate days left in the 1-month grace period
          const endDate = new Date(sub.current_period_end);
          const deleteDate = new Date(endDate);
          deleteDate.setMonth(deleteDate.getMonth() + 1);
          
          const now = new Date();
          const diff = deleteDate.getTime() - now.getTime();
          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
          setDaysLeft(days > 0 ? days : 0);
        }
      } else {
        // No subscription found, check if 14-day trial has expired
        const { data: team } = await supabase
          .from('teams')
          .select('created_at')
          .eq('id', teamId)
          .single();

        if (team && team.created_at) {
          const createdDate = new Date(team.created_at);
          const now = new Date();
          const diffDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays > 14) {
            setStatus('trial_expired');
          } else {
            setStatus('trialing');
            // optionally we could setDaysLeft to 14 - diffDays if we want to show it, but for now we just keep it active/trialing
          }
        }
      }
    }

    checkSubscription();
    // Poll every minute in case of active usage
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [teamId]);

  if (status === 'active' || status === 'trialing') {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>
        {status === 'trial_expired' 
          ? 'Dein 14-tägiger Testzeitraum ist abgelaufen. Bitte kaufe jetzt ein Abonnement, um TeamMail weiterhin zu nutzen.'
          : `Dein Abonnement ist abgelaufen. Dein Postfach ist im "Nur-Lesen"-Modus. Deine Daten werden in ${daysLeft} Tagen gelöscht.`}
      </Text>
      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push('/settings/billing')}
      >
        <Text style={styles.buttonText}>Abo erneuern</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.error,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    zIndex: 100,
  },
  bannerText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  button: {
    backgroundColor: '#FFF',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 4,
  },
  buttonText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
