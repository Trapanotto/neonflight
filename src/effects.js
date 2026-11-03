import * as THREE from 'three';

export class Rain {
  constructor(scene, count = 1700) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    this.range = { x: 320, y: 190, z: 320 };

    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * this.range.x;
      this.positions[i * 3 + 1] = Math.random() * this.range.y;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * this.range.z;
      this.speeds[i] = 110 + Math.random() * 90;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    this.material = new THREE.PointsMaterial({
      color: 0x9fdcff,
      size: 0.4,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(dt, cameraPosition) {
    const { x: rx, y: ry, z: rz } = this.range;
    const positions = this.positions;

    for (let i = 0; i < this.count; i++) {
      const ix = i * 3;
      positions[ix] += 22 * dt;
      positions[ix + 1] -= this.speeds[i] * dt;

      const dx = positions[ix] - cameraPosition.x;
      const dy = positions[ix + 1] - cameraPosition.y;
      const dz = positions[ix + 2] - cameraPosition.z;

      if (dy < -ry * 0.45) positions[ix + 1] += ry;
      if (dx > rx * 0.5) positions[ix] -= rx;
      if (dx < -rx * 0.5) positions[ix] += rx;
      if (dz > rz * 0.5) positions[ix + 2] -= rz;
      if (dz < -rz * 0.5) positions[ix + 2] += rz;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

export class CrashEffects {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
  }

  trigger(position) {
    const count = 90;
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      positions[ix] = 0;
      positions[ix + 1] = 0;
      positions[ix + 2] = 0;

      const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize().multiplyScalar(8 + Math.random() * 26);

      velocities.push(direction);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xff8a3d,
      size: 1.1,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    points.position.copy(position);
    points.frustumCulled = false;
    this.scene.add(points);

    const ringGeometry = new THREE.RingGeometry(2, 3.2, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff2fd0,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(position);
    this.scene.add(ring);

    this.bursts.push({
      points,
      ring,
      velocities,
      age: 0,
      duration: 1.1
    });
  }

  update(dt, camera) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      burst.age += dt;
      const progress = burst.age / burst.duration;

      if (progress >= 1) {
        this.scene.remove(burst.points);
        this.scene.remove(burst.ring);
        burst.points.geometry.dispose();
        burst.points.material.dispose();
        burst.ring.geometry.dispose();
        burst.ring.material.dispose();
        this.bursts.splice(i, 1);
        continue;
      }

      const positionAttribute = burst.points.geometry.attributes.position;
      for (let j = 0; j < burst.velocities.length; j++) {
        const velocity = burst.velocities[j];
        velocity.y -= 32 * dt;
        positionAttribute.array[j * 3] += velocity.x * dt;
        positionAttribute.array[j * 3 + 1] += velocity.y * dt;
        positionAttribute.array[j * 3 + 2] += velocity.z * dt;
      }
      positionAttribute.needsUpdate = true;

      burst.points.material.opacity = 0.95 * (1 - progress);

      burst.ring.scale.setScalar(1 + progress * 16);
      burst.ring.material.opacity = 0.9 * (1 - progress);
      burst.ring.lookAt(camera.position);
    }
  }
}
