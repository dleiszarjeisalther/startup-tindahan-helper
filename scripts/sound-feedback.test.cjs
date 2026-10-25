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

const MOCK_DATA_URI = 'data:audio/wav;base64,UklGRnwpAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVgpAAAA';

function setup({ modeFailure = false } = {}) {
  const players = [];
  const sources = [];
  const audioModes = [];
  let failMode = modeFailure;
  const exports = {};

  vm.runInNewContext(source, {
    exports,
    console: { error() {}, log() {} },
    setTimeout,
    clearTimeout,
    require(name) {
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === './barcodeBeepDataUri' || name.includes('barcodeBeepDataUri')) {
        return { BARCODE_BEEP_DATA_URI: MOCK_DATA_URI };
      }
      if (name === 'expo-audio') return {
        async setAudioModeAsync(mode) {
          audioModes.push(mode);
          if (failMode) { failMode = false; throw new Error('mode failed'); }
        },
        createAudioPlayer(sourceArg) {
          sources.push(sourceArg);
          const player = {
            loop: true,
            volume: 0,
            plays: 0,
            seeks: 0,
            seekPositions: [],
            pauses: 0,
            removed: false,
            callLog: [],
            isLoaded: true,
            listeners: new Set(),
            addListener(event, listener) {
              this.listeners.add(listener);
              return { remove: () => this.listeners.delete(listener) };
            },
            pause() {
              this.pauses++;
              this.callLog.push({ action: 'pause' });
            },
            async seekTo(pos = 0) {
              this.seeks++;
              this.seekPositions.push(pos);
              this.callLog.push({ action: 'seekTo', pos });
            },
            play() {
              this.plays++;
              this.callLog.push({ action: 'play' });
            },
            remove() {
              this.removed = true;
              this.callLog.push({ action: 'remove' });
            },
          };
          players.push(player);
          return player;
        },
      };
      return 1;
    },
  });

  return { service: exports.soundFeedbackService, players, sources, audioModes };
}

test('initializes 3-player round-robin pool with base64 data URI, loop disabled, and volume 1', () => {
  const h = setup();
  assert.equal(h.players.length, 3, 'Must initialize exactly 3 players for round-robin pool');
  for (let i = 0; i < 3; i++) {
    assert.equal(h.sources[i], MOCK_DATA_URI, `Player ${i} must be initialized with base64 data URI`);
    assert.equal(h.players[i].loop, false, `Player ${i} loop MUST be false`);
    assert.equal(h.players[i].volume, 1, `Player ${i} volume MUST be 1`);
  }
});

test('configures audio mode with duckOthers on native platforms during initialization', async () => {
  const h = setup();
  await h.service.initPlayer();
  assert.ok(h.audioModes.length > 0, 'setAudioModeAsync must be called');
  const lastMode = h.audioModes[h.audioModes.length - 1];
  assert.equal(lastMode.playsInSilentMode, true, 'Must play in silent mode');
  assert.equal(lastMode.interruptionMode, 'duckOthers', 'Must use duckOthers for OEM camera scanner compatibility');
  assert.equal(lastMode.shouldPlayInBackground, false);
  assert.equal(lastMode.shouldRouteThroughEarpiece, false, 'Must not route through earpiece');
});

test('pre-seeks to 0 and ensures volume 1 before calling play() with round-robin rotation', () => {
  const h = setup();

  // Scan 1: player 0
  h.service.playBarcodeBeep();
  assert.equal(h.players[0].plays, 1, 'Scan 1 should play player 0');
  assert.equal(h.players[0].seeks, 1, 'Scan 1 should pre-seek player 0 to 0');
  assert.equal(h.players[0].seekPositions[0], 0);
  assert.equal(h.players[0].volume, 1);
  assert.deepEqual(h.players[0].callLog, [{ action: 'seekTo', pos: 0 }, { action: 'play' }], 'Pre-seek must occur before play()');
  assert.equal(h.players[1].plays, 0);
  assert.equal(h.players[2].plays, 0);

  // Scan 2: player 1
  h.service.playBarcodeBeep();
  assert.equal(h.players[1].plays, 1, 'Scan 2 should play player 1');
  assert.equal(h.players[1].seeks, 1, 'Scan 2 should pre-seek player 1 to 0');
  assert.deepEqual(h.players[1].callLog, [{ action: 'seekTo', pos: 0 }, { action: 'play' }]);
  assert.equal(h.players[0].plays, 1);
  assert.equal(h.players[2].plays, 0);

  // Scan 3: player 2
  h.service.playBarcodeBeep();
  assert.equal(h.players[2].plays, 1, 'Scan 3 should play player 2');
  assert.equal(h.players[2].seeks, 1, 'Scan 3 should pre-seek player 2 to 0');
  assert.deepEqual(h.players[2].callLog, [{ action: 'seekTo', pos: 0 }, { action: 'play' }]);

  // Scan 4: rotates back to player 0
  h.service.playBarcodeBeep();
  assert.equal(h.players[0].plays, 2, 'Scan 4 should rotate back to player 0');
  assert.equal(h.players[0].seeks, 2, 'Scan 4 should pre-seek player 0 to 0 again');
});

test('does not pause player asynchronously after playback (no destructive timeouts)', async () => {
  const h = setup();
  h.service.playBarcodeBeep();

  assert.equal(h.players[0].pauses, 0, 'Must not pause immediately');

  // Wait beyond previous 140ms timeout window
  await new Promise((resolve) => setTimeout(resolve, 200));

  assert.equal(h.players[0].pauses, 0, 'Must NOT pause player via timeout (avoids audio focus stripping)');
});

test('cleans up existing players by calling remove() on pool recreation and resets activePlayerIndex', () => {
  const h = setup();
  // Play scan 1 (player 0)
  h.service.playBarcodeBeep();
  // activePlayerIndex was advanced to 1

  const initialPlayers = [...h.players];
  assert.equal(initialPlayers.length, 3);
  assert.ok(initialPlayers.every((p) => !p.removed), 'Initial players should not be removed yet');

  // Re-create pool
  h.service.createPool();

  assert.ok(initialPlayers.every((p) => p.removed), 'All previous players must have remove() called on teardown');
  assert.equal(h.players.length, 6, 'Total players created should now be 6');
  const newPlayers = h.players.slice(3);
  assert.ok(newPlayers.every((p) => !p.removed), 'New players should be active');

  // Next scan must start from index 0 of the new pool
  h.service.playBarcodeBeep();
  assert.equal(newPlayers[0].plays, 1, 'Next scan after createPool must play player 0 of new pool');
  assert.equal(newPlayers[1].plays, 0);
  assert.equal(newPlayers[2].plays, 0);
});

test('handles synchronous seekTo errors and non-promise returns without aborting play()', () => {
  const h = setup();
  // Corrupt player 0's seekTo to throw synchronously
  h.players[0].seekTo = () => {
    throw new Error('Simulated synchronous seek failure');
  };
  // Corrupt player 1's seekTo to return void (non-promise)
  h.players[1].seekTo = () => {
    return undefined;
  };

  // Scan 1: player 0 must still play even if seekTo threw synchronously
  assert.doesNotThrow(() => {
    h.service.playBarcodeBeep();
  });
  assert.equal(h.players[0].plays, 1, 'Player 0 must still play despite synchronous seekTo throw');

  // Scan 2: player 1 must still play even if seekTo returned void
  assert.doesNotThrow(() => {
    h.service.playBarcodeBeep();
  });
  assert.equal(h.players[1].plays, 1, 'Player 1 must still play despite non-promise seekTo');
});

test('recovers by recreating pool when play() encounters an unhandled runtime error', () => {
  const h = setup();
  const initialPlayers = [...h.players];

  // Force player 0 play to throw
  h.players[0].play = () => {
    throw new Error('ExoPlayer fatal native crash');
  };

  // Trigger scan - should catch and recover pool
  assert.doesNotThrow(() => {
    h.service.playBarcodeBeep();
  });

  // Old players should have been torn down
  assert.ok(initialPlayers.every((p) => p.removed), 'Failed pool should be torn down');
  assert.equal(h.players.length, 6, 'A fresh 3-player pool must be created on recovery');

  // Subsequent scan works normally on the recovered pool
  const recoveredPlayers = h.players.slice(3);
  h.service.playBarcodeBeep();
  assert.equal(recoveredPlayers[0].plays, 1, 'Subsequent scan must play cleanly on recovered pool');
});
