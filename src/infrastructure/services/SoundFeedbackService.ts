// src/infrastructure/services/SoundFeedbackService.ts
import { createAudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

/**
 * SoundFeedbackService
 * Delivers immediate auditory confirmation (POS scanner beep) upon successful barcode scan.
 * Works seamlessly across iOS, Android, and Web.
 */
class SoundFeedbackService {
  private player: ReturnType<typeof createAudioPlayer> | null = null;
  private isLoaded = false;

  constructor() {
    this.initPlayer();
  }

  private initPlayer() {
    try {
      const soundSource = require('../../../assets/sounds/barcode-beep.wav');
      this.player = createAudioPlayer(soundSource);
      this.isLoaded = true;
    } catch {
      this.isLoaded = false;
    }
  }

  /**
   * Plays the crisp 120ms 2300Hz POS barcode scanner beep.
   */
  public async playBarcodeBeep(): Promise<void> {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
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

      if (!this.player || !this.isLoaded) {
        this.initPlayer();
      }

      if (this.player) {
        await this.player.seekTo(0);
        this.player.play();
      }
    } catch {
      // Seamless fallback if audio device is muted or busy
    }
  }
}

export const soundFeedbackService = new SoundFeedbackService();
