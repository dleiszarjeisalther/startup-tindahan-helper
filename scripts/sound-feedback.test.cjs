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

function setup({ modeFailure = false } = {}) {
  const players = [];
  const sources = [];
  let failMode = modeFailure;
  const exports = {};

  vm.runInNewContext(source, {
    exports,
    console: { error() {}, log() {} },
    setTimeout,
    clearTimeout,
    require(name) {
      if (name === 'react-native') return { Platform: { OS: 'android' } };
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
            isLoaded: true,
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

  return { service: exports.soundFeedbackService, players, sources };
}

test('first scan plays directly without seeking and loop is disabled', async () => {
  const h = setup();
  await h.service.playBarcodeBeep();
  assert.equal(h.players.length, 1);
  assert.equal(h.players[0].loop, false, 'Looping MUST be false to prevent infinite playback');
  assert.equal(h.players[0].volume, 1);
  assert.equal(h.players[0].seeks, 0, 'First scan should NOT seek since audio starts at 0');
  assert.equal(h.players[0].plays, 1, 'First scan should play exactly once');
});

test('subsequent scans seek to 0 and replay exactly once per scan', async () => {
  const h = setup();
  await h.service.playBarcodeBeep(); // 1st scan
  assert.equal(h.players[0].plays, 1);
  assert.equal(h.players[0].seeks, 0);

  await h.service.playBarcodeBeep(); // 2nd scan
  assert.equal(h.players.length, 1);
  assert.equal(h.players[0].plays, 2);
  assert.equal(h.players[0].seeks, 1, '2nd scan should seek to 0 before replay');

  await h.service.playBarcodeBeep(); // 3rd scan
  assert.equal(h.players[0].plays, 3);
  assert.equal(h.players[0].seeks, 2, '3rd scan should seek to 0 before replay');
});

test('didJustFinish status update does not trigger infinite seek loop', async () => {
  const h = setup();
  await h.service.playBarcodeBeep();
  assert.equal(h.players[0].seeks, 0);
  
  // Simulate playback finishing
  for (const listener of h.players[0].listeners) {
    listener({ didJustFinish: true, isLoaded: true });
  }
  // Seeks should NOT increase on status update (preventing infinite seek-and-play loop in ExoPlayer)
  assert.equal(h.players[0].seeks, 0, 'Must NOT seek in didJustFinish listener to avoid infinite loop');
});
