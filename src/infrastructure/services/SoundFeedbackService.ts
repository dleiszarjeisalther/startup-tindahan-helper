import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

const soundSource = require('../../../assets/sounds/barcode-beep.wav');
type BeepPlayer = ReturnType<typeof createAudioPlayer>;

/**
 * SoundFeedbackService
 * Delivers immediate auditory confirmation (POS scanner beep) upon successful barcode scan.
 * Works seamlessly across iOS, Android, and Web.
 */
class SoundFeedbackService {
  private player: BeepPlayer | null = null;
  private isLoaded = false;
  private hasPlayed = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    void this.initPlayer();
  }

  public initPlayer(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (Platform.OS !== 'web') {
          await setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'mixWithOthers',
            shouldPlayInBackground: false,
          }).catch((err) => {
            console.log('[SoundFeedbackService] setAudioModeAsync notice:', err);
          });
        }

        const player = createAudioPlayer(soundSource);
        player.loop = false;
        player.volume = 1;

        if (player.isLoaded) {
          this.isLoaded = true;
        } else {
          // If native audio buffer is still loading on startup, wait up to 400ms for isLoaded
          await new Promise<void>((resolve) => {
            let done = false;
            const sub = player.addListener('playbackStatusUpdate', (status) => {
              if (status.isLoaded) {
                this.isLoaded = true;
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
            }, 400);
          });
        }

        this.player = player;
        console.log('[SoundFeedbackService] ✓ Barcode beep player initialized.');
      } catch (err) {
        console.log('[SoundFeedbackService] ⚠️ Failed to init audio player:', err);
      }
    })();

    return this.initPromise;
  }

  /**
   * Plays the crisp 120ms POS barcode scanner beep exactly ONCE per scan.
   */
  public async playBarcodeBeep(): Promise<void> {
    try {
      // 1. Web fallback using Web Audio API oscillator
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
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

      // 2. Ensure player is initialized and buffer is ready
      if (!this.player) {
        if (this.initPromise) {
          await this.initPromise;
        } else {
          await this.initPlayer();
        }
      }

      if (this.player) {
        this.player.volume = 1;
        // On subsequent scans, rewind back to 0 before playing.
        // We do NOT seek inside didJustFinish listener because in ExoPlayer / expo-audio,
        // seeking while playWhenReady is true restarts playback in an infinite loop.
        if (this.hasPlayed) {
          await this.player.seekTo(0).catch(() => {});
        }
        this.player.play();
        this.hasPlayed = true;
        console.log('[SoundFeedbackService] ✓ Barcode beep played.');
      }
    } catch (error) {
      console.log('[SoundFeedbackService] Playback notice:', error);
    }
  }
}

export const soundFeedbackService = new SoundFeedbackService();
