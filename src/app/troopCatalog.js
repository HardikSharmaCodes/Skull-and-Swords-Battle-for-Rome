/**
 * troopCatalog.js — location-aware recruitment.
 *
 * Bridges the flavour roster in unitsData.js (1–10 stats, per-culture units)
 * to the 1,000-man "cohort" objects the battle engine and army bar use
 * (attack/defense ~20-40, morale %).  Everything that raises troops — the
 * player's recruit drawer, AI provincial armies, AI reinforcements, garrisons —
 * goes through here so troop types always reflect WHERE they are raised.
 */
import { UNIT_ROSTER, getCultureForRegion, TIER_STYLE } from './unitsData';

export const UNIT_CLASS_OF = (category = '') => {
  const c = category.toLowerCase();
  if (/(cavalry|chariot|camel|horse|mounted)/.test(c)) return 'mounted';
  if (/(ranged|archer|skirmish|slinger|peltast|javelin)/.test(c)) return 'ranged';
  return 'melee';
};

/** Convert a roster unit into a recruitable cohort template (1,000 men). */
export function rosterToTemplate(unit, cultureKey) {
  const culture = UNIT_ROSTER[cultureKey];
  const unitClass = UNIT_CLASS_OF(unit.category);
  return {
    typeId: unit.id,
    rosterId: unit.id,
    culture: cultureKey,
    cultureLabel: culture?.label || cultureKey,
    name: unit.name,
    fullName: unit.fullName || unit.name,
    unitClass,
    category: unit.category,
    tier: unit.tier,
    men: 1000,
    cost: Math.round(unit.cost * 0.9) + 20,   // roster cost → Denarii per 1,000-man cohort
    upkeep: unit.upkeep,
    attack: Math.round(18 + unit.attack * 2.2),
    defense: Math.round(16 + unit.defense * 2.2),
    morale: Math.round(38 + unit.morale * 5.2),
    speedKmPerMonth: unit.speedKmPerMonth,
    description: unit.description,
    icon: unit.icon,
  };
}

const TEMPLATE_CACHE = {};
export function getCultureTemplates(cultureKey) {
  if (TEMPLATE_CACHE[cultureKey]) return TEMPLATE_CACHE[cultureKey];
  const culture = UNIT_ROSTER[cultureKey];
  const list = culture ? culture.units.map(u => rosterToTemplate(u, cultureKey)) : [];
  TEMPLATE_CACHE[cultureKey] = list;
  return list;
}

/** Legacy generic Roman basics (always available). */
export const ROMAN_LEVY_TEMPLATES = [
  {
    typeId: 'sword_levis', culture: 'rome', cultureLabel: 'Roman Republic', name: 'Sword Levis', unitClass: 'melee', category: 'Legionary Infantry',
    tier: 'M', men: 1000, cost: 100, upkeep: 10, attack: 30, defense: 32, morale: 65, speedKmPerMonth: 45,
    description: 'Disciplined Roman infantry with the gladius and scutum. The backbone of imperial conquest.', icon: '⚔️',
  },
  {
    typeId: 'javelins', culture: 'rome', cultureLabel: 'Roman Republic', name: 'Javelins', unitClass: 'ranged', category: 'Velites',
    tier: 'L', men: 1000, cost: 90, upkeep: 9, attack: 34, defense: 18, morale: 55, speedKmPerMonth: 50,
    description: 'Swift skirmishers with barbed javelins who shatter shield walls before contact.', icon: '🏹',
  },
];

/**
 * Units a general may raise at this location.
 *  - `local`:   the culture of the province the army stands in (cheap if you own it)
 *  - `roman`:   always the Roman line
 * Foreign (not owned) provinces hire their troops as mercenaries at +50% cost
 * and only offer non-elite units (elites need a loyal province).
 */
export function getRecruitOptions(region, isOwnedByPlayer) {
  const cultureKey = region ? getCultureForRegion(region) : 'rome';
  const local = getCultureTemplates(cultureKey).map(t => {
    const mercenary = !isOwnedByPlayer && cultureKey !== 'rome';
    return {
      ...t,
      mercenary,
      cost: mercenary ? Math.round(t.cost * 1.5) : t.cost,
      locked: !isOwnedByPlayer && t.tier === 'E',
      lockedReason: !isOwnedByPlayer && t.tier === 'E' ? 'Elite troops need a province loyal to you' : null,
    };
  });
  const roman = ROMAN_LEVY_TEMPLATES.map(t => ({ ...t, mercenary: false, locked: false }));
  return { cultureKey, cultureLabel: UNIT_ROSTER[cultureKey]?.label || cultureKey, local, roman };
}

/** Make a unique cohort instance from a template (what actually joins an army). */
export function instantiateCohort(template, idPrefix = 'cohort', extra = {}) {
  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    typeId: template.typeId,
    type: template.unitClass === 'ranged' ? 'javelins' : template.unitClass === 'mounted' ? 'cavalry' : 'sword_levis',
    name: template.name,
    unitClass: template.unitClass,
    category: template.category,
    culture: template.culture,
    tier: template.tier,
    men: template.men,
    attack: template.attack,
    defense: template.defense,
    morale: template.morale,
    icon: template.icon,
    veterancy: 1,
    ...extra,
  };
}

/**
 * Compose a provincial army from the LOCAL culture, scaled by province weight.
 * Always a sensible mix: a melee core, missile support, and cavalry/elites for
 * bigger provinces.  Returns cohorts (not templates).
 */
export function composeLocalArmy(region, idPrefix = 'prov', scale = 1) {
  const w = region.weight || 4;
  const cultureKey = getCultureForRegion(region);
  const pool = getCultureTemplates(cultureKey);
  if (pool.length === 0) return [];

  const byClass = c => pool.filter(t => t.unitClass === c);
  const byTier = tier => pool.filter(t => t.tier === tier);
  const used = new Map();
  // Prefer an unused unit type so armies read as varied, mixed forces.
  const pick = list => {
    const fresh = list.filter(t => !used.get(t.typeId));
    const src = fresh.length ? fresh : list;
    const t = src[Math.floor(Math.random() * src.length)];
    used.set(t.typeId, (used.get(t.typeId) || 0) + 1);
    return t;
  };

  const picks = [];
  const levies = byTier('L');
  const regulars = byTier('M');
  const elites = byTier('E');
  const melee = pool.filter(t => t.unitClass === 'melee');
  const ranged = byClass('ranged');
  const mounted = byClass('mounted');

  const coreCount = Math.max(2, Math.round((2 + w / 3) * scale));
  for (let i = 0; i < coreCount; i++) {
    const src = i % 3 === 0 && levies.length ? levies : (regulars.length ? regulars : pool);
    const meleePref = src.filter(t => t.unitClass === 'melee');
    picks.push(pick(meleePref.length ? meleePref : src));
  }
  if (ranged.length) picks.push(pick(ranged));
  if (w >= 4 && mounted.length) picks.push(pick(mounted));
  if (w >= 6 && ranged.length) picks.push(pick(ranged));
  if (w >= 6 && elites.length) picks.push(pick(elites));
  if (w >= 8 && elites.length) picks.push(pick(elites));
  if (picks.length === 0) picks.push(pick(melee.length ? melee : pool));

  return picks.map((t, i) => {
    // Vary stats a little so no two armies are identical; elite home troops get a defender's boost.
    const jitter = () => Math.round((Math.random() - 0.5) * 4);
    const cohort = instantiateCohort(t, `${idPrefix}-${region.id}-${i}`);
    cohort.attack += jitter();
    cohort.defense += jitter();
    return cohort;
  });
}

/** Pick one cohort for an AI province to buy as a reinforcement; prefers what the army lacks. */
export function pickReinforcement(region, existingUnits = [], budget = 400) {
  const pool = getCultureTemplates(getCultureForRegion(region))
    .filter(t => (t.tier === 'E' ? budget >= t.cost * 1.6 : t.cost <= budget));
  if (pool.length === 0) return null;
  const count = c => existingUnits.filter(u => (u.unitClass || 'melee') === c).length;
  const total = Math.max(1, existingUnits.length);
  // Target mix: 55% melee, 25% ranged, 20% mounted
  const want = { melee: 0.55, ranged: 0.25, mounted: 0.20 };
  const scored = pool.map(t => ({
    t,
    score: (want[t.unitClass] - count(t.unitClass) / total) + (Math.random() * 0.15) + (t.tier === 'M' ? 0.08 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].t;
}

export { TIER_STYLE };
