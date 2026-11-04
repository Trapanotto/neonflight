import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyProfile,
  getRecord,
  getRecordKey,
  loadProfile,
  saveProfile,
  setRecord
} from '../src/storage.js';
import { BEST_KEY, PROFILE_KEY } from '../src/config.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

const key = getRecordKey('course', 1, 1);

test('migrates the legacy best time once', () => {
  const storage = createStorage({ [BEST_KEY]: '61.25' });
  const profile = loadProfile(storage, { recordKey: key });

  assert.equal(getRecord(profile, key).bestTime, 61.25);
  assert.equal(getRecord(profile, key).migrated, true);
});

test('round-trips a versioned record and settings', () => {
  const storage = createStorage();
  const profile = createEmptyProfile();
  profile.settings.muted = true;
  setRecord(profile, key, {
    bestTime: 54.2,
    bestSplits: [12.1, 24.4],
    crashes: 1,
    misses: 2,
    medal: 'gold'
  });

  assert.equal(saveProfile(storage, profile), true);
  const loaded = loadProfile(storage, { recordKey: key });

  assert.equal(loaded.settings.muted, true);
  assert.deepEqual(loaded.records[key].bestSplits, [12.1, 24.4]);
  assert.equal(loaded.records[key].misses, 2);
  assert.equal(loaded.records[key].medal, 'gold');
});

test('ignores malformed profile data without throwing', () => {
  const storage = createStorage({ [PROFILE_KEY]: '{not-json' });
  const profile = loadProfile(storage, { recordKey: key });

  assert.deepEqual(profile.records, {});
  assert.equal(profile.settings.muted, false);
});

test('normalizes comfort and audio settings', () => {
  const storage = createStorage({
    [PROFILE_KEY]: JSON.stringify({
      version: 1,
      settings: {
        muted: false,
        musicVolume: 2,
        effectsVolume: -1,
        bloom: 'high',
        flashing: 'normal'
      },
      records: {}
    })
  });
  const profile = loadProfile(storage, { recordKey: key });

  assert.equal(profile.settings.musicVolume, 1);
  assert.equal(profile.settings.effectsVolume, 0);
  assert.equal(profile.settings.bloom, 'high');
  assert.equal(profile.settings.flashing, 'normal');
});

test('does not load invalid record times', () => {
  const storage = createStorage({
    [PROFILE_KEY]: JSON.stringify({
      version: 1,
      settings: { muted: false },
      records: {
        [key]: { bestTime: -4, bestSplits: [1, 'bad', 2] }
      }
    })
  });
  const profile = loadProfile(storage, { recordKey: key });

  assert.equal(profile.records[key], undefined);
});

test('handles unavailable storage safely', () => {
  const profile = loadProfile(null, { recordKey: key });

  assert.equal(profile.records[key], undefined);
  assert.equal(saveProfile(null, profile), false);
});
