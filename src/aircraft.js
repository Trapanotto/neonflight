import * as THREE from 'three';
import { COLORS } from './config.js';

export function createGhostAircraft() {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';

  const material = new THREE.MeshBasicMaterial({
    color: COLORS.cyan,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 5.2), material);
  body.position.z = 0.2;
  group.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 8), material);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.2;
  group.add(nose);

  const wings = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.16, 1.9), material);
  wings.position.z = 0.2;
  group.add(wings);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 0.8), material);
  tail.position.z = 2.7;
  group.add(tail);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.9), material);
  fin.position.set(0, 0.55, 2.8);
  group.add(fin);

  group.visible = false;

  return {
    group,
    applyTo(transform) {
      group.position.set(transform.x, transform.y, transform.z);
      group.rotation.set(transform.pitch, transform.yaw, transform.roll);
    }
  };
}

export function createAircraft() {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b1546,
    metalness: 0.72,
    roughness: 0.34,
    emissive: 0x0b0622,
    emissiveIntensity: 0.85
  });

  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e2668,
    metalness: 0.65,
    roughness: 0.4,
    emissive: 0x0b0622,
    emissiveIntensity: 0.5
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x061826,
    metalness: 1,
    roughness: 0.08,
    emissive: 0x11a7c4,
    emissiveIntensity: 1.5
  });

  const neonCyan = new THREE.MeshBasicMaterial({ color: COLORS.cyan, toneMapped: false });
  const neonMagenta = new THREE.MeshBasicMaterial({ color: COLORS.magenta, toneMapped: false });
  const neonAmber = new THREE.MeshBasicMaterial({ color: COLORS.amber, toneMapped: false });

  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.95, 7.4, 12),
    bodyMaterial
  );
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 2.4, 12),
    bodyMaterial
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.25;
  group.add(nose);

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 14, 10),
    glassMaterial
  );
  canopy.scale.set(1, 0.55, 1.7);
  canopy.position.set(0, 0.55, -1.5);
  group.add(canopy);

  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.16, 4.2),
    panelMaterial
  );
  spine.position.set(0, 0.5, 1.1);
  group.add(spine);

  const wings = new THREE.Group();
  group.add(wings);

  const wingGeometry = new THREE.BoxGeometry(4.6, 0.16, 2.6);

  const leftWing = new THREE.Mesh(wingGeometry, bodyMaterial);
  leftWing.position.set(-2.35, -0.05, 0.15);
  leftWing.rotation.y = 0.3;
  leftWing.rotation.z = 0.04;

  const rightWing = new THREE.Mesh(wingGeometry, bodyMaterial);
  rightWing.position.set(2.35, -0.05, 0.15);
  rightWing.rotation.y = -0.3;
  rightWing.rotation.z = -0.04;

  wings.add(leftWing, rightWing);

  const leftTip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 2.2), neonCyan);
  leftTip.position.set(-2.15, 0.02, 0);
  leftWing.add(leftTip);

  const rightTip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 2.2), neonMagenta);
  rightTip.position.set(2.15, 0.02, 0);
  rightWing.add(rightTip);

  const leadingStripe = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.1, 0.16), neonMagenta);
  leadingStripe.position.set(0, 0.03, -1.05);
  wings.add(leadingStripe);

  const tailFin = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 1.8, 1.6),
    bodyMaterial
  );
  tailFin.position.set(0, 0.95, 3.05);
  group.add(tailFin);

  const finNeon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 1.5), neonCyan);
  finNeon.position.set(0, 1.8, 3.05);
  group.add(finNeon);

  const stabilizer = new THREE.Mesh(
    new THREE.BoxGeometry(3.9, 0.14, 1.05),
    bodyMaterial
  );
  stabilizer.position.set(0, 0.12, 3.15);
  group.add(stabilizer);

  const stabilizerNeon = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.14), neonMagenta);
  stabilizerNeon.position.set(0, 0.2, 3.6);
  group.add(stabilizerNeon);

  const engineGlows = [];
  const flames = [];
  const engineGeometry = new THREE.CylinderGeometry(0.38, 0.46, 1.1, 10);
  const glowGeometry = new THREE.CircleGeometry(0.22, 18);
  const flameGeometry = new THREE.ConeGeometry(0.32, 2.2, 10);
  flameGeometry.rotateX(Math.PI / 2);

  const flameMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7a1a,
    toneMapped: false,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb066,
    toneMapped: false,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  [-1.15, 1.15].forEach((x) => {
    const engine = new THREE.Mesh(engineGeometry, panelMaterial);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, -0.18, 3.55);
    group.add(engine);

    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(x, -0.18, 4.12);
    group.add(glow);
    engineGlows.push(glow);

    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.position.set(x, -0.18, 5.0);
    group.add(flame);
    flames.push(flame);
  });

  const engineLight = new THREE.PointLight(0xff9a4d, 1.2, 26, 2);
  engineLight.position.set(0, 2.4, 2.6);
  group.add(engineLight);

  const spineNeon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3.6), neonCyan);
  spineNeon.position.set(0, 0.66, 0.75);
  group.add(spineNeon);

  const sideStripeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 5.2), neonCyan);
  sideStripeLeft.position.set(-0.9, 0.02, 0.2);
  group.add(sideStripeLeft);

  const sideStripeRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 5.2), neonMagenta);
  sideStripeRight.position.set(0.9, 0.02, 0.2);
  group.add(sideStripeRight);

  const underGlowLeft = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 4.6), neonCyan);
  underGlowLeft.position.set(-1.0, -0.62, 0.4);
  group.add(underGlowLeft);

  const underGlowRight = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 4.6), neonMagenta);
  underGlowRight.position.set(1.0, -0.62, 0.4);
  group.add(underGlowRight);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), neonAmber);
  beacon.position.set(0, 1.95, 3.05);
  group.add(beacon);

  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });

  return {
    group,
    engineGlows,
    update({ throttle, boost, speed, time }) {
      const flicker = 1 + Math.sin(time * 38) * 0.05;
      const length = (0.55 + throttle * 1.15 + boost * 1.9) * flicker;

      flameMaterial.opacity = 0.4 + throttle * 0.32 + boost * 0.18;
      flameMaterial.color.setHex(boost > 0.55 ? 0x86f8ff : 0xff7a1a);

      flames.forEach((flame, index) => {
        const width = 0.8 + throttle * 0.45 + Math.sin(time * 51 + index * 2.4) * 0.05;
        flame.scale.set(width, width, Math.max(0.3, length));
      });

      glowMaterial.opacity = 0.45 + throttle * 0.3 + boost * 0.1;
      glowMaterial.color.setHex(boost > 0.55 ? 0xbdfdff : 0xffb066);
      const glowScale = 0.6 + throttle * 0.4 + boost * 0.6;
      engineGlows.forEach((glow) => glow.scale.setScalar(glowScale));

      engineLight.intensity = 0.5 + throttle * 1.1 + boost * 1.4;
      engineLight.color.setHex(boost > 0.55 ? 0x00f0ff : 0xff9a4d);
    }
  };
}
