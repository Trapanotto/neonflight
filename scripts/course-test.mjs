import * as THREE from 'three';
import { Course } from '../src/course.js';
import { CHECKPOINT_EVERY, RING_COUNT } from '../src/config.js';

const scene = new THREE.Scene();
const course = new Course(scene);

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

const expectedCheckpoints = Math.floor(RING_COUNT / CHECKPOINT_EVERY);
const results = [
  ['rings generated', course.rings.length === RING_COUNT],
  ['all rings passed', passed === RING_COUNT],
  ['course finished', finished === true],
  ['checkpoints stored', checkpoints === expectedCheckpoints],
  ['rings have yaw', course.rings.every((ring) => Number.isFinite(ring.yaw))]
];

let failed = false;
for (const [name, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed = true;
}

course.reset();
const resetOk = course.currentIndex === 0 && course.getCheckpoint().position.y > 0;
console.log(`${resetOk ? 'PASS' : 'FAIL'}  reset restores start checkpoint`);
if (!resetOk) failed = true;

if (failed) process.exitCode = 1;
