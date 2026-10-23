export interface ReleaseMetadata {
  version_name: string;
  version_code: number;
  apk_url: string;
  sha256: string;
  size_bytes: number;
  release_notes: string;
  mandatory: boolean;
  mandatory_reason: string | null;
  status: 'published';
}

/** Untrusted server metadata is validated before it can reach the installer. */
export class AppRelease {
  private constructor(public readonly metadata: Readonly<ReleaseMetadata>) {}

  static parse(input: unknown): AppRelease {
    if (!input || typeof input !== 'object') throw new Error('Invalid release metadata.');
    const row = input as Record<string, unknown>;
    if (row.status !== 'published' || typeof row.version_name !== 'string' ||
        !row.version_name.trim() || row.version_name.length > 80 ||
        !Number.isSafeInteger(row.version_code) || Number(row.version_code) <= 0 || Number(row.version_code) > 2100000000 ||
        !Number.isSafeInteger(row.size_bytes) || Number(row.size_bytes) <= 0 || Number(row.size_bytes) > 1073741824 ||
        typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(row.sha256) ||
        typeof row.release_notes !== 'string' || row.release_notes.length > 20000 ||
        typeof row.mandatory !== 'boolean' ||
        (row.mandatory_reason !== null && typeof row.mandatory_reason !== 'string') ||
        (row.mandatory && !String(row.mandatory_reason ?? '').trim())) {
      throw new Error('Invalid release metadata.');
    }
    const url = new URL(String(row.apk_url));
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password ||
        url.search || url.hash ||
        !/^\/dleiszarjeisalther\/startup-tindahan-helper\/releases\/download\/[^/]+\/[^/]+\.apk$/i.test(url.pathname)) {
      throw new Error('The APK must be a public GitHub Release asset in the app repository.');
    }
    return new AppRelease(Object.freeze({
      version_name: row.version_name, version_code: Number(row.version_code), apk_url: url.href,
      sha256: row.sha256.toLowerCase(), size_bytes: Number(row.size_bytes),
      release_notes: row.release_notes, mandatory: row.mandatory,
      mandatory_reason: row.mandatory_reason as string | null, status: 'published',
    }));
  }

  isNewerThan(installedCode: number): boolean { return this.metadata.version_code > installedCode; }
}
