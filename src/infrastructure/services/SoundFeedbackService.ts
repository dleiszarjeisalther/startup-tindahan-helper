import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

const soundSource = require('../../../assets/sounds/barcode-beep.wav');
type BeepPlayer = ReturnType<typeof createAudioPlayer>;

/**
 * SoundFeedbackService
 * Delivers immediate auditory confirmation (POS scanner beep) upon successful barcode scan.
 * Uses a 3-player round-robin pool and expo-asset preloading for zero-latency burst scanning.
 * Works seamlessly across iOS, Android, and Web.
 */
class SoundFeedbackService {
  private players: BeepPlayer[] = [];
  private activePlayerIndex = 0;
  private readonly poolSize = 3;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.createPool();
    void this.initPlayer();
  }

  private createPool(): void {
    if (this.players.length >= this.poolSize) return;
    try {
      this.players = [];
      for (let i = 0; i < this.poolSize; i++) {
        const player = createAudioPlayer(soundSource);
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
        // Preload asset through expo-asset for instant playback readiness
        try {
          await Asset.fromModule(soundSource).downloadAsync();
        } catch (assetErr) {
          console.log('[SoundFeedbackService] Asset preload notice:', assetErr);
        }

        if (Platform.OS !== 'web') {
          await setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'mixWithOthers',
            shouldPlayInBackground: false,
          }).catch((err) => {
            console.log('[SoundFeedbackService] setAudioModeAsync notice:', err);
          });
        }

        if (this.players.length < this.poolSize) {
          this.createPool();
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
      this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;

      player.volume = 1;
      player.play();

      // Asynchronously reset player position for next rotation after 140ms
      setTimeout(() => {
        try {
          player.pause();
          void player.seekTo(0).catch(() => {});
        } catch {
          // ignore
        }
      }, 140);
    } catch (error) {
      console.log('[SoundFeedbackService] Playback notice:', error);
    }
  }
}

export const soundFeedbackService = new SoundFeedbackService();

