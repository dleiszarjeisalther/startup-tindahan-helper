import { AppRelease, ReleaseMetadata } from '../domain/entities/AppRelease';

export interface InstalledApp { version: string; code: number }
export interface AppUpdatePort {
  installed(): Promise<InstalledApp | null>;
  latest(): Promise<unknown | null>;
  download(release: Readonly<ReleaseMetadata>, progress: (fraction: number) => void): Promise<void>;
  install(release: Readonly<ReleaseMetadata>): Promise<'permission' | 'installer'>;
  clean(): Promise<void>;
}
export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'permission' | 'installer' | 'error';
export interface UpdateSnapshot {
  phase: UpdatePhase;
  installed: InstalledApp | null;
  release: Readonly<ReleaseMetadata> | null;
  progress: number;
  message: string;
  dismissed: boolean;
}

/** Separate from the POS store: update failures never mutate business data. */
export class AppUpdateService {
  private state: Readonly<UpdateSnapshot> = Object.freeze({ phase: 'idle', installed: null, release: null, progress: 0, message: '', dismissed: false });
  private listeners = new Set<() => void>();
  private busy = false;
  private lastCheck = 0;
  private initialized = false;
  constructor(private readonly port: AppUpdatePort, private readonly safeToInstall: () => boolean) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<UpdateSnapshot>) {
    this.state = Object.freeze({ ...this.state, ...patch });
    this.listeners.forEach(listener => listener());
  }
  dismiss = () => { if (this.state.phase !== 'installing') this.publish({ dismissed: true }); };
  show = () => this.publish({ dismissed: false });

  async check(manual = false): Promise<void> {
    if (this.busy || ['ready', 'permission', 'installer'].includes(this.state.phase)) return;
    if (!manual && Date.now() - this.lastCheck < 6 * 60 * 60 * 1000) return;
    this.busy = true;
    this.lastCheck = Date.now();
    const previous = this.state;
    try {
      const installed = await this.port.installed();
      if (!installed) {
        if (manual) this.publish({ message: 'APK updates require an Android development or production build.' });
        return;
      }
      if (!this.initialized) { await this.port.clean(); this.initialized = true; }
      this.publish({ phase: 'checking', installed, message: 'Checking for updates…' });
      const raw = await this.port.latest();
      const release = raw ? AppRelease.parse(raw) : null;
      if (!release || !release.isNewerThan(installed.code)) {
        this.publish({ phase: 'idle', release: null, message: 'Your app is up to date.' });
      } else {
        this.publish({ phase: 'available', release: release.metadata, progress: 0, message: '',
          dismissed: !manual && previous.release?.version_code === release.metadata.version_code && previous.dismissed });
      }
    } catch {
      this.publish({ phase: previous.release ? 'available' : 'idle', message: manual ? 'Cannot check for updates. Your store still works offline. Try again later.' : '' });
    } finally { this.busy = false; }
  }

  async download(): Promise<void> {
    if (this.busy || !this.state.release) return;
    this.busy = true;
    const release = this.state.release;
    this.publish({ phase: 'downloading', progress: 0, message: 'Downloading and verifying APK…' });
    try {
      await this.port.download(release, progress => this.publish({ progress }));
      this.publish({ phase: 'ready', progress: 1, message: 'APK verified. Install when you have finished your sale.' });
    } catch (error) {
      this.publish({ phase: 'error', message: error instanceof Error ? error.message : 'Download failed. Check connection and storage, then retry.' });
    } finally { this.busy = false; }
  }

  async install(): Promise<void> {
    if (this.busy || !this.state.release || !['ready', 'permission', 'installer'].includes(this.state.phase)) return;
    if (!this.safeToInstall()) { this.publish({ message: 'Finish or park your sale, then return to More to install.' }); return; }
    this.busy = true;
    this.publish({ phase: 'installing', message: 'Rechecking APK before opening Android installer…' });
    try {
      const phase = await this.port.install(this.state.release);
      this.publish({ phase, message: phase === 'permission'
        ? 'Allow installations from this app in Android Settings, return here, and tap Install again.'
        : 'Android installer opened. Confirm installation there. If you cancelled or Android rejected the APK, you can retry or continue using your store.' });
    } catch (error) {
      this.publish({ phase: 'error', message: error instanceof Error ? error.message : 'Installation could not start. Download again or try later.' });
    } finally { this.busy = false; }
  }
}
