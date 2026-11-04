import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BuildingCollisionIndex, segmentIntersectsAABB } from '../src/collision.js';

const buildings = [
  { x: 0, z: 0, width: 20, depth: 20, height: 100 },
  { x: 300, z: 0, width: 30, depth: 30, height: 80 }
];
const index = new BuildingCollisionIndex(buildings, { cellSize: 64, radius: 2.6 });

function point(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

test('detects a segment through a building', () => {
  assert.equal(index.intersectsSegment(point(0, 50, -40), point(0, 50, 40)), true);
});

test('detects a segment ending inside a building', () => {
  assert.equal(index.intersectsSegment(point(0, 50, -40), point(0, 50, 0)), true);
});

test('ignores a segment passing above a building', () => {
  assert.equal(index.intersectsSegment(point(0, 150, -40), point(0, 150, 40)), false);
});

test('ignores a segment passing beside a building', () => {
  assert.equal(index.intersectsSegment(point(40, 50, -40), point(40, 50, 40)), false);
});

test('finds a building in a neighbouring spatial cell', () => {
  assert.equal(index.intersectsSegment(point(300, 40, -50), point(300, 40, 50)), true);
});

test('AABB slab test handles parallel and diagonal segments', () => {
  const min = { x: -1, y: -1, z: -1 };
  const max = { x: 1, y: 1, z: 1 };

  assert.equal(segmentIntersectsAABB(point(-5, 0, 0), point(5, 0, 0), min, max), true);
  assert.equal(segmentIntersectsAABB(point(-5, 5, 0), point(5, 5, 0), min, max), false);
  assert.equal(segmentIntersectsAABB(point(-5, -5, -5), point(5, 5, 5), min, max), true);
});
