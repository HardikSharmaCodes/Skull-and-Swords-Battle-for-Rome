'use client';
import { useState, useEffect, useRef } from 'react';

export function getFortBonus(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('imperial capital')) return { label: 'Imperial Citadel & Aurelian Walls', pct: 50 };
  if (t.includes('frontier fortress')) return { label: 'Frontier Fortress Walls', pct: 45 };
  if (t.includes('mountain pass fort')) return { label: 'Mountain Pass Fortifications', pct: 42 };
  if (t.includes('royal residence')) return { label: 'Palace Fortifications', pct: 38 };
  if (t.includes('hill fort')) return { label: 'Hill Fort Ramparts', pct: 35 };
  if (t.includes('fortified harbor')) return { label: 'Harbor Seawalls', pct: 35 };
  if (t.includes('naval base')) return { label: 'Naval Arsenal Walls', pct: 30 };
  if (t.includes('military base')) return { label: 'Military Garrison Walls', pct: 28 };
  if (t.includes('metropolis')) return { label: 'City Walls & Towers', pct: 25 };
  if (t.includes('regional capital')) return { label: 'Provincial Walls', pct: 25 };
  if (t.includes('seaport')) return { label: 'Port Defensive Works', pct: 25 };
  if (t.includes('roman colony')) return { label: 'Colony Palisades', pct: 20 };
  if (t.includes('oppidum')) return { label: 'Gallic Murus Gallicus', pct: 18 };
  if (t.includes('market town')) return { label: 'Town Earthworks', pct: 15 };
  if (t.includes('trading emporium')) return { label: 'Merchant Walls', pct: 12 };
  return { label: 'Open Settlement', pct: 0 };
}

export function generateGarrison(weight) {
  const cohortCount = Math.max(1, weight || 1);
  const units = [];
  for (let i = 0; i < cohortCount; i++) {
    const isSword = i < Math.ceil(cohortCount * 0.6);
    units.push({
      id: 'garrison-' + i,
      type: isSword ? 'sword_levis' : 'javelins',
      name: isSword ? 'Sword Levis' : 'Javelin Skirmishers',
      men: 1000,
      count: 1000,
      attack: isSword ? 30 : 34,
      defense: isSword ? 32 : 18,
      morale: 65 + (weight || 1) * 2,
    });
  }
  return { cohortCount, units, totalMen: cohortCount * 1000 };
}

export const BATTLE_STANCES = {
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    icon: '⚖️',
    badge: 'Standard',
    desc: 'Disciplined cohort lines with standard rotation.',
    atkMult: 1.0,
    defMult: 1.0,
    atkLossMult: 1.0,
    defLossMult: 1.0,
    color: '#d4a34b',
  },
  offensive: {
    id: 'offensive',
    name: 'Offensive',
    icon: '⚔️',
    badge: 'Assault',
    desc: 'Frontal breach. +35% enemy losses, +25% Roman losses.',
    atkMult: 1.25,
    defMult: 0.85,
    atkLossMult: 1.25,
    defLossMult: 1.35,
    color: '#e74c3c',
  },
  defensive: {
    id: 'defensive',
    name: 'Defensive',
    icon: '🛡️',
    badge: 'Testudo',
    desc: 'Shield wall formation. -35% Roman casualties.',
    atkMult: 0.85,
    defMult: 1.30,
    atkLossMult: 0.65,
    defLossMult: 0.85,
    color: '#3498db',
  },
};

export function computeBattle(attackerGeneral, defSite, defWeight, elevation, stanceKey, existingGarrison) {
  const stance = BATTLE_STANCES[stanceKey] || BATTLE_STANCES.balanced;

  // 1. Attacker army analysis taking UNIT QUALITY (current health / 1000) into account
  const atkCohorts = attackerGeneral.units || [];
  const atkCount = atkCohorts.length;

  let totalAtkMen = 0;
  let weightedAtkAttack = 0;
  let weightedAtkDefense = 0;
  let weightedAtkMorale = 0;

  for (const u of atkCohorts) {
    const curMen = Math.max(0, u.men ?? u.count ?? 1000);
    const quality = Math.max(0.01, curMen / 1000);
    totalAtkMen += curMen;
    weightedAtkAttack += (u.attack || 30) * quality;
    weightedAtkDefense += (u.defense || 25) * quality;
    weightedAtkMorale += (u.morale || 65) * (0.6 + 0.4 * quality);
  }

  const avgAtkAttack = (atkCount > 0 ? weightedAtkAttack / atkCount : 25) * stance.atkMult;
  const avgAtkDefense = (atkCount > 0 ? weightedAtkDefense / atkCount : 20) * stance.defMult;
  const avgAtkMorale = atkCount > 0 ? weightedAtkMorale / atkCount : 60;

  // 2. Defender garrison analysis taking current persistent health into account
  const garrison = existingGarrison || generateGarrison(defWeight);
  const defCohorts = garrison.units || [];
  const defCount = defCohorts.length;

  let totalDefMen = 0;
  let weightedDefAttack = 0;
  let weightedDefDefense = 0;
  let weightedDefMorale = 0;

  for (const gu of defCohorts) {
    const curMen = Math.max(0, gu.men ?? gu.count ?? 1000);
    const quality = Math.max(0.01, curMen / 1000);
    totalDefMen += curMen;
    weightedDefAttack += (gu.attack || 25) * quality;
    weightedDefDefense += (gu.defense || 22) * quality;
    weightedDefMorale += (gu.morale || 65) * (0.6 + 0.4 * quality);
  }

  const avgDefAttack = defCount > 0 ? weightedDefAttack / defCount : 20;
  const avgDefDefense = defCount > 0 ? weightedDefDefense / defCount : 20;
  const avgDefMorale = defCount > 0 ? weightedDefMorale / defCount : 60;

  // Modifiers: Elevation & Castle Fortifications
  const elevBonus = Math.min(35, Math.max(0, Math.round(elevation / 25)));
  const fortBonus = getFortBonus(defSite.type);

  // Combat power scores
  const atkScore = (totalAtkMen / 1000) * avgAtkAttack * (avgAtkMorale / 100) * 1.8;
  const defScore = Math.max(0.1, (totalDefMen / 1000) * avgDefDefense * (avgDefMorale / 100)
    * (1 + elevBonus / 100)
    * (1 + fortBonus.pct / 100));

  const totalScore = atkScore + defScore;
  const atkWinChance = Math.min(0.97, Math.max(0.03, atkScore / totalScore));

  return {
    stance,
    atkCohorts: atkCount,
    atkMen: totalAtkMen,
    atkAttack: avgAtkAttack.toFixed(1),
    atkDefense: avgAtkDefense.toFixed(1),
    atkMorale: avgAtkMorale.toFixed(0),
    defCohorts: defCount,
    defMen: totalDefMen,
    defAttack: avgDefAttack.toFixed(1),
    defDefense: avgDefDefense.toFixed(1),
    defMorale: avgDefMorale.toFixed(0),
    elevBonus,
    fortBonus,
    atkWinChance: Math.round(atkWinChance * 100),
    atkScore: atkScore.toFixed(1),
    defScore: defScore.toFixed(1),
    garrison,
  };
}

// ─── Unequal Casualties Distribution with Random Engagement Factor ──────────
export function distributeUnequalCasualties(units, totalLosses, stanceKey) {
  if (!units || units.length === 0 || totalLosses <= 0) {
    return { updatedUnits: units, destroyedCount: 0 };
  }

  // Assign random engagement weights based on unit role and battle chaos
  const weights = units.map((u, idx) => {
    const curMen = Math.max(0, u.men ?? u.count ?? 1000);
    if (curMen === 0) return 0;

    const type = (u.type || u.typeId || '').toLowerCase();
    const isMelee = type.includes('sword') || type.includes('melee');
    const isRanged = type.includes('javelin') || type.includes('ranged');

    let base = 1.0;
    if (isMelee) base = 1.35;
    else if (isRanged) base = stanceKey === 'offensive' ? 1.15 : stanceKey === 'defensive' ? 0.55 : 0.85;

    // Random engagement factor (0.3x to 2.2x variance)
    const randomFactor = 0.3 + Math.random() * 1.9;
    // Frontline cohort bias
    const vanguardBias = idx < Math.ceil(units.length * 0.45) ? 1.25 : 0.85;

    return base * randomFactor * vanguardBias;
  });

  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;
  let distributed = 0;
  const losses = units.map((u, i) => {
    const curMen = Math.max(0, u.men ?? u.count ?? 1000);
    const loss = Math.min(curMen, Math.round(totalLosses * (weights[i] / totalWeight)));
    distributed += loss;
    return loss;
  });

  // Distribute rounding remainder
  let remainder = totalLosses - distributed;
  while (remainder > 0) {
    let bestIdx = -1;
    let maxRemaining = 0;
    for (let i = 0; i < units.length; i++) {
      const curMen = Math.max(0, units[i].men ?? units[i].count ?? 1000);
      const rem = curMen - losses[i];
      if (rem > maxRemaining) {
        maxRemaining = rem;
        bestIdx = i;
      }
    }
    if (bestIdx === -1 || maxRemaining <= 0) break;
    losses[bestIdx] += 1;
    remainder--;
  }

  let destroyedCount = 0;
  const updatedUnits = [];

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const curMen = Math.max(0, u.men ?? u.count ?? 1000);
    const newMen = curMen - losses[i];
    if (newMen > 0) {
      updatedUnits.push({
        ...u,
        men: newMen,
        count: newMen,
      });
    } else {
      destroyedCount++;
    }
  }

  return { updatedUnits, destroyedCount };
}

// ─── Field Battle Calculation (Army vs Army in Open Field) ─────────────────
export function computeFieldBattle(atkGeneral, defGeneral, elevation = 0, stanceKey = 'balanced') {
  const stance = BATTLE_STANCES[stanceKey] || BATTLE_STANCES.balanced;

  // 1. Attacker army analysis taking unit quality into account
  const atkCohorts = atkGeneral.units || [];
  const atkCount = atkCohorts.length;
  let totalAtkMen = 0;
  let weightedAtkAttack = 0;
  let weightedAtkDefense = 0;
  let weightedAtkMorale = 0;

  for (const u of atkCohorts) {
    const curMen = Math.max(0, u.men ?? u.count ?? 1000);
    const quality = Math.max(0.01, curMen / 1000);
    totalAtkMen += curMen;
    weightedAtkAttack += (u.attack || 30) * quality;
    weightedAtkDefense += (u.defense || 25) * quality;
    weightedAtkMorale += (u.morale || 65) * (0.6 + 0.4 * quality);
  }

  const avgAtkAttack = (atkCount > 0 ? weightedAtkAttack / atkCount : 25) * stance.atkMult;
  const avgAtkDefense = (atkCount > 0 ? weightedAtkDefense / atkCount : 20) * stance.defMult;
  const avgAtkMorale = atkCount > 0 ? weightedAtkMorale / atkCount : 60;

  // 2. Defender army analysis
  const defCohorts = defGeneral.units || [];
  const defCount = defCohorts.length;
  let totalDefMen = 0;
  let weightedDefAttack = 0;
  let weightedDefDefense = 0;
  let weightedDefMorale = 0;

  for (const du of defCohorts) {
    const curMen = Math.max(0, du.men ?? du.count ?? 1000);
    const quality = Math.max(0.01, curMen / 1000);
    totalDefMen += curMen;
    weightedDefAttack += (du.attack || 28) * quality;
    weightedDefDefense += (du.defense || 24) * quality;
    weightedDefMorale += (du.morale || 65) * (0.6 + 0.4 * quality);
  }

  const avgDefAttack = defCount > 0 ? weightedDefAttack / defCount : 25;
  const avgDefDefense = defCount > 0 ? weightedDefDefense / defCount : 22;
  const avgDefMorale = defCount > 0 ? weightedDefMorale / defCount : 60;

  // Field elevation advantage (holding the high ground)
  const elevBonus = Math.min(25, Math.max(0, Math.round(elevation / 40)));

  const atkScore = (totalAtkMen / 1000) * avgAtkAttack * (avgAtkMorale / 100) * 1.5;
  const defScore = Math.max(0.1, (totalDefMen / 1000) * avgDefDefense * (avgDefMorale / 100) * (1 + elevBonus / 100) * 1.5);

  const totalScore = atkScore + defScore;
  const atkWinChance = Math.min(0.97, Math.max(0.03, atkScore / totalScore));

  return {
    stance,
    atkMen: totalAtkMen,
    defMen: totalDefMen,
    atkScore,
    defScore,
    atkWinChance,
  };
}

// ─── Field Battle Simulation Outcome with Total Force Deletion Chance ───────
export function simulateFieldBattleOutcome(atkGeneral, defGeneral, elevation = 0, stanceKey = 'balanced') {
  const calc = computeFieldBattle(atkGeneral, defGeneral, elevation, stanceKey);
  const atkWins = Math.random() < calc.atkWinChance;

  const winner = atkWins ? atkGeneral : defGeneral;
  const loser = atkWins ? defGeneral : atkGeneral;
  const winnerMen = atkWins ? calc.atkMen : calc.defMen;
  const loserMen = atkWins ? calc.defMen : calc.atkMen;

  // Ratio of force disparity
  const powerRatio = atkWins
    ? (calc.atkScore / Math.max(0.1, calc.defScore))
    : (calc.defScore / Math.max(0.1, calc.atkScore));

  // Casualties
  // Loser suffers 50% to 85% casualty rate
  const loserCasualtyPct = Math.min(0.96, 0.50 + Math.random() * 0.35 + (powerRatio > 1.5 ? 0.12 : 0));
  // Winner suffers 15% to 35% casualty rate
  const winnerCasualtyPct = Math.max(0.06, Math.min(0.40, (0.25 - (powerRatio - 1) * 0.08) * (0.8 + Math.random() * 0.4)));

  const loserLosses = Math.min(loserMen, Math.round(loserMen * loserCasualtyPct));
  const winnerLosses = Math.min(winnerMen, Math.round(winnerMen * winnerCasualtyPct));

  const loserCas = distributeUnequalCasualties(loser.units || [], loserLosses, 'balanced');
  const winnerCas = distributeUnequalCasualties(winner.units || [], winnerLosses, 'balanced');

  // Total force loss / unit deletion chance:
  // User Requirement: "The attacker or the defender has a chance of loosing it's entire force in a feild battle which causes the unit to be deleted"
  // Catastrophic rout, envelopment, or all cohorts destroyed
  const annihilationRoll = Math.random();
  const annihilationThreshold = powerRatio >= 2.0 ? 0.65 : powerRatio >= 1.5 ? 0.48 : 0.35;
  const isTotalAnnihilation = (annihilationRoll < annihilationThreshold) || (loserCas.updatedUnits.length === 0);

  const finalLoserUnits = isTotalAnnihilation ? [] : loserCas.updatedUnits;
  const finalWinnerUnits = winnerCas.updatedUnits;

  return {
    atkWins,
    winner,
    loser,
    winnerUnits: finalWinnerUnits,
    loserUnits: finalLoserUnits,
    winnerLosses,
    loserLosses,
    isTotalAnnihilation,
    isLoserDeleted: isTotalAnnihilation || finalLoserUnits.length === 0,
    isWinnerDeleted: finalWinnerUnits.length === 0,
    powerRatio,
  };
}

const CLASH_MSGS = [
  '⚔️ Legions advance under a storm of javelins!',
  '🏹 Volleys darken the sky as skirmishers engage!',
  '🛡️ Testudo wall absorbs missile fire at the gate!',
  '🔥 Battering rams breach the fortified gatehouse!',
  '⚔️ Roman gladii clash with defenders in the forum!',
  '🦅 Aquila standard surges forward through the breach!',
  '💥 Roman victory confirmed — city secured!',
];

export default function BattleModal({
  attacker,
  defSite,
  defWeight,
  elevation,
  existingGarrison,
  onClose,
  onVictory,
  onDefeat,
}) {
  const [stanceKey, setStanceKey] = useState('balanced');
  const [phase, setPhase] = useState('pre'); // 'pre' | 'clash' | 'result'
  const [winner, setWinner] = useState(null);
  const [progress, setProgress] = useState(0);
  const [atkCasualties, setAtkCasualties] = useState(0);
  const [defCasualties, setDefCasualties] = useState(0);
  const [survivingUnits, setSurvivingUnits] = useState([]);
  const [unitsDestroyedCount, setUnitsDestroyedCount] = useState(0);
  const [clashLines, setClashLines] = useState([]);
  const intervalRef = useRef(null);

  const stats = computeBattle(attacker, defSite, defWeight, elevation, stanceKey, existingGarrison);

  function startClash() {
    setPhase('clash');
    setProgress(0);
    setClashLines([CLASH_MSGS[0]]);
    let tick = 0;
    let prog = 0;

    intervalRef.current = setInterval(function() {
      tick++;
      prog = Math.min(100, prog + 9 + Math.random() * 9);
      setProgress(Math.floor(prog));
      if (tick < CLASH_MSGS.length) {
        setClashLines(function(prev) { return [...prev.slice(-3), CLASH_MSGS[tick]]; });
      }
      if (prog >= 100) {
        clearInterval(intervalRef.current);
        const atkWins = Math.random() * 100 < stats.atkWinChance;

        // Base casualty rates modified by stance
        let baseAtkPct = atkWins ? (0.07 + Math.random() * 0.12) : (0.28 + Math.random() * 0.30);
        let baseDefPct = atkWins ? (0.68 + Math.random() * 0.32) : (0.18 + Math.random() * 0.22);

        const stance = BATTLE_STANCES[stanceKey];
        const computedAtkLosses = Math.min(stats.atkMen, Math.round(stats.atkMen * baseAtkPct * stance.atkLossMult));
        const computedDefLosses = Math.min(stats.defMen, Math.round(stats.defMen * baseDefPct * stance.defLossMult));

        setAtkCasualties(computedAtkLosses);
        setDefCasualties(computedDefLosses);

        // ── Apply Unequal Casualties with random engagement factor ──
        const atkResult = distributeUnequalCasualties(attacker.units || [], computedAtkLosses, stanceKey);
        setSurvivingUnits(atkResult.updatedUnits);
        setUnitsDestroyedCount(atkResult.destroyedCount);

        if (atkWins) {
          setWinner('attacker');
        } else {
          setWinner('defender');
        }
        setPhase('result');
      }
    }, 240);
  }

  useEffect(function() {
    return function() {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div
      data-ui-layer="true"
      style={{
        position: 'fixed',
        bottom: 22,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 650,
        width: 490,
        maxWidth: '95vw',
        background: 'linear-gradient(180deg, #18120c 0%, #0d0905 100%)',
        border: '2px solid #b08a3c',
        borderRadius: 8,
        boxShadow: '0 0 45px rgba(0,0,0,0.95), 0 0 25px rgba(212,163,75,0.35)',
        fontFamily: "'Cinzel', serif",
        userSelect: 'none',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Top Balance-of-Power Bar & Header matching Reference Image ── */}
      <div style={{ background: '#0a0704', padding: '6px 12px', borderBottom: '1.5px solid #b08a3c' }}>
        {/* Yellow / Red Balance of Power Bar */}
        <div style={{
          height: 7,
          background: '#801515',
          borderRadius: 2,
          overflow: 'hidden',
          display: 'flex',
          border: '1px solid #000',
          marginBottom: 4,
        }}>
          <div style={{
            width: `${stats.atkWinChance}%`,
            background: 'linear-gradient(90deg, #ffd700, #ffb300)',
            boxShadow: '0 0 6px rgba(255,215,0,0.8)',
            transition: 'width 0.25s ease',
          }} />
        </div>

        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#ffd700' }}>⚔️</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#ffe18f', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              BATTLE DEPLOYMENT: {defSite.site}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a08060',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ padding: '10px 14px' }}>

        {/* Compact Forces Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          {/* Attacker */}
          <div style={{ background: 'rgba(25, 45, 20, 0.5)', border: '1px solid #2a5a22', borderRadius: 4, padding: '5px 8px' }}>
            <div style={{ fontSize: 9, color: '#5dba5d', fontWeight: 800 }}>🦅 {attacker.name}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>
              {stats.atkMen.toLocaleString()} <span style={{ fontSize: 9.5, color: '#b8d4b8' }}>({stats.atkCohorts} coh)</span>
            </div>
            <div style={{ fontSize: 8.5, color: '#8da88d', marginTop: 1 }}>Power: {stats.atkScore}</div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 900, color: '#d4a34b' }}>VS</div>

          {/* Defender */}
          <div style={{ background: 'rgba(50, 20, 15, 0.5)', border: '1px solid #6a251b', borderRadius: 4, padding: '5px 8px', textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#ba5d5d', fontWeight: 800 }}>🏛️ {defSite.site}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>
              {stats.defMen.toLocaleString()} <span style={{ fontSize: 9.5, color: '#d4b8b8' }}>({stats.defCohorts} coh)</span>
            </div>
            <div style={{ fontSize: 8.5, color: '#a88d8d', marginTop: 1 }}>Power: {stats.defScore}</div>
          </div>
        </div>

        {/* ── Compact Tactical Stance Selector ── */}
        {phase === 'pre' && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {Object.values(BATTLE_STANCES).map((st) => {
                const isSelected = stanceKey === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => setStanceKey(st.id)}
                    style={{
                      background: isSelected ? 'linear-gradient(180deg, #2b1f14 0%, #150e09 100%)' : '#100b07',
                      border: isSelected ? `1.5px solid ${st.color}` : '1px solid #4a3820',
                      borderRadius: 4,
                      padding: '4px 6px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'Cinzel', serif",
                      boxShadow: isSelected ? `0 0 8px ${st.color}44` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: isSelected ? '#ffd700' : '#ddd' }}>
                        {st.icon} {st.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 8, color: '#a08868', marginTop: 2, lineHeight: 1.2 }}>
                      {st.badge}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 8.5, color: '#e8c988', marginTop: 4, fontStyle: 'italic', textAlign: 'center' }}>
              {BATTLE_STANCES[stanceKey].desc}
            </div>
          </div>
        )}

        {/* Clash Log */}
        {phase !== 'pre' && (
          <div style={{ background: '#0a0704', border: '1px solid #332211', borderRadius: 4, padding: '6px 8px', marginBottom: 8, maxHeight: 75, overflowY: 'auto' }}>
            {clashLines.map((line, i) => (
              <div key={i} style={{ fontSize: 9.5, color: i === clashLines.length - 1 ? '#ffd700' : '#8a7862', lineHeight: 1.3 }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Progress Bar */}
        {phase === 'clash' && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ background: '#111', borderRadius: 2, height: 8, overflow: 'hidden', border: '1px solid #4a3820' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #8b1a1a, #cc3333, #ffd700)', transition: 'width 0.2s ease' }} />
            </div>
          </div>
        )}

        {/* Result Screen */}
        {phase === 'result' && (
          <div style={{
            background: winner === 'attacker' ? 'rgba(20,50,20,0.6)' : 'rgba(50,15,15,0.6)',
            border: `1.5px solid ${winner === 'attacker' ? '#2ecc71' : '#e74c3c'}`,
            borderRadius: 4,
            padding: '8px 10px',
            marginBottom: 8,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: winner === 'attacker' ? '#58d68d' : '#e74c3c' }}>
              {winner === 'attacker' ? `🦅 VICTORIA! ${attacker?.name ? attacker.name.toUpperCase() : 'ATTACKER'} TRIUMPHANT!` : '🛡️ ASSAULT REPELLED!'}
            </div>
            <div style={{ fontSize: 9.5, color: '#ddd', marginTop: 2 }}>
              {winner === 'attacker'
                ? 'City fallen! Garrison wiped out (0 defenders remain).'
                : 'Defenders held! Both forces sustained unequal losses.'}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 9, color: '#ff9999' }}>
                Attacker losses: <b>{atkCasualties.toLocaleString()}</b>
                {unitsDestroyedCount > 0 && ` (${unitsDestroyedCount} wiped)`}
              </span>
              <span style={{ fontSize: 9, color: '#ffb380' }}>
                Defender losses: <b>{defCasualties.toLocaleString()}</b>
              </span>
            </div>
          </div>
        )}

        {/* Action Button Row */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          <div style={{ fontSize: 9, color: '#a08868', marginRight: 'auto' }}>
            Odds: <b style={{ color: '#ffd700' }}>{stats.atkWinChance}%</b>
          </div>

          {phase === 'pre' && (
            <button
              onClick={startClash}
              style={{
                padding: '6px 18px',
                background: 'linear-gradient(135deg, #a61c1c 0%, #e74c3c 100%)',
                border: '1px solid #ffd700',
                borderRadius: 4,
                color: '#fff',
                fontSize: 11,
                fontWeight: 900,
                cursor: 'pointer',
                letterSpacing: 1,
                fontFamily: "'Cinzel', serif",
                boxShadow: '0 2px 10px rgba(231,76,60,0.4)',
              }}
            >
              ⚔️ COMMENCE ASSAULT
            </button>
          )}

          {phase === 'result' && winner === 'attacker' && (
            <button
              onClick={() => {
                if (onVictory) {
                  onVictory({
                    defSite,
                    survivingUnits,
                    atkCasualties,
                    defCasualties,
                  });
                }
                onClose();
              }}
              style={{
                padding: '6px 18px',
                background: 'linear-gradient(135deg, #1b7a2b 0%, #2ecc71 100%)',
                border: '1px solid #ffd700',
                borderRadius: 4,
                color: '#fff',
                fontSize: 11,
                fontWeight: 900,
                cursor: 'pointer',
                letterSpacing: 1,
                fontFamily: "'Cinzel', serif",
              }}
            >
              🦅 CLAIM {defSite.site.toUpperCase()}
            </button>
          )}

          {phase === 'result' && winner === 'defender' && (
            <button
              onClick={() => {
                if (onDefeat) {
                  onDefeat({
                    defSite,
                    survivingUnits,
                    atkCasualties,
                    defCasualties,
                    existingGarrison: stats.garrison,
                  });
                }
                onClose();
              }}
              style={{
                padding: '6px 18px',
                background: 'rgba(50,35,20,0.8)',
                border: '1px solid #73481e',
                borderRadius: 4,
                color: '#c8a868',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
              }}
            >
              ⬅️ RETREAT
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
