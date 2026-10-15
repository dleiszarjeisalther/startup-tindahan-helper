// src/infrastructure/services/SoundFeedbackService.ts
import { createAudioPlayer, preload, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

const soundSource = require('../../../assets/sounds/barcode-beep.wav');

// Preload the audio file into native memory at module scope before any React components mount
if (Platform.OS !== 'web') {
  void preload(soundSource, { preferredForwardBufferDuration: 2 }).catch((err) => {
    console.log(
      '[SoundFeedbackService] Audio preload notice (non-fatal, will load on demand):',
      err?.message || err
    );
  });
}

/**
 * SoundFeedbackService
 * Delivers immediate single auditory confirmation (POS scanner beep) upon successful barcode scan.
 * Works seamlessly across iOS, Android, and Web.
 *
 * Designed to guarantee:
 * 1. Single playback per scan — strictly no infinite loop or repeating beeps.
 * 2. Instant playback on first scan — preloaded at module level + ready-check buffer guard.
 * 3. Never auto-replays: player.loop is false and no recursive didJustFinish listeners.
 */
class SoundFeedbackService {
  private player: ReturnType<typeof createAudioPlayer> | null = null;
  private isLoaded = false;
  private isPlaying = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    void this.initPlayer();
  }

  public initPlayer(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log('[SoundFeedbackService] Initializing audio player for POS beep...');

        // 1. Configure audio mode immediately so playsInSilentMode and mixWithOthers are active
        if (Platform.OS !== 'web') {
          await setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'mixWithOthers',
            shouldPlayInBackground: false,
          }).catch((err) => {
            console.log('[SoundFeedbackService] setAudioModeAsync notice:', err);
          });
          console.log('[SoundFeedbackService] ✓ Audio session mode configured (playsInSilentMode=true, mixWithOthers).');
        }

        // 2. Create player with keepAudioSessionActive: true and loop: false
        this.player = createAudioPlayer(soundSource, {
          keepAudioSessionActive: true,
        });
        this.player.loop = false;

        // 3. Track loaded state only — NEVER trigger seekTo or play from status updates to avoid infinite loops!
        this.player.addListener('playbackStatusUpdate', (status) => {
          if (status.isLoaded) {
            this.isLoaded = true;
          }
          if (status.didJustFinish) {
            this.isPlaying = false;
          }
        });

        if (this.player.isLoaded) {
          this.isLoaded = true;
        }

        console.log('[SoundFeedbackService] ✓ Barcode beep audio player instantiated successfully.');
      } catch (error) {
        console.log('[SoundFeedbackService] ⚠️ Failed to initialize audio player:', error);
      }
    })();

    return this.initPromise;
  }

  /**
   * Plays the crisp 120ms POS barcode scanner beep exactly ONCE.
   */
  public async playBarcodeBeep(): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`[SoundFeedbackService] [${timestamp}] playBarcodeBeep requested (platform: ${Platform.OS}, isLoaded: ${this.isLoaded})`);

    try {
      // 1. Web fallback using Web Audio API oscillator
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {});
          }
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
          console.log('[SoundFeedbackService] ✓ Web Audio oscillator played beep successfully.');
          return;
        }
      }

      // 2. Ensure initialization has run
      if (!this.player) {
        await this.initPlayer();
      }

      // 3. First-scan guard: if player is still buffering from app launch, wait briefly for isLoaded
      if (this.player && !this.player.isLoaded && !this.isLoaded) {
        console.log('[SoundFeedbackService] First scan occurred while player is buffering. Waiting for buffer readiness...');
        await new Promise<void>((resolve) => {
          let resolved = false;
          const sub = this.player?.addListener('playbackStatusUpdate', (status) => {
            if (status.isLoaded) {
              if (!resolved) {
                resolved = true;
                sub?.remove();
                resolve();
              }
            }
          });
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              sub?.remove();
              resolve();
            }
          }, 350);
        });
      }

      // 4. Play the beep strictly ONCE (pause -> seekTo(0) -> play)
      if (this.player) {
        this.isPlaying = true;
        this.player.pause();
        await this.player.seekTo(0).catch(() => {});
        this.player.play();
        console.log('[SoundFeedbackService] ✓ Native audio player played beep once.');
      } else {
        console.log('[SoundFeedbackService] ⚠️ Audio player is null.');
      }
    } catch (err) {
      this.isPlaying = false;
      console.error('[SoundFeedbackService] ❌ Audio playback error:', err);
    }
  }
}

export const soundFeedbackService = new SoundFeedbackService();
