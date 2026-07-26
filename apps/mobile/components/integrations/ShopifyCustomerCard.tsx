import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Alert } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../lib/constants';
import { useAuthStore } from '../../stores/authStore';

interface ShopifyCustomerCardProps {
  email: string;
  detectedOrderNumber?: string;
}

export function ShopifyCustomerCard({ email, detectedOrderNumber }: ShopifyCustomerCardProps) {
  const { currentTeam, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!currentTeam || !email) return;

    const fetchCustomer = async () => {
      try {
        setLoading(true);
        setError(null);
        const baseUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
        
        const response = await fetch(`${baseUrl}/api/shopify/customer?email=${encodeURIComponent(email)}&team_id=${currentTeam.id}`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        });

        if (response.status === 404) {
          // No shopify connection for team
          setData(null);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch Shopify data');
        }

        const json = await response.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [email, currentTeam]);

  const handleCancelOrder = async (orderId: string) => {
    Alert.alert(
      'Bestellung stornieren',
      'Möchtest du diese Bestellung wirklich in Shopify stornieren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { 
          text: 'Stornieren', 
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              const baseUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
              const response = await fetch(`${baseUrl}/api/shopify/order/cancel`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                  teamId: currentTeam?.id,
                  orderId: orderId
                })
              });

              if (!response.ok) {
                const errJson = await response.json();
                throw new Error(errJson.error || 'Fehler beim Stornieren');
              }
              
              Alert.alert('Erfolg', 'Bestellung wurde storniert.');
              // Optimistic update could go here
            } catch (err: any) {
              Alert.alert('Fehler', err.message);
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  const openInShopify = (path: string) => {
    if (!data?.shopDomain) return;
    const url = `https://${data.shopDomain}/admin/${path}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={[styles.card, { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  // If no connection or no customer found, don't show the card
  if (!data || !data.customer) {
    return null; 
  }

  const customer = data.customer;
  const orders = customer.orders?.edges?.map((e: any) => e.node) || [];
  
  // Find matched order if any
  const matchedOrder = detectedOrderNumber ? orders.find((o: any) => o.name === detectedOrderNumber) : null;
  const displayOrders = matchedOrder ? [matchedOrder] : orders;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopify</Text>
        <TouchableOpacity onPress={() => openInShopify(`customers/${customer.id.split('/').pop()}`)}>
          <Text style={styles.linkText}>Kunde ansehen</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{customer.firstName} {customer.lastName}</Text>
        <Text style={styles.customerStats}>
          {customer.ordersCount} Bestellungen • {customer.amountSpent?.amount} {customer.amountSpent?.currencyCode}
        </Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>
        {matchedOrder ? 'Erkannte Bestellung' : 'Letzte Bestellungen'}
      </Text>

      {displayOrders.map((order: any) => (
        <View key={order.id} style={styles.orderItem}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderName}>{order.name}</Text>
            <Text style={styles.orderTotal}>{order.totalPriceSet?.shopMoney?.amount} {order.totalPriceSet?.shopMoney?.currencyCode}</Text>
          </View>
          
          <View style={styles.orderBadges}>
            <View style={[styles.badge, order.displayFinancialStatus === 'PAID' ? styles.badgeSuccess : styles.badgeWarning]}>
              <Text style={[styles.badgeText, order.displayFinancialStatus === 'PAID' ? styles.badgeTextSuccess : styles.badgeTextWarning]}>
                {order.displayFinancialStatus}
              </Text>
            </View>
            <View style={[styles.badge, order.displayFulfillmentStatus === 'FULFILLED' ? styles.badgeSuccess : styles.badgeWarning]}>
              <Text style={[styles.badgeText, order.displayFulfillmentStatus === 'FULFILLED' ? styles.badgeTextSuccess : styles.badgeTextWarning]}>
                {order.displayFulfillmentStatus || 'UNFULFILLED'}
              </Text>
            </View>
          </View>

          <View style={styles.orderActions}>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => openInShopify(`orders/${order.id.split('/').pop()}`)}
            >
              <Text style={styles.actionBtnText}>Ansehen</Text>
            </TouchableOpacity>

            {/* If matched order and could be a cancellation request, show cancel button */}
            {matchedOrder && order.displayFulfillmentStatus !== 'FULFILLED' && (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.actionBtnDanger]}
                onPress={() => handleCancelOrder(order.id)}
                disabled={cancelling}
              >
                <Text style={styles.actionBtnTextDanger}>{cancelling ? 'Lädt...' : 'Stornieren'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
      
      {displayOrders.length === 0 && (
        <Text style={styles.emptyText}>Keine Bestellungen gefunden.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily,
    fontWeight: FontWeight.bold,
    color: '#96BF48', // Shopify Green
  },
  linkText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontFamily: FontFamily,
  },
  customerInfo: {
    marginBottom: Spacing.md,
  },
  customerName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  customerStats: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontFamily: FontFamily,
    marginTop: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  orderItem: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: 6,
    marginBottom: Spacing.sm,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  orderName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  orderTotal: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily,
    color: Colors.text,
  },
  orderBadges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
  },
  badgeSuccess: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  badgeTextSuccess: {
    color: '#2E7D32',
  },
  badgeWarning: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFECB3',
  },
  badgeTextWarning: {
    color: '#F57F17',
  },
  orderActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
  },
  actionBtnText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily,
    color: Colors.text,
  },
  actionBtnDanger: {
    borderColor: '#FFCDD2',
    backgroundColor: '#FFEBEE',
  },
  actionBtnTextDanger: {
    color: '#C62828',
    fontSize: FontSize.xs,
    fontFamily: FontFamily,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  }
});
