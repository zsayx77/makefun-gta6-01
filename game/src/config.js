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

// Day / night: the clock starts at 09:00 and runs one game hour per 50 s.
export const DAY_START = 9.0;
export const DAY_HOURS_PER_SEC = 1 / 50;
export const DAY_PHASES = [
  { from: 6, to: 7, name: 'DAWN', tint: '#ff9a5c', alpha: 0.1 },
  { from: 7, to: 17, name: 'DAY', tint: '#ffd76a', alpha: 0.05 },
  { from: 17, to: 19, name: 'GOLDEN HOUR', tint: '#ff7a3c', alpha: 0.16 },
  { from: 19, to: 22, name: 'DUSK', tint: '#5a4a8a', alpha: 0.22 },
  { from: 22, to: 30, name: 'NIGHT', tint: '#0a1230', alpha: 0.34 },
];

// The bay: sand strip along the east edge, water beyond it, pier at the dock.
export const SAND_X0 = 3056;
export const SAND_X1 = 3130;
export const WATER_RECTS = [{ x: 3130, y: 0, w: 70, h: 2400 }];

// Helicopters arrive at wanted 4 (one) and 5 (two); shooting one down pays.
export const HELI_SPEED = 300;
export const HELI_HP = 3;
export const HELI_BOUNTY = 100;

// Pistol: unlocked by finishing mission 5; mouse aim, click to fire.
export const GUN_ARMED_INDEX = 5;
export const BULLET_SPEED = 900;
export const FIRE_CD = 0.22;

// Crew: each member joins after the named mission and grants a real bonus.
export const CREW = [
  { id: 'vex', name: 'Vex', role: 'Hacker', joinAfter: 2, bonus: 'Wanted cools 40% faster' },
  { id: 'rook', name: 'Rook', role: 'Getaway driver', joinAfter: 4, bonus: 'Top speed +12%, sharper steering' },
  { id: 'mara', name: 'Mara', role: 'Mechanic', joinAfter: 6, bonus: 'HP heals 3x faster, crashes hurt half' },
];

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
    brief: 'A crate came in on the night ferry. Collect it before the VCPD notices.',
    target: { x: 2950, y: 2150 },
    label: 'HARBOR DOCK',
    reward: 250,
    timer: 0,
  },
  {
    id: 2,
    name: 'The Drop',
    short: 'Deliver the package to North Market — 90 seconds on the clock!',
    brief: 'The buyer waits at North Market and does not wait long. Vex is watching the radios.',
    target: { x: 500, y: 260 },
    label: 'NORTH MARKET',
    reward: 400,
    timer: 90,
  },
  {
    id: 3,
    name: 'Hot Wheels',
    short: 'Steal the gold Comet GT, then bring it to Sunset Garage',
    brief: 'A gold Comet GT sits parked on 14th. Take it — the garage pays for shine.',
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
    brief: 'The VCPD is all over you. Break line of sight, lay low, let the heat die.',
    target: null,
    label: '',
    reward: 800,
    timer: 0,
    wantedOnStart: 2,
  },
  {
    id: 5,
    name: 'The Gun Runner',
    short: 'Pick up the gun crate on the Boardwalk — then the pistol is yours',
    brief: 'Rook knows a guy. A crate of hardware waits on the Boardwalk — arm yourself.',
    target: { x: 3090, y: 1480 },
    label: 'BOARDWALK',
    reward: 700,
    timer: 0,
    givesGun: true,
  },
  {
    id: 6,
    name: 'Three Stashes',
    short: 'Collect the three cash stashes: Palm Court, City Park, Boardwalk',
    brief: 'Mara stashed the crew fund in three spots. Sweep them all before the VCPD does.',
    target: null,
    label: '',
    reward: 900,
    timer: 0,
    stops: [
      { x: 2600, y: 700, label: 'PALM COURT' },
      { x: 1000, y: 1800, label: 'CITY PARK' },
      { x: 3090, y: 1000, label: 'BOARDWALK' },
    ],
  },
  {
    id: 7,
    name: 'The Tail',
    short: 'Tail the courier — stay close for 20 seconds, do not spook him',
    brief: 'A courier carries the Harbor ledger. Follow him, learn the route, stay invisible.',
    target: null,
    label: '',
    reward: 1000,
    timer: 0,
    tail: true,
    tailTime: 20,
    tailRange: 300,
  },
  {
    id: 8,
    name: 'The Getaway',
    short: 'Grab the bag at North Market, then reach the Safehouse — 120 seconds!',
    brief: 'One bag, one safehouse, every cop in the Bay behind you. Rook drives the plan.',
    target: null,
    label: '',
    reward: 1200,
    timer: 120,
    wantedOnStart: 3,
    stops: [
      { x: 500, y: 260, label: 'THE BAG' },
      { x: 500, y: 2000, label: 'SAFEHOUSE' },
    ],
  },
  {
    id: 9,
    name: 'King of the Bay',
    short: 'Steal the Aurora GT from the Boardwalk — the whole VCPD will come. Bring it to Sunset Garage.',
    brief: 'The Aurora GT gleams on the Boardwalk. Take it and the whole city comes with you — five stars, helicopters, everything. Finish the story.',
    target: { x: 2650, y: 350 },
    label: 'SUNSET GARAGE',
    reward: 2000,
    timer: 0,
    carTarget: { x: 3090, y: 1000 },
    aurora: true,
    wantedOnSteal: 5,
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
  sand: '#d9b380',
  sandDark: '#c9a06a',
  water: '#1f6fb2',
  waterDeep: '#175a8f',
  foam: '#eaf6ff',
  palm: '#2c7a3f',
  umbrella: ['#e74c3c', '#f1c40f', '#3498db', '#e67e22'],
  carColors: ['#c0392b', '#2980b9', '#7f8c8d', '#e67e22', '#8e44ad', '#16a085', '#d4d4d4', '#2c3e50'],
};
