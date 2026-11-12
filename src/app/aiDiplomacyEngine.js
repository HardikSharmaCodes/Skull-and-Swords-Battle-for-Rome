// ─── AI Diplomacy & Strategic Whole-Map Simulation Engine ─────────────────────
// PROVINCE-BASED SOVEREIGNTY MODEL:
// Every province is an INDEPENDENT POLITY. There is NO "Roman Senate" group,
// NO "Gallic Confederation" group. Every Gallic province, every Italian province,
// every province everywhere is its own sovereign entity with its own army.
//
// Players and AI BUILD CUSTOM EMPIRES by conquering individual provinces.
// When province A controls province B, province B takes A's controller color.
//
// WASTA SYSTEM:
// Diplomatic actions have a "Wasta" (influence/clout/reach) score based on
// the geographic proximity (BFS hops in the neighbor graph) between provinces.
//   Direct neighbors  (hop=1): Wasta 100 — full diplomatic reach
//   2-hop neighbors:           Wasta 60  — trade & limited alliances
//   3-hop neighbors:           Wasta 25  — heralds & warnings only
//   4+ / unreachable:          Wasta 5   — rumours barely reach
//
// FACTION_CONFIG is kept as a DISPLAY/BANNER template for AI generals only.
// Province ownership is tracked per-province, not per faction group.

import { composeLocalArmy, pickReinforcement, instantiateCohort } from './troopCatalog';
import { getCultureForRegion } from './unitsData';
import { computeBattle, generateGarrison, distributeUnequalCasualties } from './BattleModal';
import { getElevationAt } from './gameEngine';

// ─── Empire Allegiance Resolver ──────────────────────────────────────────────
// Identifies which custom empire, realm, or sovereign nation a province belongs to.
export function getEmpireAllegianceName(provinceId, provinceOwners, regions) {
  const pId = Number(provinceId);
  const rootId = getRootController(pId, provinceOwners);
  const targetReg = regions.find(r => r.id === pId);
  const rootReg = regions.find(r => r.id === Number(rootId));
  const provName = targetReg?.site || `Province ${pId}`;

  if (Number(rootId) === 1) {
    if (pId === 1) return 'Roman Republic (Rome)';
    return `Roman Imperium (Subjugated ${provName})`;
  }

  if (Number(rootId) === pId) {
    return targetReg?.sovereignName || `Sovereign Realm of ${provName}`;
  }

  const rootName = rootReg?.site || `Ruler ${rootId}`;
  return `Empire of ${rootName} (Subject: ${provName})`;
}

// ─── WASTA SYSTEM ─────────────────────────────────────────────────────────────
// Computes Wasta score measured from the NEAREST province of the empire to the target province,
// and identifies which empire or nation that province belongs to.
export function computeEmpireWasta(empireRootId, targetProvinceId, provinceOwners, regions) {
  const targetId = Number(targetProvinceId);
  const rootTargetId = getRootController(targetId, provinceOwners);
  const targetIsOwnEmpire = (rootTargetId === empireRootId);
  const targetReg = regions.find(r => r.id === targetId);
  const targetEmpireName = getEmpireAllegianceName(targetId, provinceOwners, regions);

  if (targetIsOwnEmpire) {
    return {
      wastaScore: 100,
      hops: 0,
      nearestProvinceId: targetId,
      nearestProvinceName: targetReg?.site || 'Territory',
      isOwnEmpire: true,
      targetEmpireRootId: rootTargetId,
      targetEmpireName,
    };
  }

  // Find all provinces belonging to empireRootId
  const empireProvinces = [];
  for (const reg of regions) {
    if (getRootController(reg.id, provinceOwners) === empireRootId) {
      empireProvinces.push(reg.id);
    }
  }
  if (empireProvinces.length === 0) {
    empireProvinces.push(empireRootId);
  }

  // Check direct neighbors of ANY province in the empire
  const targetNeighbors = (targetReg?.neighbors || []).map(Number);
  for (const pId of empireProvinces) {
    if (targetNeighbors.includes(pId)) {
      const neighborReg = regions.find(r => r.id === pId);
      return {
        wastaScore: 100,
        hops: 1,
        nearestProvinceId: pId,
        nearestProvinceName: neighborReg?.site || 'Border Province',
        isOwnEmpire: false,
        targetEmpireRootId: rootTargetId,
        targetEmpireName,
      };
    }
  }

  // Build neighbor graph for BFS
  const neighborMap = {};
  for (const reg of regions) {
    neighborMap[String(reg.id)] = (reg.neighbors || []).map(String);
  }

  // Multi-source BFS starting from all provinces of empireRootId
  const goalStr = String(targetId);
  const visited = new Map();
  let frontier = [];

  for (const pid of empireProvinces) {
    const s = String(pid);
    visited.set(s, { hops: 0, sourceId: pid });
    frontier.push(s);
  }

  let minHops = 999;
  let nearestSource = empireProvinces[0];

  while (frontier.length > 0) {
    const next = [];
    for (const cur of frontier) {
      const curData = visited.get(cur);
      if (!curData || curData.hops >= 5) continue;

      for (const nid of (neighborMap[cur] || [])) {
        if (nid === goalStr) {
          const totalHops = curData.hops + 1;
          if (totalHops < minHops) {
            minHops = totalHops;
            nearestSource = curData.sourceId;
          }
        }
        if (!visited.has(nid)) {
          visited.set(nid, { hops: curData.hops + 1, sourceId: curData.sourceId });
          next.push(nid);
        }
      }
    }
    if (minHops < 999) break;
    frontier = next;
  }

  let wastaScore = 5;
  if (minHops === 1) wastaScore = 100;
  else if (minHops === 2) wastaScore = 60;
  else if (minHops === 3) wastaScore = 25;
  else wastaScore = 5;

  const nearestSourceReg = regions.find(r => r.id === nearestSource);

  return {
    wastaScore,
    hops: minHops === 999 ? 5 : minHops,
    nearestProvinceId: nearestSource,
    nearestProvinceName: nearestSourceReg?.site || 'Border Frontier',
    isOwnEmpire: false,
    targetEmpireRootId: rootTargetId,
    targetEmpireName,
  };
}

// Backward-compatible computeWasta wrapper
export function computeWasta(fromId, toId, regions, provinceOwners = null) {
  if (provinceOwners) {
    const res = computeEmpireWasta(fromId, toId, provinceOwners, regions);
    return res.wastaScore;
  }
  if (String(fromId) === String(toId)) return 100;

  const neighborMap = {};
  for (const reg of regions) {
    neighborMap[String(reg.id)] = (reg.neighbors || []).map(String);
  }

  const startStr = String(fromId);
  const goalStr  = String(toId);
  const visited  = new Set([startStr]);
  let frontier   = [startStr];
  let hops       = 0;

  while (frontier.length > 0 && hops < 6) {
    hops++;
    const next = [];
    for (const cur of frontier) {
      for (const nid of (neighborMap[cur] || [])) {
        if (nid === goalStr) {
          if (hops === 1) return 100;
          if (hops === 2) return 60;
          if (hops === 3) return 25;
          return 5;
        }
        if (!visited.has(nid)) {
          visited.add(nid);
          next.push(nid);
        }
      }
    }
    frontier = next;
  }
  return 5;
}

// Human-readable wasta tier label with nearest province context
export function wastaLabel(wastaScore, nearestProvinceName = '', hops = 1, isOwnEmpire = false) {
  if (isOwnEmpire) {
    return { label: 'Realm Homeland', color: '#ffd700', desc: 'United within your realm. Full internal administration.' };
  }
  if (wastaScore >= 100) {
    return {
      label: 'Direct Border',
      color: '#2ecc71',
      desc: nearestProvinceName
        ? `Direct border neighbour to your province ${nearestProvinceName} (1 hop). Full diplomatic reach, war, & trade.`
        : 'Direct border neighbour (1 hop). Full diplomatic reach, war, & trade.'
    };
  }
  if (wastaScore >= 60) {
    return {
      label: 'Near Frontier',
      color: '#f1c40f',
      desc: nearestProvinceName
        ? `Near frontier via ${nearestProvinceName} (2 hops). Strong reach — envoys and trade caravans welcomed.`
        : 'Near frontier (2 hops). Strong reach — envoys and trade caravans welcomed.'
    };
  }
  if (wastaScore >= 25) {
    return {
      label: 'Distant Land',
      color: '#e67e22',
      desc: nearestProvinceName
        ? `Distant land (3 hops from ${nearestProvinceName}). Weak reach — only heralds and warnings cross this distance.`
        : 'Distant land (3 hops). Weak reach — only heralds and warnings cross this distance.'
    };
  }
  return {
    label: 'Far Frontier',
    color: '#e74c3c',
    desc: nearestProvinceName
      ? `Far frontier (${hops}+ hops from ${nearestProvinceName}). Almost no influence — rumours barely reach this far.`
      : 'Far frontier (4+ hops). Almost no influence — rumours barely reach this far.'
  };
}

// ─── Province Ownership Tree Utilities ────────────────────────────────────────
// Follow the ownership chain to find the "root controller" of a province.
// provinceOwners: Map<provinceId, controllerId> where controllerId is a
// province ID (province-based) or the string 'independent'.
export function getRootController(provinceId, provinceOwners) {
  const visited = new Set();
  let cur = Number(provinceId);
  for (let i = 0; i < 50; i++) { // max 50 hops to prevent infinite loop
    const owner = provinceOwners.get(cur);
    if (owner === undefined || owner === 'independent' || owner === cur) return cur;
    if (visited.has(owner)) return cur; // cycle guard
    visited.add(cur);
    cur = owner;
  }
  return cur;
}

// Get the display fill color of a province, cascading through its ownership tree.
// If province B is owned by province A, B gets A's color (the root controller's color).
export function getProvinceDisplayColor(provinceId, provinceOwners, regionsById) {
  const rootId = getRootController(provinceId, provinceOwners);
  const rootReg = regionsById[rootId];
  if (rootReg) return rootReg.fillColor || rootReg.color || '#7f8c8d';
  return '#7f8c8d';
}

// ─── Culture/Banner Config (display only — NOT province ownership groups) ──────
export const FACTION_CONFIG = {
  rome: {
    id: 'rome',
    name: 'Province of Rome',
    shortName: 'Rome',
    adjective: 'Roman',
    ruler: 'Consul Valinus Octavius',
    culture: 'Roman',
    trait: 'Imperial Ambition',
    traitDesc: 'Disciplined cohorts, rapid strategic mobilization, relentless territorial momentum.',
    color: '#da291c',
    fillColor: '#da291c',
    strokeColor: '#ffd700',
    textColor: '#ffd700',
    bannerIcon: '🦅',
    aggression: 0.70,
    cautiousness: 0.35,
    isPlayer: true,
  },
  ptolemy: {
    id: 'ptolemy',
    name: 'Province of Alexandria',
    shortName: 'Alexandria',
    adjective: 'Egyptian',
    ruler: 'Ptolemy IV Philopator',
    culture: 'Graeco-Egyptian',
    trait: 'Wealth of the Nile',
    traitDesc: 'Vast silver reserves, rich granary yields, maintains stout well-funded garrisons.',
    color: '#d4ac0d',
    fillColor: '#d4ac0d',
    strokeColor: '#2980b9',
    textColor: '#ffffff',
    bannerIcon: '𓅃',
    aggression: 0.35,
    cautiousness: 0.65,
  },
  carthage: {
    id: 'carthage',
    name: 'Province of Carthage',
    shortName: 'Carthage',
    adjective: 'Carthaginian',
    ruler: 'Hamilcar Barca',
    culture: 'Punic',
    trait: 'Maritime Hegemony & Vengeance',
    traitDesc: 'Formidable mercenary armies, aggressive maritime trade, naval supremacy.',
    color: '#8e44ad',
    fillColor: '#8e44ad',
    strokeColor: '#f39c12',
    textColor: '#ffffff',
    bannerIcon: '🌙',
    aggression: 0.75,
    cautiousness: 0.40,
  },
  hellas: {
    id: 'hellas',
    name: 'Province of Athens',
    shortName: 'Athens',
    adjective: 'Hellenic',
    ruler: 'Strategos Aratus of Sicyon',
    culture: 'Hellenistic',
    trait: 'Phalanx Pride',
    traitDesc: 'Disciplined hoplite formations, philosophical statecraft, reluctant to wage offensive wars.',
    color: '#2980b9',
    fillColor: '#2980b9',
    strokeColor: '#f1c40f',
    textColor: '#ffffff',
    bannerIcon: '🏛️',
    aggression: 0.40,
    cautiousness: 0.60,
  },
  gaul: {
    id: 'gaul',
    name: 'Province of Gergovia',
    shortName: 'Gergovia',
    adjective: 'Gallic',
    ruler: 'Vergobret Vercingetorix',
    culture: 'Celtic Gaul',
    trait: 'Fierce Warbands',
    traitDesc: 'Volatile temperament, devastating ferocious charges, attacks whenever outnumbering foes.',
    color: '#27ae60',
    fillColor: '#27ae60',
    strokeColor: '#e67e22',
    textColor: '#ffffff',
    bannerIcon: '🐗',
    aggression: 0.85,
    cautiousness: 0.25,
  },
  germany: {
    id: 'germany',
    name: 'Province of Sarmizegetusa',
    shortName: 'Sarmizegetusa',
    adjective: 'Germanic',
    ruler: 'Kuningaz Ariovistus',
    culture: 'Germanic',
    trait: 'Untamed Fury',
    traitDesc: 'Fearless deep forest warriors, aggressive against frontier borders, unrelenting tenacity.',
    color: '#d35400',
    fillColor: '#d35400',
    strokeColor: '#f39c12',
    textColor: '#ffffff',
    bannerIcon: '🐺',
    aggression: 0.90,
    cautiousness: 0.20,
  },
  iberia: {
    id: 'iberia',
    name: 'Province of Corduba',
    shortName: 'Corduba',
    adjective: 'Iberian',
    ruler: 'Regulus Indibilis',
    culture: 'Celtiberian',
    trait: 'Guerrilla Defiance',
    traitDesc: 'Stout highland fortifications, mountain ambushes, hesitant to venture far from home.',
    color: '#e67e22',
    fillColor: '#e67e22',
    strokeColor: '#d35400',
    textColor: '#ffffff',
    bannerIcon: '🐂',
    aggression: 0.45,
    cautiousness: 0.70,
  },
  britain: {
    id: 'britain',
    name: 'Province of Camulodunum',
    shortName: 'Camulodunum',
    adjective: 'Briton',
    ruler: 'High Chieftain Cassivellaunus',
    culture: 'Brythonic',
    trait: 'Island Isolation',
    traitDesc: 'Protected by northern channel seas, intensely defensive of ancestral tribal lands.',
    color: '#16a085',
    fillColor: '#16a085',
    strokeColor: '#1abc9c',
    textColor: '#ffffff',
    bannerIcon: '🌀',
    aggression: 0.30,
    cautiousness: 0.80,
  },
  independent: {
    id: 'independent',
    name: 'Sovereign Province',
    shortName: 'Independent',
    adjective: 'Sovereign',
    ruler: 'Local Assembly',
    culture: 'Various',
    trait: 'Regional Autonomy',
    traitDesc: 'Defends homeland and regional sovereignty, opportunistic border garrisoning.',
    color: '#7f8c8d',
    fillColor: '#7f8c8d',
    strokeColor: '#bdc3c7',
    textColor: '#ffffff',
    bannerIcon: '👑',
    aggression: 0.25,
    cautiousness: 0.75,
  },
};

// Maps old faction names in regionsData → display culture key (for banner icons)
export const FACTION_NAME_MAP = {
  'Roman Senate':         'rome',
  'Ptolemaic Crown':      'ptolemy',
  'Hellenic League':      'hellas',
  'Gallic Confederation': 'gaul',
  'Iberian Coalition':    'iberia',
  'Germanic Warbands':    'germany',
  'Celtic Britons':       'britain',
  'Punic Council':        'carthage',
  'Independent Realm':    'independent',
};

// ─── Provincial Army Factory ──────────────────────────────────────────────────
// Every province raises troops of ITS OWN people (Dacian falxmen in Dacia, Nabataean
// camel corps in Arabia, Roman hastati in Italy ...) via troopCatalog / unitsData.
const CULTURE_BANNER = {
  rome:     { icon: '🦅', title: s => `Legio ${s}` },
  gaul:     { icon: '🐗', title: s => `Warband of ${s}` },
  germany:  { icon: '🐺', title: s => `Heerbann of ${s}` },
  britain:  { icon: '🔱', title: s => `Tribal Host of ${s}` },
  iberia:   { icon: '🐂', title: s => `Host of ${s}` },
  africa:   { icon: '🌙', title: s => `Punic-Numidian Host of ${s}` },
  egypt:    { icon: '𓅃', title: s => `Royal Host of ${s}` },
  levant:   { icon: '✡️', title: s => `Levantine Host of ${s}` },
  parthia:  { icon: '🏹', title: s => `Satrapal Army of ${s}` },
  pontus:   { icon: '🦁', title: s => `Royal Army of ${s}` },
  greece:   { icon: '🏛️', title: s => `Phalanx of ${s}` },
  steppe:   { icon: '🐎', title: s => `Horde of ${s}` },
  thrace:   { icon: '🪓', title: s => `Hillmen of ${s}` },
  arabia:   { icon: '🐪', title: s => `Caravan Host of ${s}` },
  nubia:    { icon: '🏹', title: s => `Kandake's Host of ${s}` },
  caucasus: { icon: '⛰️', title: s => `Mountain Host of ${s}` },
  bactria:  { icon: '🐴', title: s => `Silk Road Host of ${s}` },
};

export function createProvincialArmy(reg, idSuffix = '') {
  const culture = getCultureForRegion(reg);
  const banner = CULTURE_BANNER[culture] || { icon: '⚔️', title: s => `Army of ${s}` };
  const site = reg.site;
  const cohorts = composeLocalArmy(reg, `${reg.id}-${idSuffix || 'a'}`);

  // Speed = slowest cohort's pace (km/month) scaled to the map's km/min convention.
  const slowest = cohorts.reduce((m, c) => Math.min(m, c.speedKmPerMonth || 45), 99);
  const baseSpeed = 30 + Math.round(slowest / 12) + Math.round(Math.random() * 4);

  return {
    id: `prov-army-${reg.id}-${idSuffix || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: banner.title(site),
    faction: reg.macroRegion || 'independent',
    culture,
    homeSite: site,
    homeProvinceId: reg.id,
    x: reg.center[0] + (Math.random() - 0.5) * 8,
    y: reg.center[1] + (Math.random() - 0.5) * 8,
    units: cohorts,
    maxUnits: 14,
    status: 'idle',
    baseSpeedKmPerMin: baseSpeed,
    bannerIcon: banner.icon,
    originalMen: cohorts.length * 1000,
  };
}

// Generate initial field armies for major provincial powers (excluding player's home province)
export function generateInitialArmies(regions, playerHomeId = 1) {
  const initialArmies = [];
  const initialProvinceIds = [
    2, 3, 7, 8, 12, 17,               // Italy: Capua, Syracuse, Tarentum, Aquileia, Mediolanum, Ariminum
    27, 28, 29, 35, 36, 38, 42,       // Gaul: Massalia, Narbo, Bibracte, Lugdunum, Burdigala, Gergovia, Lutetia
    41,                               // Britannia: Camulodunum
    45, 46, 48, 49, 53,               // Iberia: Gades, Corduba, Carthago Nova, Tarraco, Olisipo
    57, 59, 62,                       // Central Europe: Sarmizegetusa, Carnuntum, Singidunum
    64, 65, 66, 68, 74,               // Greece/Balkans: Thessalonica, Athens, Corinth, Byzantium, Sparta
    88, 98, 99, 104, 109,             // Anatolia: Sinope, Ephesus, Pergamon, Tarsus, Ancyra
    122, 123, 124, 125,               // Levant: Antioch, Damascus, Tyre, Jerusalem
    170, 171, 172,                    // Egypt: Alexandria, Memphis, Thebes
    188, 189, 191, 192, 196,          // North Africa: Utica, Cirta, Leptis Magna, Carthage, Tingis
  ];

  // Culture strongholds beyond the core list, so every troop culture fields a host from turn 1.
  const extraSites = [
    'Ctesiphon', 'Ecbatana', 'Seleucia on the Tigris', 'Nisibis',      // Parthia
    'Petra', 'Marib', 'Zafar',                                          // Arabia
    'Meroe', 'Adulis',                                                  // Kush / Aksum
    'Panticapaeum', 'Scythian Neapolis', 'Tanais',                      // Steppe / Bosporus
    'Sarmizegetusa Regia', 'Histria', 'Ocnele Mari',                    // Dacia / Thrace
    'Uplistsikhe', 'Vani', 'Caspian Gates (Derbent)',                   // Caucasus
    'Bactra', 'Maracanda',                                              // Bactria
    'Artaxata', 'Tigranocerta', 'Camulodunum', 'Maiden Castle',
  ];
  for (const site of extraSites) {
    const r = regions.find(x => x.site === site);
    if (r && !initialProvinceIds.includes(r.id)) initialProvinceIds.push(r.id);
  }

  for (const pid of initialProvinceIds) {
    if (pid === playerHomeId) continue;
    const reg = regions.find(r => r.id === pid);
    if (reg && reg.center) {
      initialArmies.push(createProvincialArmy(reg, 'init'));
    }
  }

  return initialArmies;
}

// ─── Initial AI Field Generals (Backward Compatibility) ───────────────────────
export const INITIAL_AI_GENERALS = [];

// ─── Initialize Diplomacy & Economics State ────────────────────────────────────
// PROVINCE-BASED SOVEREIGNTY:
// Each province starts as its own sovereign entity (owner = province's own id).
// No province belongs to a mono-faction group from the start.
// Players and AI build custom empires by conquering individual provinces.
export function initializeDiplomacyState(regions) {
  const provinceOwners = new Map();
  const provinceTreasuries = {};

  // Each province is sovereign — owner is the province's own numeric ID
  for (const reg of regions) {
    provinceOwners.set(reg.id, reg.id);
    const weight = reg.weight || 4;
    provinceTreasuries[reg.id] = weight * 420 + 500;
  }

  // Initialize province-to-province relations (neighbors only, for performance)
  const relations = {};
  for (const reg of regions) {
    relations[reg.id] = {};
    for (const nid of (reg.neighbors || [])) {
      relations[reg.id][nid] = {
        areNeighbors: true,
        baseRelation: 0,
        pastWars: 0,
        atWar: false,
        triadicModifier: 0,
        score: 0,
        firstContactTime: 0,
        wasta: 100,
      };
    }
  }

  const treasuries = { rome: 7500 };
  const initialArmies = generateInitialArmies(regions, 1);

  return {
    gameTimeSec: 0,
    turn: 1,
    turnCycleSec: 60,
    treasuries,               // player (rome) treasury — displayed in UI
    provinceTreasuries,       // per-province economic pool
    provinceOwners,           // Map<provinceId, controllerId> — self-sovereign at start
    relations,                // province-to-province bilateral relations
    aiGenerals: initialArmies,
    wars: {},                 // { 'a|b': { a, b, since, clashes } } between ROOT controllers
    truces: {},               // { 'a|b': untilTurn }
    warDeclarationsLog: [],
  };
}


// ─── Compute Bordering Faction Graph (legacy compatibility) ───────────────────
export function computeBorderingGraph(regions, provinceOwners) {
  const graph = {};
  for (const reg of regions) {
    const owner1 = provinceOwners.get(reg.id);
    if (owner1 === undefined) continue;
    if (!graph[owner1]) graph[owner1] = new Set();

    for (const nid of (reg.neighbors || [])) {
      const owner2 = provinceOwners.get(nid);
      if (owner2 !== undefined && owner2 !== owner1) {
        if (!graph[owner2]) graph[owner2] = new Set();
        graph[owner1].add(owner2);
        graph[owner2].add(owner1);
      }
    }
  }
  return graph;
}

// ─── Calculate Dynamic Relation Score ─────────────────────────────────────────
// Incorporates:
// - Bordering check
// - Aversion -15 for the first 3 months (180 seconds), disappearing afterwards
// - Past wars
// - Triadic relations ("they don't like nations that like me, I don't like them")
export function calculateOpinionScore(f1, f2, relData, gameTimeSec, allRelations) {
  if (!relData) return 0;
  if (!relData.areNeighbors && !relData.atWar) return 0; // Relations only apply to bordering nations or active wars

  // 1. Aversion -15 for first 3 months (180 seconds), gone after that!
  const contactDuration = gameTimeSec - (relData.firstContactTime || 0);
  const isWithin3Months = contactDuration < 180;
  const aversion = isWithin3Months ? -15 : 0;

  // 2. Past wars modifier
  const pastWars = relData.pastWars || 0;

  // 3. Triadic balance: If f2 hates/attacks someone f1 likes, f1 dislikes f2!
  let triadicMod = 0;
  if (allRelations && allRelations[f1]) {
    for (const thirdFaction of Object.keys(allRelations[f1])) {
      if (thirdFaction === f1 || thirdFaction === f2) continue;
      const myFriendRel = allRelations[f1][thirdFaction];
      const targetRelWithFriend = allRelations[thirdFaction]?.[f2];

      if (myFriendRel && targetRelWithFriend) {
        // If I like thirdFaction (> 15) and f2 is at war or hated by thirdFaction (< -30)
        if (myFriendRel.baseRelation > 15) {
          if (targetRelWithFriend.atWar) {
            triadicMod -= 30; // f2 is at war with my friend!
          } else if (targetRelWithFriend.baseRelation < -25) {
            triadicMod -= 15; // f2 dislikes my friend
          }
        }
        // Enemy of my enemy is my friend
        if (myFriendRel.atWar && targetRelWithFriend.atWar) {
          triadicMod += 20; // Both fighting common enemy
        }
      }
    }
  }

  const raw = relData.baseRelation + aversion + pastWars + triadicMod + (relData.atWar ? -60 : 0);
  return Math.max(-100, Math.min(100, Math.round(raw)));
}

// ─── Turn Economy & Diplomacy Tick (Runs every game loop update) ──────────────
export function tickDiplomacyAndEconomy({
  state,
  dt,
  regions,
  playerLegionUnits,
  onWarDeclared,
  onPeaceMade,
  onTurnComplete,
}) {
  if (dt <= 0) return state; // Paused

  const next = { ...state };
  next.gameTimeSec += dt;

  // Check 1-minute turn cycle (60s)
  const prevTurn = next.turn;
  const currentTurn = Math.floor(next.gameTimeSec / next.turnCycleSec) + 1;
  const isNewTurn = currentTurn > prevTurn;

  if (isNewTurn) {
    next.turn = currentTurn;

    // 1. Process Province Income for all controllers (proportional to province weight)
    // Custom empires: root controller receives the economic yield of all its provinces
    const rootIncomes = {};
    const rootProvinceCounts = {};

    for (const reg of regions) {
      const rootId = getRootController(reg.id, next.provinceOwners);
      const weight = reg.weight || 4;
      const inc = weight * 100;
      rootIncomes[rootId] = (rootIncomes[rootId] || 0) + inc;
      rootProvinceCounts[rootId] = (rootProvinceCounts[rootId] || 0) + 1;
    }

    // 2. Process Upkeep for units (25 Denarii per unit/cohort per minute)
    const playerCohorts = playerLegionUnits?.length || 0;
    const playerUpkeep = playerCohorts * 25;

    // Player (Rome = id 1) collects yield from all provinces in their custom empire tree
    const playerHomeId = 1;
    const playerInc = rootIncomes[playerHomeId] || (10 * 100);
    const playerNet = playerInc - playerUpkeep;
    next.treasuries.rome = Math.max(0, (next.treasuries.rome || 0) + playerNet);

    // 3. AI income, upkeep, recruitment and recovery — one ledger per ROOT realm
    //    (so a conquering realm pays for and recruits every army it owns).
    const regionById = new Map(regions.map(r => [r.id, r]));
    const armiesByRoot = {};
    for (const g of next.aiGenerals) {
      const root = getRootController(g.homeProvinceId || g.faction, next.provinceOwners);
      (armiesByRoot[root] ||= []).push(g);
    }
    for (const [rootKey, armies] of Object.entries(armiesByRoot)) {
      const root = Number(rootKey);
      const income = rootIncomes[root] || 0;
      const cohortTotal = armies.reduce((n, g) => n + (g.units || []).length, 0);
      const upkeep = cohortTotal * 25;
      const tKey = `r${root}`;
      next.treasuries[tKey] = Math.max(0, (next.treasuries[tKey] ?? 600) + income - upkeep);

      for (const g of armies) {
        const homeReg = regionById.get(g.homeProvinceId);
        const cohorts = (g.units || []).length;

        // Recovery: an idle army resting inside its own realm regains strength.
        if (g.status === 'idle' && isInsideOwnRealm(g, regions, next.provinceOwners, root)) {
          for (const u of g.units) {
            if ((u.men ?? 1000) < 1000) u.men = Math.min(1000, (u.men ?? 1000) + 120);
          }
        }

        // Reinforce: spend treasury on the best-fitting LOCAL troop type the army lacks.
        const cap = g.maxUnits || 14;
        if (homeReg && g.status === 'idle' && cohorts < cap && next.treasuries[tKey] > 900) {
          const tpl = pickReinforcement(homeReg, g.units, next.treasuries[tKey] * 0.4);
          if (tpl && next.treasuries[tKey] >= tpl.cost + 400) {
            next.treasuries[tKey] -= tpl.cost;
            g.units.push(instantiateCohort(tpl, `${g.id}-rec`));
            g.originalMen = Math.max(g.originalMen || 0, g.units.length * 1000);
          }
        }
      }
    }

    // 3b. Autonomous Provincial Army Mobilization:
    // "All provinces should have power to raise armies according to need"
    if (!next.provinceTreasuries) next.provinceTreasuries = {};
    for (const reg of regions) {
      const weight = reg.weight || 4;
      next.provinceTreasuries[reg.id] = (next.provinceTreasuries[reg.id] || 0) + weight * 120;
    }

    // Mobilize when needed: province borders a rival realm and has no nearby army
    if (next.aiGenerals.length < 48) {
      for (const reg of regions) {
        if (next.aiGenerals.length >= 48) break;
        const myRoot = getRootController(reg.id, next.provinceOwners);
        if (myRoot === 1) continue; // Player manages their own provincial armies

        // Raise troops when the province borders a realm we're at war with (or, in peace,
        // occasionally for a lone border province with no army at all)
        const hasRivalBorder = (reg.neighbors || []).some(nid => {
          const nRoot = getRootController(nid, next.provinceOwners);
          return nRoot !== myRoot && areRootsAtWar(next, myRoot, nRoot);
        });

        if (!hasRivalBorder) continue;

        // Check if there is already an active army stationed nearby (< 120px)
        const hasStationedArmy = next.aiGenerals.some(g => {
          const gRoot = getRootController(g.homeProvinceId || g.faction, next.provinceOwners);
          if (gRoot !== myRoot) return false;
          return Math.hypot(g.x - reg.center[0], g.y - reg.center[1]) < 120;
        });

        if (!hasStationedArmy && (next.provinceTreasuries[reg.id] >= 500)) {
          next.provinceTreasuries[reg.id] -= 500;
          const mobilizedArmy = createProvincialArmy(reg, `mob-${currentTurn}`);
          next.aiGenerals.push(mobilizedArmy);
        }
      }
    }

    // 4. Past Wars Grievance Decay (+2 opinion towards healing per turn)
    for (const f1 of Object.keys(next.relations)) {
      for (const f2 of Object.keys(next.relations[f1])) {
        const rel = next.relations[f1][f2];
        if (rel.pastWars < 0) {
          rel.pastWars = Math.min(0, rel.pastWars + 2);
        }
      }
    }

    // 5. Realm-level diplomacy: wars are declared (and ended) between root controllers.
    runRealmDiplomacy(next, regions, playerLegionUnits, onWarDeclared, onPeaceMade);

    if (onTurnComplete) {
      onTurnComplete({
        turn: currentTurn,
        playerIncome: playerInc,
        playerUpkeep,
        playerNet,
        treasury: next.treasuries.rome,
      });
    }
  }

  // Update dynamic scores for all pairs
  for (const f1 of Object.keys(next.relations)) {
    for (const f2 of Object.keys(next.relations[f1])) {
      const rel = next.relations[f1][f2];
      rel.score = calculateOpinionScore(f1, f2, rel, next.gameTimeSec, next.relations);
    }
  }

  return next;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getHomeRootProvince(g, provinceOwners) {
  return getRootController(g.homeProvinceId || g.faction, provinceOwners);
}

function isInsideOwnRealm(g, regions, provinceOwners, rootId) {
  let best = null, bd = Infinity;
  for (const r of regions) {
    const d = Math.hypot(g.x - r.center[0], g.y - r.center[1]);
    if (d < bd) { bd = d; best = r; }
  }
  return !!best && bd < 70 && getRootController(best.id, provinceOwners) === rootId;
}

const warKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function areRootsAtWar(state, a, b) {
  if (a === b) return false;
  return !!state.wars?.[warKey(a, b)];
}

function setRelationsWar(state, regions, rootA, rootB, flag) {
  for (const r of regions) {
    const rr = getRootController(r.id, state.provinceOwners);
    if (rr !== rootA && rr !== rootB) continue;
    for (const nid of (r.neighbors || [])) {
      const nr = getRootController(nid, state.provinceOwners);
      if ((rr === rootA && nr === rootB) || (rr === rootB && nr === rootA)) {
        const rel = state.relations?.[r.id]?.[nid];
        if (rel) {
          rel.atWar = flag;
          if (flag) rel.pastWars = Math.min(rel.pastWars || 0, -20);
        }
      }
    }
  }
}

/** Public: declare war between two realms (used by AI and by the player's own attacks). */
export function declareWar(state, regions, rootA, rootB) {
  if (rootA === rootB || areRootsAtWar(state, rootA, rootB)) return false;
  if (!state.wars) state.wars = {};
  state.wars[warKey(rootA, rootB)] = { a: rootA, b: rootB, since: state.turn, clashes: 0 };
  setRelationsWar(state, regions, rootA, rootB, true);
  return true;
}

export function noteClash(state, a, b) {
  const w = state.wars?.[warKey(a, b)];
  if (w) w.clashes = (w.clashes || 0) + 1;
}

export function makePeace(state, regions, rootA, rootB, truceTurns = 6) {
  if (!state.wars) return;
  delete state.wars[warKey(rootA, rootB)];
  if (!state.truces) state.truces = {};
  state.truces[warKey(rootA, rootB)] = state.turn + truceTurns;
  setRelationsWar(state, regions, rootA, rootB, false);
}

function realmName(rootId, regions) {
  const r = regions.find(x => x.id === rootId);
  return r ? r.site : `Realm ${rootId}`;
}

function realmStrength(rootId, state, regions, playerArmyUnits) {
  let men = 0;
  let weight = 0;
  for (const g of state.aiGenerals) {
    if (getHomeRootProvince(g, state.provinceOwners) === rootId) {
      men += (g.units || []).reduce((s, u) => s + Math.max(0, u.men ?? 1000), 0);
    }
  }
  if (rootId === 1 && playerArmyUnits) {
    men += playerArmyUnits.reduce((s, u) => s + Math.max(0, u.men ?? 1000), 0);
  }
  for (const r of regions) {
    if (getRootController(r.id, state.provinceOwners) === rootId) weight += r.weight || 4;
  }
  return men + weight * 350;
}

// ─── Realm-level diplomacy: war & peace between root controllers ──────────────
// Wars are declared by ambitious realms against bordering rivals they can beat,
// last a few turns, and end in a truce once both sides are tired or one is broken.
function runRealmDiplomacy(state, regions, playerArmyUnits, onWarDeclared, onPeaceMade) {
  if (!state.wars) state.wars = {};
  if (!state.truces) state.truces = {};
  const turn = state.turn;

  // Border graph between roots
  const borders = new Map(); // root -> Set(root)
  for (const r of regions) {
    const a = getRootController(r.id, state.provinceOwners);
    for (const nid of (r.neighbors || [])) {
      const b = getRootController(nid, state.provinceOwners);
      if (a !== b) {
        if (!borders.has(a)) borders.set(a, new Set());
        borders.get(a).add(b);
      }
    }
  }

  // 1. Peace: tired, broken, or dissolved realms.
  for (const [key, war] of Object.entries(state.wars)) {
    const { a, b } = war;
    const age = turn - war.since;
    const aAlive = getRootController(a, state.provinceOwners) === a;
    const bAlive = getRootController(b, state.provinceOwners) === b;
    const sA = realmStrength(a, state, regions, playerArmyUnits);
    const sB = realmStrength(b, state, regions, playerArmyUnits);
    const lopsided = Math.max(sA, sB) / Math.max(1, Math.min(sA, sB)) > 2.2;
    let peaceChance = 0;
    if (!aAlive || !bAlive || !(borders.get(a)?.has(b))) peaceChance = 1;      // no longer neighbours / dissolved
    else if (age >= 3) peaceChance = Math.min(0.55, 0.10 + (age - 3) * 0.06 + (war.clashes === 0 ? 0.15 : 0));
    if (lopsided && age >= 4) peaceChance *= 0.5; // the stronger side presses on
    if (Math.random() < peaceChance) {
      makePeace(state, regions, a, b, 5 + Math.floor(Math.random() * 4));
      onPeaceMade?.({ a, b, aName: realmName(a, regions), bName: realmName(b, regions), involvesPlayer: a === 1 || b === 1 });
    }
  }

  // 2. Opening peace period.
  if (turn < 3) return;

  // 3. Declarations — at most one per turn, so the map doesn't explode into war at once.
  const wars = Object.values(state.wars);
  const warCount = root => wars.filter(w => w.a === root || w.b === root).length;
  const candidates = [];
  const armedRoots = new Set(state.aiGenerals.map(g => getHomeRootProvince(g, state.provinceOwners)));

  for (const root of armedRoots) {
    if (root === 1) continue; // player decides their own wars
    if (warCount(root) >= 2) continue;
    const sMe = realmStrength(root, state, regions, playerArmyUnits);
    for (const other of (borders.get(root) || [])) {
      if (areRootsAtWar(state, root, other)) continue;
      if ((state.truces[warKey(root, other)] || 0) > turn) continue;
      if (warCount(other) >= 3) continue; // don't pile on one victim
      const sThem = realmStrength(other, state, regions, playerArmyUnits);
      const ratio = sMe / Math.max(1, sThem);
      if (ratio < 0.85) continue;
      // Grievance: lingering past-war bitterness toward this neighbour
      let grievance = 0;
      for (const r of regions) {
        if (getRootController(r.id, state.provinceOwners) !== root) continue;
        for (const nid of (r.neighbors || [])) {
          if (getRootController(nid, state.provinceOwners) === other) {
            grievance += -(state.relations?.[r.id]?.[nid]?.pastWars || 0) / 100;
          }
        }
      }
      const chance = Math.min(0.30, 0.03 + 0.07 * (ratio - 0.85) + grievance * 0.05 + (other === 1 ? 0.01 : 0));
      candidates.push({ root, other, chance });
    }
  }
  candidates.sort((x, y) => y.chance - x.chance);
  for (const c of candidates) {
    if (Math.random() < c.chance) {
      if (declareWar(state, regions, c.root, c.other)) {
        const aggressor = { name: realmName(c.root, regions), shortName: realmName(c.root, regions) };
        const target = { name: realmName(c.other, regions), shortName: realmName(c.other, regions) };
        const announcement = `⚔️ WAR DECLARED! ${aggressor.name} has declared war upon ${target.name}!`;
        state.warDeclarationsLog.push({ turn, aggressor: c.root, target: c.other, text: announcement, timestamp: Date.now() });
        onWarDeclared?.({ aggressor, target, announcement, involvesPlayer: c.other === 1 });
      }
      break;
    }
  }
}

// ─── AI field logic ────────────────────────────────────────────────────────────
function armyMen(g) {
  return (g.units || []).reduce((s, u) => s + Math.max(0, u.men ?? 1000), 0);
}

/** Win chance (0-1) for an army assaulting a province, using the real battle formula. */
export function estimateAssaultChance(gen, reg, settlementGarrisons) {
  const garr = settlementGarrisons?.get?.(reg.id) || generateGarrison(reg.weight || 4);
  const elev = Math.max(0, getElevationAt(reg.center[0], reg.center[1]));
  const res = computeBattle(gen, reg, reg.weight || 4, elev, 'balanced', garr);
  return res.atkWinChance / 100;
}

/**
 * Apply the aftermath of an AI assault to both sides and return the result.
 * Attackers always bleed; a failed assault can break the army.
 */
export function resolveAiAssault(gen, reg, settlementGarrisons) {
  const garr = settlementGarrisons?.get?.(reg.id) || generateGarrison(reg.weight || 4);
  const elev = Math.max(0, getElevationAt(reg.center[0], reg.center[1]));
  const calc = computeBattle(gen, reg, reg.weight || 4, elev, 'balanced', garr);
  const chance = calc.atkWinChance / 100;
  const atkWins = Math.random() < chance;

  const atkMen = calc.atkMen, defMen = calc.defMen;
  const atkLossPct = atkWins ? 0.10 + (1 - chance) * 0.25 : 0.35 + Math.random() * 0.25;
  const defLossPct = atkWins ? 0.55 + Math.random() * 0.3 : 0.12 + chance * 0.25;
  const atkCas = distributeUnequalCasualties(gen.units || [], Math.round(atkMen * atkLossPct), 'balanced');
  const defCas = distributeUnequalCasualties(garr.units || [], Math.round(defMen * defLossPct), 'balanced');

  const survivingAtk = (atkCas.updatedUnits || []).filter(u => (u.men ?? 1000) >= 80);
  const survivingDef = (defCas.updatedUnits || []).filter(u => (u.men ?? 1000) >= 80);
  const newGarrison = {
    cohortCount: survivingDef.length,
    units: survivingDef,
    totalMen: survivingDef.reduce((s, u) => s + (u.men ?? 1000), 0),
  };
  return { atkWins, chance, survivingAtk, newGarrison };
}

// ─── AI Military Target Selection & Behaviour ──────────────────────────────────
// Armies now (1) only fight realms they are AT WAR with, (2) rush to defend a
// threatened province of their realm, (3) pick the best-value assault using the
// real battle model, (4) never pile on the same target, (5) fall back and rest
// when mauled, (6) otherwise station on the frontier facing their enemy.
export function evaluateAiMilitaryDecisions({
  state,
  regions,
  settlementGarrisons,
  playerLegion,
  playerGenerals,
  onAiMarchOrder,
}) {
  const { aiGenerals, provinceOwners } = state;
  const regionById = new Map(regions.map(r => [r.id, r]));
  const playerArmies = playerGenerals || (playerLegion ? [playerLegion] : []);

  // Provinces another army of the same realm is already marching on
  const claimed = new Set();
  for (const g of aiGenerals) {
    if ((g.status === 'marching') && g.targetSettlement) claimed.add(g.targetSettlement.id);
  }

  const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);

  for (const gen of aiGenerals) {
    if (gen.status === 'marching' || gen.status === 'retreating') continue;
    if ((gen.units || []).length === 0) continue;

    const myRoot = getHomeRootProvince(gen, provinceOwners);
    const men = armyMen(gen);
    const original = gen.originalMen || (gen.units.length * 1000);
    const strengthFrac = men / Math.max(1, original);
    const enemyRoots = new Set();
    for (const key of Object.keys(state.wars || {})) {
      const w = state.wars[key];
      if (w.a === myRoot) enemyRoots.add(w.b);
      else if (w.b === myRoot) enemyRoots.add(w.a);
    }

    const ownRegions = regions.filter(r => getRootController(r.id, provinceOwners) === myRoot);

    // ── A. Mauled? Fall back to the nearest own province and rest. ──
    if (strengthFrac < 0.45 && ownRegions.length > 0) {
      const home = ownRegions.reduce((best, r) =>
        dist(gen.x, gen.y, r.center[0], r.center[1]) < dist(gen.x, gen.y, best.center[0], best.center[1]) ? r : best, ownRegions[0]);
      if (dist(gen.x, gen.y, home.center[0], home.center[1]) > 30) {
        onAiMarchOrder?.({ general: gen, action: 'retreat', targetRegion: home, powerRatio: strengthFrac, reason: 'mauled' });
      }
      continue;
    }

    if (enemyRoots.size === 0) {
      // ── Peace: garrison the largest province of the realm nearby (spread armies out). ──
      continue;
    }

    // ── B. Defend: an enemy force is bearing down on one of our provinces ──
    let threatened = null;
    let threatScore = 0;
    for (const reg of ownRegions) {
      const dHere = dist(gen.x, gen.y, reg.center[0], reg.center[1]);
      if (dHere > 420) continue;
      for (const other of aiGenerals) {
        if (other === gen) continue;
        const oRoot = getHomeRootProvince(other, provinceOwners);
        if (!enemyRoots.has(oRoot)) continue;
        const dEnemy = dist(other.x, other.y, reg.center[0], reg.center[1]);
        if (dEnemy < 160) {
          const sc = (reg.weight || 4) * 10 - dHere / 20;
          if (sc > threatScore) { threatScore = sc; threatened = { reg, enemy: other }; }
        }
      }
      if (enemyRoots.has(1)) {
        for (const pg of playerArmies) {
          if (dist(pg.x, pg.y, reg.center[0], reg.center[1]) < 160) {
            const sc = (reg.weight || 4) * 10 - dHere / 20;
            if (sc > threatScore) { threatScore = sc; threatened = { reg, enemy: pg }; }
          }
        }
      }
    }
    if (threatened) {
      const d = dist(gen.x, gen.y, threatened.reg.center[0], threatened.reg.center[1]);
      if (d > 35) {
        onAiMarchOrder?.({ general: gen, action: 'retreat', targetRegion: threatened.reg, powerRatio: 1, reason: 'defend' });
        continue;
      }
      // Already in position: stand and fight (field combat triggers on contact).
      continue;
    }

    // ── C. Offence: find enemy provinces bordering our realm that we can take ──
    const targets = [];
    const seen = new Set();
    for (const own of ownRegions) {
      if (dist(gen.x, gen.y, own.center[0], own.center[1]) > 520) continue; // too far to be relevant
      for (const nid of (own.neighbors || [])) {
        if (seen.has(nid)) continue;
        const nroot = getRootController(nid, provinceOwners);
        if (!enemyRoots.has(nroot)) continue;
        seen.add(nid);
        const reg = regionById.get(nid);
        if (!reg || claimed.has(nid)) continue;
        const d = dist(gen.x, gen.y, reg.center[0], reg.center[1]);
        const chance = estimateAssaultChance(gen, reg, settlementGarrisons);
        // Value: win chance dominates, then prize (weight), then proximity.
        const score = chance * 100 + (reg.weight || 4) * 3 - d / 25;
        targets.push({ reg, chance, d, score });
      }
    }

    // Only attack when the odds are genuinely good; a bigger prize tolerates slightly worse odds.
    const viable = targets
      .filter(t => t.chance >= 0.58 - Math.min(0.06, (t.reg.weight || 4) * 0.006))
      .sort((a, b) => b.score - a.score);
    if (viable.length > 0) {
      const best = viable[0];
      claimed.add(best.reg.id);
      onAiMarchOrder?.({ general: gen, action: 'attack', targetRegion: best.reg, powerRatio: best.chance / Math.max(0.01, 1 - best.chance) });
      continue;
    }

    // ── D. No good attack: take position at the frontier province facing the enemy ──
    const frontier = ownRegions.filter(r => (r.neighbors || []).some(n => enemyRoots.has(getRootController(n, provinceOwners))));
    if (frontier.length > 0) {
      // Prefer a frontier province with no friendly army already standing there.
      const occupied = reg => aiGenerals.some(o => o !== gen && getHomeRootProvince(o, provinceOwners) === myRoot && dist(o.x, o.y, reg.center[0], reg.center[1]) < 60);
      const free = frontier.filter(r => !occupied(r));
      const pool = free.length ? free : frontier;
      const base = pool.reduce((best, r) =>
        dist(gen.x, gen.y, r.center[0], r.center[1]) < dist(gen.x, gen.y, best.center[0], best.center[1]) ? r : best, pool[0]);
      if (dist(gen.x, gen.y, base.center[0], base.center[1]) > 45) {
        onAiMarchOrder?.({ general: gen, action: 'retreat', targetRegion: base, powerRatio: 1, reason: 'frontier' });
      }
    }
  }
}
