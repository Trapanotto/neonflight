export const COURSES = [
  {
    id: 'downtown-dash',
    name: 'DOWNTOWN DASH',
    tagline: 'Low skyline. Wide lines. Learn the city.',
    difficulty: 'ROOKIE',
    seed: 1337,
    version: 1,
    tuning: {},
    medals: [
      { id: 'neon', label: 'NEON', time: 48 },
      { id: 'gold', label: 'GOLD', time: 58 },
      { id: 'silver', label: 'SILVER', time: 70 },
      { id: 'bronze', label: 'BRONZE', time: 90 }
    ]
  },
  {
    id: 'storm-circuit',
    name: 'STORM CIRCUIT',
    tagline: 'Tight turns. Violent climbs. No comfort line.',
    difficulty: 'EXPERT',
    seed: 18,
    version: 1,
    tuning: {
      curveScale: 1.15,
      elevationScale: 1.1,
      stepScale: 0.95,
      radiusScale: 0.9
    },
    medals: [
      { id: 'neon', label: 'NEON', time: 50 },
      { id: 'gold', label: 'GOLD', time: 62 },
      { id: 'silver', label: 'SILVER', time: 76 },
      { id: 'bronze', label: 'BRONZE', time: 98 }
    ]
  },
  {
    id: 'skyline-rush',
    name: 'SKYLINE RUSH',
    tagline: 'Long high-speed lines above the rooftops.',
    difficulty: 'ADVANCED',
    seed: 32,
    version: 1,
    tuning: {
      curveScale: 0.75,
      elevationScale: 0.8,
      stepScale: 1.12,
      radiusScale: 1.05
    },
    medals: [
      { id: 'neon', label: 'NEON', time: 53 },
      { id: 'gold', label: 'GOLD', time: 65 },
      { id: 'silver', label: 'SILVER', time: 78 },
      { id: 'bronze', label: 'BRONZE', time: 100 }
    ]
  }
];

export function getCourseById(id) {
  return COURSES.find((course) => course.id === id) || COURSES[0];
}
