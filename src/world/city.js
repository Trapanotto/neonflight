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

  const bodyMaterial = enableNeonWindows(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.45,
    emissive: 0x120827,
    emissiveIntensity: 0.75
  }));

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
        building.x + sx * (building.width * 0.5 + 0.28),
        0,
        building.z + sz * (building.depth * 0.5 + 0.28)
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
  const bands = new THREE.InstancedMesh(bandGeometry, neonMaterial, buildings.length * 4);
  const amber = new THREE.Color(COLORS.amber).multiplyScalar(1.4);

  let bandIndex = 0;

  buildings.forEach((building) => {
    const value = random();
    let bandColor = cyan;
    if (value >= 0.55 && value < 0.85) {
      bandColor = magenta;
    } else if (value >= 0.85) {
      bandColor = amber;
    }

    const y = building.height + 0.12;
    const sides = [
      { x: building.x, z: building.z + building.depth * 0.5 + 0.24, sx: building.width + 0.9, sz: 0.36 },
      { x: building.x, z: building.z - building.depth * 0.5 - 0.24, sx: building.width + 0.9, sz: 0.36 },
      { x: building.x + building.width * 0.5 + 0.24, z: building.z, sx: 0.36, sz: building.depth + 0.9 },
      { x: building.x - building.width * 0.5 - 0.24, z: building.z, sx: 0.36, sz: building.depth + 0.9 }
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
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });

    const billboard = new THREE.Mesh(geometry, material);
    billboard.position.set(
      building.x,
      clamp(building.height * 0.62, 26, building.height - height * 0.8),
      building.z + building.depth * 0.5 + 1.2
    );
    group.add(billboard);
  });

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

  return {
    group,
    buildings,
    update(dt, cameraPosition) {
      updateCars(dt);

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
