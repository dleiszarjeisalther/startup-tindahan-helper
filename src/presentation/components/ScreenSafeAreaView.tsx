import React from 'react';
import {
  SafeAreaView,
  SafeAreaViewProps,
} from 'react-native-safe-area-context';

/**
 * Page-level safe area wrapper.
 *
 * Normal pages need the top safe-area edge on both platforms because Expo's
 * Android edge-to-edge layout can otherwise place controls under the status
 * bar. Full-bleed pages can explicitly pass `edges={[]}` and inset only their
 * overlaid controls.
 */
export function ScreenSafeAreaView({ edges, ...props }: SafeAreaViewProps) {
  return (
    <SafeAreaView
      {...props}
      edges={edges ?? ['top']}
    />
  );
}
