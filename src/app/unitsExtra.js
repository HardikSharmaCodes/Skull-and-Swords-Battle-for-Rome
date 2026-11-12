/**
 * Extra regional troop cultures — the steppe, Thrace/Dacia/Illyria, Arabia,
 * Nubia/Aksum, the Caucasus and Bactria/Central Asia. Merged into UNIT_ROSTER
 * by unitsData.js. Stat scale and fields are identical to the base roster.
 */

// Compact row builder: [id, name, fullName, tier, category, icon, speed, atk, def, mor, cost, strength, description]
function build(rows) {
  return rows.map(([id, name, fullName, tier, category, icon, speed, attack, defense, morale, cost, strength, description]) => ({
    id, name, fullName, tier, category, icon,
    speedKmPerMonth: speed,
    attack, defense, morale,
    cost, upkeep: Math.round(cost / 10),
    strength, description,
  }));
}

export const EXTRA_ROSTER = {
  // ─── PONTIC STEPPE (Scythia / Sarmatia) ───────────────────────────────────
  steppe: {
    label: 'Scythia & Sarmatia',
    color: '#a16207',
    macroRegions: ['steppe'],
    units: build([
      ['steppe-1', 'Roxolani Cataphracts', 'Roxolani Sarmatian Cataphracts', 'E', 'Heavy Cavalry', '🐴', 62, 9, 8, 8, 340, 100,
        'Lance-armed Sarmatian nobles in scale armour on armoured steeds. The first true shock cavalry of the north.'],
      ['steppe-2', 'Royal Scythian Horse Archers', 'Royal Scythian Horse Archers', 'E', 'Ranged Cavalry', '🏹', 80, 8, 4, 8, 300, 140,
        'Hereditary bowmen of the Scythian aristocracy, shooting at the gallop with deadly composite bows.'],
      ['steppe-3', 'Alan Lancers', 'Alan Heavy Lancers', 'M', 'Cavalry', '🏇', 70, 7, 5, 7, 220, 180,
        'Nomads of the eastern steppe riding down from the Caucasus gates; relentless in the charge.'],
      ['steppe-4', 'Sarmatian Riders', 'Sarmatian Horsemen', 'M', 'Cavalry', '🐎', 72, 6, 5, 6, 170, 250,
        'Free tribal riders with lance and bow. The mobile heart of every steppe host.'],
      ['steppe-5', 'Scythian Archer-Foot', 'Scythian Foot Archers', 'L', 'Ranged', '🏹', 40, 5, 3, 4, 70, 450,
        'Dismounted bowmen and herders who defend the wagon-camps and river crossings.'],
      ['steppe-6', 'Wagon-Fort Guard', 'Kurgan Wagon-Fort Guard', 'L', 'Spearmen', '🛡️', 32, 4, 6, 5, 80, 400,
        'Spear-carrying herdsmen fighting behind a ring of wagons. Slow, but stubborn on the defence.'],
    ]),
  },

  // ─── THRACE, DACIA & ILLYRIA ──────────────────────────────────────────────
  thrace: {
    label: 'Thrace, Dacia & Illyria',
    color: '#7f1d1d',
    macroRegions: ['thrace'],
    units: build([
      ['thr-1', 'Dacian Falxmen', 'Dacian Falx Warriors', 'E', 'Shock Infantry', '⚔️', 42, 10, 5, 9, 260, 300,
        'Wielders of the terrifying two-handed falx, able to cleave through helmet and shield alike.'],
      ['thr-2', 'Comati Nobles', 'Dacian Comati Noble Horse', 'E', 'Heavy Cavalry', '🐴', 62, 8, 7, 8, 300, 120,
        'The long-haired Dacian aristocracy, riding to war around the royal fortress of Sarmizegetusa.'],
      ['thr-3', 'Thracian Peltasts', 'Thracian Peltasts', 'M', 'Peltasts', '🗡️', 50, 6, 4, 6, 100, 450,
        'Mobile javelin-fighters with crescent pelte shields; famed across the Hellenistic world.'],
      ['thr-4', 'Illyrian Lembari', 'Illyrian Sea-Raiders', 'M', 'Light Infantry', '⚓', 46, 6, 5, 6, 110, 400,
        'Coastal warriors of the Adriatic who raid from fast light galleys and fight ashore with sword and spear.'],
      ['thr-5', 'Getae Horsemen', 'Getic Horse', 'M', 'Cavalry', '🏇', 66, 6, 5, 6, 150, 220,
        'Riders from the lower Danube who screen the hillforts of the Dacian kings.'],
      ['thr-6', 'Hillfort Levy', 'Highland Tribal Levy', 'L', 'Levy Infantry', '🪖', 36, 4, 4, 4, 50, 600,
        'Mountain herdsmen called to the palisade when the war-horn sounds.'],
    ]),
  },

  // ─── ARABIA ───────────────────────────────────────────────────────────────
  arabia: {
    label: 'Arabia & Nabataea',
    color: '#c2410c',
    macroRegions: ['arabia'],
    units: build([
      ['arab-1', 'Nabataean Camel Corps', 'Nabataean Camel Riders', 'E', 'Cavalry', '🐪', 78, 8, 5, 8, 280, 160,
        'Camel-borne archers and spearmen who strike out of the desert and vanish into it. Horses panic at their smell.'],
      ['arab-2', 'Petra Royal Guard', 'Nabataean Royal Guard of Petra', 'E', 'Guard Infantry', '🏛️', 40, 7, 9, 9, 270, 220,
        'Heavy spearmen holding the rock-cut city and its single narrow gorge entrance.'],
      ['arab-3', 'Qedarite Raiders', 'Qedarite Bedouin Raiders', 'M', 'Light Infantry', '🗡️', 58, 6, 4, 6, 110, 380,
        'Desert tribesmen who know every well and wadi; masters of raiding and ambush.'],
      ['arab-4', 'Himyarite Archers', 'Himyarite Bowmen', 'M', 'Ranged', '🏹', 44, 7, 3, 6, 120, 380,
        'South-Arabian spice-kingdom bowmen with powerful self bows.'],
      ['arab-5', 'Sabaean Spearmen', 'Sabaean Spearmen', 'L', 'Spearmen', '🛡️', 38, 5, 5, 5, 70, 500,
        'Frankincense-road levies armed with spear and wicker shield.'],
      ['arab-6', 'Desert Slingers', 'Bedouin Slingers', 'L', 'Skirmishers', '🪨', 52, 4, 2, 4, 45, 450,
        'Cheap, fast skirmishers who harass columns crossing the wastes.'],
    ]),
  },

  // ─── NUBIA & AKSUM ────────────────────────────────────────────────────────
  nubia: {
    label: 'Kush & Aksum',
    color: '#4d7c0f',
    macroRegions: ['nubia'],
    units: build([
      ['nub-1', 'Kushite Royal Archers', 'Kushite Royal Archers of Meroë', 'E', 'Ranged', '🏹', 46, 9, 4, 8, 260, 260,
        'The "Ta-Seti" — Land of the Bow. Their long bows pierce shields at range; Roman legionaries long remembered them.'],
      ['nub-2', 'Meroitic Guard', 'Meroitic Royal Guard', 'E', 'Guard Infantry', '🛡️', 42, 7, 8, 9, 240, 220,
        'Disciplined temple-and-palace guard of the Kandake queens.'],
      ['nub-3', 'Blemmye Raiders', 'Blemmye Desert Raiders', 'M', 'Light Infantry', '🗡️', 60, 6, 3, 6, 90, 400,
        'Red Sea hill-people who raid the Egyptian frontier at will.'],
      ['nub-4', 'Aksumite Spearmen', 'Proto-Aksumite Spearmen', 'M', 'Spearmen', '🛡️', 40, 6, 6, 6, 100, 450,
        'Highland spearmen from the emerging Aksumite kingdom.'],
      ['nub-5', 'Nubian Camel Scouts', 'Nubian Camel Scouts', 'M', 'Cavalry', '🐪', 75, 5, 4, 6, 130, 180,
        'Fast desert scouts for the long caravan roads to the Nile.'],
      ['nub-6', 'Nile Reed Levy', 'Nilotic Levy Bowmen', 'L', 'Levy Infantry', '🪖', 36, 4, 3, 4, 40, 600,
        'Farmer-archers called up along the Nile cataracts.'],
    ]),
  },

  // ─── CAUCASUS ─────────────────────────────────────────────────────────────
  caucasus: {
    label: 'Caucasus & Caspian',
    color: '#0f766e',
    macroRegions: ['caucasus'],
    units: build([
      ['cauc-1', 'Iberian Nobles', 'Kartlian Iberian Noble Horse', 'E', 'Heavy Cavalry', '🐴', 58, 8, 7, 8, 290, 130,
        'Armoured aristocratic cavalry of the Kartli highlands who fought Pompey in 65 BC.'],
      ['cauc-2', 'Albanian Javelin-Riders', 'Caucasian Albanian Mounted Javelineers', 'M', 'Mounted Skirmishers', '🏇', 68, 6, 4, 6, 150, 200,
        'Light riders of the Kura valley; Pompey met 60,000 of them on the Abas river.'],
      ['cauc-3', 'Colchian Axemen', 'Colchian Axemen', 'M', 'Shock Infantry', '🪓', 44, 7, 5, 6, 110, 420,
        'Forest warriors of the Black Sea coast with heavy axes and wicker shields.'],
      ['cauc-4', 'Hyrcanian Hillmen', 'Hyrcanian Hillmen', 'M', 'Light Infantry', '🗡️', 46, 6, 5, 6, 100, 400,
        'Caspian highlanders loyal to the Parthian crown.'],
      ['cauc-5', 'Pass Defenders', 'Caucasian Gate Defenders', 'L', 'Spearmen', '🛡️', 34, 4, 7, 5, 70, 450,
        'Garrison spearmen who hold the narrow passes of the great range.'],
      ['cauc-6', 'Mountain Slingers', 'Mountain Slingers', 'L', 'Skirmishers', '🪨', 48, 4, 2, 4, 45, 450,
        'Shepherds with slings who rain stones down from the crags.'],
    ]),
  },

  // ─── BACTRIA & CENTRAL ASIA ───────────────────────────────────────────────
  bactria: {
    label: 'Bactria & Central Asia',
    color: '#6d28d9',
    macroRegions: ['bactria'],
    units: build([
      ['bact-1', 'Yuezhi Horse Archers', 'Yuezhi Heavy Horse Archers', 'E', 'Ranged Cavalry', '🏹', 80, 9, 5, 8, 340, 140,
        'The nomad conquerors of Bactria who swept away the Greek kingdoms.'],
      ['bact-2', 'Bactrian Cataphracts', 'Bactrian Cataphracts', 'E', 'Heavy Cavalry', '🐴', 56, 9, 9, 8, 400, 100,
        'Fully armoured lancers, heirs of Alexander\'s Greek settlers and Iranian nobility.'],
      ['bact-3', 'Sogdian Lancers', 'Sogdian Lancers', 'M', 'Cavalry', '🏇', 68, 7, 5, 7, 200, 200,
        'Oasis-city cavalry who guard the Silk Road trade.'],
      ['bact-4', 'Indo-Scythian Archers', 'Indo-Scythian Foot Archers', 'M', 'Ranged', '🏹', 42, 7, 3, 6, 120, 380,
        'Archers of the Scythian kingdoms of the Indus and Oxus.'],
      ['bact-5', 'Oasis Levy', 'Oasis City Levy', 'L', 'Levy Spearmen', '🪖', 34, 4, 4, 4, 55, 550,
        'Farmer-militia called up from the irrigated oasis towns.'],
      ['bact-6', 'Silk Road Guard', 'Caravan Guard', 'L', 'Mixed', '🛡️', 44, 5, 5, 5, 80, 300,
        'Mercenary escorts hardened by desert and bandit alike.'],
    ]),
  },
};
