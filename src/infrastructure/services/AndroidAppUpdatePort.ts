import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { AppUpdatePort, InstalledApp } from '../../application/AppUpdateService';
import { ReleaseMetadata } from '../../domain/entities/AppRelease';

interface NativeUpdater {
  installed(): Promise<InstalledApp>;
  clean(): Promise<void>;
  download(url: string, hash: string, code: number, size: number): Promise<void>;
  install(hash: string, code: number, size: number): Promise<'permission' | 'installer'>;
  addListener(event: 'progress', callback: (event: { fraction: number }) => void): { remove(): void };
}

export class AndroidAppUpdatePort implements AppUpdatePort {
  private native(): NativeUpdater | null {
    if (Platform.OS !== 'android' || isRunningInExpoGo()) return null;
    return requireOptionalNativeModule<NativeUpdater>('ApkUpdater');
  }
  async installed(): Promise<InstalledApp | null> { return this.native()?.installed() ?? null; }
  async clean(): Promise<void> { await this.native()?.clean(); }
  async latest(): Promise<unknown | null> {
    // Publishable key only. RLS grants read access to published releases, never writes.
    const url = process.env.EXPO_PUBLIC_UPDATE_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_UPDATE_SUPABASE_KEY;
    if (!url || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw new Error('Update server is not configured.');
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 8000);
    try {
      const response = await fetch(`${url}/rest/v1/app_releases?status=eq.published&order=version_code.desc&limit=1&select=version_name,version_code,apk_url,sha256,size_bytes,release_notes,mandatory,mandatory_reason,status`, {
        headers: { apikey: key }, signal: abort.signal,
      });
      if (!response.ok) throw new Error('Update server unavailable.');
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid update server response.');
      return rows[0] ?? null;
    } finally { clearTimeout(timeout); }
  }
  async download(release: Readonly<ReleaseMetadata>, progress: (fraction: number) => void): Promise<void> {
    const native = this.native();
    if (!native) throw new Error('Install a native Android build to use APK updates.');
    const subscription = native.addListener('progress', event => progress(Math.max(0, Math.min(1, event.fraction))));
    try { await native.download(release.apk_url, release.sha256, release.version_code, release.size_bytes); }
    finally { subscription.remove(); }
  }
  async install(release: Readonly<ReleaseMetadata>): Promise<'permission' | 'installer'> {
    const native = this.native();
    if (!native) throw new Error('APK installer unavailable in this build.');
    return native.install(release.sha256, release.version_code, release.size_bytes);
  }
}
