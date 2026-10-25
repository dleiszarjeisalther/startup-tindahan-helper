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
      if (name === 'expo-asset') return {
        Asset: {
          fromModule: () => ({
            downloadAsync: async () => {},
          }),
        },
      };
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
            pauses: 0,
            removed: false,
            isLoaded: true,
            listeners: new Set(),
            addListener(event, listener) {
              this.listeners.add(listener);
              return { remove: () => this.listeners.delete(listener) };
            },
            pause() { this.pauses++; },
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

test('initializes 3-player round-robin pool with loop disabled and volume 1', async () => {
  const h = setup();
  assert.equal(h.players.length, 3, 'Must initialize exactly 3 players for round-robin pool');
  for (let i = 0; i < 3; i++) {
    assert.equal(h.players[i].loop, false, `Player ${i} loop MUST be false`);
    assert.equal(h.players[i].volume, 1, `Player ${i} volume MUST be 1`);
  }
});

test('plays immediately with zero awaits and rotates round-robin across players', () => {
  const h = setup();

  // Scan 1: player 0
  h.service.playBarcodeBeep();
  assert.equal(h.players[0].plays, 1, 'Scan 1 should play player 0');
  assert.equal(h.players[1].plays, 0);
  assert.equal(h.players[2].plays, 0);
  assert.equal(h.players[0].seeks, 0, 'Must NOT synchronously await seek before play');

  // Scan 2: player 1
  h.service.playBarcodeBeep();
  assert.equal(h.players[0].plays, 1);
  assert.equal(h.players[1].plays, 1, 'Scan 2 should play player 1');
  assert.equal(h.players[2].plays, 0);
  assert.equal(h.players[1].seeks, 0, 'Must NOT synchronously await seek before play');

  // Scan 3: player 2
  h.service.playBarcodeBeep();
  assert.equal(h.players[0].plays, 1);
  assert.equal(h.players[1].plays, 1);
  assert.equal(h.players[2].plays, 1, 'Scan 3 should play player 2');
  assert.equal(h.players[2].seeks, 0, 'Must NOT synchronously await seek before play');

  // Scan 4: rotates back to player 0
  h.service.playBarcodeBeep();
  assert.equal(h.players[0].plays, 2, 'Scan 4 should rotate back to player 0');
});

test('asynchronously pauses and rewinds player after 140ms timeout', async () => {
  const h = setup();
  h.service.playBarcodeBeep(); // triggers player 0

  assert.equal(h.players[0].pauses, 0, 'Should not pause immediately');
  assert.equal(h.players[0].seeks, 0, 'Should not seek immediately');

  // Wait for 150ms timeout to fire
  await new Promise((resolve) => setTimeout(resolve, 160));

  assert.equal(h.players[0].pauses, 1, 'Should pause after 140ms');
  assert.equal(h.players[0].seeks, 1, 'Should seek to 0 after 140ms');
});

test('cancels pending reset timer when player is reused during rapid burst scan', async () => {
  const h = setup();

  // Burst scan 1: player 0
  h.service.playBarcodeBeep();
  assert.equal(h.players[0].plays, 1);
  assert.equal(h.players[0].pauses, 0);

  // Rapidly trigger 3 more scans so player 0 is reused before 140ms elapses
  h.service.playBarcodeBeep(); // player 1
  h.service.playBarcodeBeep(); // player 2
  h.service.playBarcodeBeep(); // player 0 reused!

  assert.equal(h.players[0].plays, 2, 'Player 0 should be played a second time');
  assert.equal(h.players[0].pauses, 0, 'Player 0 should NOT be paused when reused');
  assert.equal(h.players[0].seeks, 1, 'Player 0 should be rewound before second play');

  // Wait 160ms for second timer to fire
  await new Promise((resolve) => setTimeout(resolve, 160));
  assert.equal(h.players[0].pauses, 1, 'Player 0 should have paused once after full duration');
});
