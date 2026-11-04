import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { COURSES, getCourseById } from '../src/content/courses.js';
import { Course } from '../src/course.js';

function metrics(config) {
  const course = new Course(new THREE.Scene(), config.seed, config.tuning);
  let length = 0;
  let minAltitude = Number.POSITIVE_INFINITY;
  let maxAltitude = Number.NEGATIVE_INFINITY;
  let totalTurn = 0;
  let previousDirection = null;

  for (let i = 1; i < course.path.length; i++) {
    const direction = new THREE.Vector3()
      .subVectors(course.path[i], course.path[i - 1]);
    length += direction.length();
    minAltitude = Math.min(minAltitude, course.path[i].y);
    maxAltitude = Math.max(maxAltitude, course.path[i].y);

    direction.normalize();
    if (previousDirection) totalTurn += previousDirection.angleTo(direction);
    previousDirection = direction;
  }

  return {
    length,
    altitudeSpread: maxAltitude - minAltitude,
    totalTurn
  };
}

test('ships three distinct, valid courses', () => {
  assert.equal(COURSES.length, 3);
  assert.equal(new Set(COURSES.map((course) => course.id)).size, COURSES.length);
  assert.equal(new Set(COURSES.map((course) => course.seed)).size, COURSES.length);

  for (const course of COURSES) {
    assert.ok(course.name.length > 0);
    assert.ok(course.medals.length === 4);
    for (let i = 1; i < course.medals.length; i++) {
      assert.ok(course.medals[i - 1].time < course.medals[i].time);
    }
  }
});

test('course tuning produces different flight profiles', () => {
  const downtown = metrics(COURSES[0]);
  const storm = metrics(COURSES[1]);
  const skyline = metrics(COURSES[2]);

  assert.ok(storm.totalTurn > downtown.totalTurn);
  assert.ok(storm.altitudeSpread > downtown.altitudeSpread);
  assert.ok(skyline.length > downtown.length);
  assert.ok(skyline.totalTurn < downtown.totalTurn);
});

test('falls back to the first course for unknown ids', () => {
  assert.equal(getCourseById('missing').id, COURSES[0].id);
});
