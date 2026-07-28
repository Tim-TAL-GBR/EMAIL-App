import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Alert, ScrollView, Image, TextInput, Platform } from 'react-native';
import { Colors, Spacing, FontFamily, FontSize, FontWeight } from '../../lib/constants';
import { useAuthStore } from '../../stores/authStore';

interface ShopifyCustomerCardProps {
  email: string;
  teamId?: string;
  detectedOrderNumber?: string;
  onResult?: (result: { connected: boolean; hasCustomer: boolean }) => void;
}

export function ShopifyCustomerCard({ email, teamId, detectedOrderNumber, onResult }: ShopifyCustomerCardProps) {
  const { session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const webAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);

  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState<any>({});
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!teamId || !email) {
      setLoading(false);
      return;
    }

    const fetchCustomer = async () => {
      try {
        setLoading(true);
        setError(null);
        const baseUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
        
        const response = await fetch(`${baseUrl}/api/shopify/customer?email=${encodeURIComponent(email)}&team_id=${teamId}`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        });

        if (response.status === 404) {
          setData(null);
          onResult?.({ connected: false, hasCustomer: false });
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch Shopify data');
        }

        const json = await response.json();
        setData(json);
        onResult?.({ connected: true, hasCustomer: !!json.customer });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [email, teamId]);

  const fetchOrderDetail = useCallback(async (orderId: string) => {
    if (!teamId) return;
    try {
      setOrderDetailLoading(true);
      setOrderDetail(null);
      setSelectedOrderId(orderId);
      const baseUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/shopify/order/detail?order_id=${encodeURIComponent(orderId)}&team_id=${teamId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch order');
      const json = await response.json();
      setOrderDetail(json.order);
    } catch (err: any) {
      console.error('Failed to fetch order detail:', err.message);
      webAlert('Fehler', err.message);
      setSelectedOrderId(null);
    } finally {
      setOrderDetailLoading(false);
    }
  }, [teamId, session?.access_token]);

  const handleCancelOrder = async (orderId: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Bestellung wirklich in Shopify stornieren?')) return;
      try {
        setCancelling(true);
        const baseUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
        const response = await fetch(`${baseUrl}/api/shopify/order/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ teamId, orderId })
        });
        if (!response.ok) {
          const errJson = await response.json();
          throw new Error(errJson.error || 'Fehler beim Stornieren');
        }
        webAlert('Erfolg', 'Bestellung wurde storniert.');
        if (selectedOrderId) fetchOrderDetail(selectedOrderId);
      } catch (err: any) {
        webAlert('Fehler', err.message);
      } finally {
        setCancelling(false);
      }
    } else {
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
                  body: JSON.stringify({ teamId, orderId })
                });
                if (!response.ok) {
                  const errJson = await response.json();
                  throw new Error(errJson.error || 'Fehler beim Stornieren');
                }
                Alert.alert('Erfolg', 'Bestellung wurde storniert.');
                if (selectedOrderId) fetchOrderDetail(selectedOrderId);
              } catch (err: any) {
                Alert.alert('Fehler', err.message);
              } finally {
                setCancelling(false);
              }
            }
          }
        ]
      );
    }
  };

  const openInShopify = (path: string) => {
    if (!data?.shopDomain && !orderDetail) return;
    const domain = data?.shopDomain || (orderDetail ? undefined : undefined);
    const url = `https://${domain}/admin/${path}`;
    Linking.openURL(url);
  };

  const handleUpdateOrder = async (updates: { note?: string; shippingAddress?: any }) => {
    if (!selectedOrderId || !teamId) return;
    try {
      setUpdating(true);
      const baseUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/shopify/order/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ orderId: selectedOrderId, teamId, ...updates })
      });
      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Fehler beim Aktualisieren');
      }
      const json = await response.json();
      if (json.order) {
        setOrderDetail((prev: any) => ({ ...prev, ...json.order }));
      }
      webAlert('Erfolg', 'Bestellung aktualisiert.');
      setEditingNote(false);
      setEditingAddress(false);
    } catch (err: any) {
      webAlert('Fehler', err.message);
    } finally {
      setUpdating(false);
    }
  };

  const formatMoney = (set: any) => {
    if (!set?.shopMoney) return null;
    return `${set.shopMoney.amount} ${set.shopMoney.currencyCode}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return '#2E7D32';
      case 'PARTIALLY_REFUNDED': case 'REFUNDED': return '#1565C0';
      case 'PENDING': case 'AUTHORIZED': return '#F57F17';
      case 'VOIDED': return '#C62828';
      default: return Colors.textSecondary;
    }
  };

  const getFulfillmentColor = (status: string) => {
    switch (status) {
      case 'FULFILLED': return '#2E7D32';
      case 'PARTIALLY_FULFILLED': return '#1565C0';
      case 'UNFULFILLED': return '#F57F17';
      case 'RESTOCKED': return '#6A1B9A';
      default: return Colors.textSecondary;
    }
  };

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      PAID: 'Bezahlt', PENDING: 'Ausstehend', AUTHORIZED: 'Autorisiert',
      PARTIALLY_PAID: 'Teilbezahlt', PARTIALLY_REFUNDED: 'Teilweise erstattet',
      REFUNDED: 'Erstattet', VOIDED: 'Storniert',
      FULFILLED: 'Versendet', PARTIALLY_FULFILLED: 'Teilversendet',
      UNFULFILLED: 'Nicht versendet', RESTOCKED: 'Retourniert',
      PROCESSING: 'In Bearbeitung', READY: 'Bereit',
      IN_TRANSIT: 'Underwegs', DELIVERED: 'Zugestellt', OPEN: 'Offen',
      SCHEDULED: 'Geplant', CANCELLED: 'Storniert',
    };
    return labels[s] || s;
  };

  if (loading) {
    return (
      <View style={[styles.card, { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (!data || !data.customer) {
    return null; 
  }

  const customer = data.customer;
  const orders = customer.orders?.edges?.map((e: any) => e.node) || [];
  const matchedOrder = detectedOrderNumber ? orders.find((o: any) => o.name === detectedOrderNumber) : null;
  const displayOrders = matchedOrder ? [matchedOrder] : orders;

  // ----- ORDER DETAIL VIEW -----
  if (selectedOrderId) {
    if (orderDetailLoading) {
      return (
        <View style={styles.card}>
          <TouchableOpacity onPress={() => { setSelectedOrderId(null); setOrderDetail(null); }} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Zurück</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center', padding: Spacing.xl }}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        </View>
      );
    }

    if (!orderDetail) {
      return (
        <View style={styles.card}>
          <TouchableOpacity onPress={() => { setSelectedOrderId(null); setOrderDetail(null); }} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Zurück</Text>
          </TouchableOpacity>
          <Text style={styles.emptyText}>Bestellung nicht gefunden.</Text>
        </View>
      );
    }

    const order = orderDetail;
    const lineItems = order.lineItems?.nodes || [];
    const shippingAddr = order.shippingAddress;
    const billingAddr = order.billingAddress;

    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => { setSelectedOrderId(null); setOrderDetail(null); }} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Zurück zu {customer.firstName}'s Bestellungen</Text>
        </TouchableOpacity>

        {/* Order Header */}
        <View style={styles.detailHeader}>
          <Text style={styles.detailOrderName}>{order.name}</Text>
          <Text style={styles.detailDate}>{formatDate(order.createdAt)}</Text>
        </View>

        <View style={styles.detailBadges}>
          <View style={[styles.badge, { backgroundColor: getStatusColor(order.displayFinancialStatus) + '18', borderColor: getStatusColor(order.displayFinancialStatus) + '40' }]}>
            <Text style={[styles.badgeText, { color: getStatusColor(order.displayFinancialStatus) }]}>
              {statusLabel(order.displayFinancialStatus)}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: getFulfillmentColor(order.displayFulfillmentStatus) + '18', borderColor: getFulfillmentColor(order.displayFulfillmentStatus) + '40' }]}>
            <Text style={[styles.badgeText, { color: getFulfillmentColor(order.displayFulfillmentStatus) }]}>
              {statusLabel(order.displayFulfillmentStatus)}
            </Text>
          </View>
          {order.test && (
            <View style={[styles.badge, { backgroundColor: '#F3E5F5', borderColor: '#CE93D8' }]}>
              <Text style={[styles.badgeText, { color: '#6A1B9A' }]}>Test</Text>
            </View>
          )}
        </View>

        {/* Line Items */}
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Produkte ({lineItems.length})</Text>
          {lineItems.map((item: any, idx: number) => {
            const removedQty = item.quantity - (item.currentQuantity ?? item.quantity);
            const isPartiallyRemoved = removedQty > 0;
            return (
            <View key={item.id || idx} style={[styles.lineItem, isPartiallyRemoved && styles.lineItemRemoved]}>
              <View style={styles.lineItemRow}>
                {item.image?.url ? (
                  <Image source={{ uri: item.image.url }} style={styles.lineItemImage} />
                ) : (
                  <View style={[styles.lineItemImage, styles.lineItemImagePlaceholder]}>
                    <Text style={styles.lineItemImagePlaceholderText}>?</Text>
                  </View>
                )}
                <View style={styles.lineItemInfo}>
                  <Text style={[styles.lineItemTitle, isPartiallyRemoved && styles.lineItemTitleRemoved]} numberOfLines={2}>{item.title}{item.variantTitle ? ` — ${item.variantTitle}` : ''}</Text>
                  {item.sku && <Text style={styles.lineItemSku}>SKU: {item.sku}</Text>}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.lineItemQty}>Menge: {item.currentQuantity ?? item.quantity}</Text>
                    {isPartiallyRemoved && (
                      <View style={styles.removedBadge}>
                        <Text style={styles.removedBadgeText}>urspr. {item.quantity}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.lineItemPriceCol}>
                  <Text style={styles.lineItemPrice}>{formatMoney(item.originalUnitPriceSet)}</Text>
                  {item.totalDiscountSet?.shopMoney?.amount !== '0.0' && (
                    <Text style={styles.lineItemDiscount}>-{formatMoney(item.totalDiscountSet)}</Text>
                  )}
                  {isPartiallyRemoved && (
                    <Text style={styles.removedQtyText}>-{removedQty}x</Text>
                  )}
                </View>
              </View>
            </View>
            );
          })}
        </View>

        {/* Financials */}
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Zusammenfassung</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Zwischensumme</Text>
            <Text style={styles.summaryValue}>{formatMoney(order.subtotalPriceSet)}</Text>
          </View>
          {order.totalDiscountsSet?.shopMoney?.amount !== '0.0' && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#2E7D32' }]}>Rabatt</Text>
              <Text style={[styles.summaryValue, { color: '#2E7D32' }]}>-{formatMoney(order.totalDiscountsSet)}</Text>
            </View>
          )}
          {order.totalShippingPriceSet?.shopMoney?.amount !== '0.0' && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Versand{order.shippingLine?.title ? ` (${order.shippingLine.title})` : ''}</Text>
              <Text style={styles.summaryValue}>{formatMoney(order.totalShippingPriceSet)}</Text>
            </View>
          )}
          {order.totalTaxSet?.shopMoney?.amount !== '0.0' && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Steuern</Text>
              <Text style={styles.summaryValue}>{formatMoney(order.totalTaxSet)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>Gesamt</Text>
            <Text style={styles.summaryTotalValue}>{formatMoney(order.totalPriceSet)}</Text>
          </View>
          {order.totalRefundedSet?.shopMoney?.amount !== '0.0' && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#1565C0' }]}>Erstattet</Text>
              <Text style={[styles.summaryValue, { color: '#1565C0' }]}>-{formatMoney(order.totalRefundedSet)}</Text>
            </View>
          )}
        </View>

        {/* Discount Codes */}
        {order.discountCodes?.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Rabattcodes</Text>
            {order.discountCodes.map((dc: any, idx: number) => (
              <Text key={idx} style={styles.discountCode}>{dc.code || dc}{dc.amount && dc.amount !== '0.0' ? ` (${dc.amount})` : ''}</Text>
            ))}
          </View>
        )}

        {/* Refunds / Returns */}
        {order.refunds?.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Rückgaben ({order.refunds.length})</Text>
            {order.refunds.map((refund: any, idx: number) => (
              <View key={refund.id || idx} style={styles.refundBlock}>
                <View style={styles.refundHeader}>
                  <Text style={styles.refundDate}>{formatDate(refund.createdAt)}</Text>
                  <Text style={styles.refundTotal}>-{formatMoney(refund.totalRefundedSet)}</Text>
                </View>
                {refund.refundLineItems?.nodes?.map((rli: any, rliIdx: number) => (
                  <View key={rliIdx} style={styles.refundItem}>
                    <Text style={styles.refundItemTitle} numberOfLines={1}>
                      {rli.lineItem?.title}{rli.lineItem?.variantTitle ? ` — ${rli.lineItem.variantTitle}` : ''}
                    </Text>
                    <Text style={styles.refundItemQty}>x{rli.quantity}</Text>
                    <Text style={styles.refundItemAmount}>{formatMoney(rli.subtotalSet)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Addresses */}
        <View style={styles.detailSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.detailSectionTitle}>Adressen</Text>
            {!editingAddress && (
              <TouchableOpacity onPress={() => {
                setAddressDraft(shippingAddr ? { ...shippingAddr } : {
                  firstName: '', lastName: '', address1: '', address2: '', city: '', zip: '', countryCode: 'DE', phone: ''
                });
                setEditingAddress(true);
              }}>
                <Text style={styles.editBtn}>Bearbeiten</Text>
              </TouchableOpacity>
            )}
          </View>
          {editingAddress ? (
            <View style={styles.editForm}>
              <Text style={styles.editFormLabel}>Lieferadresse</Text>
              <TextInput style={styles.input} placeholder="Vorname" value={addressDraft.firstName || ''} onChangeText={(t) => setAddressDraft((p: any) => ({ ...p, firstName: t }))} />
              <TextInput style={styles.input} placeholder="Nachname" value={addressDraft.lastName || ''} onChangeText={(t) => setAddressDraft((p: any) => ({ ...p, lastName: t }))} />
              <TextInput style={styles.input} placeholder="Adresse 1" value={addressDraft.address1 || ''} onChangeText={(t) => setAddressDraft((p: any) => ({ ...p, address1: t }))} />
              <TextInput style={styles.input} placeholder="Adresse 2 (optional)" value={addressDraft.address2 || ''} onChangeText={(t) => setAddressDraft((p: any) => ({ ...p, address2: t }))} />
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="PLZ" value={addressDraft.zip || ''} onChangeText={(t) => setAddressDraft((p: any) => ({ ...p, zip: t }))} />
                <TextInput style={[styles.input, { flex: 2 }]} placeholder="Stadt" value={addressDraft.city || ''} onChangeText={(t) => setAddressDraft((p: any) => ({ ...p, city: t }))} />
              </View>
              <TextInput style={styles.input} placeholder="Land (DE)" value={addressDraft.countryCode || 'DE'} onChangeText={(t) => setAddressDraft((p: any) => ({ ...p, countryCode: t }))} />
              <TextInput style={styles.input} placeholder="Telefon" value={addressDraft.phone || ''} onChangeText={(t) => setAddressDraft((p: any) => ({ ...p, phone: t }))} />
              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => {
                  handleUpdateOrder({ shippingAddress: addressDraft });
                }} disabled={updating}>
                  <Text style={styles.actionBtnText}>{updating ? 'Lädt...' : 'Speichern'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => setEditingAddress(false)}>
                  <Text style={styles.actionBtnText}>Abbrechen</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {shippingAddr && (
                <View style={styles.addressBlock}>
                  <Text style={styles.addressLabel}>Lieferadresse</Text>
                  <Text style={styles.addressName}>{shippingAddr.firstName} {shippingAddr.lastName}</Text>
                  {shippingAddr.company && <Text style={styles.addressLine}>{shippingAddr.company}</Text>}
                  <Text style={styles.addressLine}>{shippingAddr.address1}</Text>
                  {shippingAddr.address2 && <Text style={styles.addressLine}>{shippingAddr.address2}</Text>}
                  <Text style={styles.addressLine}>{shippingAddr.zip} {shippingAddr.city}</Text>
                  {shippingAddr.province && <Text style={styles.addressLine}>{shippingAddr.province}</Text>}
                  <Text style={styles.addressLine}>{shippingAddr.country}</Text>
                  {shippingAddr.phone && <Text style={styles.addressLine}>{shippingAddr.phone}</Text>}
                </View>
              )}
              {billingAddr && (
                <View style={styles.addressBlock}>
                  <Text style={styles.addressLabel}>Rechnungsadresse (Shopify)</Text>
                  <Text style={styles.addressName}>{billingAddr.firstName} {billingAddr.lastName}</Text>
                  {billingAddr.company && <Text style={styles.addressLine}>{billingAddr.company}</Text>}
                  <Text style={styles.addressLine}>{billingAddr.address1}</Text>
                  {billingAddr.address2 && <Text style={styles.addressLine}>{billingAddr.address2}</Text>}
                  <Text style={styles.addressLine}>{billingAddr.zip} {billingAddr.city}</Text>
                  {billingAddr.province && <Text style={styles.addressLine}>{billingAddr.province}</Text>}
                  <Text style={styles.addressLine}>{billingAddr.country}</Text>
                </View>
              )}
              {!shippingAddr && !billingAddr && (
                <Text style={styles.emptyText}>Keine Adressen vorhanden</Text>
              )}
            </>
          )}
        </View>

        {/* Note */}
        <View style={styles.detailSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.detailSectionTitle}>Hinweis</Text>
            {!editingNote && (
              <TouchableOpacity onPress={() => { setNoteDraft(order.note || ''); setEditingNote(true); }}>
                <Text style={styles.editBtn}>{order.note ? 'Bearbeiten' : 'Hinzufügen'}</Text>
              </TouchableOpacity>
            )}
          </View>
          {editingNote ? (
            <View>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                multiline
                placeholder="Bestellhinweis eingeben..."
                value={noteDraft}
                onChangeText={setNoteDraft}
              />
              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => handleUpdateOrder({ note: noteDraft })} disabled={updating}>
                  <Text style={styles.actionBtnText}>{updating ? 'Lädt...' : 'Speichern'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => setEditingNote(false)}>
                  <Text style={styles.actionBtnText}>Abbrechen</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            order.note ? <Text style={styles.orderNote}>{order.note}</Text> : <Text style={styles.emptyText}>Kein Hinweis vorhanden</Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.detailActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              const domain = data?.shopDomain;
              if (domain) Linking.openURL(`https://${domain}/admin/orders/${order.id.split('/').pop()}`);
            }}
          >
            <Text style={styles.actionBtnText}>In Shopify öffnen</Text>
          </TouchableOpacity>

          {order.displayFulfillmentStatus !== 'FULFILLED' && order.displayFulfillmentStatus !== 'CANCELLED' && (
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
    );
  }

  // ----- ORDER LIST VIEW -----
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopify</Text>
        <TouchableOpacity onPress={() => {
          const cid = customer.id.split('/').pop();
          const domain = data?.shopDomain;
          if (domain) Linking.openURL(`https://${domain}/admin/customers/${cid}`);
        }}>
          <Text style={styles.linkText}>Kunde ansehen</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{customer.firstName} {customer.lastName}</Text>
        <Text style={styles.customerStats}>
          {customer.numberOfOrders} Bestellungen • {customer.amountSpent?.amount} {customer.amountSpent?.currencyCode}
        </Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>
        {matchedOrder ? 'Erkannte Bestellung' : 'Letzte Bestellungen'}
      </Text>

      {displayOrders.map((order: any) => (
        <TouchableOpacity
          key={order.id}
          style={styles.orderItem}
          onPress={() => fetchOrderDetail(order.id)}
          activeOpacity={0.6}
        >
          <View style={styles.orderHeader}>
            <Text style={styles.orderName}>{order.name}</Text>
            <Text style={styles.orderTotal}>{formatMoney(order.totalPriceSet)}</Text>
          </View>
          
          <View style={styles.orderBadges}>
            <View style={[styles.badge, { backgroundColor: getStatusColor(order.displayFinancialStatus) + '18', borderColor: getStatusColor(order.displayFinancialStatus) + '40' }]}>
              <Text style={[styles.badgeText, { color: getStatusColor(order.displayFinancialStatus) }]}>
                {statusLabel(order.displayFinancialStatus)}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: getFulfillmentColor(order.displayFulfillmentStatus) + '18', borderColor: getFulfillmentColor(order.displayFulfillmentStatus) + '40' }]}>
              <Text style={[styles.badgeText, { color: getFulfillmentColor(order.displayFulfillmentStatus) }]}>
                {statusLabel(order.displayFulfillmentStatus)}
              </Text>
            </View>
          </View>

          <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
          <Text style={styles.tapHint}>Tippen für Details →</Text>
        </TouchableOpacity>
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
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily,
    fontWeight: FontWeight.bold,
    color: '#96BF48',
  },
  linkText: {
    fontSize: 10,
    color: Colors.primary,
    fontFamily: FontFamily,
  },
  customerInfo: {
    marginBottom: Spacing.xs,
  },
  customerName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  customerStats: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: FontFamily,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  orderItem: {
    backgroundColor: Colors.background,
    padding: Spacing.xs + 2,
    borderRadius: 4,
    marginBottom: Spacing.xs,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  orderName: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  orderTotal: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily,
    color: Colors.text,
  },
  orderBadges: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: FontFamily,
  },
  tapHint: {
    fontSize: 10,
    color: Colors.primary,
    fontFamily: FontFamily,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
  },
  orderActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtn: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 3,
  },
  actionBtnText: {
    fontSize: 10,
    fontFamily: FontFamily,
    color: Colors.text,
  },
  actionBtnDanger: {
    borderColor: '#FFCDD2',
    backgroundColor: '#FFEBEE',
  },
  actionBtnTextDanger: {
    color: '#C62828',
    fontSize: 10,
    fontFamily: FontFamily,
  },
  emptyText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  // --- Detail View ---
  backBtn: {
    marginBottom: Spacing.xs,
  },
  backBtnText: {
    fontSize: 10,
    color: Colors.primary,
    fontFamily: FontFamily,
  },
  detailHeader: {
    marginBottom: Spacing.xs,
  },
  detailOrderName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  detailDate: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: FontFamily,
    marginTop: 1,
  },
  detailBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginBottom: Spacing.xs,
  },
  detailSection: {
    marginBottom: Spacing.xs,
  },
  detailSectionTitle: {
    fontSize: 10,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  lineItem: {
    backgroundColor: Colors.background,
    padding: Spacing.xs,
    borderRadius: 4,
    marginBottom: 2,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lineItemImage: {
    width: 32,
    height: 32,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  lineItemImagePlaceholder: {
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineItemImagePlaceholderText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  lineItemInfo: {
    flex: 1,
  },
  lineItemTitle: {
    fontSize: 10,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  lineItemSku: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontFamily: FontFamily,
  },
  lineItemQty: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontFamily: FontFamily,
  },
  lineItemPriceCol: {
    alignItems: 'flex-end',
  },
  lineItemPrice: {
    fontSize: 10,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  lineItemDiscount: {
    fontSize: 9,
    fontFamily: FontFamily,
    color: '#2E7D32',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: FontFamily,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 10,
    fontFamily: FontFamily,
    color: Colors.text,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 3,
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  summaryTotalLabel: {
    fontSize: 10,
    fontFamily: FontFamily,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  summaryTotalValue: {
    fontSize: 10,
    fontFamily: FontFamily,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  discountCode: {
    fontSize: 10,
    fontFamily: FontFamily,
    color: Colors.text,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 2,
    fontWeight: FontWeight.semibold,
  },
  addressBlock: {
    backgroundColor: Colors.background,
    padding: Spacing.xs,
    borderRadius: 4,
    marginBottom: Spacing.xs,
  },
  addressLabel: {
    fontSize: 9,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  addressName: {
    fontSize: 10,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  addressLine: {
    fontSize: 10,
    fontFamily: FontFamily,
    color: Colors.text,
  },
  orderNote: {
    fontSize: 10,
    fontFamily: FontFamily,
    color: Colors.text,
    backgroundColor: Colors.background,
    padding: Spacing.xs,
    borderRadius: 4,
    fontStyle: 'italic',
  },
  detailActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editBtn: {
    fontSize: 10,
    color: Colors.primary,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
  },
  editForm: {
    backgroundColor: Colors.background,
    padding: Spacing.xs,
    borderRadius: 4,
  },
  editFormLabel: {
    fontSize: 9,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 3,
    padding: Spacing.xs,
    fontSize: 10,
    fontFamily: FontFamily,
    color: Colors.text,
    backgroundColor: Colors.surface,
    marginBottom: 2,
  },
  lineItemRemoved: {
    opacity: 0.65,
    borderLeftWidth: 2,
    borderLeftColor: '#C62828',
    paddingLeft: Spacing.xs,
  },
  lineItemTitleRemoved: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
  },
  removedBadge: {
    backgroundColor: '#FFEBEE',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  removedBadgeText: {
    fontSize: 8,
    color: '#C62828',
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
  },
  removedQtyText: {
    fontSize: 9,
    fontFamily: FontFamily,
    color: '#C62828',
    fontWeight: FontWeight.semibold,
  },
  refundBlock: {
    backgroundColor: '#EBF5FB',
    borderRadius: 4,
    padding: Spacing.xs,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: '#B3D4FC',
  },
  refundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  refundDate: {
    fontSize: 10,
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: '#1565C0',
  },
  refundTotal: {
    fontSize: 10,
    fontFamily: FontFamily,
    fontWeight: FontWeight.bold,
    color: '#1565C0',
  },
  refundItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 1,
  },
  refundItemTitle: {
    flex: 1,
    fontSize: 9,
    fontFamily: FontFamily,
    color: Colors.text,
  },
  refundItemQty: {
    fontSize: 9,
    fontFamily: FontFamily,
    color: '#1565C0',
    fontWeight: FontWeight.semibold,
  },
  refundItemAmount: {
    fontSize: 9,
    fontFamily: FontFamily,
    color: '#1565C0',
  },
});
