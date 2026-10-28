export interface ReleaseMetadata {
  version_name: string;
  version_code: number;
  apk_url: string;
  sha256: string;
  size_bytes: number;
  release_notes: string;
  image_url?: string | null;
  video_url?: string | null;
  mandatory: boolean;
  mandatory_reason: string | null;
  status: 'published';
  published_at?: string | null;
}

/** Untrusted server metadata is validated before it can reach the installer. */
export class AppRelease {
  private constructor(public readonly metadata: Readonly<ReleaseMetadata>) {}

  static parse(input: unknown): AppRelease {
    if (!input || typeof input !== 'object') throw new Error('Invalid release metadata.');
    const row = input as Record<string, unknown>;
    const isMandatory = Boolean(row.mandatory);
    const rawReason = row.mandatory_reason;
    if (rawReason !== undefined && rawReason !== null && typeof rawReason !== 'string') {
      throw new Error('Invalid release metadata.');
    }
    const mandatoryReason = isMandatory
      ? (typeof rawReason === 'string' && rawReason.trim().length > 0 ? rawReason.trim() : null)
      : (typeof rawReason === 'string' ? rawReason : null);

    if (row.status !== 'published' || typeof row.version_name !== 'string' ||
        !row.version_name.trim() || row.version_name.length > 80 ||
        !Number.isSafeInteger(row.version_code) || Number(row.version_code) <= 0 || Number(row.version_code) > 2100000000 ||
        !Number.isSafeInteger(row.size_bytes) || Number(row.size_bytes) <= 0 || Number(row.size_bytes) > 1073741824 ||
        typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(row.sha256) ||
        typeof row.release_notes !== 'string' || row.release_notes.length > 20000 ||
        (row.mandatory !== undefined && typeof row.mandatory !== 'boolean') ||
        (isMandatory && !mandatoryReason)) {
      throw new Error('Invalid release metadata.');
    }
    const url = new URL(String(row.apk_url).trim());
    const isGithub = url.hostname === 'github.com' &&
      /^\/dleiszarjeisalther\/startup-tindahan-helper\/releases\/download\/[^/]+\/[^/]+\.apk$/i.test(url.pathname);
    const isWebsite = (url.hostname === 'tindahanhelper.wuaze.com' || url.hostname.endsWith('.wuaze.com')) &&
      url.pathname.endsWith('.apk');

    if (url.protocol !== 'https:' || (!isGithub && !isWebsite) || url.port || url.username || url.password ||
        url.search || url.hash) {
      throw new Error('The APK must be an authentic release asset from GitHub or the official Tindahan Helper website.');
    }

    let imageUrl: string | null = null;
    if (row.image_url !== undefined && row.image_url !== null) {
      if (typeof row.image_url !== 'string') throw new Error('Invalid release image URL.');
      const imgTrimmed = row.image_url.trim();
      if (imgTrimmed) {
        const u = new URL(imgTrimmed);
        if (u.protocol !== 'https:') throw new Error('Release image must be HTTPS.');
        imageUrl = u.href;
      }
    }

    let videoUrl: string | null = null;
    if (row.video_url !== undefined && row.video_url !== null) {
      if (typeof row.video_url !== 'string') throw new Error('Invalid release video URL.');
      const vidTrimmed = row.video_url.trim();
      if (vidTrimmed) {
        const u = new URL(vidTrimmed);
        if (u.protocol !== 'https:') throw new Error('Release video must be HTTPS.');
        videoUrl = u.href;
      }
    }

    return new AppRelease(Object.freeze({
      version_name: row.version_name,
      version_code: Number(row.version_code),
      apk_url: url.href,
      sha256: row.sha256.toLowerCase(),
      size_bytes: Number(row.size_bytes),
      release_notes: row.release_notes,
      image_url: imageUrl,
      video_url: videoUrl,
      mandatory: isMandatory,
      mandatory_reason: mandatoryReason,
      status: 'published',
      published_at: typeof row.published_at === 'string' ? row.published_at : null,
    }));
  }

  isNewerThan(installedCode: number): boolean { return this.metadata.version_code > installedCode; }
}
