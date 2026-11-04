import * as THREE from 'three';
import {
  COLORS,
  RING_COUNT,
  RING_RADIUS,
  RING_RADIUS_MAX,
  RING_RADIUS_MIN,
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
  constructor(scene, seed = COURSE_SEED, options = {}) {
    this.scene = scene;
    this.random = mulberry32(seed);
    this.tuning = {
      curveScale: 1,
      elevationScale: 1,
      stepScale: 1,
      radiusScale: 1,
      ...options
    };
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
    let curveDirection = random() < 0.5 ? 1 : -1;
    let curveRun = 2 + Math.floor(random() * 3);
    let verticalDirection = random() < 0.5 ? 1 : -1;
    let verticalRun = 2 + Math.floor(random() * 3);

    for (let i = 0; i < RING_COUNT; i++) {
      const previous = path[path.length - 1];
      const straightSection = i > 0 && i % 7 === 0;
      const baseStep = straightSection
        ? 200 + random() * 35
        : 150 + random() * 65;
      const step = baseStep * this.tuning.stepScale;

      if (curveRun <= 0) {
        curveDirection *= -1;
        curveRun = 2 + Math.floor(random() * 4);
      }
      if (verticalRun <= 0) {
        verticalDirection *= -1;
        verticalRun = 2 + Math.floor(random() * 3);
      }
      curveRun--;
      verticalRun--;

      const baseTurn = straightSection
        ? (random() - 0.5) * 0.06
        : curveDirection * (0.16 + random() * 0.28) + (random() - 0.5) * 0.1;

      heading += baseTurn * this.tuning.curveScale;
      heading += previous.x * 0.00035;
      if (Math.abs(heading) > 1.2) {
        curveDirection = -Math.sign(heading);
      }
      heading = clamp(heading, -1.25, 1.25);

      altitude += (
        verticalDirection * (20 + random() * 38) + (random() - 0.5) * 14
      ) * this.tuning.elevationScale;
      if (altitude > 225) {
        altitude = 225;
        verticalDirection = -1;
        verticalRun = 2 + Math.floor(random() * 3);
      } else if (altitude < 48) {
        altitude = 48;
        verticalDirection = 1;
        verticalRun = 2 + Math.floor(random() * 3);
      }
      altitude = clamp(altitude, 48, 225);

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
      const isCheckpoint = i % CHECKPOINT_EVERY === 0;
      const baseRadius = isCheckpoint
        ? RING_RADIUS
        : RING_RADIUS_MIN + this.random() * (RING_RADIUS_MAX - RING_RADIUS_MIN);
      const radius = baseRadius * this.tuning.radiusScale;

      const ring = createRing(radius);
      ring.radius = radius;
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
    const followColor = new THREE.Color(COLORS.amber).multiplyScalar(0.9);
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
      } else if (index === this.currentIndex + 1) {
        tint = followColor;
        opacity = 0.7;
      } else {
        tint = upcomingColor;
        opacity = 0.48;
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
    this.rings.forEach((ring) => {
      ring.passed = false;
    });
    this.refreshColors();
  }

  getCheckpoint() {
    return this.checkpoint;
  }

  update(dt, time, planePosition) {
    const result = {
      passed: false,
      missed: false,
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

      // A forward crossing always completes the current ring slot. Crossing
      // outside the aperture is a miss, but the run continues with the next
      // ring instead of forcing the player to turn back.
      const crossedForward = previousAlong < 0 && currentAlong >= 0;

      if (crossedForward) {
        const t = previousAlong / (previousAlong - currentAlong);
        const intersection = new THREE.Vector3()
          .lerpVectors(this.previousPosition, planePosition, t);
        const insideRing = intersection.distanceTo(ring.position) < ring.radius * 1.05;
        const completedIndex = this.currentIndex;

        ring.passed = insideRing;
        this.currentIndex++;

        result.passed = insideRing;
        result.missed = !insideRing;
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

    if (this.previousPosition) {
      this.previousPosition.copy(planePosition);
    } else {
      this.previousPosition = planePosition.clone();
    }
    return result;
  }
}
