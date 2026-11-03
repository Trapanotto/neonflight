import * as THREE from 'three';
import {
  COLORS,
  RING_COUNT,
  RING_RADIUS,
  RING_TUBE,
  CHECKPOINT_EVERY,
  COURSE_SEED,
  START_POSITION,
  START_YAW
} from './config.js';
import { clamp, mulberry32 } from './utils.js';

function createRing(radius) {
  const group = new THREE.Group();

  const mainGeometry = new THREE.TorusGeometry(radius, RING_TUBE, 10, 56);
  const mainMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.magenta,
    toneMapped: false,
    fog: true,
    transparent: true,
    opacity: 0.95
  });
  const main = new THREE.Mesh(mainGeometry, mainMaterial);
  group.add(main);

  const glowGeometry = new THREE.TorusGeometry(radius, RING_TUBE * 4.5, 8, 40);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.magenta,
    toneMapped: false,
    fog: false,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  group.add(glow);

  return { group, main, glow, mainMaterial, glowMaterial };
}

export class Course {
  constructor(scene, seed = COURSE_SEED) {
    this.scene = scene;
    this.random = mulberry32(seed);
    this.group = new THREE.Group();
    scene.add(this.group);

    this.path = this.buildPath();
    this.rings = [];
    this.currentIndex = 0;
    this.previousPosition = null;
    this.checkpoint = {
      position: new THREE.Vector3(START_POSITION.x, START_POSITION.y, START_POSITION.z),
      yaw: START_YAW
    };

    this.buildRings();
    this.refreshColors();
  }

  buildPath() {
    const random = this.random;
    const start = new THREE.Vector3(START_POSITION.x, START_POSITION.y, START_POSITION.z);
    const path = [start];

    let heading = 0;
    let altitude = START_POSITION.y;

    for (let i = 0; i < RING_COUNT; i++) {
      const previous = path[path.length - 1];
      const step = 165 + random() * 60;

      heading += (random() - 0.5) * 0.42;
      heading += previous.x * 0.00025;
      heading = clamp(heading, -1.0, 1.0);

      altitude += (random() - 0.5) * 52;
      altitude = clamp(altitude, 48, 235);

      path.push(new THREE.Vector3(
        previous.x - Math.sin(heading) * step,
        altitude,
        previous.z - Math.cos(heading) * step
      ));
    }

    return path;
  }

  buildRings() {
    const dummy = new THREE.Object3D();

    for (let i = 1; i < this.path.length; i++) {
      const position = this.path[i];
      const previous = this.path[i - 1];
      const direction = new THREE.Vector3().subVectors(position, previous).normalize();

      const ring = createRing(RING_RADIUS);
      ring.group.position.copy(position);

      dummy.position.set(0, 0, 0);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
      ring.group.quaternion.copy(dummy.quaternion);

      ring.direction = direction;
      ring.position = position.clone();
      ring.yaw = Math.atan2(-direction.x, -direction.z);
      ring.passed = false;
      ring.index = i - 1;
      ring.visuals = ring;

      this.rings.push(ring);
      this.group.add(ring.group);
    }
  }

  refreshColors() {
    const nextColor = new THREE.Color(COLORS.cyan);
    const upcomingColor = new THREE.Color(COLORS.magenta).multiplyScalar(0.5);
    const passedColor = new THREE.Color(COLORS.purple).multiplyScalar(0.16);

    this.rings.forEach((ring, index) => {
      let tint;
      let opacity;

      if (index < this.currentIndex) {
        tint = passedColor;
        opacity = 0.25;
      } else if (index === this.currentIndex) {
        tint = nextColor;
        opacity = 1;
      } else {
        tint = upcomingColor;
        opacity = 0.75;
      }

      ring.mainMaterial.color.copy(tint);
      ring.mainMaterial.opacity = opacity;
      ring.glowMaterial.color.copy(tint);
      ring.glowMaterial.opacity = index === this.currentIndex ? 0.22 : 0.07;
      ring.group.scale.setScalar(1);
    });
  }

  reset() {
    this.currentIndex = 0;
    this.previousPosition = null;
    this.checkpoint = {
      position: new THREE.Vector3(START_POSITION.x, START_POSITION.y, START_POSITION.z),
      yaw: START_YAW
    };
    this.refreshColors();
  }

  getCheckpoint() {
    return this.checkpoint;
  }

  update(dt, time, planePosition) {
    const result = {
      passed: false,
      index: -1,
      checkpoint: false,
      refill: false,
      finished: false
    };

    if (this.currentIndex >= this.rings.length) return result;

    const ring = this.rings[this.currentIndex];

    ring.group.scale.setScalar(1 + Math.sin(time * 4.2) * 0.045);
    ring.main.rotation.z += dt * 0.4;
    ring.glow.rotation.z -= dt * 0.25;

    if (this.previousPosition) {
      const currentLocal = new THREE.Vector3().subVectors(planePosition, ring.position);
      const previousLocal = new THREE.Vector3().subVectors(this.previousPosition, ring.position);

      const currentAlong = currentLocal.dot(ring.direction);
      const previousAlong = previousLocal.dot(ring.direction);

      const currentRadial = Math.sqrt(Math.max(0, currentLocal.lengthSq() - currentAlong * currentAlong));

      const crossedPlane = previousAlong * currentAlong <= 0;
      const insideRing = currentRadial < RING_RADIUS * 1.18;
      const veryClose = currentLocal.length() < RING_RADIUS * 0.8;

      if ((crossedPlane && insideRing) || veryClose) {
        const completedIndex = this.currentIndex;
        ring.passed = true;
        this.currentIndex++;

        result.passed = true;
        result.index = completedIndex;
        result.refill = (completedIndex + 1) % CHECKPOINT_EVERY === 0;

        if (result.refill) {
          result.checkpoint = true;
          this.checkpoint = {
            position: ring.position.clone(),
            yaw: ring.yaw
          };
        }

        if (this.currentIndex >= this.rings.length) {
          result.finished = true;
        }

        this.refreshColors();
      }
    }

    this.previousPosition = planePosition.clone();
    return result;
  }
}
