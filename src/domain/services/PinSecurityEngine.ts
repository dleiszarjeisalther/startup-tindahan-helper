// src/domain/services/PinSecurityEngine.ts
/**
 * PinSecurityEngine
 * Pure TypeScript Domain Service enforcing Owner Master PIN cryptography,
 * format validation, and brute-force rate-limiting invariants.
 *
 * Compliance: ISO/IEC 25010 (Security & Fault Tolerance), NFR-SEC-006, FR-SEC-001
 * Zero React/React Native or native module dependencies.
 */

export interface PinLockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
  failedAttempts: number;
}

export interface PinVerificationOutcome {
  success: boolean;
  remainingAttempts: number;
  lockoutStatus: PinLockoutStatus;
  errorMessage?: string;
}

export class PinSecurityEngine {
  public static readonly PIN_LENGTH = 4;
  public static readonly MAX_FAILED_ATTEMPTS = 5;
  public static readonly BASE_LOCKOUT_SECONDS = 300; // 5 minutes

  /**
   * Validates whether a PIN candidate consists of exactly 4 numeric digits.
   */
  public static isValidPinFormat(pin: string): boolean {
    return /^[0-9]{4}$/.test(pin);
  }

  /**
   * Generates a pseudo-random alphanumeric salt string.
   */
  public static generateSalt(length = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let salt = '';
    for (let i = 0; i < length; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      salt += chars.charAt(idx);
    }
    return salt;
  }

  /**
   * Pure TypeScript implementation of SHA-256 cryptographic hash.
   * Ensures 100% framework-agnostic portability in the Domain Layer.
   */
  public static sha256(ascii: string): string {
    function rightRotate(value: number, amount: number): number {
      return (value >>> amount) | (value << (32 - amount));
    }

    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let i: number;
    let j: number;

    const words: number[] = [];
    const asciiBitLength = ascii.length * 8;

    let hash: number[] = [];
    const k: number[] = [];

    let primeCounter = 0;
    const isComposite: { [n: number]: boolean } = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = true;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    ascii += '\x80';
    while ((ascii.length % 64) - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;

    for (j = 0; j < words.length; ) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash;
      hash = hash.slice(0, 8);

      for (i = 0; i < 64; i++) {
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

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    let result = '';
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  /**
   * Hashes a PIN with a salt.
   */
  public static hashPin(pin: string, salt: string): string {
    return this.sha256(`${salt}:${pin}`);
  }

  /**
   * Computes current lockout state given current timestamp and lockout expiration.
   */
  public static checkLockout(
    lockoutUntilTimestamp: number,
    failedAttempts: number,
    now: number = Date.now()
  ): PinLockoutStatus {
    if (lockoutUntilTimestamp > now) {
      const remainingSeconds = Math.ceil((lockoutUntilTimestamp - now) / 1000);
      return {
        isLocked: true,
        remainingSeconds,
        failedAttempts
      };
    }
    return {
      isLocked: false,
      remainingSeconds: 0,
      failedAttempts
    };
  }

  /**
   * Verifies an entered PIN against stored salted hash and enforces rate limiting.
   */
  public static verifyPin(
    enteredPin: string,
    storedHash: string,
    storedSalt: string,
    currentFailedAttempts: number,
    lockoutUntilTimestamp: number,
    now: number = Date.now()
  ): PinVerificationOutcome {
    const initialLock = this.checkLockout(lockoutUntilTimestamp, currentFailedAttempts, now);
    if (initialLock.isLocked) {
      return {
        success: false,
        remainingAttempts: 0,
        lockoutStatus: initialLock,
        errorMessage: `Naka-lockout ang PIN. Subukan muli pagkatapos ng ${initialLock.remainingSeconds} segundo.`
      };
    }

    if (!this.isValidPinFormat(enteredPin)) {
      return {
        success: false,
        remainingAttempts: Math.max(0, this.MAX_FAILED_ATTEMPTS - currentFailedAttempts),
        lockoutStatus: initialLock,
        errorMessage: 'Ang PIN ay dapat binubuo ng eksaktong 4 na numero.'
      };
    }

    const computedHash = this.hashPin(enteredPin, storedSalt);
    if (computedHash === storedHash) {
      return {
        success: true,
        remainingAttempts: this.MAX_FAILED_ATTEMPTS,
        lockoutStatus: {
          isLocked: false,
          remainingSeconds: 0,
          failedAttempts: 0
        }
      };
    }

    const newFailedAttempts = currentFailedAttempts + 1;
    if (newFailedAttempts >= this.MAX_FAILED_ATTEMPTS) {
      const lockedStatus = {
        isLocked: true,
        remainingSeconds: this.BASE_LOCKOUT_SECONDS,
        failedAttempts: newFailedAttempts
      };
      return {
        success: false,
        remainingAttempts: 0,
        lockoutStatus: lockedStatus,
        errorMessage: 'Maling PIN nang 5 beses. Naka-lock ang access sa loob ng 5 minuto.'
      };
    }

    const remaining = this.MAX_FAILED_ATTEMPTS - newFailedAttempts;
    return {
      success: false,
      remainingAttempts: remaining,
      lockoutStatus: {
        isLocked: false,
        remainingSeconds: 0,
        failedAttempts: newFailedAttempts
      },
      errorMessage: `Maling PIN. May ${remaining} pagkakataon pa bago mag-lock.`
    };
  }
}
