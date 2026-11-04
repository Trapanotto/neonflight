import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { Course } from '../src/course.js';
import {
  CHECKPOINT_EVERY,
  RING_COUNT,
  RING_RADIUS_MAX,
  RING_RADIUS_MIN
} from '../src/config.js';

function createCourse() {
  return new Course(new THREE.Scene());
}

function crossRing(course, start, end) {
  course.previousPosition = null;
  course.update(1 / 60, 0, start);
  return course.update(1 / 60, 1 / 60, end);
}

test('generates and completes the seeded course in order', () => {
  const course = createCourse();
  let passed = 0;
  let checkpoints = 0;
  let finished = false;
  const stepsPerSegment = 24;

  for (let i = 0; i < RING_COUNT; i++) {
    const from = course.path[i];
    const to = course.path[i + 1];

    for (let step = 1; step <= stepsPerSegment; step++) {
      const position = new THREE.Vector3().lerpVectors(from, to, step / stepsPerSegment);
      const event = course.update(1 / 60, step / 60, position);

      if (event.passed) {
        passed++;
        if (event.checkpoint) checkpoints++;
        if (event.finished) finished = true;
      }
    }
  }

  assert.equal(course.rings.length, RING_COUNT);
  assert.equal(passed, RING_COUNT);
  assert.equal(finished, true);
  assert.equal(checkpoints, Math.floor(RING_COUNT / CHECKPOINT_EVERY));
  assert.ok(course.rings.every((ring) => Number.isFinite(ring.yaw)));
});

test('provides meaningful turns, elevation changes and varied ring sizes', () => {
  const course = createCourse();
  const altitudes = course.path.slice(1).map((point) => point.y);
  let totalTurn = 0;
  let previousDirection = null;

  for (let i = 1; i < course.path.length; i++) {
    const direction = new THREE.Vector3()
      .subVectors(course.path[i], course.path[i - 1])
      .normalize();

    if (previousDirection) {
      totalTurn += previousDirection.angleTo(direction);
    }
    previousDirection = direction;
  }

  assert.ok(Math.max(...altitudes) - Math.min(...altitudes) >= 100);
  assert.ok(totalTurn >= 5);
  assert.ok(course.rings.every((ring) => (
    ring.radius >= RING_RADIUS_MIN && ring.radius <= RING_RADIUS_MAX
  )));
  assert.ok(new Set(course.rings.map((ring) => ring.radius.toFixed(1))).size >= 4);
});

test('does not count crossing a ring backwards', () => {
  const course = createCourse();
  const ring = course.rings[0];
  const start = ring.position.clone().addScaledVector(ring.direction, 20);
  const end = ring.position.clone().addScaledVector(ring.direction, -20);
  const event = crossRing(course, start, end);

  assert.equal(event.passed, false);
  assert.equal(course.currentIndex, 0);
});

test('marks a forward crossing outside the ring as missed and continues', () => {
  const course = createCourse();
  const ring = course.rings[0];
  const lateral = new THREE.Vector3()
    .crossVectors(ring.direction, new THREE.Vector3(0, 1, 0))
    .normalize();
  const start = ring.position.clone()
    .addScaledVector(ring.direction, -20)
    .addScaledVector(lateral, 30);
  const end = ring.position.clone()
    .addScaledVector(ring.direction, 20)
    .addScaledVector(lateral, 30);
  const event = crossRing(course, start, end);

  assert.equal(event.passed, false);
  assert.equal(event.missed, true);
  assert.equal(event.index, 0);
  assert.equal(course.currentIndex, 1);
});

test('still completes checkpoints and the course after missed rings', () => {
  const course = createCourse();
  let misses = 0;
  let checkpoints = 0;
  let finished = false;

  for (let i = 0; i < RING_COUNT; i++) {
    const ring = course.rings[i];
    const lateral = new THREE.Vector3()
      .crossVectors(ring.direction, new THREE.Vector3(0, 1, 0))
      .normalize()
      .multiplyScalar(30);
    const start = ring.position.clone()
      .addScaledVector(ring.direction, -20)
      .add(lateral);
    const end = ring.position.clone()
      .addScaledVector(ring.direction, 20)
      .add(lateral);
    const event = crossRing(course, start, end);

    if (event.missed) misses++;
    if (event.checkpoint) checkpoints++;
    if (event.finished) finished = true;
  }

  assert.equal(misses, RING_COUNT);
  assert.equal(checkpoints, Math.floor(RING_COUNT / CHECKPOINT_EVERY));
  assert.equal(finished, true);
});

test('detects a valid crossing across a very large simulation step', () => {
  const course = createCourse();
  const ring = course.rings[0];
  const start = ring.position.clone().addScaledVector(ring.direction, -80);
  const end = ring.position.clone().addScaledVector(ring.direction, 80);
  const event = crossRing(course, start, end);

  assert.equal(event.passed, true);
  assert.equal(course.currentIndex, 1);
});

test('reset restores rings, checkpoint and progress', () => {
  const course = createCourse();
  const ring = course.rings[0];
  const start = ring.position.clone().addScaledVector(ring.direction, -20);
  const end = ring.position.clone().addScaledVector(ring.direction, 20);
  crossRing(course, start, end);

  course.reset();

  assert.equal(course.currentIndex, 0);
  assert.equal(course.getCheckpoint().position.y > 0, true);
  assert.ok(course.rings.every((item) => item.passed === false));
});
