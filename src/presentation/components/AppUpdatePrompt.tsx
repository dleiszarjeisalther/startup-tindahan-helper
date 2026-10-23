import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appUpdateService } from '../../infrastructure/container';
import { useTindahanStore } from '../hooks/useTindahanStore';

export function AppUpdatePrompt() {
  const state = useSyncExternalStore(appUpdateService.subscribe, appUpdateService.getSnapshot, appUpdateService.getSnapshot);
  const { cartSummary } = useTindahanStore();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const safe = cartSummary.items.length === 0 && (pathname === '/more' || pathname === '/settings');
  useEffect(() => {
    void appUpdateService.check();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') void appUpdateService.check();
    });
    return () => subscription.remove();
  }, []);
  const visible = safe && Boolean(state.release) && !state.dismissed && state.phase !== 'checking';
  const ready = ['ready', 'permission', 'installer'].includes(state.phase);
  const downloading = state.phase === 'downloading';
  const installing = state.phase === 'installing';
  return <>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={appUpdateService.dismiss}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>{state.release?.mandatory ? 'Mahalagang update' : 'May bagong update'}</Text>
            <Text>Installed: {state.installed?.version} ({state.installed?.code})</Text>
            <Text>New: {state.release?.version_name} ({state.release?.version_code})</Text>
            {state.release?.mandatory ? <Text style={styles.notice}>{state.release.mandatory_reason}</Text> : null}
            <Text style={styles.notes}>{state.release?.release_notes}</Text>
            <Text>{state.message}</Text>
            {downloading ? <Text accessibilityLiveRegion="polite" style={styles.notes}>{Math.floor(state.progress * 100)}% downloaded · verification follows</Text> : null}
            <Text style={styles.small}>Android may ask you to allow installations from this app. You must confirm installation. Finish or park any sale first; the update keeps your store data.</Text>
            <Pressable accessibilityRole="button" disabled={downloading || installing} style={[styles.button, (downloading || installing) && styles.disabled]}
              onPress={() => { if (safe) void (ready ? appUpdateService.install() : appUpdateService.download()); }}>
              <Text style={styles.buttonText}>{installing ? 'Verifying…' : downloading ? 'Downloading…' : ready ? 'Install update' : state.phase === 'error' ? 'Retry download' : 'Update now'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={installing} style={styles.secondary} onPress={appUpdateService.dismiss}>
              <Text>{downloading ? 'Continue working' : state.release?.mandatory ? 'Finish work first' : 'Later'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

export function AppUpdateMenuItem() {
  const state = useSyncExternalStore(appUpdateService.subscribe, appUpdateService.getSnapshot, appUpdateService.getSnapshot);
  const { cartSummary } = useTindahanStore();
  return <View style={styles.menuItem}>
    <Pressable accessibilityRole="button" disabled={state.phase === 'checking'} style={styles.button} onPress={() => {
      if (state.release) appUpdateService.show(); else void appUpdateService.check(true);
    }}><Text style={styles.buttonText}>{state.phase === 'checking' ? 'Checking…' : state.release ? 'May app update — tingnan' : 'Check app updates'}</Text></Pressable>
    {state.message ? <Text style={styles.small}>{state.message}</Text> : null}
    {state.release && cartSummary.items.length > 0 ? <Text style={styles.small}>Finish or park your sale to view this update.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  menuItem: { paddingVertical: 12, gap: 8 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.55)' },
  card: { maxHeight: '90%', backgroundColor: '#FFFFFF', borderRadius: 24 },
  content: { padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#064E3B' },
  notes: { fontSize: 16, lineHeight: 24 },
  notice: { color: '#92400E', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12 },
  button: { minHeight: 48, padding: 14, borderRadius: 12, backgroundColor: '#047857', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  small: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  disabled: { opacity: 0.6 },
});
