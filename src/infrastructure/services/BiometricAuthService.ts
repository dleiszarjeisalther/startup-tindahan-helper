// src/infrastructure/services/BiometricAuthService.ts
import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricCapability {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  typeNames: string[];
}

export class BiometricAuthService {
  public static async checkCapabilities(): Promise<BiometricCapability> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const typeNames: string[] = [];
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        typeNames.push('Fingerprint');
      }
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        typeNames.push('Face ID');
      }
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        typeNames.push('Iris');
      }
      return { hasHardware, isEnrolled, supportedTypes, typeNames };
    } catch {
      return { hasHardware: false, isEnrolled: false, supportedTypes: [], typeNames: [] };
    }
  }

  public static async authenticate(
    promptMessage: string = 'I-scan ang fingerprint o Face ID upang buksan ang tindahan'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        return { success: false, error: 'Walang nakarehistrong biometrics sa device' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Gamitin ang PIN',
        fallbackLabel: 'Gamitin ang PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Biometric authentication failed' };
    }
  }
}
