import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import { BARCODE_BEEP_DATA_URI } from './barcodeBeepDataUri';

type BeepPlayer = ReturnType<typeof createAudioPlayer>;

/**
 * SoundFeedbackService
 * Delivers immediate auditory confirmation (POS scanner beep) upon successful barcode scan.
 * Uses a 3-player round-robin pool and RFC 2397 base64 data URI for zero-latency burst scanning.
 * Works seamlessly across iOS, Android, and Web.
 */
class SoundFeedbackService {
  private players: BeepPlayer[] = [];
  private activePlayerIndex = 0;
  private readonly poolSize = 3;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.createPool(BARCODE_BEEP_DATA_URI);
    void this.initPlayer();
  }

  public createPool(sourceToUse: any = BARCODE_BEEP_DATA_URI): void {
    try {
      for (const player of this.players) {
        try {
          player.remove();
        } catch {
          // ignore
        }
      }
      this.players = [];
      for (let i = 0; i < this.poolSize; i++) {
        const player = createAudioPlayer(sourceToUse);
        player.loop = false;
        player.volume = 1;
        this.players.push(player);
      }
    } catch (err) {
      console.log('[SoundFeedbackService] Failed to create player pool:', err);
    }
  }

  public initPlayer(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (Platform.OS !== 'web') {
          await setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'duckOthers',
            shouldPlayInBackground: false,
            shouldRouteThroughEarpiece: false,
          }).catch((err) => {
            console.log('[SoundFeedbackService] setAudioModeAsync notice:', err);
          });
        }

        if (this.players.length === 0) {
          this.createPool(BARCODE_BEEP_DATA_URI);
        }

        console.log(`[SoundFeedbackService] ✓ Barcode beep pool (${this.players.length} players) initialized.`);
      } catch (err) {
        console.log('[SoundFeedbackService] ⚠️ Failed to init audio player pool:', err);
      }
    })();

    return this.initPromise;
  }

  /**
   * Plays the crisp 120ms POS barcode scanner beep with ZERO awaits.
   * Rotates through a 3-player round-robin pool for zero-latency burst scanning.
   */
  public playBarcodeBeep(): void {
    try {
      // 1. Web fallback using Web Audio API oscillator
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2300, ctx.currentTime);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
          return;
        }
      }

      // 2. Ensure player pool is available
      if (this.players.length === 0) {
        this.createPool();
      }

      if (this.players.length === 0) return;

      const player = this.players[this.activePlayerIndex];
      void player.seekTo(0).catch(() => {});
      player.volume = 1;
      this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
      player.play();
    } catch (error) {
      console.log('[SoundFeedbackService] Playback notice:', error);
    }
  }
}

export const soundFeedbackService = new SoundFeedbackService();
