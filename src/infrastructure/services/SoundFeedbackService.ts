import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

const soundSource = require('../../../assets/sounds/barcode-beep.wav');
type BeepPlayer = ReturnType<typeof createAudioPlayer>;

// Preload the bundled WAV asset file at module load
let assetPromise: Promise<Asset> | null =
  Platform.OS === 'web' ? null : Asset.fromModule(soundSource).downloadAsync();

/**
 * SoundFeedbackService
 * Delivers immediate auditory confirmation (POS scanner beep) upon successful barcode scan.
 * Works seamlessly across iOS, Android, and Web.
 */
class SoundFeedbackService {
  private player: BeepPlayer | null = null;
  private isLoaded = false;
  private hasPlayedOnce = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (Platform.OS !== 'web') {
      void this.initPlayer().catch((error) => {
        console.log('[SoundFeedbackService] Startup audio preparation notice:', error);
      });
    }
  }

  public initPlayer(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (Platform.OS === 'web') return;

      const [, asset] = await Promise.all([
        setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
          shouldPlayInBackground: false,
        }).catch((err) => {
          console.log('[SoundFeedbackService] setAudioModeAsync notice:', err);
        }),
        this.loadBundledAsset(),
      ]);

      const localUri = asset.localUri ?? asset.uri;
      if (!localUri) throw new Error('Barcode beep asset has no playable URI.');

      const player = createAudioPlayer({ uri: localUri }, {
        keepAudioSessionActive: true,
        updateInterval: 100,
      });

      this.player = player;
      player.loop = false;
      player.volume = 1;

      player.addListener('playbackStatusUpdate', (status) => {
        if (status.isLoaded) {
          this.isLoaded = true;
        }
      });

      if (player.isLoaded) {
        this.isLoaded = true;
      }

      console.log('[SoundFeedbackService] ✓ Barcode beep audio player instantiated successfully.');
    })().catch((error) => {
      const failedPlayer = this.player;
      this.player = null;
      this.isLoaded = false;
      this.hasPlayedOnce = false;
      this.initPromise = null;
      try {
        failedPlayer?.remove();
      } catch (cleanupError) {
        console.error('[SoundFeedbackService] Audio cleanup failed:', cleanupError);
      }
      throw error;
    });

    return this.initPromise;
  }

  private async loadBundledAsset(): Promise<Asset> {
    if (!assetPromise) {
      assetPromise = Asset.fromModule(soundSource).downloadAsync();
    }

    try {
      return await assetPromise;
    } catch (error) {
      assetPromise = null;
      throw error;
    }
  }

  /**
   * Plays the crisp 120ms POS barcode scanner beep exactly ONCE.
   */
  public async playBarcodeBeep(): Promise<void> {
    // 1. Web fallback using Web Audio API oscillator
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') await ctx.resume();
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

    // 2. Ensure player is initialized
    if (!this.player) {
      await this.initPlayer();
    }

    // 3. First-scan guard: if player is still buffering the local asset at app launch, wait briefly for isLoaded
    if (this.player && !this.player.isLoaded && !this.isLoaded) {
      console.log('[SoundFeedbackService] First scan occurred while player is buffering. Waiting for buffer readiness...');
      await new Promise<void>((resolve) => {
        let done = false;
        const sub = this.player?.addListener('playbackStatusUpdate', (status) => {
          if (status.isLoaded) {
            if (!done) {
              done = true;
              sub?.remove();
              resolve();
            }
          }
        });
        setTimeout(() => {
          if (!done) {
            done = true;
            sub?.remove();
            resolve();
          }
        }, 800);
      });
    }

    const player = this.player;
    if (!player) throw new Error('Barcode beep player is unavailable.');

    // 4. Play the sound:
    // On the very first play, the player is already positioned at 0 — no seekTo or pause needed.
    // On subsequent plays, rewind to 0 before playing.
    player.volume = 1;
    if (this.hasPlayedOnce) {
      await player.seekTo(0).catch(() => {});
    }
    player.play();
    this.hasPlayedOnce = true;
    console.log('[SoundFeedbackService] ✓ Native audio player played beep.');
  }
}

export const soundFeedbackService = new SoundFeedbackService();
