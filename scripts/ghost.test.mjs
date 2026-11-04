import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GhostPlayer,
  GhostRecorder,
  sanitizeGhostSamples
} from '../src/ghost.js';

function transform(x, y = 50, z = 0) {
  return { x, y, z, pitch: 0.1, yaw: 0.2, roll: -0.1 };
}

test('records ghost samples at a fixed interval', () => {
  const recorder = new GhostRecorder(0.1);
  assert.equal(recorder.capture(0, transform(0)), true);
  assert.equal(recorder.capture(0.05, transform(1)), false);
  assert.equal(recorder.capture(0.1, transform(2)), true);
  assert.equal(recorder.capture(0.2, transform(3)), true);

  assert.equal(recorder.samples.length, 3);
  assert.deepEqual(recorder.samples.map((sample) => sample.x), [0, 2, 3]);
});

test('interpolates a recorded ghost by elapsed time', () => {
  const player = new GhostPlayer();
  player.setSamples([
    { t: 0, x: 0, y: 10, z: 0, pitch: 0, yaw: 0, roll: 0 },
    { t: 2, x: 20, y: 30, z: -40, pitch: 0.2, yaw: 0.4, roll: 0.1 }
  ]);

  const halfway = player.update(1);
  assert.equal(halfway.x, 10);
  assert.equal(halfway.y, 20);
  assert.equal(halfway.z, -20);
  assert.equal(halfway.pitch, 0.1);

  const afterEnd = player.update(3);
  assert.equal(afterEnd.x, 20);
  assert.equal(afterEnd.z, -40);
});

test('drops invalid ghost data', () => {
  const samples = sanitizeGhostSamples([
    { t: 0, x: 1, y: 2, z: 3, pitch: 0, yaw: 0, roll: 0 },
    { t: -1, x: 1, y: 2, z: 3, pitch: 0, yaw: 0, roll: 0 },
    { t: 1, x: 1, y: 2, z: 3, pitch: 0, yaw: 0 },
    null
  ]);

  assert.equal(samples.length, 1);
  assert.deepEqual(samples[0], {
    t: 0,
    x: 1,
    y: 2,
    z: 3,
    pitch: 0,
    yaw: 0,
    roll: 0
  });
});
