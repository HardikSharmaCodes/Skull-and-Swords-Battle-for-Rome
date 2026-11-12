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
// Allows any province across the Mediterranean to raise armies according to need
export function createProvincialArmy(reg, idSuffix = '') {
  const w = reg.weight || 4;
  const regionType = reg.macroRegion || 'independent';
  const site = reg.site;

  let title = `Army of ${site}`;
  let u1Name = 'Provincial Spearmen';
  let u2Name = 'Skirmishers';
  let u3Name = 'Swordsmen';
  let bannerIcon = '⚔️';

  if (regionType === 'rome' || reg.region?.includes('Italy')) {
    title = `Legio ${site}`;
    u1Name = `${site} Hastati`;
    u2Name = `${site} Velites`;
    u3Name = `${site} Principes`;
    bannerIcon = '🦅';
  } else if (regionType === 'gaul' || reg.region?.includes('Gaul')) {
    title = `Warband of ${site}`;
    u1Name = 'Celtic Oathsworn';
    u2Name = 'Gallic Javelins';
    u3Name = 'Arverni Swords';
    bannerIcon = '🐗';
  } else if (regionType === 'iberia' || reg.region?.includes('Iberia')) {
    title = `Host of ${site}`;
    u1Name = 'Scutarii Guerrillas';
    u2Name = 'Cantabrian Javelins';
    u3Name = 'Celtiberian Caetrati';
    bannerIcon = '🐂';
  } else if (regionType === 'germany' || reg.region?.includes('Central Europe')) {
    title = `Warband of ${site}`;
    u1Name = 'Suebi Berserkers';
    u2Name = 'Forest Hunters';
    u3Name = 'Dacian Falxmen';
    bannerIcon = '🐺';
  } else if (regionType === 'greece' || reg.region?.includes('Greece') || reg.region?.includes('Balkans')) {
    title = `Phalanx of ${site}`;
    u1Name = 'Hoplite Phalanx';
    u2Name = 'Cretan Archers';
    u3Name = 'Macedonian Sarissas';
    bannerIcon = '🏛️';
  } else if (regionType === 'carthage' || reg.region?.includes('North Africa') || site === 'Carthage') {
    title = `Punic Host of ${site}`;
    u1Name = 'Libyan Spearmen';
    u2Name = 'Numidian Skirmishers';
    u3Name = 'Poeni Veterans';
    bannerIcon = '🌙';
  } else if (regionType === 'egypt' || reg.region?.includes('Egypt')) {
    title = `Royal Host of ${site}`;
    u1Name = 'Machimoi Phalanx';
    u2Name = 'Archers of the Nile';
    u3Name = 'Galatian Guard';
    bannerIcon = '𓅃';
  } else {
    title = `Forces of ${site}`;
    u1Name = 'Border Spearmen';
    u2Name = 'Archers';
    u3Name = 'Warrior Cohort';
    bannerIcon = '👑';
  }

  const cohorts = [
    { id: `${reg.id}-u1-${idSuffix}`, name: u1Name, type: 'sword_levis', men: 1000, attack: 32 + w, defense: 30 + w, morale: 75 },
    { id: `${reg.id}-u2-${idSuffix}`, name: u2Name, type: 'javelins', men: 1000, attack: 36 + w, defense: 20 + w, morale: 70 },
  ];
  if (w >= 5) {
    cohorts.push({ id: `${reg.id}-u3-${idSuffix}`, name: u3Name, type: 'sword_levis', men: 1000, attack: 35 + w, defense: 32 + w, morale: 78 });
  }
  if (w >= 7) {
    cohorts.push({ id: `${reg.id}-u4-${idSuffix}`, name: `${site} Elite Guard`, type: 'sword_levis', men: 1000, attack: 40 + w, defense: 35 + w, morale: 85 });
  }

  return {
    id: `prov-army-${reg.id}-${idSuffix || Date.now()}`,
    name: title,
    faction: regionType,
    homeSite: site,
    homeProvinceId: reg.id,
    x: reg.center[0] + (Math.random() - 0.5) * 8,
    y: reg.center[1] + (Math.random() - 0.5) * 8,
    units: cohorts,
    status: 'idle',
    baseSpeedKmPerMin: 34 + Math.round(Math.random() * 6),
    bannerIcon,
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

    // 3. Process AI Factions Income & Upkeep
    for (const aiGen of next.aiGenerals) {
      const fac = aiGen.faction;
      const homeId = aiGen.homeProvinceId;
      const cohorts = (aiGen.units || []).length;
      const upkeep = cohorts * 25;
      const genIncome = (homeId ? rootIncomes[homeId] : 0) || (rootIncomes[fac] || 500);
      const net = genIncome - upkeep;
      next.treasuries[fac] = Math.max(0, (next.treasuries[fac] || 0) + net);

      // AI Recruitment: If treasury > 1200 and army has room (< 14 cohorts)
      if (next.treasuries[fac] > 1200 && cohorts < 14) {
        next.treasuries[fac] -= 450;
        const newCohortNum = cohorts + 1;
        const isSword = Math.random() > 0.4;
        aiGen.units.push({
          id: `${fac}-recruit-${Date.now()}-${newCohortNum}`,
          name: isSword ? `${FACTION_CONFIG[fac]?.adjective || ''} Veteran Cohort` : `${FACTION_CONFIG[fac]?.adjective || ''} Skirmishers`,
          type: isSword ? 'sword_levis' : 'javelins',
          men: 1000,
          attack: isSword ? 34 : 36,
          defense: isSword ? 32 : 20,
          morale: 75,
        });
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
    if (next.aiGenerals.length < 42) {
      for (const reg of regions) {
        if (next.aiGenerals.length >= 42) break;
        const myRoot = getRootController(reg.id, next.provinceOwners);
        if (myRoot === 1) continue; // Player manages their own provincial armies

        // Check if province has bordering rival realm
        const hasRivalBorder = (reg.neighbors || []).some(nid => {
          const nRoot = getRootController(nid, next.provinceOwners);
          return nRoot !== myRoot;
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

    // 5. 50% War Declaration Check against hated nations
    checkWarDeclarations(next, onWarDeclared);

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

// ─── 50% War Declaration Check ────────────────────────────────────────────────
// "If a nation hates you, they have a 50% chance of declaring war on the nations they hate (not just the player)."
function checkWarDeclarations(state, onWarDeclared) {
  // Opening peace period: Give factions time to govern, recruit, and assemble their armies before declaring wars
  if (state.turn < 3) return;

  const fKeys = Object.keys(FACTION_CONFIG);

  for (const f1 of fKeys) {
    if (f1 === 'independent') continue; // Minor realms don't launch offensive declarations

    for (const f2 of fKeys) {
      if (f1 === f2) continue;
      const rel = state.relations[f1]?.[f2];
      if (!rel || !rel.areNeighbors || rel.atWar) continue;

      const score = calculateOpinionScore(f1, f2, rel, state.gameTimeSec, state.relations);

      // If a nation hates another nation (score <= -40 / Hostile)
      if (score <= -40) {
        // 50% chance of declaring war!
        if (Math.random() < 0.50) {
          rel.atWar = true;
          if (state.relations[f2]?.[f1]) {
            state.relations[f2][f1].atWar = true;
          }

          const fac1 = FACTION_CONFIG[f1];
          const fac2 = FACTION_CONFIG[f2];
          const announcement = `⚔️ WAR DECLARED! ${fac1.name} has declared war upon ${fac2.name}!`;

          state.warDeclarationsLog.push({
            turn: state.turn,
            aggressor: f1,
            target: f2,
            text: announcement,
            timestamp: Date.now(),
          });

          if (onWarDeclared) {
            onWarDeclared({ aggressor: fac1, target: fac2, announcement });
          }
        }
      }
    }
  }
}

// ─── AI Military Target Selection & Behavior ──────────────────────────────────
// "the enemy units should be doing war against their borders"
// AI provincial hosts actively evaluate adjacent borders (neighboring provinces)
// of different rulers/empires and wage border warfare against rival frontiers.
export function evaluateAiMilitaryDecisions({
  state,
  regions,
  settlementGarrisons,
  playerLegion,
  onAiMarchOrder,
}) {
  const { aiGenerals, provinceOwners } = state;

  for (const gen of aiGenerals) {
    if (gen.status === 'marching' || gen.status === 'retreating') continue; // Already executing an order

    const armyRootId = getRootController(gen.homeProvinceId || gen.faction, provinceOwners);
    const genTotalMen = (gen.units || []).reduce((s, u) => s + (u.men || 1000), 0);

    // 1. Identify which province this army is currently located in or near
    let currentReg = null;
    let minD = Infinity;
    for (const reg of regions) {
      const d = Math.hypot(gen.x - reg.center[0], gen.y - reg.center[1]);
      if (d < minD) {
        minD = d;
        currentReg = reg;
      }
    }
    if (!currentReg) continue;

    // 2. Identify immediate bordering rival provinces (frontier targets)
    const neighborIds = (currentReg.neighbors || []).map(Number);
    const rivalBorderTargets = [];

    for (const nid of neighborIds) {
      const neighborRoot = getRootController(nid, provinceOwners);
      if (neighborRoot !== armyRootId) {
        const borderReg = regions.find(r => r.id === nid);
        if (borderReg) {
          const garrData = settlementGarrisons?.get?.(nid) || { totalMen: (borderReg.weight || 4) * 1000 };
          const garrMen = Math.max(1, garrData.totalMen || 1000);
          const dist = Math.hypot(gen.x - borderReg.center[0], gen.y - borderReg.center[1]);

          // Score: prioritize weaker garrisons and closer immediate border proximity
          const score = (5000 / garrMen) * 1.5 + (800 / Math.max(30, dist));
          rivalBorderTargets.push({
            region: borderReg,
            garrMen,
            dist,
            score,
          });
        }
      }
    }

    if (rivalBorderTargets.length > 0) {
      // ── Border skirmish / frontier invasion across the border! ──
      rivalBorderTargets.sort((a, b) => b.score - a.score);
      const bestTarget = rivalBorderTargets[0];
      const targetDefensePower = bestTarget.garrMen * 1.1;
      const powerRatio = genTotalMen / Math.max(1, targetDefensePower);

      // Attack if army has a fighting chance across the border (powerRatio >= 0.82 or chance assault)
      if (powerRatio >= 0.82 || Math.random() < 0.25) {
        if (onAiMarchOrder) {
          onAiMarchOrder({
            general: gen,
            action: 'attack',
            targetRegion: bestTarget.region,
            powerRatio,
          });
        }
      }
      continue;
    }

    // 3. If no immediate rival neighbors (army is inland / deep inside realm):
    // March to the nearest frontier province belonging to this realm that DOES border a rival
    const friendlyRegions = regions.filter(r => getRootController(r.id, provinceOwners) === armyRootId);
    const frontierStrongholds = friendlyRegions.filter(r => {
      return (r.neighbors || []).some(nid => getRootController(nid, provinceOwners) !== armyRootId);
    });

    if (frontierStrongholds.length > 0) {
      frontierStrongholds.sort((a, b) => {
        const da = Math.hypot(gen.x - a.center[0], gen.y - a.center[1]);
        const db = Math.hypot(gen.x - b.center[0], gen.y - b.center[1]);
        return da - db;
      });
      const frontierBase = frontierStrongholds[0];
      const distToBase = Math.hypot(gen.x - frontierBase.center[0], gen.y - frontierBase.center[1]);

      // Only march if not already stationed at this frontier
      if (distToBase > 45) {
        if (onAiMarchOrder) {
          onAiMarchOrder({
            general: gen,
            action: 'retreat', // repositioning to border frontier
            targetRegion: frontierBase,
            powerRatio: 1.0,
          });
        }
      }
    }
  }
}
