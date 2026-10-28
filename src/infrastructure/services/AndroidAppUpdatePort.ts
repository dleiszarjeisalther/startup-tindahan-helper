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
    const url = process.env.EXPO_PUBLIC_UPDATE_SUPABASE_URL || 'https://eitqtggytkosvdgfeqap.supabase.co';
    const key = process.env.EXPO_PUBLIC_UPDATE_SUPABASE_KEY || 'sb_publishable_71hwmfru1nxpm2OMNU3W_w_EPV2HhOz';
    const websiteEndpoint = 'https://tindahanhelper.wuaze.com/api/releases.php?latest=1';

    // 1. Try Supabase REST API first
    if (url && key && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 6000);
      try {
        const selectFields = 'version_name,version_code,apk_url,sha256,size_bytes,release_notes,mandatory,mandatory_reason,status,image_url,video_url,published_at';
        const response = await fetch(`${url}/rest/v1/app_releases?status=eq.published&order=version_code.desc&limit=1&select=${selectFields}`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          signal: abort.signal,
        });
        if (response.ok) {
          const rows: unknown = await response.json();
          if (Array.isArray(rows) && rows.length > 0) {
            return rows[0];
          }
        }
      } catch {
        // Fall back to website endpoint if Supabase is temporarily unreachable or table pending
      } finally {
        clearTimeout(timeout);
      }
    }

    // 2. Fallback to website releases API (safely verify JSON payload)
    const fallbackAbort = new AbortController();
    const fallbackTimeout = setTimeout(() => fallbackAbort.abort(), 6000);
    try {
      const response = await fetch(websiteEndpoint, {
        signal: fallbackAbort.signal,
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const text = await response.text();
        const trimmed = text.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          const data: unknown = JSON.parse(trimmed);
          if (data && typeof data === 'object') {
            return data;
          }
        }
      }
    } catch {
      // Continue to next fallback
    } finally {
      clearTimeout(fallbackTimeout);
    }

    // 3. Fallback to GitHub Releases API (guaranteed accessible publicly)
    const ghAbort = new AbortController();
    const ghTimeout = setTimeout(() => ghAbort.abort(), 6000);
    try {
      const response = await fetch('https://api.github.com/repos/dleiszarjeisalther/startup-tindahan-helper/releases/latest', {
        signal: ghAbort.signal,
        headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'TindahanHelper' },
      });
      if (response.ok) {
        const releaseData: any = await response.json();
        if (releaseData && releaseData.tag_name) {
          const apkAsset = Array.isArray(releaseData.assets)
            ? releaseData.assets.find((a: any) => typeof a.name === 'string' && a.name.endsWith('.apk'))
            : null;
          if (apkAsset && apkAsset.browser_download_url) {
            const versionName = String(releaseData.tag_name).replace(/^v/i, '');
            const parts = versionName.split('.').map((p: string) => parseInt(p, 10));
            const derivedCode = parts.length >= 3 && !isNaN(parts[2]) ? (parts[0] * 10000 + parts[1] * 100 + parts[2]) : 6;
            const shaMatch = typeof releaseData.body === 'string' ? releaseData.body.match(/\b([a-fA-F0-9]{64})\b/) : null;
            const imgMatch = typeof releaseData.body === 'string' ? releaseData.body.match(/(https:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp))/i) : null;
            const vidMatch = typeof releaseData.body === 'string' ? releaseData.body.match(/(https:\/\/[^\s"'<>]+\.(?:mp4|webm)|https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s"'<>]+)/i) : null;
            return {
              version_name: versionName,
              version_code: derivedCode,
              apk_url: apkAsset.browser_download_url,
              sha256: shaMatch ? shaMatch[1] : '06b191bfed628aace16726eaed6f6de42b634a2706f090f98da0c8e8020eec3c',
              size_bytes: apkAsset.size || 137710920,
              release_notes: releaseData.body || `🚀 Bagong Bersyon v${versionName} ng Tindahan Helper.`,
              image_url: imgMatch ? imgMatch[1] : 'https://tindahanhelper.wuaze.com/assets/images/hero-tindahan.jpg',
              video_url: vidMatch ? vidMatch[1] : 'https://tindahanhelper.wuaze.com/assets/video/merged_part1_part3.mp4',
              mandatory: false,
              mandatory_reason: null,
              status: 'published',
            };
          }
        }
      }
    } catch {
      // Offline fallback: returns null safely
    } finally {
      clearTimeout(ghTimeout);
    }

    return null;
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
