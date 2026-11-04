import * as THREE from 'three';
import { MIN_ALTITUDE } from './config.js';
import { clamp, damp } from './utils.js';

export class FlightModel {
  constructor() {
    this.position = new THREE.Vector3();
    this.previousPosition = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.boost = 1;
    this.boosting = false;
    this.grace = 0;
  }

  reset(position, yaw, speed = 46) {
    this.position.copy(position);
    this.previousPosition.copy(position);
    this.yaw = yaw;
    this.pitch = 0;
    this.roll = 0;
    this.speed = speed;
    this.throttle = 0.62;
    this.boost = 1;
    this.boosting = false;
    this.grace = 1.2;
  }

  respawn(position, yaw, speed = 52) {
    this.position.copy(position);
    this.previousPosition.copy(position);
    this.yaw = yaw;
    this.pitch = 0;
    this.roll = 0;
    this.speed = speed;
    this.throttle = 0.7;
    this.boosting = false;
    this.grace = 1.2;
  }

  getForward(target = new THREE.Vector3()) {
    const cosPitch = Math.cos(this.pitch);
    return target.set(
      -Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cosPitch
    );
  }

  update(dt, input) {
    const wasBoosting = this.boosting;
    this.previousPosition.copy(this.position);

    this.throttle = clamp(
      this.throttle + ((input.throttleUp ? 1 : 0) - (input.throttleDown ? 1 : 0)) * 0.8 * dt,
      0,
      1
    );

    const wantsBoost = input.boost && this.boost > 0.02 && this.throttle > 0.12;
    this.boosting = wantsBoost;

    if (wantsBoost) {
      this.boost = Math.max(0, this.boost - 0.3 * dt);
    } else {
      this.boost = Math.min(1, this.boost + 0.11 * dt);
    }

    const targetSpeed = 42 + this.throttle * 96 + (this.boosting ? 64 : 0);
    this.speed = damp(this.speed, targetSpeed, 0.85, dt);

    const speedAuthority = clamp(this.speed / 45, 0.45, 1);
    const pitchInput = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
    const desiredPitch = pitchInput * 0.6 * speedAuthority;
    this.pitch = damp(this.pitch, desiredPitch, 2.2, dt);

    const rollInput = (input.rollLeft ? 1 : 0) - (input.rollRight ? 1 : 0);
    const desiredRoll = rollInput * 0.88;
    this.roll = damp(this.roll, desiredRoll, 3.0, dt);

    const turnRate = Math.sin(this.roll) * (0.62 + this.speed * 0.0042);
    this.yaw += turnRate * dt;

    const cosPitch = Math.cos(this.pitch);
    this.position.x -= Math.sin(this.yaw) * cosPitch * this.speed * dt;
    this.position.z -= Math.cos(this.yaw) * cosPitch * this.speed * dt;
    this.position.y += Math.sin(this.pitch) * this.speed * dt;

    if (this.grace > 0) this.grace = Math.max(0, this.grace - dt);

    let crashed = false;
    if (this.position.y <= MIN_ALTITUDE) {
      this.position.y = MIN_ALTITUDE;
      crashed = true;
    }

    return {
      crashed,
      boostStarted: this.boosting && !wasBoosting,
      boostEnded: !this.boosting && wasBoosting,
      speedRatio: clamp((this.speed - 42) / 160, 0, 1)
    };
  }

  applyTo(object) {
    object.position.copy(this.position);
    object.rotation.set(this.pitch, this.yaw, this.roll);
  }
}
