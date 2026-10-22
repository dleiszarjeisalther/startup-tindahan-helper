// src/presentation/components/PrivacyPolicyModal.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
  if (!visible) return null;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.shieldBadge}>
              <Ionicons name="shield-checkmark" size={22} color="#059669" />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.headerTitle}>Patakaran sa Privacy</Text>
              <Text style={styles.headerSubtitle}>
                Data Privacy Act of 2012 (Republic Act No. 10173)
              </Text>
            </View>
          </View>
          <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={10}>
            <Ionicons name="close" size={24} color="#4B5563" />
          </Pressable>
        </View>

        {/* Scrollable Privacy Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Badge Notice */}
          <View style={styles.highlightCard}>
            <Ionicons name="lock-closed" size={20} color="#047857" style={{ marginTop: 2 }} />
            <Text style={styles.highlightText}>
              Mahalaga sa amin ang iyong tiwala. Ang Tindahan Helper ay dinisenyo bilang isang{' '}
              <Text style={styles.bold}>100% Offline-First Store Companion</Text> kung saan ang
              lahat ng iyong paninda, benta, at utang ay nananatili sa loob ng iyong cellphone.
            </Text>
          </View>

          {/* Section 1 */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="person-circle-outline" size={18} color="#059669" />
              </View>
              <Text style={styles.sectionTitle}>
                1. Anong Impormasyon ang Kinokolekta sa Onboarding?
              </Text>
            </View>
            <Text style={styles.paragraph}>
              Kapag inirerehistro mo ang iyong tindahan para sa libreng 7-araw na trial, kinukuha
              namin ang mga sumusunod na pangunahing detalye:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Pangalan ng May-ari / Tindera:</Text> Upang makilala ang
                lehitimong may-ari ng account, magamit sa customer support, at maitala ang lisensya
                ng tindahan.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Pangalan ng Tindahan:</Text> Ginagamit para sa pag-setup
                ng iyong tindahan, pagpapakita sa New Sale screen, at pag-print sa itaas ng resibo.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Cellphone / GCash Number:</Text> Kinakailangan para sa
                isang beses na trial activation, device verification, mabilisang customer helpline,
                at default na tatanggap ng GCash payments mula sa iyong mga mamimili.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Lokasyon (Barangay / Bayan):</Text> Opsyonal na address
                na inilalagay sa header ng iyong customer receipt.
              </Text>
            </View>
          </View>

          {/* Section 2 */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="server-outline" size={18} color="#059669" />
              </View>
              <Text style={styles.sectionTitle}>
                2. 100% Offline: Ligtas ang Benta at Paninda sa Telepono Mo
              </Text>
            </View>
            <Text style={styles.paragraph}>
              Iba ang Tindahan Helper sa ibang apps na nagpapadala ng bawat benta mo sa internet.
              Ang lahat ng iyong paninda, benta, at listahan ng utang ay nananatiling{' '}
              <Text style={styles.bold}>100% offline at ligtas na nakatago sa mismong telepono mo</Text>.
            </Text>
            <Text style={styles.paragraph}>
              Hindi namin sinusubaybayan, kinokolekta, o ibinebenta ang iyong puhunan, arawang
              tubo, o presyo ng paninda sa mga third-party data brokers o advertisers. Ang data ng
              iyong tindahan ay eksklusibong pag-aari mo.
            </Text>
          </View>

          {/* Section 3 */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="key-outline" size={18} color="#059669" />
              </View>
              <Text style={styles.sectionTitle}>3. Mga Pahintulot ng App (App Permissions)</Text>
            </View>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Kamera (Camera):</Text> Ginagamit lamang para sa
                mabilisang pag-scan ng barcodes gamit ang scanner at pagkuha ng litrato ng paninda.
                Walang video recording na itinatago o ipinapadala sa labas.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Photos / Storage:</Text> Ginagamit kung nais mong
                mag-upload ng sariling produkto o i-save / i-download ang iyong GCash QR Code sa
                gallery ng iyong telepono.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Bluetooth:</Text> Ginagamit upang kumonekta sa wireless
                ESC/POS 58mm/80mm thermal receipt printer.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Internet:</Text> Kinakailangan lamang sa unang araw ng
                trial registration, pagbubukas ng online feedback form, o pag-verify ng lisensya.
              </Text>
            </View>
          </View>

          {/* Section 4 */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="people-outline" size={18} color="#059669" />
              </View>
              <Text style={styles.sectionTitle}>
                4. Proteksyon sa Utang at Impormasyon ng Suki
              </Text>
            </View>
            <Text style={styles.paragraph}>
              Ang listahan ng pautang at mga pangalan ng iyong mga suki ay mahigpit na
              kompidensyal. Maaari kang mag-save ng backup copy ng iyong tindahan o maglagay ng Owner PIN
              upang walang ibang makakita sa listahan ng iyong benta at pautang.
            </Text>
          </View>

          {/* Section 5: BIR Compliance */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="receipt-outline" size={18} color="#059669" />
              </View>
              <Text style={styles.sectionTitle}>
                5. Gabay sa BIR at Resibo (EOPT Act RA 11976)
              </Text>
            </View>
            <Text style={styles.paragraph}>
              Alinsunod sa mga panuntunan ng Bureau of Internal Revenue (BIR):
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • Ang mga resibong inilalabas ng app sa Bluetooth thermal printer ay nagsisilbing{' '}
                <Text style={styles.bold}>Customer Sales Slip / Patunay ng Bili</Text> at
                awtomatikong may nakatatak na disclaimer:
                {'\n'}
                <Text style={styles.codeText}>
                  &quot;THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX&quot;
                </Text>
              </Text>
              <Text style={styles.bulletItem}>
                • Para sa mga transaksyong ₱500 pataas o kapag hiniling ng mamimili para sa opisyal
                na tax claim, mag-isyu ng inyong rehistradong manual BIR Sales Invoice booklet.
              </Text>
              <Text style={styles.bulletItem}>
                • Ang Daily Sales Summary (Z-Reading) ng app ay legal mong magagamit bilang batayan
                sa pagtatala sa inyong BIR Books of Accounts (Sales Journal).
              </Text>
            </View>
          </View>

          {/* Section 6 */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="call-outline" size={18} color="#059669" />
              </View>
              <Text style={styles.sectionTitle}>6. Pakikipag-ugnayan at Opisyal na Suporta</Text>
            </View>
            <Text style={styles.paragraph}>
              Para sa anumang katanungan ukol sa iyong privacy at data rights sa ilalim ng RA 10173,
              maaari kang makipag-ugnayan sa aming opisyal na helpline:
            </Text>
            <View style={styles.contactCard}>
              <Text style={styles.contactPhone}>Official Helpline: 0991 658 9854</Text>
              <Text style={styles.contactEmail}>
                Online Feedback: https://tindahanhelper.wuaze.com/feedback.php
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer Dismiss Button */}
        <View style={styles.footer}>
          <Pressable style={styles.primaryBtn} onPress={handleClose}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.primaryBtnText}>Naiintindihan Ko</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  shieldBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  highlightCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  highlightText: {
    flex: 1,
    fontSize: 13,
    color: '#065F46',
    lineHeight: 19,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
  },
  paragraph: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
    marginBottom: 8,
  },
  bulletList: {
    gap: 6,
    marginTop: 4,
  },
  bulletItem: {
    fontSize: 12.5,
    color: '#374151',
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
    color: '#111827',
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: '#DC2626',
    fontSize: 11.5,
  },
  contactCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
  },
  contactPhone: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D7A52',
    marginBottom: 4,
  },
  contactEmail: {
    fontSize: 11.5,
    color: '#4B5563',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  primaryBtn: {
    backgroundColor: '#0D7A52',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
