const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(
  readFileSync(resolve(__dirname, '../src/infrastructure/services/SoundFeedbackService.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function setup({ assetFailure = false, modeFailure = false, initiallyLoaded = true } = {}) {
  const players = [];
  const sources = [];
  let downloads = 0;
  let failAsset = assetFailure;
  let failMode = modeFailure;
  const asset = {
    localUri: 'file:///cache/barcode-beep.wav',
    uri: 'http://metro/barcode-beep.wav',
    async downloadAsync() {
      downloads++;
      if (failAsset) { failAsset = false; throw new Error('asset failed'); }
      return this;
    },
  };
  const exports = {};

  vm.runInNewContext(source, {
    exports,
    console: { error() {}, log() {} },
    setTimeout,
    clearTimeout,
    require(name) {
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === 'expo-asset') return { Asset: { fromModule() { return asset; } } };
      if (name === 'expo-audio') return {
        async setAudioModeAsync() {
          if (failMode) { failMode = false; throw new Error('mode failed'); }
        },
        createAudioPlayer(sourceArg) {
          sources.push(sourceArg);
          const player = {
            loop: true,
            volume: 0,
            plays: 0,
            seeks: 0,
            removed: false,
            isLoaded: initiallyLoaded,
            listeners: new Set(),
            addListener(event, listener) {
              this.listeners.add(listener);
              return { remove: () => this.listeners.delete(listener) };
            },
            pause() {},
            async seekTo() { this.seeks++; },
            play() {
              this.plays++;
            },
            remove() { this.removed = true; },
          };
          players.push(player);
          return player;
        },
      };
      return 1;
    },
  });

  return { service: exports.soundFeedbackService, players, sources, get downloads() { return downloads; } };
}

test('first scan plays directly from position 0 without silent warm-up or seek', async () => {
  const h = setup();
  await h.service.playBarcodeBeep();
  assert.equal(h.downloads, 1);
  assert.equal(h.sources[0].uri, 'file:///cache/barcode-beep.wav');
  assert.equal(h.players[0].loop, false);
  assert.equal(h.players[0].volume, 1);
  assert.equal(h.players[0].seeks, 0, 'First scan should NOT seek since audio starts at 0');
  assert.equal(h.players[0].plays, 1, 'First scan should play exactly once (audibly)');
});

test('later scans reuse the player and rewind to zero', async () => {
  const h = setup();
  await h.service.playBarcodeBeep(); // 1st scan
  assert.equal(h.players[0].plays, 1);
  assert.equal(h.players[0].seeks, 0);

  await h.service.playBarcodeBeep(); // 2nd scan
  assert.equal(h.players.length, 1);
  assert.equal(h.players[0].plays, 2);
  assert.equal(h.players[0].seeks, 1, '2nd scan should seekTo(0) before playing');

  await h.service.playBarcodeBeep(); // 3rd scan
  assert.equal(h.players[0].plays, 3);
  assert.equal(h.players[0].seeks, 2, '3rd scan should seekTo(0) before playing');
});

test('first scan waits for buffer readiness if player was still loading', async () => {
  const h = setup({ initiallyLoaded: false });
  setTimeout(() => {
    if (h.players[0]) {
      h.players[0].isLoaded = true;
      for (const listener of h.players[0].listeners) {
        listener({ isLoaded: true });
      }
    }
  }, 20);

  await h.service.playBarcodeBeep();
  assert.equal(h.players[0].plays, 1);
  assert.equal(h.players[0].seeks, 0);
});

test('asset download failure is retryable', async () => {
  const h = setup({ assetFailure: true });
  await flush();
  await h.service.playBarcodeBeep();
  assert.equal(h.downloads, 2);
  assert.equal(h.players[0].plays, 1);
});

test('audio mode failure is tolerated and scan still plays', async () => {
  const h = setup({ modeFailure: true });
  await flush();
  await h.service.playBarcodeBeep();
  assert.equal(h.players.length, 1);
  assert.equal(h.players[0].plays, 1);
});
