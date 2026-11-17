// Velvet Bay — Street Heat. An original open-world crime game (2D top-down).
// All tuning numbers and colours in one place. The canvas shows a fixed
// 1280x720 logical view; the camera pans over a 3200x2400 city.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const WORLD = { width: 3200, height: 2400 };
export const ROAD_W = 140;
/** Road centre lines: a grid the whole city is built on. */
export const ROADS_X = [300, 700, 1100, 1500, 1900, 2300, 2700];
export const ROADS_Y = [300, 700, 1100, 1500, 1900];
/** The harbour water starts here; the docks pier sticks out into it. */
export const WATER_Y = 2150;

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  runSpeed: 300,
  hp: 100,
  hpRegen: 3,
};

export const CAR = {
  length: 64,
  width: 32,
  accel: 520,
  brake: 720,
  maxSpeed: 560,
  reverseMax: 180,
  turnRate: 2.6,
  hp: 100,
};

export const WANTED = {
  max: 5,
  decaySeconds: 22, // per star, when no cop is near and no fresh crime
  decayMission4: 12,
  stealCar: 1,
  punchPed: 1,
  punchCop: 2,
  ramCop: 1,
};

export const POLICE = {
  carSpeed: 490,
  footSpeed: 238,
  bustDistance: 32,
  bustTime: 0.6,
  ramDamage: 9,
  punchDamage: 8,
  maxCars: 3,
};

export const TRAFFIC = { count: 22, speedMin: 130, speedMax: 210 };
export const PEDS = { count: 26, speedMin: 45, speedMax: 80 };
export const PARKED = { count: 14 };
export const CASH_PICKUPS = 8;

export const PALETTE = {
  grass: '#2e5d3a',
  grassDark: '#274f31',
  water: '#1d4e6b',
  waterDark: '#17405a',
  pier: '#8a6f4d',
  road: '#33373f',
  roadEdge: '#54585f',
  lane: '#c9b458',
  sidewalk: '#6b6f78',
  park: '#3d7a44',
  tree: '#2c6b34',
  treeDark: '#235a2b',
  buildingRoof: ['#7a5c46', '#5d6b7a', '#6b4a5e', '#4a6b5d', '#715f3a', '#54496b'],
  buildingEdge: '#23232c',
  window: '#ffd76a',
  player: '#f2c14e',
  playerShirt: '#e4572e',
  policeCar: '#2f6fb2',
  policeLightRed: '#ff3b30',
  policeLightBlue: '#35a7ff',
  marker: '#ffd23f',
  cash: '#7ee787',
  hudBg: 'rgba(10,12,18,0.72)',
  hudText: '#f5f1e6',
  hudAccent: '#ffd23f',
  danger: '#ff5a4e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (cash + story progress) is kept between visits (this browser only). */
export const SAVE_KEY = 'velvet-bay.save.v1';
