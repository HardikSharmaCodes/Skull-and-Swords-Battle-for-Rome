/**
 * combatEngine.js — Total War-style Combat & Siege System
 */

export const SETTLEMENT_TIERS = {
  1: { label: 'Village',    garrisonStrength: 180,  income: 20,  defBonus: 1.0,  hasWalls: false, icon: '🏘️' },
  2: { label: 'Town',       garrisonStrength: 340,  income: 45,  defBonus: 1.15, hasWalls: false, icon: '🏠' },
  3: { label: 'Large Town', garrisonStrength: 580,  income: 80,  defBonus: 1.30, hasWalls: true,  icon: '🏙️' },
  4: { label: 'City',       garrisonStrength: 920,  income: 130, defBonus: 1.55, hasWalls: true,  icon: '🏰' },
  5: { label: 'Major City', garrisonStrength: 1400, income: 200, defBonus: 1.90, hasWalls: true,  icon: '👑' },
};

export function getTierForWeight(weight) {
  if (weight >= 9) return 5;
  if (weight >= 7) return 4;
  if (weight >= 5) return 3;
  if (weight >= 3) return 2;
  return 1;
}

const G = {
  militia:  { name: 'Militia',        icon: '🪖', attack: 4,  defense: 4,  morale: 30, strength: 120 },
  spear:    { name: 'Spearmen',       icon: '🗡️', attack: 6,  defense: 8,  morale: 45, strength: 160 },
  archer:   { name: 'Archers',        icon: '🏹', attack: 8,  defense: 4,  morale: 35, strength: 120 },
  sword:    { name: 'Swordsmen',      icon: '⚔️', attack: 10, defense: 10, morale: 55, strength: 180 },
  heavy:    { name: 'Heavy Infantry', icon: '🛡️', attack: 13, defense: 14, morale: 70, strength: 200 },
  wall:     { name: 'Wall Guards',    icon: '🏯', attack: 7,  defense: 14, morale: 60, strength: 140 },
  cav:      { name: 'Cavalry',        icon: '🐎', attack: 12, defense: 8,  morale: 60, strength: 100 },
  elite:    { name: 'Elite Veterans', icon: '👑', attack: 18, defense: 18, morale: 90, strength: 200 },
};

export function buildGarrison(tier) {
  switch (tier) {
    case 1: return [{ ...G.militia }, { ...G.archer, strength: 80 }];
    case 2: return [{ ...G.militia }, { ...G.militia }, { ...G.archer }];
    case 3: return [{ ...G.spear }, { ...G.spear }, { ...G.archer }, { ...G.wall }];
    case 4: return [{ ...G.sword }, { ...G.spear }, { ...G.spear }, { ...G.archer }, { ...G.wall }, { ...G.cav }];
    case 5: return [{ ...G.elite }, { ...G.heavy }, { ...G.sword }, { ...G.spear }, { ...G.archer }, { ...G.wall }, { ...G.cav }];
    default: return [{ ...G.militia }];
  }
}

export function computeArmyStrength(units) {
  if (!units || units.length === 0) return 0;
  return units.reduce((s, u) => s + (u.attack || 5) * ((u.strength || 100) / 100), 0);
}

export function computeGarrisonStrength(garrisonUnits, tier, siegeTurns = 0) {
  const t = SETTLEMENT_TIERS[tier] || SETTLEMENT_TIERS[1];
  const base = garrisonUnits.reduce((s, u) => s + (u.defense || 5) * ((u.strength || 100) / 100), 0);
  const wallBonus = t.hasWalls ? 1.4 : 1.0;
  const attrition = Math.max(0.3, 1.0 - siegeTurns * 0.12);
  return base * t.defBonus * wallBonus * attrition;
}

export function autoresolve(attackerUnits, garrisonUnits, tier, siegeTurns = 0) {
  const atkStr = computeArmyStrength(attackerUnits);
  const defStr = computeGarrisonStrength(garrisonUnits, tier, siegeTurns);
  const total = atkStr + defStr;
  if (total === 0) return { attackerWins: true, attackerCasualtiesPct: 0, defenderCasualtiesPct: 100, atkStr: 0, defStr: 0, log: [] };
  const rand = () => 1 + (Math.random() - 0.5) * 0.24;
  const attackerWins = atkStr * rand() > defStr * rand();
  const defRatio = defStr / total;
  const atkRatio = atkStr / total;
  const attackerCasualtiesPct = attackerWins
    ? Math.round((0.08 + defRatio * 0.14) * 100)
    : Math.round((0.35 + atkRatio * 0.30) * 100);
  const defenderCasualtiesPct = attackerWins
    ? Math.round((0.35 + defRatio * 0.30) * 100)
    : Math.round((0.08 + atkRatio * 0.14) * 100);
  const tierInfo = SETTLEMENT_TIERS[tier];
  const log = [
    `⚔️ Attacker: ${Math.round(atkStr)} power vs Defender: ${Math.round(defStr)} power`,
    `🏰 ${tierInfo?.label || 'Settlement'} — ${tierInfo?.hasWalls ? 'Walled (+40% def)' : 'Open settlement'}`,
    siegeTurns > 0 ? `⏳ ${siegeTurns} siege turns — garrison weakened` : null,
    attackerWins ? `✅ ATTACKER VICTORIOUS` : `❌ ATTACK REPELLED`,
    `Attacker casualties: ~${attackerCasualtiesPct}% | Defender casualties: ~${defenderCasualtiesPct}%`,
  ].filter(Boolean);
  return { attackerWins, attackerCasualtiesPct, defenderCasualtiesPct, atkStr, defStr, log };
}

export function applyCasualties(units, casualtiesPct) {
  if (!units || units.length === 0) return [];
  const surviveFrac = Math.max(0, 1 - casualtiesPct / 100);
  return units
    .map(u => ({ ...u, strength: Math.round((u.strength || 100) * surviveFrac) }))
    .filter(u => u.strength > 10);
}

export const OCCUPATION_OPTIONS = [
  {
    id: 'occupy',
    label: 'Occupy',
    icon: '🏛️',
    description: 'Settlement intact. Minimal unrest. Immediate ownership.',
    treasuryBonus: 0,
    orderPenalty: 20,
    buildingDamage: 0,
    noCapture: false,
  },
  {
    id: 'sack',
    label: 'Sack & Occupy',
    icon: '🔥',
    description: 'Loot the treasury. Buildings damaged. Public order reduced.',
    treasuryBonus: 150,
    orderPenalty: 45,
    buildingDamage: 1,
    noCapture: false,
  },
  {
    id: 'raze',
    label: 'Raze',
    icon: '💀',
    description: 'Burn everything. Maximum plunder. Province is destroyed.',
    treasuryBonus: 300,
    orderPenalty: 0,
    buildingDamage: 99,
    noCapture: true,
  },
];

export function getTierIncome(tier) {
  return (SETTLEMENT_TIERS[tier] || SETTLEMENT_TIERS[1]).income;
}

export function getDefaultProvinceState(region) {
  const tier = getTierForWeight(region.weight || 1);
  return {
    tier,
    garrison: buildGarrison(tier),
    publicOrder: 80,
    siegeTurns: 0,
    isBesieged: false,
    recentlyConquered: 0,
    income: getTierIncome(tier),
  };
}

export function processTurnProvince(pState) {
  const next = { ...pState, garrison: [...(pState.garrison || [])] };
  const orderDelta = next.recentlyConquered > 0 ? -3 : 5;
  next.publicOrder = Math.min(100, Math.max(0, next.publicOrder + orderDelta));
  if (next.recentlyConquered > 0) next.recentlyConquered = Math.max(0, next.recentlyConquered - 1);
  if (next.isBesieged) next.siegeTurns = (next.siegeTurns || 0) + 1;
  return next;
}
