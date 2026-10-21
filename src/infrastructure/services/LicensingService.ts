// src/infrastructure/services/LicensingService.ts
import * as Device from 'expo-device';
import { SqliteDatabase } from '../database/SqliteDatabase';
import { appKeyValueStorage } from '../storage/KeyValueStorage';

export interface LicensingState {
  deviceId: string;
  isRegistered: boolean;
  storeName: string;
  ownerName: string;
  phoneNumber: string;
  location: string;
  registeredAtMs: number;
  trialDays: number;
  trialExpiresAtMs: number;
  isLicensed: boolean;
  licensePin: string | null;
  lastObservedTimeMs: number;
  isTrialExpired: boolean;
  isClockTampered: boolean;
  isQuotaExceeded: boolean;
  completedSalesCount: number;
  maxTrialSales: number;
  daysRemaining: number;
  hoursRemaining: number;
  gcashNumber: string;
  gcashName: string;
  proPrice: number;
}

export interface RegisterTrialParams {
  ownerName: string;
  storeName: string;
  phoneNumber: string;
  location?: string;
}

export interface SubmitPaymentParams {
  gcashReference: string;
  amount?: number;
  receiptBase64?: string;
}

export interface VerificationResult {
  success: boolean;
  message: string;
}

const SUPABASE_URL = 'https://eitqtggytkosvdgfeqap.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_71hwmfru1nxpm2OMNU3W_w_EPV2HhOz';
const MASTER_PIN = '985421';
export const MAX_TRIAL_SALES = 200;

/**
 * Obfuscated salt bytes unscrambled at runtime to prevent plaintext string extraction from APK bytecode
 */
function getSecretSalt(): string {
  const bytes = [84, 105, 110, 100, 97, 104, 97, 110, 72, 101, 108, 112, 101, 114, 83, 101, 99, 114, 101, 116, 75, 101, 121, 50, 48, 50, 54, 33];
  return bytes.map((c) => String.fromCharCode(c)).join('');
}

/**
 * Normalizes any Philippine phone number variation to standard 11 digits (e.g. 09171234567)
 */
export function normalizePhoneNumber(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length === 12) {
    digits = '0' + digits.substring(2);
  } else if (digits.length === 10 && digits.startsWith('9')) {
    digits = '0' + digits;
  }
  return digits;
}

/**
 * Validates whether string is a valid Philippine mobile number (11 digits starting with 09)
 */
export function isValidPhilippinePhoneNumber(raw: string): boolean {
  const norm = normalizePhoneNumber(raw);
  return norm.length === 11 && norm.startsWith('09');
}

/**
 * Generates deterministic hardware fingerprint based on physical device characteristics
 */
export function getDeviceHardwareFingerprint(): string {
  const parts = [
    Device.brand || '',
    Device.manufacturer || '',
    Device.modelName || '',
    Device.designName || '',
    Device.productName || '',
    Device.osBuildId || '',
    String(Device.deviceYearClass || ''),
    String(Device.totalMemory || ''),
  ];
  const raw = parts.join('|').toLowerCase().trim();
  if (!raw.replace(/\|/g, '')) {
    return 'generic_fingerprint';
  }
  return sha256Hex(raw);
}

/**
 * Counts total completed sales in local SQLite database
 */
function getCompletedSalesCount(): number {
  const db = SqliteDatabase.getInstance().rawDb;
  if (!db) return 0;
  try {
    const row = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sales_transactions WHERE status = 'COMPLETED'"
    );
    return row ? Number(row.count || 0) : 0;
  } catch {
    return 0;
  }
}

async function supabaseFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers,
  });
}

/**
 * Pure JavaScript SHA-256 Implementation (Zero-dependency, synchronous, cross-platform)
 */
export function sha256Hex(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (let i = 0; i < 8; i++) {
    for (let i2 = 3; i2 >= 0; i2--) {
      const b = (hash[i] >> (i2 * 8)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

type Listener = () => void;

export class LicensingService {
  private static instance: LicensingService | null = null;
  private listeners = new Set<Listener>();
  private state!: LicensingState;

  private constructor() {
    this.hydrateInitialState();
  }

  public static getInstance(): LicensingService {
    if (!LicensingService.instance) {
      LicensingService.instance = new LicensingService();
    }
    return LicensingService.instance;
  }

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): LicensingState => {
    return this.state;
  };

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Licensing subscriber error:', err);
      }
    }
  }

  /**
   * Generates or retrieves deterministic 6-character Device ID (e.g., TH-A1B2)
   */
  public getOrCreateDeviceId(): string {
    let existing = appKeyValueStorage.getString('app_device_id');
    if (existing && existing.trim().length > 0) {
      return existing.trim().toUpperCase();
    }

    // Generate random 4-character uppercase alphanumeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const deviceId = `TH-${code}`;
    appKeyValueStorage.setString('app_device_id', deviceId);
    return deviceId;
  }

  /**
   * Computes expected 6-digit offline activation PIN for any device ID
   */
  public computeExpectedPin(deviceId: string): string {
    const cleanId = deviceId.trim().toUpperCase();
    const hash = sha256Hex(`${cleanId}:${getSecretSalt()}`);
    const num = parseInt(hash.substring(0, 8), 16);
    return (num % 1000000).toString().padStart(6, '0');
  }

  private hydrateInitialState(): void {
    const deviceId = this.getOrCreateDeviceId();
    const db = SqliteDatabase.getInstance().rawDb;
    const now = Date.now();

    let isRegistered = false;
    let storeName = 'Aking Tindahan';
    let ownerName = '';
    let phoneNumber = '';
    let location = 'Pilipinas';
    let registeredAtMs = 0;
    let trialDays = 7;
    let trialExpiresAtMs = 0;
    let isLicensed = false;
    let licensePin: string | null = null;
    let lastObservedTimeMs = now;

    if (db) {
      try {
        const row = db.getFirstSync<{
          device_id: string;
          store_name: string;
          owner_name: string;
          phone_number: string;
          location: string | null;
          registered_at_ms: number;
          trial_days: number;
          trial_expires_at_ms: number;
          is_licensed: number;
          license_pin: string | null;
          last_observed_time_ms: number;
        }>('SELECT * FROM app_licensing WHERE id = 1 LIMIT 1');

        if (row) {
          isRegistered = true;
          storeName = row.store_name || storeName;
          ownerName = row.owner_name || ownerName;
          phoneNumber = row.phone_number || phoneNumber;
          location = row.location || location;
          registeredAtMs = Number(row.registered_at_ms);
          trialDays = Number(row.trial_days || 7);
          trialExpiresAtMs = Number(row.trial_expires_at_ms);
          isLicensed = row.is_licensed === 1;
          licensePin = row.license_pin;
          lastObservedTimeMs = Number(row.last_observed_time_ms || now);
        }
      } catch (err) {
        console.warn('Licensing hydration warning:', err);
      }
    }

    // Monotonic clock tampering check:
    // Leeway of 10 minutes (600,000 ms) for legitimate minor NTP network adjustments.
    const isClockTampered = isRegistered && !isLicensed && now < lastObservedTimeMs - 600000;
    const updatedLastObserved = Math.max(lastObservedTimeMs, now);

    if (db && isRegistered) {
      try {
        db.runSync(
          'UPDATE app_licensing SET last_observed_time_ms = ? WHERE id = 1',
          [updatedLastObserved]
        );
      } catch {
        // Safe ignore
      }
    }

    // Transaction ceiling check: Max 200 sales in trial mode
    const completedSalesCount = getCompletedSalesCount();
    const isQuotaExceeded = isRegistered && !isLicensed && completedSalesCount >= MAX_TRIAL_SALES;

    const isTrialExpired =
      isRegistered && !isLicensed && (now >= trialExpiresAtMs || isClockTampered || isQuotaExceeded);

    const msRemaining = Math.max(0, trialExpiresAtMs - now);
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    const hoursRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60)));

    const gcashNumber = appKeyValueStorage.getString('cfg_gcash_number', '0991 658 9854') || '0991 658 9854';
    const gcashName = appKeyValueStorage.getString('cfg_gcash_name', 'Tindahan Helper Support') || 'Tindahan Helper Support';
    const proPrice = appKeyValueStorage.getNumber('cfg_pro_price', 299.00) || 299.00;

    this.state = Object.freeze({
      deviceId,
      isRegistered,
      storeName,
      ownerName,
      phoneNumber,
      location,
      registeredAtMs,
      trialDays,
      trialExpiresAtMs,
      isLicensed,
      licensePin,
      lastObservedTimeMs: updatedLastObserved,
      isTrialExpired,
      isClockTampered,
      isQuotaExceeded,
      completedSalesCount,
      maxTrialSales: MAX_TRIAL_SALES,
      daysRemaining,
      hoursRemaining,
      gcashNumber,
      gcashName,
      proPrice,
    });
  }

  /**
   * Called on app launch or screen interaction to advance monotonic clock and check expiry.
   */
  public updateClockCheck(): void {
    if (!this.state.isRegistered || this.state.isLicensed) return;

    const now = Date.now();
    const isClockTampered = now < this.state.lastObservedTimeMs - 600000;
    const updatedLastObserved = Math.max(this.state.lastObservedTimeMs, now);
    const completedSalesCount = getCompletedSalesCount();
    const isQuotaExceeded = !this.state.isLicensed && completedSalesCount >= MAX_TRIAL_SALES;
    const isTrialExpired = now >= this.state.trialExpiresAtMs || isClockTampered || isQuotaExceeded;

    const msRemaining = Math.max(0, this.state.trialExpiresAtMs - now);
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    const hoursRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60)));

    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      try {
        db.runSync(
          'UPDATE app_licensing SET last_observed_time_ms = ? WHERE id = 1',
          [updatedLastObserved]
        );
      } catch {
        // Safe ignore
      }
    }

    this.state = Object.freeze({
      ...this.state,
      lastObservedTimeMs: updatedLastObserved,
      isTrialExpired,
      isClockTampered,
      isQuotaExceeded,
      completedSalesCount,
      daysRemaining,
      hoursRemaining,
    });

    this.notify();
  }

  /**
   * First-launch online onboarding: sends store info directly to Supabase and registers trial duration.
   * Performs deduplication across device ID, normalized phone number, and hardware fingerprint.
   */
  public async registerTrial(params: RegisterTrialParams): Promise<VerificationResult> {
    const rawDevId = this.getOrCreateDeviceId();
    const cleanDevId = rawDevId.trim().toUpperCase();

    // Strict Philippine Phone Validation
    const normalizedPhone = normalizePhoneNumber(params.phoneNumber);
    if (!isValidPhilippinePhoneNumber(params.phoneNumber)) {
      return {
        success: false,
        message: 'Pakisuyong maglagay ng wastong 11-digit mobile number na nagsisimula sa 09 (hal. 09171234567).',
      };
    }

    const deviceFingerprint = getDeviceHardwareFingerprint();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      // 1. Fetch live app config from Supabase
      let freeDays = 7;
      let gcashNum = '0991 658 9854';
      let gcashNm = 'Tindahan Helper Support';
      let proPrc = 299.00;

      try {
        const cfgRes = await supabaseFetch('app_config?id=eq.global&select=*', {
          signal: controller.signal,
        });
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          if (Array.isArray(cfgData) && cfgData.length > 0) {
            freeDays = Math.max(1, Number(cfgData[0].free_trial_days || 7));
            gcashNum = cfgData[0].gcash_number || gcashNum;
            gcashNm = cfgData[0].gcash_name || gcashNm;
            proPrc = Number(cfgData[0].pro_price || proPrc);
          }
        }
      } catch {
        // Fallback to defaults
      }

      appKeyValueStorage.setString('cfg_gcash_number', gcashNum);
      appKeyValueStorage.setString('cfg_gcash_name', gcashNm);
      appKeyValueStorage.setNumber('cfg_pro_price', proPrc);

      // 2. Check if device, normalized phone, or hardware fingerprint already registered in Supabase
      const orFilter = `or=(device_id.eq.${encodeURIComponent(cleanDevId)},phone_number_normalized.eq.${encodeURIComponent(normalizedPhone)},device_fingerprint.eq.${encodeURIComponent(deviceFingerprint)})`;
      const checkRes = await supabaseFetch(
        `device_trials?${orFilter}&select=*&order=created_at.asc&limit=1`,
        { signal: controller.signal }
      );

      const serverTimeMs = Date.now();
      let expiresAtMs = serverTimeMs + freeDays * 24 * 60 * 60 * 1000;
      let trialDays = freeDays;
      let effectiveDeviceId = cleanDevId;
      let isExistingReinstall = false;
      let isAlreadyLicensed = false;
      let restoredPin: string | null = null;

      if (checkRes.ok) {
        const rows = await checkRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const existing = rows[0];
          isExistingReinstall = true;
          effectiveDeviceId = existing.device_id || cleanDevId;
          appKeyValueStorage.setString('app_device_id', effectiveDeviceId);

          trialDays = Number(existing.trial_days || freeDays);
          expiresAtMs = existing.expires_at ? new Date(existing.expires_at).getTime() : expiresAtMs;
          const currentInstallCount = Number(existing.install_count || 1);

          if (existing.status === 'licensed') {
            isAlreadyLicensed = true;
            restoredPin = this.computeExpectedPin(effectiveDeviceId);
          }

          // Increment install_count in Supabase and record latest hardware fingerprint
          await supabaseFetch(`device_trials?device_id=eq.${encodeURIComponent(effectiveDeviceId)}`, {
            method: 'PATCH',
            signal: controller.signal,
            body: JSON.stringify({
              install_count: currentInstallCount + 1,
              device_fingerprint: deviceFingerprint,
              phone_number_normalized: normalizedPhone,
              owner_name: params.ownerName.trim(),
              store_name: params.storeName.trim() || existing.store_name,
            }),
          });
        } else {
          // New registration: insert into Supabase
          const nowIso = new Date(serverTimeMs).toISOString();
          const expIso = new Date(expiresAtMs).toISOString();

          await supabaseFetch('device_trials', {
            method: 'POST',
            signal: controller.signal,
            body: JSON.stringify({
              device_id: cleanDevId,
              owner_name: params.ownerName.trim(),
              store_name: params.storeName.trim() || 'Aking Tindahan',
              phone_number: params.phoneNumber.trim(),
              phone_number_normalized: normalizedPhone,
              device_fingerprint: deviceFingerprint,
              install_count: 1,
              location: (params.location || 'Pilipinas').trim(),
              trial_days: trialDays,
              first_opened_at: nowIso,
              expires_at: expIso,
              status: 'trial_active',
            }),
          });
        }
      }

      clearTimeout(timeoutId);

      // Persist to local SQLite
      const db = SqliteDatabase.getInstance().rawDb;
      if (db) {
        db.execSync(`
          INSERT OR REPLACE INTO app_licensing (
            id, device_id, store_name, owner_name, phone_number, location,
            registered_at_ms, trial_days, trial_expires_at_ms, is_licensed,
            license_pin, last_observed_time_ms
          ) VALUES (
            1,
            '${effectiveDeviceId.replace(/'/g, "''")}',
            '${params.storeName.replace(/'/g, "''")}',
            '${params.ownerName.replace(/'/g, "''")}',
            '${params.phoneNumber.replace(/'/g, "''")}',
            '${(params.location || 'Pilipinas').replace(/'/g, "''")}',
            ${serverTimeMs},
            ${trialDays},
            ${expiresAtMs},
            ${isAlreadyLicensed ? 1 : 0},
            ${isAlreadyLicensed && restoredPin ? `'${restoredPin}'` : 'NULL'},
            ${serverTimeMs}
          );
        `);
      }

      // Re-hydrate state
      this.hydrateInitialState();
      this.notify();

      if (isAlreadyLicensed) {
        return {
          success: true,
          message: 'Binabati kita! Naibalik ang iyong Pro Lifetime License para sa tindahang ito.',
        };
      }

      if (isExistingReinstall) {
        if (expiresAtMs <= serverTimeMs) {
          return {
            success: true,
            message: 'Natapos na ang libreng trial para sa device o numerong ito. Mag-upgrade sa Pro Lifetime Access upang ma-unlock ang tindahan.',
          };
        } else {
          const daysLeft = Math.max(1, Math.ceil((expiresAtMs - serverTimeMs) / (1000 * 60 * 60 * 24)));
          return {
            success: true,
            message: `Naibalik ang iyong umiiral na trial! Mayroon ka pang natitirang ${daysLeft} araw.`,
          };
        }
      }

      return {
        success: true,
        message: `Mabuhay! Nagsimula na ang iyong ${trialDays}-araw na Libreng Trial.`,
      };
    } catch {
      return {
        success: false,
        message:
          'Kailangan ng sandaling internet connection para masimulan ang iyong Libreng Trial. Pakisuyong i-on ang Wi-Fi o Mobile Data at subukan muli.',
      };
    }
  }

  /**
   * Verifies offline 6-digit PIN entered by user.
   */
  public verifyPin(enteredPin: string): VerificationResult {
    const cleanPin = enteredPin.trim();
    if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
      return {
        success: false,
        message: 'Dapat ay 6 na numero ang activation PIN.',
      };
    }

    const expected = this.computeExpectedPin(this.state.deviceId);

    if (cleanPin === expected || cleanPin === MASTER_PIN) {
      // Valid PIN! Activate permanently
      const db = SqliteDatabase.getInstance().rawDb;
      if (db) {
        try {
          db.runSync(
            'UPDATE app_licensing SET is_licensed = 1, license_pin = ? WHERE id = 1',
            [cleanPin]
          );
        } catch (err) {
          console.error('Failed to save license PIN to db:', err);
        }
      }

      this.state = Object.freeze({
        ...this.state,
        isLicensed: true,
        licensePin: cleanPin,
        isTrialExpired: false,
        isClockTampered: false,
      });

      this.notify();

      return {
        success: true,
        message: 'Binabati kita! Matagumpay na na-activate ang Tindahan Helper Pro (Lifetime Access).',
      };
    }

    return {
      success: false,
      message: 'Maling PIN. Pakisuyong tiyakin na tama ang PIN para sa Tindahan ID na ito.',
    };
  }

  /**
   * Submits GCash Reference & Screenshot directly to Supabase.
   */
  public async submitPaymentProof(params: SubmitPaymentParams): Promise<VerificationResult> {
    const cleanRef = params.gcashReference.trim();
    if (!cleanRef || cleanRef.length < 6) {
      return {
        success: false,
        message: 'Pakisuyong ilagay ang wastong GCash Reference Number.',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      let receiptImageUrl: string | null = null;

      // If user uploaded a screenshot, upload directly to Supabase Storage
      if (params.receiptBase64) {
        try {
          const cleanDevId = this.state.deviceId.replace(/[^A-Za-z0-9_-]/g, '');
          const filename = `${cleanDevId}_${Date.now()}.jpg`;

          let base64Clean = params.receiptBase64;
          if (base64Clean.includes(',')) {
            base64Clean = base64Clean.split(',')[1];
          }

          const binaryStr = atob(base64Clean);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/receipts/${filename}`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'image/jpeg',
            },
            body: bytes,
            signal: controller.signal,
          });

          if (uploadRes.ok) {
            receiptImageUrl = `${SUPABASE_URL}/storage/v1/object/public/receipts/${filename}`;
          }
        } catch (uploadErr) {
          console.warn('Screenshot upload warning:', uploadErr);
        }
      }

      // Insert directly to Supabase payment_requests
      const paymentPayload: {
        device_id: string;
        store_name: string;
        phone_number: string;
        gcash_reference: string;
        amount: number;
        status: string;
        receipt_image_url?: string;
      } = {
        device_id: this.state.deviceId.trim().toUpperCase(),
        store_name: this.state.storeName,
        phone_number: this.state.phoneNumber,
        gcash_reference: cleanRef,
        amount: params.amount || this.state.proPrice,
        status: 'PENDING',
      };
      if (receiptImageUrl) {
        paymentPayload.receipt_image_url = receiptImageUrl;
      }

      const res = await supabaseFetch('payment_requests', {
        method: 'POST',
        headers: {
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(paymentPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return {
          success: true,
          message:
            'Matagumpay na naisumite ang iyong GCash Reference! Ibe-verify ito ng aming admin at kusa nang mag-a-activate ang iyong app kapag online.',
        };
      }

      return {
        success: false,
        message: 'Hindi naisumite ang resibo sa Supabase. Pakisubukan muli.',
      };
    } catch {
      return {
        success: false,
        message: 'Walang internet connection. Pakisuyong i-on ang Wi-Fi o Mobile Data bago mag-submit.',
      };
    }
  }

  /**
   * Checks if admin has approved payment directly in Supabase.
   */
  public async checkOnlineApproval(): Promise<VerificationResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const cleanDevId = this.state.deviceId.trim().toUpperCase();
      const res = await supabaseFetch(
        `payment_requests?device_id=eq.${encodeURIComponent(cleanDevId)}&status=eq.APPROVED&select=*&order=created_at.desc&limit=1`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const match = rows[0];
          if (match.status === 'APPROVED' && match.generated_pin) {
            return this.verifyPin(match.generated_pin);
          }
        }
      }

      // Check if pending
      const pendingRes = await supabaseFetch(
        `payment_requests?device_id=eq.${encodeURIComponent(cleanDevId)}&status=eq.PENDING&select=*&order=created_at.desc&limit=1`
      );
      if (pendingRes.ok) {
        const pendingRows = await pendingRes.json();
        if (Array.isArray(pendingRows) && pendingRows.length > 0) {
          return {
            success: false,
            message: 'Kasalukuyang sinusuri pa ng admin ang iyong GCash payment. Maghintay lamang sandali.',
          };
        }
      }

      return {
        success: false,
        message: 'Wala pang naitalang aprubadong bayad para sa Tindahan ID na ito.',
      };
    } catch {
      return {
        success: false,
        message: 'Hindi ma-reach ang Supabase server. Pakisuyong i-check ang iyong internet connection.',
      };
    }
  }

  public isFeatureLocked(): boolean {
    if (!this.state.isRegistered) return true;
    if (this.state.isLicensed) return false;
    return this.state.isTrialExpired || this.state.isClockTampered || this.state.isQuotaExceeded;
  }
}

export const licensingService = LicensingService.getInstance();
