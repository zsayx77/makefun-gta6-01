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

// The bay along the east edge: sand, then open water. Water blocks movement.
export const SAND_X = 3060;
export const WATER_X = 3140;
export const BOARDWALK_X = 3080;

// Dax's crew — all three ride with you from the start, bonuses always on.
export const CREW = [
  { name: 'Vex', role: 'Lookout', perk: 'Wanted cools 40% faster' },
  { name: 'Rook', role: 'Driver', perk: '+12% top speed, sharper steering' },
  { name: 'Mara', role: 'Medic', perk: 'Heals 3x faster, half crash damage' },
];

// The pistol unlocks once five missions are done.
export const PISTOL_UNLOCK_MISSIONS = 5;
export const HELI_REWARD = 100;
export const HELI_HP = 3;

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
  {
    id: 5,
    name: 'The Gun Runner',
    short: 'Pick up the weapons cache, then drop it at the buyer',
    target: null,
    label: '',
    reward: 900,
    timer: 0,
    stops: [
      { x: 1800, y: 2200, label: 'WEAPONS CACHE' },
      { x: 600, y: 200, label: 'DROP POINT' },
    ],
  },
  {
    id: 6,
    name: 'Three Stashes',
    short: 'Collect the three stashes hidden around Velvet Bay',
    target: null,
    label: '',
    reward: 1000,
    timer: 0,
    stops: [
      { x: 600, y: 1800, label: 'STASH 1' },
      { x: 2600, y: 600, label: 'STASH 2' },
      { x: 1400, y: 2600, label: 'STASH 3' },
    ],
  },
  {
    id: 7,
    name: 'The Tail',
    short: 'Tail the courier for 20 seconds — too close or too far and he bolts',
    target: null,
    label: '',
    reward: 1200,
    timer: 0,
  },
  {
    id: 8,
    name: 'The Getaway',
    short: 'Hit wanted level 3 and survive the heat for 120 seconds',
    target: null,
    label: '',
    reward: 1500,
    timer: 0,
  },
  {
    id: 9,
    name: 'King of the Bay',
    short: 'Steal the Aurora GT and bring it to Sunset Garage',
    target: { x: 2650, y: 350 },
    label: 'SUNSET GARAGE',
    reward: 2500,
    timer: 0,
    carTarget: { x: 2400, y: 1160 },
  },
  {
    id: 10,
    name: 'The Vault',
    short: 'Crack the Bay National vault — hold the bank for 30 seconds, then run to Sunset Garage',
    target: { x: 2650, y: 350 },
    label: 'SUNSET GARAGE',
    reward: 3000,
    timer: 0,
    bank: { x: 1000, y: 840, label: 'BAY NATIONAL BANK' },
    holdSeconds: 30,
    vaultCash: 500,
  },
];

// The Vault (mission 10): hold the bank while the vault cracks, then run.
// Three escape routes out of downtown — the north one is the fastest, so
// Dax's crew weights it heaviest when picking the getaway.
export const VAULT_HOLD_SECONDS = 30;
export const VAULT_CASH = 500;
export const VAULT_BANK = { x: 1000, y: 840, label: 'BAY NATIONAL BANK' };
export const VAULT_GARAGE = { x: 2650, y: 350, label: 'SUNSET GARAGE' };
export const VAULT_ESCAPE_ROUTES = [
  { name: 'North Run', weight: 5, via: [{ x: 1000, y: 200 }, { x: 2600, y: 200 }] },
  { name: 'West Run', weight: 3, via: [{ x: 200, y: 840 }, { x: 200, y: 200 }, { x: 2600, y: 200 }] },
  { name: 'South Run', weight: 2, via: [{ x: 1000, y: 1800 }, { x: 2600, y: 1800 }] },
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
  sand: '#c2a878',
  water: '#1b5f7a',
  waterDeep: '#134a61',
  boardwalk: '#8a6d3b',
  carColors: ['#c0392b', '#2980b9', '#7f8c8d', '#e67e22', '#8e44ad', '#16a085', '#d4d4d4', '#2c3e50'],
};
