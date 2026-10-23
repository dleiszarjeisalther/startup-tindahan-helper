// src/app/+not-found.tsx
// Expo Go SDK 58 passes `tindahanpos:///index` as the initial deep-link URL.
// expo-router v4 maps index.tsx only to '/', not '/index', causing an
// "Unmatched Route" on every cold launch inside Expo Go.
// This file redirects '/index' → '/' transparently so the app opens correctly.
import { Redirect, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFound() {
  const pathname = usePathname();

  // Silently redirect the Expo Go SDK 58 initial-URL quirk.
  if (pathname === '/index') {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.subtitle}>{pathname}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
});
