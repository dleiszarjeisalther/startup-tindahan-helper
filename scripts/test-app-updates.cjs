const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
// Load the actual framework-independent production code, not a copy of its logic.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { AppRelease } = require('../src/domain/entities/AppRelease.ts');
const { AppUpdateService } = require('../src/application/AppUpdateService.ts');
const release = { version_name: '1.0.1', version_code: 2, apk_url: 'https://github.com/dleiszarjeisalther/startup-tindahan-helper/releases/download/v1.0.1/app.apk', sha256: 'a'.repeat(64), size_bytes: 1000, release_notes: 'Fixes', mandatory: false, mandatory_reason: null, status: 'published' };
function setup(overrides = {}, safe = () => true) {
  let installs = 0;
  const port = { installed: async () => ({ version: '1.0', code: 1 }), latest: async () => release,
    clean: async () => {}, download: async (_, progress) => progress(1), install: async () => { installs++; return 'installer'; }, ...overrides };
  return { service: new AppUpdateService(port, safe), installs: () => installs };
}
test('only valid published HTTPS repository assets are accepted', () => {
  assert.equal(AppRelease.parse(release).isNewerThan(1), true);
  for (const patch of [{ status: 'draft' }, { sha256: 'bad' }, { version_code: 1.5 }, { size_bytes: -1 }, { mandatory: true }, { apk_url: 'http://github.com/x.apk' }, { apk_url: 'https://evil.com/app.apk' }, { apk_url: release.apk_url + '?redirect=bad' }]) {
    assert.throws(() => AppRelease.parse({ ...release, ...patch }));
  }
});
test('newer release publishes immutable snapshot; identical version never prompts', async () => {
  const { service } = setup(); const before = service.getSnapshot(); let notifications = 0;
  service.subscribe(() => { notifications++; assert.notEqual(service.getSnapshot(), before); });
  await service.check(); assert.equal(service.getSnapshot().phase, 'available'); assert.ok(notifications);
  assert.ok(Object.isFrozen(service.getSnapshot())); assert.equal(service.getSnapshot(), service.getSnapshot());
  const same = setup({ installed: async () => ({ version: '1.0.1', code: 2 }) }).service;
  await same.check(); assert.equal(same.getSnapshot().release, null);
});
test('offline, malformed metadata and unsupported native runtime remain nonblocking', async () => {
  for (const overrides of [{ latest: async () => { throw Error('offline'); } }, { latest: async () => ({}) }, { installed: async () => null }]) {
    const { service } = setup(overrides); await service.check(); assert.equal(service.getSnapshot().phase, 'idle');
  }
});
test('verification failure never permits install; retry succeeds', async () => {
  let fail = true;
  const { service, installs } = setup({ download: async () => { if (fail) throw Error('APK checksum failed'); } });
  await service.check(); await service.download(); await service.install();
  assert.equal(service.getSnapshot().phase, 'error'); assert.equal(installs(), 0);
  fail = false; await service.download(); await service.install(); assert.equal(installs(), 1);
});
test('sale guard blocks installer and permission return is explicit', async () => {
  const { service, installs } = setup({}, () => false);
  await service.check(); await service.download(); await service.install(); assert.equal(installs(), 0);
  const permission = setup({ install: async () => 'permission' }).service;
  await permission.check(); await permission.download(); await permission.install(); assert.equal(permission.getSnapshot().phase, 'permission');
});
test('checks are throttled, concurrent downloads locked and dismissal does not cancel downloads', async () => {
  let checks = 0; let downloads = 0; let finish;
  const { service } = setup({ latest: async () => { checks++; return release; }, download: () => { downloads++; return new Promise(resolve => { finish = resolve; }); } });
  await service.check(); await service.check(); assert.equal(checks, 1);
  const active = service.download(); await service.download(); service.dismiss(); finish(); await active;
  assert.equal(downloads, 1); assert.equal(service.getSnapshot().phase, 'ready'); assert.equal(service.getSnapshot().dismissed, true);
});
test('accepts image_url, video_url, and website download link assets', () => {
  const enhanced = {
    ...release,
    apk_url: 'https://tindahanhelper.wuaze.com/apk/tindahan-helper.apk',
    image_url: 'https://tindahanhelper.wuaze.com/assets/images/hero-tindahan.jpg',
    video_url: 'https://tindahanhelper.wuaze.com/assets/video/merged_part1_part3.mp4',
  };
  const parsed = AppRelease.parse(enhanced);
  assert.equal(parsed.metadata.image_url, 'https://tindahanhelper.wuaze.com/assets/images/hero-tindahan.jpg');
  assert.equal(parsed.metadata.video_url, 'https://tindahanhelper.wuaze.com/assets/video/merged_part1_part3.mp4');
  assert.equal(parsed.metadata.apk_url, 'https://tindahanhelper.wuaze.com/apk/tindahan-helper.apk');
});

test('validates image_url and video_url security constraints', () => {
  // Non-HTTPS image URL is rejected
  assert.throws(() => AppRelease.parse({ ...release, image_url: 'http://insecure.com/img.png' }));
  // Non-HTTPS video URL is rejected
  assert.throws(() => AppRelease.parse({ ...release, video_url: 'http://insecure.com/video.mp4' }));
  // Non-string image URL is rejected
  assert.throws(() => AppRelease.parse({ ...release, image_url: 12345 }));
  // Null and empty string image/video URLs are accepted and become null
  const nullMedia = AppRelease.parse({ ...release, image_url: null, video_url: '   ' });
  assert.equal(nullMedia.metadata.image_url, null);
  assert.equal(nullMedia.metadata.video_url, null);
});


