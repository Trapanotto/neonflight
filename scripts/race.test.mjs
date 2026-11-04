import assert from 'node:assert/strict';
import test from 'node:test';
import { RaceSession, formatDelta, getMedal } from '../src/race.js';
import { COURSES } from '../src/content/courses.js';

test('advances race time only by simulation ticks', () => {
  const race = new RaceSession();

  race.tick(1 / 120);
  race.tick(1 / 120);
  race.tick(-1);
  race.tick(Number.NaN);

  assert.equal(race.time, 2 / 120);
  assert.equal(race.elapsed, 2 / 120);
});

test('adds a crash penalty and records the crash', () => {
  const race = new RaceSession({ crashPenalty: 2 });
  race.tick(10);
  race.addCrash();

  assert.equal(race.crashes, 1);
  assert.equal(race.penalty, 2);
  assert.equal(race.time, 12);
});

test('records missed rings without changing race time', () => {
  const race = new RaceSession();
  race.tick(5);
  race.addMiss();

  assert.equal(race.misses, 1);
  assert.equal(race.time, 5);
});

test('records sector splits including penalties', () => {
  const race = new RaceSession({ crashPenalty: 2 });
  race.tick(12);
  race.addCrash();
  const split = race.recordSector();

  assert.equal(split, 14);
  assert.deepEqual(race.sectorTimes, [14]);
});

test('selects the fastest reached medal', () => {
  const medals = COURSES[0].medals;
  assert.equal(getMedal(47, medals).id, 'neon');
  assert.equal(getMedal(52, medals).id, 'gold');
  assert.equal(getMedal(65, medals).id, 'silver');
  assert.equal(getMedal(82, medals).id, 'bronze');
  assert.equal(getMedal(100, medals), null);
});

test('formats signed race deltas', () => {
  assert.equal(formatDelta(-0.4), '\u22120.40s');
  assert.equal(formatDelta(1.25), '+1.25s');
  assert.equal(formatDelta(Number.POSITIVE_INFINITY), '');
});
