import { PLANE_RADIUS } from './config.js';

const EPSILON = 1e-8;

export function segmentIntersectsAABB(start, end, min, max) {
  let tMin = 0;
  let tMax = 1;

  for (const axis of ['x', 'y', 'z']) {
    const origin = start[axis];
    const delta = end[axis] - origin;

    if (Math.abs(delta) < EPSILON) {
      if (origin < min[axis] || origin > max[axis]) return false;
      continue;
    }

    let near = (min[axis] - origin) / delta;
    let far = (max[axis] - origin) / delta;
    if (near > far) [near, far] = [far, near];

    tMin = Math.max(tMin, near);
    tMax = Math.min(tMax, far);
    if (tMin > tMax) return false;
  }

  return true;
}

export class BuildingCollisionIndex {
  constructor(buildings, { cellSize = 96, radius = PLANE_RADIUS } = {}) {
    this.buildings = buildings;
    this.cellSize = cellSize;
    this.radius = radius;
    this.cells = new Map();

    buildings.forEach((building) => {
      const entry = {
        building,
        bounds: this.getBuildingBounds(building)
      };
      const { bounds } = entry;
      const range = this.getCellRange(
        bounds.minX,
        bounds.maxX,
        bounds.minZ,
        bounds.maxZ
      );

      for (let ix = range.minX; ix <= range.maxX; ix++) {
        for (let iz = range.minZ; iz <= range.maxZ; iz++) {
          const key = this.getCellKey(ix, iz);
          let cell = this.cells.get(key);
          if (!cell) {
            cell = [];
            this.cells.set(key, cell);
          }
          cell.push(entry);
        }
      }
    });
  }

  getBuildingBounds(building) {
    const minX = building.x - building.width * 0.5 - this.radius;
    const maxX = building.x + building.width * 0.5 + this.radius;
    const minY = -this.radius;
    const maxY = building.height + this.radius;
    const minZ = building.z - building.depth * 0.5 - this.radius;
    const maxZ = building.z + building.depth * 0.5 + this.radius;

    return {
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }

  getCellRange(minX, maxX, minZ, maxZ) {
    return {
      minX: Math.floor(minX / this.cellSize),
      maxX: Math.floor(maxX / this.cellSize),
      minZ: Math.floor(minZ / this.cellSize),
      maxZ: Math.floor(maxZ / this.cellSize)
    };
  }

  getCellKey(ix, iz) {
    return `${ix}:${iz}`;
  }

  intersectsSegment(start, end) {
    const minX = Math.min(start.x, end.x) - this.radius;
    const maxX = Math.max(start.x, end.x) + this.radius;
    const minZ = Math.min(start.z, end.z) - this.radius;
    const maxZ = Math.max(start.z, end.z) + this.radius;
    const range = this.getCellRange(minX, maxX, minZ, maxZ);
    const checked = new Set();

    for (let ix = range.minX; ix <= range.maxX; ix++) {
      for (let iz = range.minZ; iz <= range.maxZ; iz++) {
        const cell = this.cells.get(this.getCellKey(ix, iz));
        if (!cell) continue;

        for (const entry of cell) {
          if (checked.has(entry)) continue;
          checked.add(entry);

          const { bounds } = entry;
          if (segmentIntersectsAABB(start, end, bounds.min, bounds.max)) {
            return true;
          }
        }
      }
    }

    return false;
  }
}
