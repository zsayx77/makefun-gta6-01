// Velvet Bay — Street Heat: an original open-world crime game, top-down 2D.
// Every tuning number lives in this one module so the rules can be balanced
// without touching the simulation or the drawing code.

/** The logical view the camera shows: 1280 by 720, scaled to the window. */
export const VIEW = { width: 1280, height: 720 };

/** One simulation step, in seconds. The loop runs the world at 60 steps/s. */
export const STEP = 1 / 60;

/** The city is 3200 wide, 2400 tall; the harbour water fills the south edge. */
export const WORLD = { width: 3200, height: 2400 };

/** How wide a road is, in world units. */
export const ROAD_W = 140;

/** Centre lines of the road grid, vertical (x) and horizontal (y). */
export const ROADS_X = [300, 700, 1100, 1500, 1900, 2300, 2700];
export const ROADS_Y = [300, 700, 1100, 1500, 1900];

/** The first y of open water; below it is harbour, except for the pier. */
export const WATER_Y = 2150;

/** The player on foot: size, speeds, health and slow regeneration. */
export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  runSpeed: 300,
  hp: 100,
  hpRegen: 3,
};

/** How a driven car handles: size, acceleration, top speed, turning. */
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

/** Wanted level: 0 to 5 stars, what each crime adds, how fast heat cools. */
export const WANTED = {
  max: 5,
  decaySeconds: 22, // seconds per star, once the heat has been off a while
  decayMission4: 12, // the final mission cools faster
  stealCar: 1,
  punchPed: 1,
  punchCop: 2,
  ramCop: 1,
};

/** Police behaviour: chase speed, bust range and timing, damage, car count. */
export const POLICE = {
  carSpeed: 490,
  footSpeed: 238,
  bustDistance: 32,
  bustTime: 0.6,
  ramDamage: 9,
  punchDamage: 8,
  maxCars: 3,
};

/** Ambient city life: how many traffic cars and pedestrians, and their speeds. */
export const TRAFFIC = { count: 22, speedMin: 130, speedMax: 210 };
export const PEDS = { count: 26, speedMin: 45, speedMax: 80 };
export const PARKED = { count: 14 };
export const CASH_PICKUPS = 8;

/** Every colour the renderer uses, in one table. */
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

/** localStorage key for the save: cash plus how far the story has gone. */
export const SAVE_KEY = 'velvet-bay.save.v1';
