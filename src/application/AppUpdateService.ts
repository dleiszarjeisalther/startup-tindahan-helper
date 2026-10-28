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
    if (this.busy) return;
    if (['ready', 'permission', 'installer'].includes(this.state.phase)) {
      if (manual && this.state.release) this.publish({ dismissed: false });
      return;
    }
    if (!manual && Date.now() - this.lastCheck < 60 * 1000) return;
    this.busy = true;
    this.lastCheck = Date.now();
    const previous = this.state;
    try {
      const installed = await this.port.installed();
      if (!installed) {
        if (manual) this.publish({ message: 'Ang in-app update ay gumagana sa Android phone.' });
        return;
      }
      if (!this.initialized) { await this.port.clean(); this.initialized = true; }
      this.publish({ phase: 'checking', installed, message: 'Sinusuri kung may bagong bersyon…' });
      const raw = await this.port.latest();
      const release = raw ? AppRelease.parse(raw) : null;
      if (!release || !release.isNewerThan(installed.code)) {
        this.publish({ phase: 'idle', release: null, message: 'Nasa pinakabagong bersyon na ang iyong tindahan.' });
      } else {
        this.publish({ phase: 'available', release: release.metadata, progress: 0, message: '',
          dismissed: !manual && previous.release?.version_code === release.metadata.version_code && previous.dismissed });
      }
    } catch {
      this.publish({ phase: previous.release ? 'available' : 'idle', message: manual ? 'Hindi masuri ang update ngayon. Ligtas at gumagana pa rin ang tindahan offline.' : '' });
    } finally { this.busy = false; }
  }

  async download(): Promise<void> {
    if (this.busy || !this.state.release) return;
    this.busy = true;
    const release = this.state.release;
    this.publish({ phase: 'downloading', progress: 0, message: 'Dina-download ang bagong bersyon ng app…' });
    try {
      await this.port.download(release, progress => this.publish({ progress }));
      this.publish({ phase: 'ready', progress: 1, message: 'Handa nang i-install! Pindutin ang Install kapag tapos na ang benta.' });
    } catch (error) {
      this.publish({ phase: 'error', message: error instanceof Error ? error.message : 'Hindi natapos ang download. Pakisuri ang koneksyon at subukan muli.' });
    } finally { this.busy = false; }
  }

  async install(): Promise<void> {
    if (this.busy || !this.state.release || !['ready', 'permission', 'installer'].includes(this.state.phase)) return;
    if (!this.safeToInstall()) { this.publish({ message: 'Pansamantalang tapusin o i-park muna ang bukas na bayaran bago mag-update.' }); return; }
    this.busy = true;
    this.publish({ phase: 'installing', message: 'Inihahanda ang pag-install…' });
    try {
      const phase = await this.port.install(this.state.release);
      this.publish({ phase, message: phase === 'permission'
        ? 'Pahintulutan ang pag-install sa Settings ng phone, pagkatapos ay i-tap muli ang Install.'
        : 'Bukas na ang installer. Pindutin ang "Install" o "Update" sa screen.' });
    } catch (error) {
      this.publish({ phase: 'error', message: error instanceof Error ? error.message : 'Hindi masimulan ang pag-install. Pakisubukan muli mamaya.' });
    } finally { this.busy = false; }
  }
}
