export const COLORS = {
  cyan: 0x00f0ff,
  magenta: 0xff2fd0,
  purple: 0x7a2cff,
  amber: 0xffbe3d,
  deep: 0x05010f,
  fog: 0x12062a
};

export const RING_COUNT = 30;
export const RING_RADIUS = 15;
export const RING_RADIUS_MIN = 12.5;
export const RING_RADIUS_MAX = 16.5;
export const RING_TUBE = 0.75;
export const CHECKPOINT_EVERY = 6;
export const COURSE_SEED = 1337;
export const COURSE_ID = 'downtown-dash';
export const COURSE_VERSION = 1;
export const PHYSICS_VERSION = 1;

export const START_POSITION = { x: 0, y: 72, z: 120 };
export const START_YAW = 0;
export const START_SPEED = 46;

export const PLANE_RADIUS = 2.6;
export const MIN_ALTITUDE = 4;

export const SIMULATION_HZ = 120;
export const SIMULATION_STEP = 1 / SIMULATION_HZ;
export const MAX_SIMULATION_STEPS = 30;
export const CRASH_PENALTY_SECONDS = 2;

export const PROFILE_KEY = 'neonflight.profile.v1';
export const BEST_KEY = 'neonflight.best';

// Provisional targets for the current course. Revisit them with real playtests.
export const MEDALS = [
  { id: 'neon', label: 'NEON', time: 48 },
  { id: 'gold', label: 'GOLD', time: 58 },
  { id: 'silver', label: 'SILVER', time: 70 },
  { id: 'bronze', label: 'BRONZE', time: 90 }
];
