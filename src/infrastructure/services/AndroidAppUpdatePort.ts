import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';
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

  async installed(): Promise<InstalledApp | null> {
    try {
      const native = this.native();
      if (native) {
        const info = await native.installed();
        if (info && info.code > 0) {
          return info;
        }
      }
    } catch {
      // Native updater threw or unavailable; fallback below
    }

    const inExpoGo = isRunningInExpoGo();

    // 1. Authoritative configuration from app.json
    const configCode = Constants.expoConfig?.android?.versionCode ?? 0;
    const configVersion = Constants.expoConfig?.version ?? '';

    // 2. OS-level native package info (standalone production/preview APK only; never in Expo Go where it reports Expo Go's SDK version)
    const appBuildCode = !inExpoGo && Application.nativeBuildVersion ? parseInt(Application.nativeBuildVersion, 10) : 0;
    const appVersion = !inExpoGo ? (Application.nativeApplicationVersion || '') : '';

    const constBuildCode = !inExpoGo && Constants.nativeBuildVersion ? parseInt(Constants.nativeBuildVersion, 10) : 0;
    const constVersion = !inExpoGo ? (Constants.nativeAppVersion || '') : '';

    const code =
      (configCode > 0 ? configCode : 0) ||
      (appBuildCode > 0 ? appBuildCode : 0) ||
      (constBuildCode > 0 ? constBuildCode : 0);

    const version = configVersion || appVersion || constVersion || '';

    if (code > 0) {
      return { version, code };
    }

    return null;
  }

  async clean(): Promise<void> {
    try {
      await this.native()?.clean();
    } catch {
      // Ignore cleanup error if native updater is missing
    }
    try {
      const targetDir = new Directory(Paths.cache, 'apk-updates');
      if (targetDir.exists) {
        targetDir.delete();
      }
    } catch {
      // Ignore cleanup error
    }
  }
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
            const codeMatch = typeof releaseData.body === 'string' ? releaseData.body.match(/\bversion_code\s*[:=]\s*(\d+)\b/i) : null;
            const digestMatch = typeof apkAsset.digest === 'string' ? apkAsset.digest.match(/^sha256:([a-fA-F0-9]{64})$/) : null;
            const checksum = digestMatch?.[1] || shaMatch?.[1];
            if (!checksum || !Number.isSafeInteger(apkAsset.size) || apkAsset.size <= 0) return null;
            const imgMatch = typeof releaseData.body === 'string' ? releaseData.body.match(/(https:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp))/i) : null;
            const vidMatch = typeof releaseData.body === 'string' ? releaseData.body.match(/(https:\/\/[^\s"'<>]+\.(?:mp4|webm)|https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s"'<>]+)/i) : null;
            return {
              version_name: versionName,
              version_code: codeMatch ? Number(codeMatch[1]) : derivedCode,
              apk_url: apkAsset.browser_download_url,
              sha256: checksum.toLowerCase(),
              size_bytes: apkAsset.size,
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
    if (native) {
      const subscription = native.addListener('progress', event => progress(Math.max(0, Math.min(1, event.fraction))));
      try {
        await native.download(release.apk_url, release.sha256, release.version_code, release.size_bytes);
        return;
      } finally {
        subscription.remove();
      }
    }

    // Direct In-App Download Fallback (no browser redirect)
    if (Platform.OS === 'android' && release.apk_url) {
      const targetDir = new Directory(Paths.cache, 'apk-updates');
      if (!targetDir.exists) {
        targetDir.create();
      }
      const targetFile = new File(targetDir, 'verified.apk');
      if (targetFile.exists) {
        targetFile.delete();
      }
      progress(0.1);
      await File.downloadFileAsync(release.apk_url, targetFile);
      progress(1);
      return;
    }

    throw new Error('Hindi ma-download ang update. Pakibisita ang website para sa pinakabagong bersyon.');
  }

  async install(release: Readonly<ReleaseMetadata>): Promise<'permission' | 'installer'> {
    const native = this.native();
    if (native) {
      return native.install(release.sha256, release.version_code, release.size_bytes);
    }

    // Direct In-App Installer Fallback (triggers Android Package Installer)
    if (Platform.OS === 'android') {
      const targetDir = new Directory(Paths.cache, 'apk-updates');
      const targetFile = new File(targetDir, 'verified.apk');
      if (targetFile.exists) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(targetFile.uri, {
            mimeType: 'application/vnd.android.package-archive',
            dialogTitle: 'I-install ang Bagong Bersyon ng Tindahan Helper',
            UTI: 'com.android.package-archive',
          });
          return 'installer';
        }
        await Linking.openURL(targetFile.uri);
        return 'installer';
      }
    }

    if (release.apk_url) {
      await Linking.openURL(release.apk_url);
      return 'installer';
    }
    throw new Error('Hindi mabuksan ang installer.');
  }
}

