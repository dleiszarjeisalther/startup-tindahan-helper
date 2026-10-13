// src/app/more.tsx — Screen 6: Menu / Profile ("Juan's Store — Owner")
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';

export default function MenuProfileScreen() {
  const router = useRouter();
  const {
    settings,
    utangCustomers,
    addUtangCustomer,
    deleteUtangCustomer,
    recordUtangPayment,
  } = useTindahanStore();

  const [activeSection, setActiveSection] = useState<
    'NONE' | 'UTANG_ONLINE' | 'SUBSCRIPTION' | 'HELP'
  >('UTANG_ONLINE');

  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('500');
  const [newInitialBalance, setNewInitialBalance] = useState('0');
  const [payAmountMap, setPayAmountMap] = useState<Record<string, string>>({});

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Emerald Green Owner Profile Banner */}
      <Pressable
        style={styles.greenBanner}
        onPress={() => router.push('/settings')}
      >
        <View style={styles.storeAvatar}>
          <View style={styles.awningTop}>
            <Text style={styles.awningText}>TINDAHAN</Text>
          </View>
          <Text style={styles.storeEmoji}>🏪</Text>
        </View>

        <View style={styles.ownerTextCol}>
          <Text style={styles.storeNameText}>{settings.storeName}</Text>
          <Text style={styles.ownerRoleText}>{settings.ownerTitle}</Text>
        </View>

        <Text style={styles.bannerChevron}>›</Text>
      </Pressable>

      {/* White Rounded Sheet with Menu Items */}
      <View style={styles.menuSheet}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Store Settings -> Screen 7 */}
          <Pressable
            style={styles.menuRow}
            onPress={() => router.push('/settings')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>⚙️</Text>
              <Text style={styles.menuLabel}>Store Settings</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>

          {/* 2. Products -> Screen 2 */}
          <Pressable
            style={styles.menuRow}
            onPress={() => router.push('/products')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🏪</Text>
              <Text style={styles.menuLabel}>Products</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>

          {/* 3. Sales Reports -> Feature C: Seasonal Product Forecast */}
          <Pressable
            style={styles.menuRow}
            onPress={() => router.push('/explore')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>📊</Text>
              <Text style={styles.menuLabel}>Sales Reports</Text>
            </View>
            <View style={styles.menuRightGroup}>
              <View style={styles.forecastTag}>
                <Text style={styles.forecastTagText}>Seasonal Forecast</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </View>
          </Pressable>

          {/* 4. Inventory -> Screen 4 */}
          <Pressable
            style={styles.menuRow}
            onPress={() => router.push('/inventory')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>📦</Text>
              <Text style={styles.menuLabel}>Inventory</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>

          {/* 5. Online Store & Owner Utang Credit Ledger (SQLite CRUD) */}
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              setActiveSection((prev) =>
                prev === 'UTANG_ONLINE' ? 'NONE' : 'UTANG_ONLINE'
              )
            }
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🌐</Text>
              <Text style={styles.menuLabel}>Online Store &amp; Utang Ledger</Text>
            </View>
            <View style={styles.menuRightGroup}>
              <Text style={styles.subHintText}>
                {utangCustomers.length} in DB
              </Text>
              <Text style={styles.menuChevron}>›</Text>
            </View>
          </Pressable>

          {activeSection === 'UTANG_ONLINE' ? (
            <View style={styles.inlinePanel}>
              <Text style={styles.inlinePanelTitle}>
                📒 Suki Utang (Credit) Ledger — Add Customer to Database
              </Text>

              <View style={styles.addCustForm}>
                <TextInput
                  style={styles.custInput}
                  value={newCustomerName}
                  onChangeText={setNewCustomerName}
                  placeholder="Customer Name *"
                  placeholderTextColor="#9CA3AF"
                />
                <View style={styles.custTwoCol}>
                  <TextInput
                    style={[styles.custInput, styles.halfInput]}
                    value={newInitialBalance}
                    onChangeText={setNewInitialBalance}
                    placeholder="Initial Utang ₱"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[styles.custInput, styles.halfInput]}
                    value={newCreditLimit}
                    onChangeText={setNewCreditLimit}
                    placeholder="Credit Limit ₱"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
                <Pressable
                  style={styles.addCustBtn}
                  onPress={() => {
                    if (!newCustomerName.trim()) return;
                    const limit = parseFloat(newCreditLimit) || 500;
                    const bal = parseFloat(newInitialBalance) || 0;
                    addUtangCustomer(newCustomerName.trim(), limit, bal);
                    setNewCustomerName('');
                    setNewInitialBalance('0');
                  }}
                >
                  <Text style={styles.addCustBtnText}>
                    + Save Customer to SQLite Database
                  </Text>
                </Pressable>
              </View>

              {utangCustomers.length === 0 ? (
                <Text style={styles.emptyUtangText}>
                  No Utang customers in database yet. Add one above or record an Utang sale in &quot;New Sale&quot;.
                </Text>
              ) : (
                utangCustomers.map((c) => {
                  const payInput = payAmountMap[c.id] ?? '';
                  return (
                    <View key={c.id} style={styles.utangRow}>
                      <View style={styles.utangTopRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.utangName}>{c.name}</Text>
                          <Text style={styles.utangMeta}>
                            Balance: ₱{c.balancePhp.toFixed(2)} / Limit: ₱{c.creditLimitPhp}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.deleteCustBtn}
                          onPress={() => deleteUtangCustomer(c.id)}
                        >
                          <Text style={styles.deleteCustText}>✕</Text>
                        </Pressable>
                      </View>

                      {c.balancePhp > 0 ? (
                        <View style={styles.collectRow}>
                          <TextInput
                            style={styles.collectInput}
                            value={payInput}
                            onChangeText={(txt) =>
                              setPayAmountMap((prev) => ({ ...prev, [c.id]: txt }))
                            }
                            placeholder={`Pay ₱ (max ${c.balancePhp.toFixed(0)})`}
                            placeholderTextColor="#9CA3AF"
                            keyboardType="decimal-pad"
                          />
                          <Pressable
                            style={styles.payUtangBtn}
                            onPress={() => {
                              const amt =
                                parseFloat(payInput) || c.balancePhp;
                              recordUtangPayment(c.id, amt);
                              setPayAmountMap((prev) => ({ ...prev, [c.id]: '' }));
                            }}
                          >
                            <Text style={styles.payUtangBtnText}>
                              {payInput ? 'Collect ₱' : 'Clear Full'}
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Text style={styles.paidBadge}>Settled ✓</Text>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          ) : null}

          {/* 6. Subscription [Free] */}
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              setActiveSection((prev) =>
                prev === 'SUBSCRIPTION' ? 'NONE' : 'SUBSCRIPTION'
              )
            }
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🛡️</Text>
              <Text style={styles.menuLabel}>Subscription</Text>
            </View>
            <View style={styles.menuRightGroup}>
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>Free</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </View>
          </Pressable>

          {activeSection === 'SUBSCRIPTION' ? (
            <View style={styles.inlinePanel}>
              <Text style={styles.inlinePanelTitle}>
                ✓ Owner Single-Operator Plan (Free • SQLite Offline-First)
              </Text>
              <Text style={styles.inlinePanelBody}>
                All catalog items, stock movements, utang customers, and sales receipts are persisted locally in SQLite (tindahan_pos_v2.db).
              </Text>
            </View>
          ) : null}

          {/* 7. Help & Support */}
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              setActiveSection((prev) => (prev === 'HELP' ? 'NONE' : 'HELP'))
            }
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>❓</Text>
              <Text style={styles.menuLabel}>Help &amp; Support</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>

          {activeSection === 'HELP' ? (
            <View style={styles.inlinePanel}>
              <Text style={styles.inlinePanelTitle}>
                Owner POS Mitigations Active:
              </Text>
              <Text style={styles.inlinePanelBody}>
                • Dual Barcode Registration (Camera Scan + Manual Input + Tingi Code){'\n'}
                • Receipt-Linked Returns with Sellable vs. Damaged Quarantine Gate{'\n'}
                • Instant Exchange Credit &amp; Same-Day Owner Void{'\n'}
                • 12m / 24m+ YoY Seasonal Product Forecast (Feature C)
              </Text>
            </View>
          ) : null}

          {/* 8. Log Out */}
          <Pressable
            style={[styles.menuRow, styles.menuRowNoBorder]}
            onPress={() => router.push('/')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>↪️</Text>
              <Text style={styles.menuLabel}>Log Out</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D7A52',
  },
  greenBanner: {
    backgroundColor: '#0D7A52',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  storeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  awningTop: {
    backgroundColor: '#DC2626',
    width: '100%',
    paddingVertical: 2,
    alignItems: 'center',
  },
  awningText: {
    color: '#FFFFFF',
    fontSize: 6,
    fontWeight: '900',
  },
  storeEmoji: {
    fontSize: 26,
    marginTop: 2,
  },
  ownerTextCol: {
    flex: 1,
    gap: 2,
  },
  storeNameText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  ownerRoleText: {
    color: '#D1FAE5',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerChevron: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  menuSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -18,
    paddingTop: 10,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 130,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuRowNoBorder: {
    borderBottomWidth: 0,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  menuRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  forecastTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  forecastTagText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '800',
  },
  subHintText: {
    fontSize: 11,
    color: '#0D7A52',
    fontWeight: '700',
  },
  freeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  freeBadgeText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '800',
  },
  menuChevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  inlinePanel: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  inlinePanelTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D7A52',
  },
  inlinePanelBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  addCustForm: {
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  custInput: {
    height: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#111827',
  },
  custTwoCol: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  addCustBtn: {
    backgroundColor: '#0D7A52',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addCustBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyUtangText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 8,
  },
  utangRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 6,
  },
  utangTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  utangName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  utangMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  deleteCustBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteCustText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '800',
  },
  collectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collectInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#111827',
  },
  payUtangBtn: {
    backgroundColor: '#0D7A52',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  payUtangBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  paidBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
});
