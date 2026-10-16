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
    name: 'Balanced Stance',
    icon: '⚖️',
    motto: 'Disciplined Cohort Lines',
    badge: 'Standard Doctrine',
    desc: 'Disciplined century lines, pilum volley followed by gladius rotation. Standard casualty exchange and reliable battle efficiency.',
    atkMult: 1.0,
    defMult: 1.0,
    atkLossMult: 1.0,
    defLossMult: 1.0,
    color: '#d4a34b',
    border: '#a67c2e',
  },
  offensive: {
    id: 'offensive',
    name: 'Offensive Stance',
    icon: '⚔️',
    motto: 'Frontal Assault & Battering Rams',
    badge: 'High Aggression',
    desc: 'Massed gladius charges aiming for quick breach. Inflicts devastating garrison losses (+35%), but exposes Roman cohorts to fierce counter-attacks (+25% Roman losses).',
    atkMult: 1.25,
    defMult: 0.85,
    atkLossMult: 1.25,
    defLossMult: 1.35,
    color: '#e74c3c',
    border: '#c0392b',
  },
  defensive: {
    id: 'defensive',
    name: 'Defensive Stance',
    icon: '🛡️',
    motto: 'Testudo Formation & Sapping',
    desc: 'Armored testudo shield walls advancing steadily under ballista cover. Drastically reduces Roman casualties (-35%), but inflicts lower shock on defenders (-15% garrison losses).',
    atkMult: 0.85,
    defMult: 1.30,
    atkLossMult: 0.65,
    defLossMult: 0.85,
    color: '#3498db',
    border: '#2980b9',
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
    const quality = Math.max(0.01, curMen / 1000); // 1.0 = full health, 0.5 = 50% strength
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

  // Scores
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

const CLASH_MSGS = [
  '⚔️ Legions advance under a storm of javelins!',
  '🏹 Arrows darken the sky as skirmishers loose their volleys!',
  '🛡️ The testudo formation absorbs defending missile salvos!',
  '🔥 Battering rams thunder against the fortified gatehouse!',
  '⚔️ Roman gladii cut through the defending front rank!',
  '🚨 Garrison commanders rally at the inner ramparts!',
  '🦅 The Aquila standard surges forward through the breach!',
  '💥 Gate shattered — legionary cohorts flood into the forum!',
  '🛡️ Defenders begin to break under coordinated cohort assault!',
  '🦅 ROME ETERNAL — the battle reaches its decisive climax!',
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
      prog = Math.min(100, prog + 7 + Math.random() * 8);
      setProgress(Math.floor(prog));
      if (tick < CLASH_MSGS.length) {
        setClashLines(function(prev) { return [...prev.slice(-5), CLASH_MSGS[tick]]; });
      }
      if (prog >= 100) {
        clearInterval(intervalRef.current);
        const atkWins = Math.random() * 100 < stats.atkWinChance;

        // Base casualty rates modified by tactical stance
        let baseAtkPct = atkWins ? (0.08 + Math.random() * 0.12) : (0.28 + Math.random() * 0.30);
        let baseDefPct = atkWins ? (0.65 + Math.random() * 0.35) : (0.18 + Math.random() * 0.22);

        const stance = BATTLE_STANCES[stanceKey];
        const computedAtkLosses = Math.min(stats.atkMen, Math.round(stats.atkMen * baseAtkPct * stance.atkLossMult));
        const computedDefLosses = Math.min(stats.defMen, Math.round(stats.defMen * baseDefPct * stance.defLossMult));

        setAtkCasualties(computedAtkLosses);
        setDefCasualties(computedDefLosses);

        // ── Apply real losses to Attacker Units and remove units that hit 0 health ──
        const remainingLossPerCohort = Math.round(computedAtkLosses / Math.max(1, (attacker.units || []).length));
        let destroyed = 0;
        const newAtkUnits = [];

        for (const u of (attacker.units || [])) {
          const cur = Math.max(0, u.men ?? u.count ?? 1000);
          const newMen = cur - remainingLossPerCohort;
          if (newMen > 0) {
            newAtkUnits.push({
              ...u,
              men: newMen,
              count: newMen,
            });
          } else {
            destroyed++;
          }
        }

        setSurvivingUnits(newAtkUnits);
        setUnitsDestroyedCount(destroyed);

        if (atkWins) {
          setWinner('attacker');
        } else {
          setWinner('defender');
        }
        setPhase('result');
      }
    }, 280);
  }

  useEffect(function() {
    return function() {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const fortBonus = stats.fortBonus;

  return (
    <div
      data-ui-layer="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 650,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Cinzel', serif",
      }}
      onClick={function(e) { e.stopPropagation(); }}
    >
      <div
        style={{
          background: 'linear-gradient(160deg,#0d1117 0%,#1a0f07 50%,#0d1117 100%)',
          border: '2px solid #b08a3c',
          borderRadius: 12,
          width: 720,
          maxWidth: '96vw',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 0 60px rgba(255,100,0,0.25), 0 20px 80px rgba(0,0,0,0.9)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg,#8b1a1a 0%,#3d0000 50%,#8b1a1a 100%)',
            borderBottom: '2px solid #b08a3c',
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: '10px 10px 0 0',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#d4a34b', letterSpacing: 3, textTransform: 'uppercase' }}>
              ⚔️ BATTLE OF {defSite.site.toUpperCase()}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginTop: 2 }}>
              Assault on the Settlement Center
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #6b4020',
              color: '#a08060',
              fontSize: 18,
              cursor: 'pointer',
              width: 32,
              height: 32,
              borderRadius: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '18px 22px' }}>

          {/* Force Comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, marginBottom: 16, alignItems: 'stretch' }}>
            {/* Roman Legion */}
            <div style={{ background: 'rgba(30,80,30,0.25)', border: '1.5px solid #2a7a2a', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#5dba5d', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>
                🦅 Roman Legion
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{attacker.name}</div>
              <div style={{ fontSize: 11, color: '#b8d4b8', lineHeight: 1.7 }}>
                <div>⚔️ Active Cohorts: <b style={{ color: '#fff' }}>{stats.atkCohorts} / 20</b></div>
                <div>👥 Men (Unit Quality): <b style={{ color: '#fff' }}>{stats.atkMen.toLocaleString()} troops</b></div>
                <div>🗡️ Effective Attack: <b style={{ color: '#fff' }}>{stats.atkAttack}</b></div>
                <div>🛡️ Effective Defense: <b style={{ color: '#fff' }}>{stats.atkDefense}</b></div>
                <div>💪 Average Morale: <b style={{ color: '#fff' }}>{stats.atkMorale}%</b></div>
              </div>
              <div style={{ marginTop: 8, padding: '5px 8px', background: 'rgba(30,100,30,0.4)', borderRadius: 4, fontSize: 10, color: '#7dda7d' }}>
                Combat Power: <b>{stats.atkScore}</b>
              </div>
            </div>

            {/* VS Emblem */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
              <div style={{ fontSize: 24, color: '#d4a34b', fontWeight: 900 }}>VS</div>
              {phase !== 'pre' && (
                <div style={{ marginTop: 12, width: 40, height: 40, borderRadius: '50%', background: 'radial-gradient(circle,#ff4444,#880000)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 0 15px rgba(255,50,50,0.6)' }}>
                  ⚔️
                </div>
              )}
            </div>

            {/* Garrison */}
            <div style={{ background: 'rgba(80,30,30,0.25)', border: '1.5px solid #7a2a2a', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#ba5d5d', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>
                🏛️ Garrison Defenders
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{defSite.site}</div>
              <div style={{ fontSize: 11, color: '#d4b8b8', lineHeight: 1.7 }}>
                <div>⚔️ Cohorts: <b style={{ color: '#fff' }}>{stats.defCohorts} / 20</b></div>
                <div>👥 Defenders: <b style={{ color: '#fff' }}>{stats.defMen.toLocaleString()} troops</b></div>
                <div>🗡️ Defense Attack: <b style={{ color: '#fff' }}>{stats.defAttack}</b></div>
                <div>🛡️ Base Defense: <b style={{ color: '#fff' }}>{stats.defDefense}</b></div>
                <div>💪 Morale: <b style={{ color: '#fff' }}>{stats.defMorale}%</b></div>
              </div>
              <div style={{ marginTop: 8, padding: '5px 8px', background: 'rgba(100,30,30,0.4)', borderRadius: 4, fontSize: 10, color: '#da7d7d' }}>
                Fortified Power: <b>{stats.defScore}</b>
              </div>
            </div>
          </div>

          {/* ── Tactical Stance Selector (Options: Offensive, Defensive, Balanced) ── */}
          {phase === 'pre' && (
            <div style={{ background: 'rgba(15,10,6,0.9)', border: '1.5px solid #5a4020', borderRadius: 8, padding: '14px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#ffd700', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase', fontWeight: 800 }}>
                ⚖️ CHOOSE TACTICAL BATTLE STANCE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {Object.values(BATTLE_STANCES).map((st) => {
                  const isSelected = stanceKey === st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => setStanceKey(st.id)}
                      style={{
                        background: isSelected ? 'linear-gradient(160deg, #2b1f14 0%, #150e09 100%)' : '#120d08',
                        border: isSelected ? `2px solid ${st.color}` : '1px solid #4a3820',
                        borderRadius: 6,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        boxShadow: isSelected ? `0 0 15px ${st.color}55` : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 14 }}>{st.icon}</span>
                        <span style={{ fontSize: 9, color: st.color, fontWeight: 800, textTransform: 'uppercase' }}>
                          {st.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: isSelected ? '#ffd700' : '#fff', marginBottom: 2 }}>
                        {st.name}
                      </div>
                      <div style={{ fontSize: 9.5, color: '#e8c988', fontStyle: 'italic', marginBottom: 6 }}>
                        "{st.motto}"
                      </div>
                      <div style={{ fontSize: 9.5, color: '#a08868', lineHeight: 1.35 }}>
                        {st.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tactical Modifiers & Win Chance */}
          <div style={{ background: 'rgba(20,15,8,0.8)', border: '1px solid #4a3820', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#d4a34b', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>
              ⚖️ Battlefield Conditions & Probability
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ padding: '6px 12px', background: stats.elevBonus > 0 ? 'rgba(60,100,60,0.4)' : 'rgba(40,40,40,0.4)', border: '1px solid ' + (stats.elevBonus > 0 ? '#3a8a3a' : '#333'), borderRadius: 6, fontSize: 11, color: stats.elevBonus > 0 ? '#8de88d' : '#666' }}>
                🏔️ Terrain Elevation: <b>+{stats.elevBonus}% DEF</b>
                {stats.elevBonus > 0 && <div style={{ fontSize: 9, color: '#6ab06a' }}>Settlement High Ground</div>}
              </div>
              <div style={{ padding: '6px 12px', background: fortBonus.pct > 0 ? 'rgba(100,60,20,0.4)' : 'rgba(40,40,40,0.4)', border: '1px solid ' + (fortBonus.pct > 0 ? '#8a5a1a' : '#333'), borderRadius: 6, fontSize: 11, color: fortBonus.pct > 0 ? '#e8aa4e' : '#666' }}>
                🏰 Fortifications: <b>+{fortBonus.pct}% DEF</b>
                {fortBonus.pct > 0 && <div style={{ fontSize: 9, color: '#c48a2e' }}>{fortBonus.label}</div>}
              </div>
              <div style={{ padding: '6px 12px', background: 'rgba(20,40,80,0.4)', border: '1px solid #1a3a6a', borderRadius: 6, fontSize: 11, flex: 1, minWidth: 140 }}>
                <div style={{ color: '#6ab0ea' }}>Win Probability ({stats.stance.name})</div>
                <div style={{ display: 'flex', gap: 0, marginTop: 4, borderRadius: 4, overflow: 'hidden', height: 8 }}>
                  <div style={{ flex: stats.atkWinChance, background: 'linear-gradient(90deg,#22aa22,#44dd44)' }} />
                  <div style={{ flex: 100 - stats.atkWinChance, background: 'linear-gradient(90deg,#cc2222,#ff4444)' }} />
                </div>
                <div style={{ fontSize: 9, color: '#8ab8e8', marginTop: 3 }}>
                  Rome: <b>{stats.atkWinChance}%</b> · Garrison: <b>{100 - stats.atkWinChance}%</b>
                </div>
              </div>
            </div>
          </div>

          {/* Clash Log */}
          {phase !== 'pre' && (
            <div style={{ background: 'rgba(5,5,5,0.85)', border: '1px solid #332211', borderRadius: 8, padding: 12, marginBottom: 16, maxHeight: 150, overflowY: 'auto' }}>
              {clashLines.map(function(line, i) {
                return (
                  <div key={i} style={{ fontSize: 11, color: i === clashLines.length - 1 ? '#ffd700' : '#a08868', marginBottom: 4, lineHeight: 1.4 }}>
                    {line}
                  </div>
                );
              })}
            </div>
          )}

          {/* Progress */}
          {phase === 'clash' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#d4a34b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 2 }}>
                Assault In Progress...
              </div>
              <div style={{ background: '#111', borderRadius: 4, height: 12, overflow: 'hidden', border: '1px solid #4a3820' }}>
                <div style={{ height: '100%', width: progress + '%', background: 'linear-gradient(90deg,#8b1a1a,#cc3333,#ff6644)', transition: 'width 0.2s ease', boxShadow: '0 0 8px rgba(255,100,50,0.5)' }} />
              </div>
              <div style={{ textAlign: 'right', fontSize: 9, color: '#666', marginTop: 3 }}>{progress}%</div>
            </div>
          )}

          {/* Result */}
          {phase === 'result' && (
            <div style={{ background: winner === 'attacker' ? 'linear-gradient(135deg,rgba(20,60,20,0.5),rgba(10,30,10,0.8))' : 'linear-gradient(135deg,rgba(80,10,10,0.5),rgba(40,0,0,0.8))', border: '2px solid ' + (winner === 'attacker' ? '#33aa33' : '#aa2222'), borderRadius: 10, padding: '16px 20px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 2, color: winner === 'attacker' ? '#66ff66' : '#ff4444', marginBottom: 8, textShadow: winner === 'attacker' ? '0 0 20px rgba(100,255,100,0.5)' : '0 0 20px rgba(255,50,50,0.5)' }}>
                {winner === 'attacker' ? '🦅 VICTORIA! ROME TRIUMPHANT!' : '🛡️ ASSAULT REPELLED!'}
              </div>
              <div style={{ fontSize: 13, color: '#c8b898', marginBottom: 12 }}>
                {winner === 'attacker'
                  ? `${defSite.site} has fallen to Rome! The garrison has been routed. Since defending soldiers fell in combat, the captured city has 0 garrison remaining.`
                  : `Defenders of ${defSite.site} resisted the assault! Surviving garrison units sustained heavy casualties.`}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <div style={{ background: 'rgba(30,80,30,0.4)', border: '1px solid #2a6a2a', borderRadius: 6, padding: '8px 16px' }}>
                  <div style={{ fontSize: 10, color: '#6ab06a' }}>Roman Losses</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#ff8866' }}>{atkCasualties.toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: '#a08060' }}>
                    {unitsDestroyedCount > 0 ? `⚠️ ${unitsDestroyedCount} Cohort(s) Wiped Out` : 'Cohorts Weakened'}
                  </div>
                </div>
                <div style={{ background: 'rgba(80,30,30,0.4)', border: '1px solid #6a2a2a', borderRadius: 6, padding: '8px 16px' }}>
                  <div style={{ fontSize: 10, color: '#ba5d5d' }}>Defender Losses</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#ff8866' }}>{defCasualties.toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: '#a08060' }}>
                    ({Math.round(defCasualties / Math.max(1, stats.defMen) * 100)}% of garrison depleted)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            {phase === 'pre' && (
              <button
                onClick={startClash}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg,#8b1a1a,#cc2222)',
                  border: '1px solid #d4a34b',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Cinzel',serif",
                  letterSpacing: 1,
                  boxShadow: '0 4px 16px rgba(200,50,50,0.4)',
                }}
              >
                ⚔️ COMMENCE ASSAULT ({stats.stance.name.toUpperCase()})
              </button>
            )}

            {phase === 'result' && winner === 'attacker' && (
              <button
                onClick={function() {
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
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg,#1a6b1a,#22aa22)',
                  border: '1px solid #5db85d',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Cinzel',serif",
                  letterSpacing: 1,
                }}
              >
                🦅 Claim {defSite.site} for Rome!
              </button>
            )}

            {phase === 'result' && winner === 'defender' && (
              <button
                onClick={function() {
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
                  padding: '10px 24px',
                  background: 'rgba(40,30,20,0.8)',
                  border: '1px solid #6a4a20',
                  borderRadius: 6,
                  color: '#c8a868',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: "'Cinzel',serif",
                }}
              >
                ⬅️ Sound Retreat & Regroup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
