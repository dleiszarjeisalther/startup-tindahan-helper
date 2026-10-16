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

  constructor() {
    this.initPlayer();
  }

  public initPlayer(): void {
    try {
      if (Platform.OS !== 'web') {
        void setAudioModeAsync({
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

      player.addListener('playbackStatusUpdate', (status) => {
        if (status.isLoaded) {
          this.isLoaded = true;
        }
        // Auto-rewind as soon as the sound finishes playing,
        // ensuring the player is back at position 0 ready for the next scan.
        if (status.didJustFinish) {
          void player.seekTo(0).catch(() => {});
        }
      });

      this.player = player;
      this.isLoaded = true;
      console.log('[SoundFeedbackService] ✓ Barcode beep player initialized.');
    } catch (err) {
      console.log('[SoundFeedbackService] ⚠️ Failed to init audio player:', err);
    }
  }

  /**
   * Plays the crisp 120ms POS barcode scanner beep.
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

      // 2. Ensure player exists
      if (!this.player) {
        this.initPlayer();
      }

      if (this.player) {
        this.player.volume = 1;
        // On subsequent scans after playing, ensure we start from 0 if auto-rewind is still settling
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
