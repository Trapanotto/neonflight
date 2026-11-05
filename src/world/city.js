import * as THREE from 'three';
import { COLORS } from '../config.js';
import { clamp, distanceToSegment2D, mulberry32 } from '../utils.js';

const BILLBOARD_TEXTS = [
  'NEON',
  'SKYWAYS',
  'NIGHT\nCITY',
  '1984',
  'AETHER',
  'HYPER\nDRIVE',
  'VOLT',
  'RADIO\nFM',
  'DREAM',
  'OUTRUN',
  '// SYS.ON',
  'PULSE'
];

const NEON_PALETTES = [
  [COLORS.cyan, COLORS.magenta],
  [COLORS.magenta, COLORS.amber],
  [COLORS.cyan, COLORS.purple],
  [COLORS.amber, COLORS.cyan],
  [COLORS.purple, COLORS.magenta]
].map((palette) => palette.map((hex) => new THREE.Color(hex).multiplyScalar(1.65)));

function createBuildingTiers(width, depth, height, random) {
  const tiers = [];

  let count = 1;
  if (height > 70 && random() < 0.65) count = 2;
  if (count === 2 && height > 150 && random() < 0.45) count = 3;

  let remainingHeight = height;
  let tierWidth = width;
  let tierDepth = depth;
  let baseY = 0;

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    let tierHeight;

    if (isLast) {
      tierHeight = remainingHeight;
    } else {
      const share = count === 2
        ? 0.58 + random() * 0.16
        : (i === 0 ? 0.46 + random() * 0.12 : 0.24 + random() * 0.1);
      tierHeight = height * share;
      remainingHeight -= tierHeight;
    }

    tiers.push({
      width: tierWidth,
      depth: tierDepth,
      height: tierHeight,
      y: baseY
    });

    baseY += tierHeight;

    if (!isLast) {
      tierWidth = Math.max(9, tierWidth * (0.52 + random() * 0.18));
      tierDepth = Math.max(9, tierDepth * (0.52 + random() * 0.18));
    }
  }

  return tiers;
}

function makeBillboardTexture(text, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(6, 2, 18, 0.94)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 2;
  for (let y = 0; y < canvas.height; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 26;
  ctx.font = 'bold 86px "Courier New", monospace';

  const lines = text.split('\n');
  lines.forEach((line, index) => {
    const offset = (index - (lines.length - 1) / 2) * 92;
    ctx.fillText(line, canvas.width / 2, canvas.height / 2 + offset);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addNeonMaterial(intensity = 1.5) {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
}

function enableNeonWindows(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vNeonWorldPos;
      varying vec3 vNeonNormal;`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `vec4 worldPosition = vec4( transformed, 1.0 );
      #ifdef USE_BATCHING
        worldPosition = batchingMatrix * worldPosition;
      #endif
      #ifdef USE_INSTANCING
        worldPosition = instanceMatrix * worldPosition;
      #endif
      worldPosition = modelMatrix * worldPosition;
      vNeonWorldPos = worldPosition.xyz;
      vNeonNormal = normal;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vNeonWorldPos;
      varying vec3 vNeonNormal;

      float neonWindowHash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      vec3 facadeNormal = normalize(vNeonNormal);

      if (abs(facadeNormal.y) < 0.5) {
        vec2 faceUv = abs(facadeNormal.x) > abs(facadeNormal.z)
          ? vec2(vNeonWorldPos.z, vNeonWorldPos.y)
          : vec2(vNeonWorldPos.x, vNeonWorldPos.y);

        vec2 cellUv = faceUv / vec2(4.6, 6.0);
        vec2 cellId = floor(cellUv);
        vec2 cellFrac = fract(cellUv);

        float windowMask =
          step(0.22, cellFrac.x) * step(cellFrac.x, 0.78) *
          step(0.30, cellFrac.y) * step(cellFrac.y, 0.70);

        vec2 faceSeed = vec2(
          facadeNormal.x * 17.0 + facadeNormal.z * 31.0,
          facadeNormal.x * 7.0 - facadeNormal.z * 13.0
        );

        float floorLit = step(0.55, neonWindowHash(vec2(floor(faceUv.y / 6.0), faceSeed.x)));
        float lit = step(0.35, neonWindowHash(cellId + faceSeed));
        float tone = neonWindowHash(cellId + faceSeed + 19.0);
        vec3 windowColor = mix(vec3(0.04, 0.30, 0.45), vec3(0.50, 0.06, 0.34), tone);
        float intensity = 0.5 + neonWindowHash(cellId + faceSeed + 37.0) * 1.1;
        float windowFade = 1.0 - smoothstep(350.0, 1500.0, distance(cameraPosition, vNeonWorldPos));

        totalEmissiveRadiance += windowColor * (windowMask * lit * floorLit * intensity * 0.7 * windowFade);
      }`
    );
  };

  material.customProgramCacheKey = () => 'neon-building-windows-v1';
  return material;
}

function createGround() {
  const geometry = new THREE.PlaneGeometry(16000, 16000);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color(COLORS.fog) },
      uFogDensity: { value: 0.00135 },
      uCameraPos: { value: new THREE.Vector3() }
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform vec3 uCameraPos;
      varying vec3 vWorldPosition;

      float gridLine(vec2 coord, float thickness) {
        vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
        float line = min(grid.x, grid.y);
        return 1.0 - min(line * thickness, 1.0);
      }

      void main() {
        vec2 p = vWorldPosition.xz;
        float minor = gridLine(p / 16.0, 1.0);
        float major = gridLine(p / 96.0, 1.25);

        vec3 color = vec3(0.008, 0.004, 0.024);
        vec3 cyan = vec3(0.0, 0.70, 0.95);
        vec3 magenta = vec3(0.95, 0.06, 0.62);

        color += cyan * minor * 0.20;
        color += magenta * major * 0.30;

        float pulse = 0.5 + 0.5 * sin(uTime * 0.9 - (p.x + p.y) * 0.0025);
        color += cyan * minor * pulse * 0.06;

        vec3 viewDir = normalize(uCameraPos - vWorldPosition);
        float grazing = pow(1.0 - clamp(viewDir.y, 0.0, 1.0), 3.0);
        color += vec3(0.10, 0.02, 0.14) * grazing * 0.45;

        float dist = distance(p, uCameraPos.xz);
        float horizon = smoothstep(800.0, 4000.0, dist);
        vec3 farColor = mix(uFogColor, vec3(0.18, 0.018, 0.20), horizon * 0.7);

        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        color = mix(color, farColor, clamp(fogFactor, 0.0, 1.0));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    fog: false
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.6;
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  return mesh;
}

function addRooftopAntennas(group, buildings, random) {
  const antennas = [];

  buildings.forEach((building) => {
    if (building.height < 90 || random() > 0.38) return;

    const topTier = building.tiers[building.tiers.length - 1];
    antennas.push({
      x: building.x + (random() - 0.5) * Math.max(0, topTier.width - 8),
      z: building.z + (random() - 0.5) * Math.max(0, topTier.depth - 8),
      baseY: building.height,
      height: 8 + random() * 22,
      phase: Math.floor(random() * 3),
      color: building.palette[Math.floor(random() * building.palette.length)]
    });
  });

  if (antennas.length === 0) return [];

  const rodGeometry = new THREE.BoxGeometry(1, 1, 1);
  rodGeometry.translate(0, 0.5, 0);

  const rodMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
    fog: true
  });

  const rods = new THREE.InstancedMesh(rodGeometry, rodMaterial, antennas.length);
  const dummy = new THREE.Object3D();

  antennas.forEach((antenna, index) => {
    dummy.position.set(antenna.x, antenna.baseY - 0.25, antenna.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.55, antenna.height, 0.55);
    dummy.updateMatrix();
    rods.setMatrixAt(index, dummy.matrix);
    rods.setColorAt(index, antenna.color);
  });

  rods.instanceMatrix.needsUpdate = true;
  if (rods.instanceColor) rods.instanceColor.needsUpdate = true;
  rods.frustumCulled = false;
  group.add(rods);

  const beaconGeometry = new THREE.SphereGeometry(0.55, 6, 6);
  const beaconGroups = [];

  for (let phase = 0; phase < 3; phase++) {
    const items = antennas.filter((antenna) => antenna.phase === phase);

    if (items.length === 0) {
      beaconGroups.push(null);
      continue;
    }

    const material = new THREE.MeshBasicMaterial({
      color: 0xff3355,
      toneMapped: false,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const mesh = new THREE.InstancedMesh(beaconGeometry, material, items.length);

    items.forEach((antenna, index) => {
      dummy.position.set(antenna.x, antenna.baseY + antenna.height + 0.4, antenna.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    beaconGroups.push({ material });
  }

  return beaconGroups;
}

function addSkybridges(group, buildings, random, coursePaths, neonMaterial) {
  const courseDistance = (x, z) => {
    let best = Infinity;

    for (const path of coursePaths) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        best = Math.min(best, distanceToSegment2D(x, z, a.x, a.z, b.x, b.z));
      }
    }

    return best;
  };

  const bridges = [];
  const used = new Set();
  const ordered = buildings
    .map((building, index) => ({
      building,
      index,
      score: building.routeDistance + random() * 260
    }))
    .sort((a, b) => a.score - b.score);

  for (let oi = 0; oi < ordered.length && bridges.length < 18; oi++) {
    const { building: a, index: i } = ordered[oi];
    if (a.routeDistance > 450) break;
    if (used.has(i) || a.height < 65 || a.tiers[0].height < 35) continue;

    for (let oj = oi + 1; oj < ordered.length; oj++) {
      const { building: b, index: j } = ordered[oj];
      if (b.routeDistance > 450) break;
      if (used.has(j) || b.height < 65 || b.tiers[0].height < 35) continue;

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const distance = Math.hypot(dx, dz);

      if (distance < 55 || distance > 165) continue;
      if (Math.abs(dx) < Math.abs(dz) * 1.8 && Math.abs(dz) < Math.abs(dx) * 1.8) continue;
      if (Math.abs(a.height - b.height) > 55) continue;

      const axis = Math.abs(dx) > Math.abs(dz) ? 'x' : 'z';
      const span = axis === 'x'
        ? Math.abs(dx) - (a.width + b.width) * 0.5
        : Math.abs(dz) - (a.depth + b.depth) * 0.5;

      if (span < 10) continue;

      const x = (a.x + b.x) * 0.5;
      const z = (a.z + b.z) * 0.5;
      if (courseDistance(x, z) < 95) continue;

      const y = Math.min(a.tiers[0].height, b.tiers[0].height) * 0.68;
      if (y < 22) continue;

      bridges.push({
        x,
        z,
        y,
        axis,
        length: span + 4,
        color: a.palette[bridges.length % a.palette.length]
      });

      used.add(i);
      used.add(j);
      break;
    }
  }

  if (bridges.length === 0) return;

  const bridgeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const bridgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x151030,
    metalness: 0.55,
    roughness: 0.45,
    emissive: 0x0a0518,
    emissiveIntensity: 0.5
  });

  const bodies = new THREE.InstancedMesh(bridgeGeometry, bridgeMaterial, bridges.length);
  const glows = new THREE.InstancedMesh(bridgeGeometry, neonMaterial, bridges.length);
  const dummy = new THREE.Object3D();

  bridges.forEach((bridge, index) => {
    const alongX = bridge.axis === 'x';

    dummy.position.set(bridge.x, bridge.y, bridge.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(alongX ? bridge.length : 4.6, 3.2, alongX ? 4.6 : bridge.length);
    dummy.updateMatrix();
    bodies.setMatrixAt(index, dummy.matrix);

    dummy.position.set(bridge.x, bridge.y - 1.9, bridge.z);
    dummy.scale.set(alongX ? bridge.length : 0.55, 0.45, alongX ? 0.55 : bridge.length);
    dummy.updateMatrix();
    glows.setMatrixAt(index, dummy.matrix);
    glows.setColorAt(index, bridge.color);
  });

  bodies.instanceMatrix.needsUpdate = true;
  bodies.frustumCulled = false;
  group.add(bodies);

  glows.instanceMatrix.needsUpdate = true;
  if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
  glows.frustumCulled = false;
  group.add(glows);
}

function addLandmarks(group, buildings) {
  const sorted = buildings
    .filter((building) => building.height > 150)
    .map((building) => ({
      building,
      score: building.height - Math.min(building.routeDistance, 1200) * 0.35
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.building);

  const chosen = [];

  for (const building of sorted) {
    if (chosen.length >= 6) break;
    if (chosen.some((other) => Math.hypot(other.x - building.x, other.z - building.z) < 360)) continue;
    chosen.push(building);
  }

  const halos = [];

  chosen.forEach((building, index) => {
    const topTier = building.tiers[building.tiers.length - 1];
    const radius = Math.max(topTier.width, topTier.depth) * 0.85 + 8;
    const color = building.palette[index % building.palette.length];

    const haloGroup = new THREE.Group();
    haloGroup.position.set(building.x, building.height * 0.82, building.z);

    const ringGeometry = new THREE.TorusGeometry(radius, 1.1, 8, 48);
    const ringMaterial = new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: true });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    haloGroup.add(ring);

    const glowGeometry = new THREE.TorusGeometry(radius, 3.4, 8, 48);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.rotation.x = Math.PI / 2;
    haloGroup.add(glow);

    group.add(haloGroup);

    const spireMaterial = new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: true });
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(1.5, radius * 0.08), 26, 8, 1, true),
      spireMaterial
    );
    spire.position.set(building.x, building.height + 13, building.z);
    group.add(spire);

    halos.push({
      group: haloGroup,
      glow: glowMaterial,
      phase: index * 1.4
    });
  });

  return halos;
}

function addSearchlights(group, buildings, random) {
  const candidates = buildings
    .filter((building) => building.height > 150)
    .map((building) => ({ building, score: building.routeDistance + random() * 420 }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.building);

  const lights = [];

  for (const building of candidates) {
    if (lights.length >= 5) break;
    if (lights.some((light) => Math.hypot(light.x - building.x, light.z - building.z) < 360)) continue;

    const color = building.palette[lights.length % building.palette.length];
    const pivot = new THREE.Group();
    pivot.position.set(building.x, building.height + 3, building.z);

    const coneGeometry = new THREE.CylinderGeometry(48, 1.4, 250, 18, 1, true);
    const coneMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 0.075 }
      },
      vertexShader: /* glsl */ `
        varying vec2 vBeamUv;
        void main() {
          vBeamUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vBeamUv;
        void main() {
          float fade = smoothstep(0.0, 0.16, vBeamUv.y) * (1.0 - smoothstep(0.45, 1.0, vBeamUv.y));
          gl_FragColor = vec4(uColor, fade * uOpacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(coneGeometry, coneMaterial);
    beam.position.y = 125;
    pivot.add(beam);

    const sourceMaterial = new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: false });
    const source = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), sourceMaterial);
    pivot.add(source);

    group.add(pivot);

    lights.push({
      x: building.x,
      z: building.z,
      pivot,
      phase: random() * Math.PI * 2,
      speed: 0.15 + random() * 0.15,
      tilt: 0.18 + random() * 0.18,
      base: random() * Math.PI * 2
    });
  }

  return lights;
}

function createAirTraffic(group, bounds, cell, random) {
  const count = 220;
  const geometry = new THREE.BoxGeometry(14, 0.34, 0.45);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;

  const colors = [COLORS.cyan, COLORS.magenta, COLORS.amber, 0xffffff]
    .map((hex) => new THREE.Color(hex).multiplyScalar(1.8));

  const state = [];
  const dummy = new THREE.Object3D();
  const { minX, maxX, minZ, maxZ } = bounds;

  for (let i = 0; i < count; i++) {
    const axis = random() < 0.5 ? 'x' : 'z';
    const direction = random() < 0.5 ? 1 : -1;
    const lineZ = (Math.floor(minZ / cell) + Math.floor(random() * ((maxZ - minZ) / cell))) * cell;
    const lineX = (Math.floor(minX / cell) + Math.floor(random() * ((maxX - minX) / cell))) * cell;

    state.push({
      axis,
      line: axis === 'x' ? lineZ : lineX,
      value: axis === 'x'
        ? minX + random() * (maxX - minX)
        : minZ + random() * (maxZ - minZ),
      y: 22 + random() * 128,
      speed: 40 + random() * 60,
      direction,
      scale: 0.7 + random() * 1.3,
      phase: random() * Math.PI * 2
    });

    mesh.setColorAt(i, colors[Math.floor(random() * colors.length)]);
  }

  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);

  return (dt, elapsed) => {
    for (let i = 0; i < state.length; i++) {
      const car = state[i];
      car.value += car.speed * car.direction * dt;

      if (car.axis === 'x') {
        if (car.value > maxX) car.value = minX;
        if (car.value < minX) car.value = maxX;
        dummy.position.set(car.value, car.y + Math.sin(elapsed * 0.8 + car.phase) * 0.8, car.line);
        dummy.rotation.set(0, 0, 0);
      } else {
        if (car.value > maxZ) car.value = minZ;
        if (car.value < minZ) car.value = maxZ;
        dummy.position.set(car.line, car.y + Math.sin(elapsed * 0.8 + car.phase) * 0.8, car.value);
        dummy.rotation.set(0, Math.PI / 2, 0);
      }

      dummy.scale.set(car.scale, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  };
}

export function createCity(scene, coursePath, seed = 4242) {
  const random = mulberry32(seed);
  const group = new THREE.Group();
  scene.add(group);
  const coursePaths = Array.isArray(coursePath[0]) ? coursePath : [coursePath];
  let elapsed = 0;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const path of coursePaths) {
    for (const point of path) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    }
  }

  const margin = 520;
  minX -= margin;
  maxX += margin;
  minZ -= margin;
  maxZ += margin;

  const cell = 78;
  const startCellX = Math.floor(minX / cell);
  const endCellX = Math.ceil(maxX / cell);
  const startCellZ = Math.floor(minZ / cell);
  const endCellZ = Math.ceil(maxZ / cell);

  const CLEARANCE = 70;

  const courseDistance = (x, z) => {
    let best = Infinity;

    for (const path of coursePaths) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        best = Math.min(best, distanceToSegment2D(x, z, a.x, a.z, b.x, b.z));
      }
    }

    return best;
  };

  const buildings = [];

  for (let ix = startCellX; ix <= endCellX; ix++) {
    for (let iz = startCellZ; iz <= endCellZ; iz++) {
      if (random() < 0.18) continue;

      const x = ix * cell + (random() - 0.5) * 16;
      const z = iz * cell + (random() - 0.5) * 16;

      const routeDistance = courseDistance(x, z);
      if (routeDistance < CLEARANCE) continue;

      const distFromStart = Math.hypot(x, z - 120);
      if (distFromStart < 180) continue;

      const width = 26 + random() * 22;
      const depth = 26 + random() * 22;
      const t = random();
      const height = 34 + t * t * 285;

      const paletteIndex = ((ix * 7 + iz * 13) % NEON_PALETTES.length + NEON_PALETTES.length) % NEON_PALETTES.length;

      buildings.push({
        x,
        z,
        width,
        depth,
        height,
        routeDistance,
        tiers: createBuildingTiers(width, depth, height, random),
        palette: NEON_PALETTES[paletteIndex]
      });
    }
  }

  // ---------- Building bodies ----------
  const bodyGeometry = new THREE.BoxGeometry(1, 1, 1);
  bodyGeometry.translate(0, 0.5, 0);

  const bodyMaterial = enableNeonWindows(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.45,
    emissive: 0x120827,
    emissiveIntensity: 0.75
  }));

  const totalTiers = buildings.reduce((sum, building) => sum + building.tiers.length, 0);

  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, totalTiers);
  bodies.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  let bodyIndex = 0;

  buildings.forEach((building) => {
    const hue = 0.70 + random() * 0.10;
    const lightness = 0.035 + random() * 0.045;
    color.setHSL(hue, 0.55, lightness);

    building.tiers.forEach((tier) => {
      dummy.position.set(building.x, tier.y, building.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(tier.width, tier.height, tier.depth);
      dummy.updateMatrix();
      bodies.setMatrixAt(bodyIndex, dummy.matrix);
      bodies.setColorAt(bodyIndex, color);
      bodyIndex++;
    });
  });

  bodies.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  bodies.frustumCulled = false;
  group.add(bodies);

  // ---------- Vertical neon edges ----------
  const stripGeometry = new THREE.BoxGeometry(0.5, 1, 0.5);
  stripGeometry.translate(0, 0.5, 0);

  const corners = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1]
  ];

  const neonMaterial = addNeonMaterial();
  const strips = new THREE.InstancedMesh(stripGeometry, neonMaterial, totalTiers * 4);

  let stripIndex = 0;

  buildings.forEach((building) => {
    building.tiers.forEach((tier, tierIndex) => {
      corners.forEach(([sx, sz], cornerIndex) => {
        dummy.position.set(
          building.x + sx * (tier.width * 0.5 + 0.28),
          tier.y,
          building.z + sz * (tier.depth * 0.5 + 0.28)
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, tier.height, 1);
        dummy.updateMatrix();
        strips.setMatrixAt(stripIndex, dummy.matrix);

        const paletteColor = building.palette[(tierIndex + cornerIndex) % building.palette.length];
        strips.setColorAt(stripIndex, paletteColor);
        stripIndex++;
      });
    });
  });

  strips.instanceMatrix.needsUpdate = true;
  if (strips.instanceColor) strips.instanceColor.needsUpdate = true;
  strips.frustumCulled = false;
  group.add(strips);

  // ---------- Rooftop bands ----------
  const bandGeometry = new THREE.BoxGeometry(1, 1, 1);
  const bands = new THREE.InstancedMesh(bandGeometry, neonMaterial, totalTiers * 4);

  let bandIndex = 0;

  buildings.forEach((building) => {
    building.tiers.forEach((tier, tierIndex) => {
      const bandColor = building.palette[(tierIndex + 1) % building.palette.length];
      const y = tier.y + tier.height + 0.12;
      const sides = [
        { x: building.x, z: building.z + tier.depth * 0.5 + 0.24, sx: tier.width + 0.9, sz: 0.36 },
        { x: building.x, z: building.z - tier.depth * 0.5 - 0.24, sx: tier.width + 0.9, sz: 0.36 },
        { x: building.x + tier.width * 0.5 + 0.24, z: building.z, sx: 0.36, sz: tier.depth + 0.9 },
        { x: building.x - tier.width * 0.5 - 0.24, z: building.z, sx: 0.36, sz: tier.depth + 0.9 }
      ];

      sides.forEach((side) => {
        dummy.position.set(side.x, y, side.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(side.sx, 0.35, side.sz);
        dummy.updateMatrix();
        bands.setMatrixAt(bandIndex, dummy.matrix);
        bands.setColorAt(bandIndex, bandColor);
        bandIndex++;
      });
    });
  });

  bands.instanceMatrix.needsUpdate = true;
  if (bands.instanceColor) bands.instanceColor.needsUpdate = true;
  bands.frustumCulled = false;
  group.add(bands);

  // ---------- Billboards ----------
  const billboardCandidates = buildings
    .filter((building) => building.height > 70 && building.tiers[0].width > 28)
    .map((building) => ({ building, score: building.routeDistance + random() * 180 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 16)
    .map((entry) => entry.building);

  billboardCandidates.forEach((building, index) => {
    const text = BILLBOARD_TEXTS[index % BILLBOARD_TEXTS.length];
    const baseTier = building.tiers[0];
    const accentColor = building.palette[index % building.palette.length];
    const accent = `#${accentColor.getHexString()}`;
    const texture = makeBillboardTexture(text, accent);

    const width = Math.min(baseTier.width * 0.82, 34);
    const height = width * 0.5;
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });

    const billboard = new THREE.Mesh(geometry, material);
    billboard.position.set(
      building.x,
      clamp(baseTier.height * 0.58, 26, baseTier.height - height),
      building.z + baseTier.depth * 0.5 + 1.2
    );
    group.add(billboard);
  });

  // ---------- City details ----------
  const beaconGroups = addRooftopAntennas(group, buildings, random);
  addSkybridges(group, buildings, random, coursePaths, neonMaterial);
  const halos = addLandmarks(group, buildings);
  const searchlights = addSearchlights(group, buildings, random);

  // ---------- Infinite ground grid ----------
  const ground = createGround();
  if (scene.fog) {
    ground.material.uniforms.uFogColor.value.copy(scene.fog.color);
    ground.material.uniforms.uFogDensity.value = scene.fog.density;
  }
  group.add(ground);

  // ---------- Street traffic ----------
  const carCount = 260;
  const carGeometry = new THREE.BoxGeometry(1.7, 0.55, 3.6);
  const carMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
    fog: true
  });
  const cars = new THREE.InstancedMesh(carGeometry, carMaterial, carCount);
  cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cars.frustumCulled = false;

  const carColors = [
    new THREE.Color(COLORS.cyan).multiplyScalar(1.8),
    new THREE.Color(COLORS.magenta).multiplyScalar(1.8),
    new THREE.Color(COLORS.amber).multiplyScalar(1.5)
  ];

  const streetMinX = startCellX * cell;
  const streetMaxX = endCellX * cell;
  const streetMinZ = startCellZ * cell;
  const streetMaxZ = endCellZ * cell;

  const carState = [];
  const carDummy = new THREE.Object3D();

  for (let i = 0; i < carCount; i++) {
    const axis = random() < 0.5 ? 'x' : 'z';
    const direction = random() < 0.5 ? 1 : -1;

    if (axis === 'x') {
      const lineZ = (Math.floor(streetMinZ / cell) + Math.floor(random() * ((streetMaxZ - streetMinZ) / cell))) * cell;
      carState.push({
        axis,
        line: lineZ,
        value: streetMinX + random() * (streetMaxX - streetMinX),
        speed: 16 + random() * 34,
        direction
      });
    } else {
      const lineX = (Math.floor(streetMinX / cell) + Math.floor(random() * ((streetMaxX - streetMinX) / cell))) * cell;
      carState.push({
        axis,
        line: lineX,
        value: streetMinZ + random() * (streetMaxZ - streetMinZ),
        speed: 16 + random() * 34,
        direction
      });
    }

    cars.setColorAt(i, carColors[Math.floor(random() * carColors.length)]);
  }

  if (cars.instanceColor) cars.instanceColor.needsUpdate = true;
  group.add(cars);

  const updateCars = (dt) => {
    for (let i = 0; i < carState.length; i++) {
      const car = carState[i];
      car.value += car.speed * car.direction * dt;

      if (car.axis === 'x') {
        if (car.value > streetMaxX) car.value = streetMinX;
        if (car.value < streetMinX) car.value = streetMaxX;
        carDummy.position.set(car.value, 1.1, car.line);
        carDummy.rotation.set(0, Math.PI / 2, 0);
      } else {
        if (car.value > streetMaxZ) car.value = streetMinZ;
        if (car.value < streetMinZ) car.value = streetMaxZ;
        carDummy.position.set(car.line, 1.1, car.value);
        carDummy.rotation.set(0, 0, 0);
      }

      carDummy.updateMatrix();
      cars.setMatrixAt(i, carDummy.matrix);
    }
    cars.instanceMatrix.needsUpdate = true;
  };

  updateCars(0);

  const updateAirTraffic = createAirTraffic(
    group,
    { minX: streetMinX, maxX: streetMaxX, minZ: streetMinZ, maxZ: streetMaxZ },
    cell,
    random
  );

  return {
    group,
    buildings,
    update(dt, cameraPosition) {
      elapsed += dt;
      updateCars(dt);
      updateAirTraffic(dt, elapsed);

      beaconGroups.forEach((beaconGroup, index) => {
        if (!beaconGroup) return;
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.2 + index * 2.1);
        beaconGroup.material.opacity = 0.15 + pulse * 0.75;
      });

      halos.forEach((halo) => {
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.3 + halo.phase);
        halo.group.scale.setScalar(1 + pulse * 0.04);
        halo.glow.opacity = 0.08 + pulse * 0.08;
      });

      searchlights.forEach((light) => {
        const wave = elapsed * light.speed + light.phase;
        light.pivot.rotation.y = light.base + Math.sin(wave) * 0.85;
        light.pivot.rotation.z = Math.cos(wave * 0.8) * light.tilt;
        light.pivot.rotation.x = Math.sin(wave * 0.6) * light.tilt * 0.5;
      });

      ground.material.uniforms.uTime.value += dt;

      if (cameraPosition) {
        ground.position.x = cameraPosition.x;
        ground.position.z = cameraPosition.z;
        ground.material.uniforms.uCameraPos.value.copy(cameraPosition);
      }
    },
    dispose() {
      scene.remove(group);
      group.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (material.map) material.map.dispose();
            material.dispose();
          });
        }
      });
    }
  };
}
