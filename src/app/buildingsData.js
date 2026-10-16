// ── Total War Style Buildings & Unit Unlock System ───────────────────────────
// Buildings determine what units can be recruited in a province.
// Each building has tiers (1–3). Higher tiers unlock stronger units.
// 1 turn = 1 month in-game.

export const BUILDING_TYPES = {
  barracks: {
    id: 'barracks',
    name: 'Barracks',
    icon: '🏛️',
    description: 'Trains infantry: spearmen, swordsmen, elite guards.',
    tiers: [
      { tier: 1, name: 'Militia Barracks',       cost: 150, buildTurns: 2 },
      { tier: 2, name: 'Legionary Barracks',      cost: 350, buildTurns: 3 },
      { tier: 3, name: 'Praetorian Headquarters', cost: 700, buildTurns: 5 },
    ],
  },
  stables: {
    id: 'stables',
    name: 'Stables',
    icon: '🐎',
    description: 'Trains cavalry: light horsemen, heavy cavalry, cataphracts.',
    tiers: [
      { tier: 1, name: 'Basic Stables',   cost: 200, buildTurns: 2 },
      { tier: 2, name: 'War Stables',     cost: 450, buildTurns: 3 },
      { tier: 3, name: 'Cataphract Yard', cost: 800, buildTurns: 5 },
    ],
  },
  archery_range: {
    id: 'archery_range',
    name: 'Archery Range',
    icon: '🏹',
    description: 'Trains archers and skirmishers.',
    tiers: [
      { tier: 1, name: 'Firing Range',    cost: 120, buildTurns: 2 },
      { tier: 2, name: 'Archery School',  cost: 300, buildTurns: 3 },
      { tier: 3, name: 'Master Bowyers',  cost: 600, buildTurns: 4 },
    ],
  },
  siege_workshop: {
    id: 'siege_workshop',
    name: 'Siege Workshop',
    icon: '⚙️',
    description: 'Builds siege engines and ballistae.',
    tiers: [
      { tier: 1, name: 'Workshop',       cost: 300, buildTurns: 3 },
      { tier: 2, name: 'War Foundry',    cost: 600, buildTurns: 4 },
    ],
  },
  port: {
    id: 'port',
    name: 'Port',
    icon: '⚓',
    description: 'Enables naval units and marine infantry.',
    tiers: [
      { tier: 1, name: 'Fishing Harbour', cost: 200, buildTurns: 3 },
      { tier: 2, name: 'War Harbour',     cost: 500, buildTurns: 5 },
    ],
  },
};

// ── Unit definitions per building + tier requirement ────────────────────────
// recruitTurns: turns to train (local). Global adds +2.
// maxCapacity: global unit cap (null = unlimited).
// requiredBuilding: { type, tier }

export const ALL_UNITS = [
  // ── BARRACKS TIER 1 ──────────────────────────────────────────────────────
  {
    id: 'town_militia',
    name: 'Town Militia',
    icon: '🪖',
    category: 'Infantry',
    tier: 'L',
    description: 'Poorly trained levy. Cheap and expendable.',
    strength: 120, attack: 4, defense: 5, morale: 30,
    speedKmPerMonth: 55, cost: 60, upkeep: 8,
    recruitTurns: 1, requiredBuilding: { type: 'barracks', tier: 1 },
  },
  {
    id: 'spearmen',
    name: 'Spearmen',
    icon: '🗡️',
    category: 'Infantry',
    tier: 'L',
    description: 'Disciplined spear formation. Effective vs cavalry.',
    strength: 160, attack: 6, defense: 8, morale: 45,
    speedKmPerMonth: 50, cost: 90, upkeep: 12,
    recruitTurns: 1, requiredBuilding: { type: 'barracks', tier: 1 },
  },
  // ── BARRACKS TIER 2 ──────────────────────────────────────────────────────
  {
    id: 'swordsmen',
    name: 'Swordsmen',
    icon: '⚔️',
    category: 'Infantry',
    tier: 'M',
    description: 'Well-trained heavy infantry. Reliable in melee.',
    strength: 180, attack: 10, defense: 10, morale: 55,
    speedKmPerMonth: 50, cost: 160, upkeep: 18,
    recruitTurns: 2, requiredBuilding: { type: 'barracks', tier: 2 },
  },
  {
    id: 'hastati',
    name: 'Hastati',
    icon: '🛡️',
    category: 'Infantry',
    tier: 'M',
    description: 'Roman legionary front-rankers. Strong javelin charge.',
    strength: 200, attack: 11, defense: 11, morale: 60,
    speedKmPerMonth: 50, cost: 180, upkeep: 20,
    recruitTurns: 2, requiredBuilding: { type: 'barracks', tier: 2 },
  },
  {
    id: 'principes',
    name: 'Principes',
    icon: '⚔️',
    category: 'Infantry',
    tier: 'M',
    description: 'Veteran legionaries. Second battle line.',
    strength: 200, attack: 12, defense: 12, morale: 65,
    speedKmPerMonth: 48, cost: 200, upkeep: 22,
    recruitTurns: 2, requiredBuilding: { type: 'barracks', tier: 2 },
  },
  // ── BARRACKS TIER 3 ──────────────────────────────────────────────────────
  {
    id: 'triarii',
    name: 'Triarii',
    icon: '🔱',
    category: 'Heavy Infantry',
    tier: 'E',
    description: 'Elite veteran spearmen. Last line of Roman defense.',
    strength: 200, attack: 14, defense: 16, morale: 80,
    speedKmPerMonth: 45, cost: 320, upkeep: 35,
    recruitTurns: 3, requiredBuilding: { type: 'barracks', tier: 3 },
  },
  {
    id: 'praetorian_guard',
    name: 'Praetorian Guard',
    icon: '👑',
    category: 'Elite Infantry',
    tier: 'E',
    description: 'The emperor\'s finest. Unbreakable in battle.',
    strength: 160, attack: 18, defense: 18, morale: 95,
    speedKmPerMonth: 50, cost: 500, upkeep: 60,
    recruitTurns: 4, requiredBuilding: { type: 'barracks', tier: 3 },
    maxCapacity: 2,
  },

  // ── STABLES TIER 1 ───────────────────────────────────────────────────────
  {
    id: 'light_cavalry',
    name: 'Light Cavalry',
    icon: '🐎',
    category: 'Cavalry',
    tier: 'L',
    description: 'Fast scouts and flankers. Low staying power.',
    strength: 80, attack: 7, defense: 5, morale: 40,
    speedKmPerMonth: 90, cost: 120, upkeep: 15,
    recruitTurns: 1, requiredBuilding: { type: 'stables', tier: 1 },
  },
  {
    id: 'equites',
    name: 'Equites',
    icon: '🏇',
    category: 'Cavalry',
    tier: 'L',
    description: 'Roman citizen cavalry. Versatile and mobile.',
    strength: 100, attack: 9, defense: 7, morale: 50,
    speedKmPerMonth: 85, cost: 150, upkeep: 18,
    recruitTurns: 1, requiredBuilding: { type: 'stables', tier: 1 },
  },
  // ── STABLES TIER 2 ───────────────────────────────────────────────────────
  {
    id: 'italian_cavalry',
    name: 'Italian Cavalry',
    icon: '⚔️',
    category: 'Heavy Cavalry',
    tier: 'M',
    description: 'Armored horsemen. Shock attack on flanks.',
    strength: 120, attack: 13, defense: 10, morale: 60,
    speedKmPerMonth: 80, cost: 260, upkeep: 30,
    recruitTurns: 2, requiredBuilding: { type: 'stables', tier: 2 },
  },
  {
    id: 'numidian_cavalry',
    name: 'Numidian Cavalry',
    icon: '🐫',
    category: 'Skirmish Cavalry',
    tier: 'M',
    description: 'Expert skirmishers from North Africa. Hit-and-run.',
    strength: 90, attack: 11, defense: 8, morale: 55,
    speedKmPerMonth: 100, cost: 220, upkeep: 25,
    recruitTurns: 2, requiredBuilding: { type: 'stables', tier: 2 },
  },
  // ── STABLES TIER 3 ───────────────────────────────────────────────────────
  {
    id: 'cataphracts',
    name: 'Cataphracts',
    icon: '🛡️',
    category: 'Armored Cavalry',
    tier: 'E',
    description: 'Heavily armored eastern horsemen. Nearly unstoppable charge.',
    strength: 100, attack: 17, defense: 15, morale: 75,
    speedKmPerMonth: 70, cost: 420, upkeep: 50,
    recruitTurns: 3, requiredBuilding: { type: 'stables', tier: 3 },
  },

  // ── ARCHERY RANGE TIER 1 ─────────────────────────────────────────────────
  {
    id: 'skirmishers',
    name: 'Skirmishers',
    icon: '🏹',
    category: 'Skirmisher',
    tier: 'L',
    description: 'Light javelinmen. Harass enemy lines before battle.',
    strength: 100, attack: 6, defense: 3, morale: 30,
    speedKmPerMonth: 65, cost: 70, upkeep: 9,
    recruitTurns: 1, requiredBuilding: { type: 'archery_range', tier: 1 },
  },
  {
    id: 'archers',
    name: 'Archers',
    icon: '🏹',
    category: 'Ranged',
    tier: 'L',
    description: 'Bow-armed infantry. Effective at range.',
    strength: 120, attack: 8, defense: 4, morale: 35,
    speedKmPerMonth: 55, cost: 100, upkeep: 12,
    recruitTurns: 1, requiredBuilding: { type: 'archery_range', tier: 1 },
  },
  // ── ARCHERY RANGE TIER 2 ─────────────────────────────────────────────────
  {
    id: 'composite_bowmen',
    name: 'Composite Bowmen',
    icon: '🏹',
    category: 'Ranged',
    tier: 'M',
    description: 'Trained archers with superior composite bows.',
    strength: 140, attack: 12, defense: 5, morale: 48,
    speedKmPerMonth: 55, cost: 190, upkeep: 22,
    recruitTurns: 2, requiredBuilding: { type: 'archery_range', tier: 2 },
  },
  // ── ARCHERY RANGE TIER 3 ─────────────────────────────────────────────────
  {
    id: 'veteran_archers',
    name: 'Veteran Archers',
    icon: '🎯',
    category: 'Elite Ranged',
    tier: 'E',
    description: 'Master bowmen. Devastating long-range firepower.',
    strength: 140, attack: 16, defense: 6, morale: 65,
    speedKmPerMonth: 55, cost: 340, upkeep: 38,
    recruitTurns: 3, requiredBuilding: { type: 'archery_range', tier: 3 },
  },

  // ── SIEGE WORKSHOP ────────────────────────────────────────────────────────
  {
    id: 'ballista',
    name: 'Ballista',
    icon: '🏹',
    category: 'Siege',
    tier: 'M',
    description: 'Giant bolt-thrower. Deadly against fortifications.',
    strength: 40, attack: 20, defense: 2, morale: 50,
    speedKmPerMonth: 25, cost: 280, upkeep: 30,
    recruitTurns: 3, requiredBuilding: { type: 'siege_workshop', tier: 1 },
  },
  {
    id: 'onager',
    name: 'Onager',
    icon: '💥',
    category: 'Siege Artillery',
    tier: 'E',
    description: 'Roman stone-throwing catapult. Crushes enemy formations.',
    strength: 30, attack: 25, defense: 1, morale: 55,
    speedKmPerMonth: 20, cost: 450, upkeep: 45,
    recruitTurns: 4, requiredBuilding: { type: 'siege_workshop', tier: 2 },
    maxCapacity: 3,
  },

  // ── PORT ──────────────────────────────────────────────────────────────────
  {
    id: 'marines',
    name: 'Marines',
    icon: '⚓',
    category: 'Naval Infantry',
    tier: 'M',
    description: 'Seaborne soldiers. Board and take enemy vessels.',
    strength: 160, attack: 10, defense: 9, morale: 55,
    speedKmPerMonth: 60, cost: 200, upkeep: 22,
    recruitTurns: 2, requiredBuilding: { type: 'port', tier: 1 },
  },
  {
    id: 'legionary_cohort',
    name: 'Legionary Cohort',
    icon: '🏅',
    category: 'Elite Naval',
    tier: 'E',
    description: 'Full Roman cohort on warships. Dominates at sea.',
    strength: 200, attack: 15, defense: 14, morale: 80,
    speedKmPerMonth: 55, cost: 380, upkeep: 42,
    recruitTurns: 3, requiredBuilding: { type: 'port', tier: 2 },
  },
];

// ── Helper: Get available units from a province's buildings ─────────────────
export function getAvailableUnits(buildings) {
  // buildings = { barracks: 2, stables: 1, archery_range: 0, ... }
  return ALL_UNITS.filter(u => {
    const req = u.requiredBuilding;
    const bTier = buildings[req.type] || 0;
    return bTier >= req.tier;
  });
}

// ── Rome starts with Tier 1 Barracks ────────────────────────────────────────
export const ROME_START_BUILDINGS = { barracks: 1, stables: 0, archery_range: 0, siege_workshop: 0, port: 0 };

// ── Tier display styling ────────────────────────────────────────────────────
export const TW_TIER_STYLE = {
  L: { label: 'Levy',  color: '#94a3b8', bg: 'rgba(30,41,59,0.8)' },
  M: { label: 'Line',  color: '#60a5fa', bg: 'rgba(23,37,84,0.8)' },
  E: { label: 'Elite', color: '#ffd700', bg: 'rgba(78,40,0,0.8)'  },
};
