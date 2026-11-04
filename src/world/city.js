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

function makeGridTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#05010f';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);

  ctx.strokeStyle = 'rgba(255, 47, 208, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(220, 220);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
    fog: true
  });
}

export function createCity(scene, coursePath, seed = 4242) {
  const random = mulberry32(seed);
  const group = new THREE.Group();
  scene.add(group);
  const coursePaths = Array.isArray(coursePath[0]) ? coursePath : [coursePath];

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

  const nearCourse = (x, z) => {
    for (const path of coursePaths) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        if (distanceToSegment2D(x, z, a.x, a.z, b.x, b.z) < CLEARANCE) return true;
      }
    }
    return false;
  };

  const buildings = [];

  for (let ix = startCellX; ix <= endCellX; ix++) {
    for (let iz = startCellZ; iz <= endCellZ; iz++) {
      if (random() < 0.18) continue;

      const x = ix * cell + (random() - 0.5) * 16;
      const z = iz * cell + (random() - 0.5) * 16;

      if (nearCourse(x, z)) continue;

      const distFromStart = Math.hypot(x, z - 120);
      if (distFromStart < 180) continue;

      const width = 26 + random() * 22;
      const depth = 26 + random() * 22;
      const t = random();
      const height = 34 + t * t * 285;

      buildings.push({ x, z, width, depth, height });
    }
  }

  // ---------- Building bodies ----------
  const bodyGeometry = new THREE.BoxGeometry(1, 1, 1);
  bodyGeometry.translate(0, 0.5, 0);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.45,
    emissive: 0x120827,
    emissiveIntensity: 0.75
  });

  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, buildings.length);
  bodies.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  buildings.forEach((building, index) => {
    dummy.position.set(building.x, 0, building.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(building.width, building.height, building.depth);
    dummy.updateMatrix();
    bodies.setMatrixAt(index, dummy.matrix);

    const hue = 0.70 + random() * 0.10;
    const lightness = 0.035 + random() * 0.045;
    color.setHSL(hue, 0.55, lightness);
    bodies.setColorAt(index, color);
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
  const strips = new THREE.InstancedMesh(stripGeometry, neonMaterial, buildings.length * 4);
  const cyan = new THREE.Color(COLORS.cyan).multiplyScalar(1.7);
  const magenta = new THREE.Color(COLORS.magenta).multiplyScalar(1.7);

  let stripIndex = 0;
  buildings.forEach((building, buildingIndex) => {
    corners.forEach(([sx, sz], cornerIndex) => {
      dummy.position.set(
        building.x + sx * building.width * 0.5,
        0,
        building.z + sz * building.depth * 0.5
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, building.height, 1);
      dummy.updateMatrix();
      strips.setMatrixAt(stripIndex, dummy.matrix);

      const useCyan = (buildingIndex + cornerIndex) % 2 === 0;
      strips.setColorAt(stripIndex, useCyan ? cyan : magenta);
      stripIndex++;
    });
  });

  strips.instanceMatrix.needsUpdate = true;
  if (strips.instanceColor) strips.instanceColor.needsUpdate = true;
  strips.frustumCulled = false;
  group.add(strips);

  // ---------- Rooftop bands ----------
  const bandGeometry = new THREE.BoxGeometry(1, 1, 1);
  const bands = new THREE.InstancedMesh(bandGeometry, neonMaterial, buildings.length);
  const amber = new THREE.Color(COLORS.amber).multiplyScalar(1.4);

  buildings.forEach((building, index) => {
    dummy.position.set(building.x, building.height - 0.3, building.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(building.width + 0.8, 0.6, building.depth + 0.8);
    dummy.updateMatrix();
    bands.setMatrixAt(index, dummy.matrix);

    const value = random();
    if (value < 0.55) {
      bands.setColorAt(index, cyan);
    } else if (value < 0.85) {
      bands.setColorAt(index, magenta);
    } else {
      bands.setColorAt(index, amber);
    }
  });

  bands.instanceMatrix.needsUpdate = true;
  if (bands.instanceColor) bands.instanceColor.needsUpdate = true;
  bands.frustumCulled = false;
  group.add(bands);

  // ---------- Billboards ----------
  const billboardCandidates = buildings
    .filter((building) => building.height > 80 && building.width > 30)
    .sort(() => random() - 0.5)
    .slice(0, Math.min(14, BILLBOARD_TEXTS.length + 2));

  billboardCandidates.forEach((building, index) => {
    const text = BILLBOARD_TEXTS[index % BILLBOARD_TEXTS.length];
    const accent = index % 2 === 0 ? '#00f0ff' : '#ff2fd0';
    const texture = makeBillboardTexture(text, accent);

    const width = Math.min(building.width * 0.82, 34);
    const height = width * 0.5;
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
      fog: true
    });

    const billboard = new THREE.Mesh(geometry, material);
    billboard.position.set(
      building.x,
      clamp(building.height * 0.62, 26, building.height - height * 0.8),
      building.z + building.depth * 0.5 + 1.2
    );
    group.add(billboard);
  });

  // ---------- Ground grid ----------
  const groundGeometry = new THREE.PlaneGeometry(9000, 9000);
  const groundMaterial = new THREE.MeshBasicMaterial({
    map: makeGridTexture(),
    color: 0xffffff,
    toneMapped: false,
    fog: true
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.2;
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

  return {
    group,
    buildings,
    update(dt) {
      updateCars(dt);
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
