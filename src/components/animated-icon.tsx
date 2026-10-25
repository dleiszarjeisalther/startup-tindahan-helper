import React, { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const fadeAnim = useState(() => new Animated.Value(1))[0];
  const scaleAnim = useState(() => new Animated.Value(0.92))[0];

  useEffect(() => {
    let isCancelled = false;

    async function prepareAndDisplaySplash() {
      try {
        await Asset.fromModule(require('@/assets/images/splash-icon.png')).downloadAsync();
      } catch (err) {
        console.log('[SplashOverlay] Asset preload notice:', err);
      }

      // Hide the native OS splash screen once the in-app logo is guaranteed loaded
      await SplashScreen.hideAsync().catch(() => {});

      if (isCancelled) return;

      // Display the Emerald Green Logo screen prominently for ~1.8 seconds before fading
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!isCancelled) {
          setVisible(false);
        }
      });
    }

    void prepareAndDisplaySplash();

    return () => {
      isCancelled = true;
    };
  }, [fadeAnim, scaleAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.splashOverlay,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.contentBox,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <View style={styles.brandTitleRow}>
          <Text style={styles.brandTitleWhite}>Tindahan</Text>
          <Text style={styles.brandTitleAccent}>Helper</Text>
        </View>
        <Text style={styles.brandTagline}>Sari-sari Store POS & Inventory</Text>
      </Animated.View>
    </Animated.View>
  );
}

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Image
        style={styles.logoImage}
        source={require('@/assets/images/icon.png')}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0D7A52',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
    elevation: 999999,
  },
  contentBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 112,
    height: 112,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  brandTitleWhite: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandTitleAccent: {
    color: '#FBBF24',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandTagline: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    letterSpacing: 0.3,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 104,
    height: 104,
  },
});
