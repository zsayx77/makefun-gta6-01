// Velvet Bay — Street Heat: shared tuning numbers and story content.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;
export const ROADS_V = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_H = [200, 520, 840, 1160, 1480, 1800, 2120];
export const SAVE_KEY = 'velvet-bay-save-v1';
export const SEED = 1337;

export const PLAYER_START = { x: 600, y: 520 };
export const WALK_SPEED = 175;
export const RUN_SPEED = 305;
export const CAR_ACCEL = 340;
export const CAR_MAX_SPEED = 540;
export const CAR_REVERSE_MAX = 170;

export const MISSIONS = [
  {
    id: 1,
    name: 'The Pickup',
    short: 'Pick up the package at Harbor Dock',
    target: { x: 2950, y: 2150 },
    label: 'HARBOR DOCK',
    reward: 250,
    timer: 0,
  },
  {
    id: 2,
    name: 'The Drop',
    short: 'Deliver the package to North Market — 90 seconds on the clock!',
    target: { x: 500, y: 260 },
    label: 'NORTH MARKET',
    reward: 400,
    timer: 90,
  },
  {
    id: 3,
    name: 'Hot Wheels',
    short: 'Steal the gold Comet GT, then bring it to Sunset Garage',
    target: { x: 2650, y: 350 },
    label: 'SUNSET GARAGE',
    reward: 600,
    timer: 0,
    carTarget: { x: 1450, y: 1210 },
  },
  {
    id: 4,
    name: 'Lose the Heat',
    short: 'Lose the cops — get your wanted level down to zero',
    target: null,
    label: '',
    reward: 800,
    timer: 0,
  },
];

export const PALETTE = {
  grass: '#1d3320',
  grassAlt: '#224023',
  road: '#2b2f36',
  roadEdge: '#3a3f47',
  lane: '#c8b25a',
  sidewalk: '#4a4f57',
  building: '#5a6270',
  park: '#2c5a2e',
  carColors: ['#c0392b', '#2980b9', '#7f8c8d', '#e67e22', '#8e44ad', '#16a085', '#d4d4d4', '#2c3e50'],
};
