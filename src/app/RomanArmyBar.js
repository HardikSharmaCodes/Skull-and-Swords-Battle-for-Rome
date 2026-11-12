'use client';

import React, { useState } from 'react';
import { RomanAudio } from './gameEngine';
import { TIER_STYLE } from './unitsData';
import { instantiateCohort } from './troopCatalog';

// ─── Unit Classes Definition ────────────────────────────────────────────────
export const UNIT_CLASSES = {
  melee: {
    id: 'melee',
    label: 'Melee Infantry',
    icon: '⚔️',
    color: '#e74c3c',
    badgeColor: '#ffd700',
    symbol: '⚔',
  },
  ranged: {
    id: 'ranged',
    label: 'Missile / Ranged',
    icon: '🏹',
    color: '#3498db',
    badgeColor: '#ffd700',
    symbol: '🏹',
  },
  mounted: {
    id: 'mounted',
    label: 'Cavalry / Mounted',
    icon: '🐎',
    color: '#2ecc71',
    badgeColor: '#ffd700',
    symbol: '🐎',
  },
};

// ─── Two Hirable Unit Types (1,000 troops per unit cohort) ──────────────────
export const HIRABLE_UNITS = [
  {
    typeId: 'sword_levis',
    name: 'Sword Levis',
    unitClass: 'melee',
    men: 1000,
    cost: 100,
    attack: 30,
    defense: 32,
    morale: 65,
    armor: 'Lorica Hamata & Scutum',
    weapon: 'Gladius Hispaniensis',
    description: 'Disciplined Roman infantry equipped with the famed gladius short sword and large curved scutum shield. The backbone of imperial conquest.',
    icon: '⚔️',
  },
  {
    typeId: 'javelins',
    name: 'Javelins',
    unitClass: 'ranged',
    men: 1000,
    cost: 90,
    attack: 34,
    defense: 18,
    morale: 55,
    range: 120,
    armor: 'Light Tunic & Wolf Pelt',
    weapon: 'Barbed Pilum & Parma',
    description: 'Swift skirmishers armed with bundles of barbed throwing javelins and round parma shields designed to shatter enemy shield walls before contact.',
    icon: '🏹',
  },
];

// ─── Authentic Roman Warrior Vector Art for Unit Cards ───────────────────────
function UnitCardArt({ typeId, unitClass, isGeneral = false }) {
  if (isGeneral) {
    return (
      <svg width="38" height="56" viewBox="0 0 38 56" fill="none">
        {/* Background Aura */}
        <rect x="0" y="0" width="38" height="56" fill="url(#bgGeneral)" />
        {/* Helmet with Imperial Red Crest */}
        <path d="M14 6C14 3 24 3 24 6V12H14V6Z" fill="#b81d13" />
        <path d="M12 12C12 7 26 7 26 12V18H12V12Z" fill="#ffd700" stroke="#7a5518" strokeWidth="0.8" />
        {/* Visor & Face */}
        <circle cx="19" cy="15" r="3.5" fill="#e8c090" />
        {/* Gilded Lorica Musculata */}
        <path d="M11 20L19 18L27 20V38L19 41L11 38V20Z" fill="#d4af37" stroke="#7a5518" strokeWidth="1" />
        <path d="M15 25C15 29 23 29 23 25" stroke="#997018" strokeWidth="1.2" fill="none" />
        {/* Imperial Purple Paludamentum Cloak */}
        <path d="M9 21L6 42L11 44L12 24Z" fill="#5c1040" />
        <path d="M29 21L32 42L27 44L26 24Z" fill="#5c1040" />
        {/* Aquila Eagle Scepter */}
        <line x1="28" y1="14" x2="33" y2="46" stroke="#ffd700" strokeWidth="1.5" />
        <circle cx="28" cy="14" r="2.5" fill="#ffd700" />
        <defs>
          <linearGradient id="bgGeneral" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d1e12" />
            <stop offset="100%" stopColor="#1a0b06" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (unitClass === 'melee' || typeId === 'sword_levis') {
    return (
      <svg width="38" height="56" viewBox="0 0 38 56" fill="none">
        {/* Warm Classical Backdrop */}
        <rect x="0" y="0" width="38" height="56" fill="url(#bgMelee)" />
        {/* Roman Galea Helmet with Red Crest */}
        <path d="M16 4C17 2 21 2 22 4V10H16V4Z" fill="#c0392b" />
        <ellipse cx="19" cy="11" rx="6" ry="4" fill="#a47832" stroke="#5a3d12" strokeWidth="0.8" />
        <path d="M15 13L16 18M23 13L22 18" stroke="#a47832" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="19" cy="14" r="3" fill="#eac39d" />
        {/* Lorica Segmentata Shoulder & Torso Plates */}
        <path d="M12 18L19 16L26 18L25 32L19 33L13 32L12 18Z" fill="#5a6572" stroke="#333d47" strokeWidth="0.8" />
        <line x1="13" y1="22" x2="25" y2="22" stroke="#d5dbe2" strokeWidth="0.8" />
        <line x1="13" y1="26" x2="25" y2="26" stroke="#d5dbe2" strokeWidth="0.8" />
        {/* Red Roman Scutum Shield with Golden Eagle Wings */}
        <rect x="7" y="16" width="13" height="30" rx="3" fill="#a62217" stroke="#ffd700" strokeWidth="1" />
        <circle cx="13.5" cy="31" r="3" fill="#ffd700" stroke="#684210" strokeWidth="0.8" />
        {/* Golden Wings on Scutum */}
        <path d="M8 24L13 28M19 24L14 28M8 38L13 34M19 38L14 34" stroke="#ffd700" strokeWidth="1" strokeLinecap="round" />
        {/* Gladius Sword held in right hand */}
        <polygon points="26,16 28,15 29,31 27,31" fill="#e0e0e0" stroke="#555" strokeWidth="0.6" />
        <rect x="25.5" y="31" width="3.5" height="1.8" fill="#ffd700" />
        <rect x="26.5" y="33" width="1.5" height="3" fill="#6d4625" />
        {/* Caligae Sandals */}
        <rect x="15" y="44" width="3" height="5" fill="#6d4625" />
        <rect x="21" y="44" width="3" height="5" fill="#6d4625" />
        <defs>
          <linearGradient id="bgMelee" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d9cfbe" />
            <stop offset="60%" stopColor="#c5baa7" />
            <stop offset="100%" stopColor="#9a8c76" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  // Ranged (Javelins)
  return (
    <svg width="38" height="56" viewBox="0 0 38 56" fill="none">
      {/* Ochre Parchment Backdrop */}
      <rect x="0" y="0" width="38" height="56" fill="url(#bgRanged)" />
      {/* Velite Wolf Headpiece / Cap */}
      <path d="M14 6C15 4 23 4 24 6C25 10 23 13 19 13C15 13 13 10 14 6Z" fill="#755a43" />
      <circle cx="19" cy="14" r="3" fill="#eac39d" />
      {/* Light Linen Tunic */}
      <path d="M13 18L19 17L25 18L24 34L14 34L13 18Z" fill="#cfbe9b" stroke="#756448" strokeWidth="0.8" />
      <line x1="14" y1="25" x2="24" y2="25" stroke="#9e2a22" strokeWidth="1.5" />
      {/* Round Parma Shield with Solar Burst Pattern */}
      <circle cx="14" cy="30" r="10" fill="#1b415c" stroke="#ffd700" strokeWidth="1.2" />
      <circle cx="14" cy="30" r="4" fill="#a62217" stroke="#ffd700" strokeWidth="0.8" />
      <path d="M14 20V26M14 34V40M4 30H10M18 30H24" stroke="#ffd700" strokeWidth="0.8" />
      {/* Barbed Javelins (Pila Bundle) */}
      <line x1="18" y1="46" x2="31" y2="6" stroke="#c0c5cc" strokeWidth="1.6" strokeLinecap="round" />
      <polygon points="31,6 28,10 32,9" fill="#ffd700" />
      <line x1="21" y1="46" x2="34" y2="8" stroke="#a0a5ac" strokeWidth="1.4" strokeLinecap="round" />
      <polygon points="34,8 31,12 35,11" fill="#ffd700" />
      {/* Feet */}
      <rect x="15" y="44" width="3" height="5" fill="#6d4625" />
      <rect x="21" y="44" width="3" height="5" fill="#6d4625" />
      <defs>
        <linearGradient id="bgRanged" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbd2be" />
          <stop offset="60%" stopColor="#c7bc9f" />
          <stop offset="100%" stopColor="#968968" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Single Unit Slot Card Component ────────────────────────────────────────
function UnitSlotCard({
  slotIndex,
  unit,
  isSelected,
  onClick,
  onDisband,
}) {
  const [isHovered, setIsHovered] = useState(false);

  if (!unit) {
    // Empty Slot Card (Styled Roman Architrave Slot)
    return (
      <div
        data-ui-layer="true"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: 44,
          height: 94,
          flexShrink: 0,
          background: isHovered
            ? 'linear-gradient(180deg, rgba(42, 34, 25, 0.95) 0%, rgba(24, 18, 12, 0.95) 100%)'
            : 'linear-gradient(180deg, rgba(22, 18, 14, 0.90) 0%, rgba(12, 10, 8, 0.90) 100%)',
          border: isHovered ? '1.5px dashed #ffd700' : '1px dashed #54412f',
          borderRadius: 3,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          transition: 'all 0.15s ease',
          boxShadow: isHovered ? '0 0 12px rgba(255, 215, 0, 0.4), inset 0 0 8px rgba(0,0,0,0.8)' : 'inset 0 0 6px rgba(0,0,0,0.6)',
        }}
        title={`Slot #${slotIndex + 1}: Click to Raise Cohort`}
      >
        <span style={{ fontSize: '18px', color: isHovered ? '#ffd700' : '#735a3e', lineHeight: 1, fontWeight: 300 }}>+</span>
        <span style={{ fontSize: '8.5px', color: isHovered ? '#ffe18f' : '#5a4632', fontFamily: "'Cinzel', serif" }}>
          #{slotIndex + 1}
        </span>
      </div>
    );
  }

  // Filled Unit Card (Total War: Rome II Authentic Style)
  const classMeta = UNIT_CLASSES[unit.unitClass] || UNIT_CLASSES.melee;
  const isGeneralUnit = Boolean(unit.isGeneral);

  return (
    <div
      data-ui-layer="true"
      onClick={onClick}
      onMouseEnter={() => {
        setIsHovered(true);
        RomanAudio.playHover();
      }}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 44,
        height: 94,
        flexShrink: 0,
        position: 'relative',
        background: 'linear-gradient(180deg, #d8cbba 0%, #b8a892 100%)',
        border: isSelected ? '2px solid #ffd700' : '1px solid #735a3e',
        borderRadius: 3,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 1px 3px 1px',
        boxShadow: isSelected || isHovered
          ? '0 0 14px rgba(255, 215, 0, 0.7), 0 6px 12px rgba(0,0,0,0.9)'
          : '0 3px 8px rgba(0,0,0,0.7)',
        transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
        userSelect: 'none',
        overflow: 'hidden',
      }}
      title={`${unit.name} (${classMeta.label}${unit.tier ? ' · ' + (TIER_STYLE[unit.tier]?.label || '') : ''}) • ${(unit.men ?? 1000).toLocaleString()} troops • ATK ${unit.attack} DEF ${unit.defense} MOR ${unit.morale}`}
    >
      {/* Top Diamond Badge with Weapon Icon & Chevrons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 2px', zIndex: 2 }}>
        <div
          style={{
            width: 14,
            height: 14,
            background: isGeneralUnit ? '#ffd700' : '#f5a623',
            border: '1px solid #3d2402',
            transform: 'rotate(45deg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.7)',
            marginLeft: 2,
          }}
        >
          <span
            style={{
              transform: 'rotate(-45deg)',
              fontSize: '8px',
              fontWeight: 900,
              color: '#1a0b02',
              lineHeight: 1,
            }}
          >
            {isGeneralUnit ? '★' : classMeta.symbol}
          </span>
        </div>

        {/* Double Rank Chevrons */}
        <span style={{ fontSize: '7.5px', color: '#ffd700', fontWeight: 900, letterSpacing: '-0.5px', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
          {isGeneralUnit ? '»»»' : '»»'}
        </span>
      </div>

      {/* Center Unit Card Illustration */}
      <div style={{ margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {(!isGeneralUnit && unit.icon && unit.typeId !== 'sword_levis' && unit.typeId !== 'javelins')
          ? (
            <div style={{ width: 38, height: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#d9cfbe 0%,#9a8c76 100%)' }}>
              <span style={{ fontSize: 24, lineHeight: 1 }}>{unit.icon}</span>
              <span style={{ fontSize: 6.5, fontWeight: 900, color: (TIER_STYLE[unit.tier] || TIER_STYLE.M).color, background: '#1a120a', padding: '0 3px', borderRadius: 2, marginTop: 3 }}>
                {(TIER_STYLE[unit.tier] || TIER_STYLE.M).label.slice(0, 5)}
              </span>
            </div>
          )
          : <UnitCardArt typeId={unit.typeId} unitClass={unit.unitClass} isGeneral={isGeneralUnit} />}
      </div>

      {/* Troop Strength Number Pill */}
      {(() => {
        const unitMen = isGeneralUnit ? 1000 : Math.max(0, unit.men ?? unit.count ?? 1000);
        const hpPct = Math.max(0, Math.min(100, Math.round((unitMen / 1000) * 100)));
        const hpColor = hpPct > 60
          ? 'linear-gradient(90deg, #27ae60, #2ecc71)'
          : hpPct > 30
            ? 'linear-gradient(90deg, #d35400, #f39c12)'
            : 'linear-gradient(90deg, #c0392b, #e74c3c)';
        return (
          <>
            <div style={{
              fontSize: '8.5px',
              fontWeight: 900,
              color: hpPct < 35 ? '#800000' : '#1b130b',
              fontFamily: "'Cinzel', serif",
              background: 'rgba(255,255,255,0.85)',
              padding: '0 4px',
              borderRadius: 2,
              lineHeight: 1.2,
            }}>
              {unitMen.toLocaleString()}
            </div>

            {/* Dynamic Unit Health / Readiness Bar at the Bottom */}
            <div
              style={{
                width: '94%',
                height: 4,
                background: '#1a0b06',
                borderRadius: 1,
                overflow: 'hidden',
                border: '0.5px solid #000000',
              }}
              title={`Readiness: ${unitMen} / 1,000 (${hpPct}%)`}
            >
              <div style={{ width: `${hpPct}%`, height: '100%', background: hpColor, transition: 'width 0.3s ease' }} />
            </div>
          </>
        );
      })()}

      {/* Disband Button on Hover */}
      {isHovered && !isGeneralUnit && onDisband && (
        <button
          data-ui-layer="true"
          onClick={(e) => {
            e.stopPropagation();
            RomanAudio.playClick();
            onDisband(unit.id);
          }}
          style={{
            position: 'absolute',
            top: 1,
            right: 1,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#c0392b',
            border: '1px solid #ffd700',
            color: '#ffffff',
            fontSize: '9px',
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.8)',
            zIndex: 10,
          }}
          title="Disband this cohort"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Classical Circular Roman Medallion Buttons (Matching Screenshot) ────────
function RomanMedallion({ icon, label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      data-ui-layer="true"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: hovered
          ? 'radial-gradient(circle, #f9e29a 0%, #d4a34b 60%, #875e18 100%)'
          : 'radial-gradient(circle, #ecd58b 0%, #c4943b 60%, #704b10 100%)',
        border: hovered ? '2px solid #ffffff' : '1.5px solid #3d2402',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: hovered
          ? '0 0 10px rgba(255, 215, 0, 0.6), 0 3px 6px rgba(0,0,0,0.8)'
          : '0 2px 5px rgba(0,0,0,0.6)',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        transition: 'all 0.12s ease',
        padding: 0,
      }}
      title={label}
    >
      <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>
    </button>
  );
}

// ─── Drawer tab pill ─────────────────────────────────────────────────────────
function DrawerTab({ active, onClick, children }) {
  return (
    <button
      data-ui-layer="true"
      onClick={() => { RomanAudio.playClick(); onClick(); }}
      style={{
        padding: '5px 14px', fontSize: '11px', fontWeight: 900, cursor: 'pointer', borderRadius: 5,
        fontFamily: "'Cinzel', serif", letterSpacing: '0.5px',
        background: active ? 'linear-gradient(180deg, #d4af37 0%, #997316 100%)' : 'rgba(255,255,255,0.05)',
        color: active ? '#1a0d02' : '#d9c6a3',
        border: active ? '1.5px solid #ffd700' : '1px solid #54412f',
      }}
    >
      {children}
    </button>
  );
}

// ─── Stat bar (0–50 scale for attack/defense, 0–100 for morale) ──────────────
function StatBar({ label, value, max, color }) {
  const pct = Math.max(4, Math.min(100, (value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '8.5px', color: '#cdb994' }}>
      <span style={{ width: 24, fontWeight: 800 }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: '#0b0805', borderRadius: 3, overflow: 'hidden', border: '0.5px solid #3a2a18' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
      <span style={{ width: 20, textAlign: 'right', color: '#ffe18f', fontWeight: 800 }}>{value}</span>
    </div>
  );
}

// ─── Recruitable unit card ───────────────────────────────────────────────────
function RecruitCard({ tpl, isFull, canAfford, onRecruit }) {
  const tier = TIER_STYLE[tpl.tier] || TIER_STYLE.M;
  const classMeta = UNIT_CLASSES[tpl.unitClass] || UNIT_CLASSES.melee;
  const disabled = isFull || tpl.locked || !canAfford;
  const reason = tpl.locked ? tpl.lockedReason : isFull ? 'Legion full' : !canAfford ? 'Not enough Denarii' : null;
  const roman = tpl.typeId === 'sword_levis' || tpl.typeId === 'javelins';
  return (
    <div
      data-ui-layer="true"
      style={{
        background: 'linear-gradient(180deg, #241b12 0%, #161009 100%)',
        border: `1.5px solid ${tpl.locked ? '#3a2e22' : tier.color + '88'}`,
        borderRadius: 6,
        padding: '9px 11px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        opacity: tpl.locked ? 0.55 : 1,
        boxShadow: '0 3px 10px rgba(0,0,0,0.55)',
      }}
    >
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 44, height: 58, flexShrink: 0, background: '#0e0b07', border: `1.5px solid ${tier.color}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {roman
            ? <UnitCardArt typeId={tpl.typeId} unitClass={tpl.unitClass} />
            : <span style={{ fontSize: 28 }}>{tpl.icon}</span>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#ffd700', lineHeight: 1.15 }}>{tpl.name}</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '8px', fontWeight: 900, padding: '1px 5px', borderRadius: 3, color: tier.color, background: tier.bg, border: `1px solid ${tier.color}66` }}>{tier.label}</span>
            <span style={{ fontSize: '8px', fontWeight: 800, padding: '1px 5px', borderRadius: 3, color: '#d9c6a3', background: 'rgba(255,255,255,0.07)' }}>{classMeta.icon} {tpl.category}</span>
            {tpl.mercenary && <span style={{ fontSize: '8px', fontWeight: 800, padding: '1px 5px', borderRadius: 3, color: '#e6a04a', background: 'rgba(120,70,0,0.35)' }}>MERCENARY</span>}
          </div>
        </div>
      </div>
      <div style={{ fontSize: '8.5px', color: '#bba488', lineHeight: 1.35, minHeight: 34 }}>{tpl.description}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <StatBar label="ATK" value={tpl.attack} max={42} color="linear-gradient(90deg,#9b2d20,#e74c3c)" />
        <StatBar label="DEF" value={tpl.defense} max={42} color="linear-gradient(90deg,#1f5f99,#4aa3e8)" />
        <StatBar label="MOR" value={tpl.morale} max={95} color="linear-gradient(90deg,#8a6d10,#ffd700)" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: '10.5px', color: canAfford ? '#ffd700' : '#e74c3c', fontWeight: 800 }}>
          🪙 {tpl.cost}
          <span style={{ color: '#8f7d5f', fontWeight: 600, fontSize: '9px' }}> · upkeep {tpl.upkeep}</span>
        </div>
        <button
          data-ui-layer="true"
          disabled={disabled}
          title={reason || ''}
          onClick={onRecruit}
          style={{
            padding: '5px 11px',
            background: disabled ? '#3a3a3a' : 'linear-gradient(180deg, #961e15 0%, #5e120d 100%)',
            border: disabled ? '1px solid #555' : '1.5px solid #ffd700',
            borderRadius: 4,
            color: disabled ? '#8a8a8a' : '#ffffff',
            fontFamily: "'Cinzel', serif",
            fontSize: '9.5px',
            fontWeight: 900,
            cursor: disabled ? 'not-allowed' : 'pointer',
            letterSpacing: '0.5px',
          }}
        >
          {reason ? reason.toUpperCase().slice(0, 18) : '+ EQUIP COHORT'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Roman Army Division Bar Component (20 Slots) ───────────────────────
export default function RomanArmyBar({
  general,
  onRecruitUnit,
  onDisbandUnit,
  onClose,
  recruitOptions,      // { cultureKey, cultureLabel, local[], roman[] } from troopCatalog.getRecruitOptions
  locationName,        // nearest province name
  locationOwned,       // true if the player controls that province
  treasury = 0,
}) {
  const [showRecruitDrawer, setShowRecruitDrawer] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [drawerTab, setDrawerTab] = useState('local');
  const [classFilter, setClassFilter] = useState('all');

  if (!general) return null;

  const units = general.units || [];
  const maxUnits = general.maxUnits || 20;
  const isFull = units.length >= maxUnits;
  const totalTroops = units.reduce((sum, u) => sum + Math.max(0, u.men ?? u.count ?? 1000), 0);

  const handleRecruit = (template) => {
    if (isFull || template.locked || treasury < template.cost) return;
    onRecruitUnit(instantiateCohort(template, 'cohort', { recruitCost: template.cost }), template.cost);
  };

  const opts = recruitOptions || { cultureKey: 'rome', cultureLabel: 'Roman Republic', local: [], roman: [] };
  const hasLocal = opts.local.length > 0 && opts.cultureKey !== 'rome';
  const activeTab = hasLocal ? drawerTab : 'roman';
  const rawList = activeTab === 'local' ? opts.local : (opts.cultureKey === 'rome' ? [...opts.local, ...opts.roman] : opts.roman);
  const shownList = rawList
    .filter(t => classFilter === 'all' || t.unitClass === classFilter)
    .sort((a, b) => ({ E: 0, M: 1, L: 2 }[a.tier] - { E: 0, M: 1, L: 2 }[b.tier]) || a.cost - b.cost);

  return (
    <div
      data-ui-layer="true"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 125,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'auto',
        userSelect: 'none',
        maxWidth: '98vw',
        animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── "Raise Units" Recruitment Drawer (Emerges Above Bar) ───────────── */}
      {showRecruitDrawer && (
        <div
          data-ui-layer="true"
          style={{
            width: '980px',
            maxWidth: '96vw',
            marginBottom: 8,
            background: 'linear-gradient(180deg, #1b130b 0%, #0d0a07 100%)',
            border: '2px solid #ffd700',
            borderRadius: 7,
            padding: '10px 14px 12px',
            boxShadow: '0 14px 40px rgba(0,0,0,0.95), 0 0 20px rgba(255, 215, 0, 0.35)',
            fontFamily: "'Cinzel', Georgia, serif",
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#ffd700', fontWeight: 900, letterSpacing: '0.8px' }}>
                🏛️ RAISE UNITS — {units.length}/{maxUnits} COHORTS
              </div>
              <div style={{ fontSize: '10px', color: '#c4ad8e', marginTop: 2 }}>
                📍 Army stands near <b style={{ color: '#ffe18f' }}>{locationName || 'open country'}</b>
                {' · '}
                {locationOwned
                  ? <span style={{ color: '#58d68d' }}>loyal province — local troops at full price, elites available</span>
                  : <span style={{ color: '#e6a04a' }}>foreign land — local troops hired as mercenaries (+50%), no elites</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '12px', color: '#ffd700', fontWeight: 900 }}>🪙 {Math.floor(treasury).toLocaleString()}</span>
              <button
                data-ui-layer="true"
                onClick={() => { RomanAudio.playClick(); setShowRecruitDrawer(false); }}
                style={{ background: '#2a110a', border: '1px solid #733118', color: '#ffe18f', padding: '3px 9px', borderRadius: 4, cursor: 'pointer', fontWeight: 800, fontSize: '11px' }}
              >
                ✕ CLOSE
              </button>
            </div>
          </div>

          {/* Tabs + class filter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {hasLocal && (
                <DrawerTab active={activeTab === 'local'} onClick={() => setDrawerTab('local')}>
                  🌍 Local · {opts.cultureLabel}
                </DrawerTab>
              )}
              <DrawerTab active={activeTab === 'roman'} onClick={() => setDrawerTab('roman')}>
                🦅 Roman Line
              </DrawerTab>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['all', 'All'], ['melee', '⚔ Melee'], ['ranged', '🏹 Ranged'], ['mounted', '🐎 Mounted']].map(([id, label]) => (
                <button
                  key={id}
                  data-ui-layer="true"
                  onClick={() => setClassFilter(id)}
                  style={{
                    padding: '3px 9px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', borderRadius: 11,
                    fontFamily: "'Cinzel', serif",
                    background: classFilter === id ? '#ffd700' : 'rgba(255,255,255,0.06)',
                    color: classFilter === id ? '#1a0d02' : '#d9c6a3',
                    border: classFilter === id ? '1px solid #ffd700' : '1px solid #54412f',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Unit cards */}
          <div
            data-ui-layer="true"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: 10,
              maxHeight: 'min(46vh, 380px)',
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {shownList.length === 0 && (
              <div style={{ color: '#9a8a70', fontSize: 11, padding: 14 }}>No units of that class are available here.</div>
            )}
            {shownList.map((tpl) => (
              <RecruitCard
                key={tpl.typeId}
                tpl={tpl}
                isFull={isFull}
                canAfford={treasury >= tpl.cost}
                onRecruit={() => handleRecruit(tpl)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Main Total War Legion Roster Frame (Identical to Uploaded Image) ─── */}
      <div
        data-ui-layer="true"
        style={{
          width: '980px',
          maxWidth: '96vw',
          background: 'linear-gradient(180deg, #eae2d3 0%, #dbd0be 18%, #c7baa2 100%)',
          border: '2px solid #5a452c',
          borderRadius: 6,
          boxShadow: '0 16px 45px rgba(0,0,0,0.95), inset 0 1.5px 0 #ffffff, inset 0 -1.5px 0 #735939',
          overflow: 'hidden',
          fontFamily: "'Cinzel', Georgia, serif",
        }}
      >
        {/* ── Top Header Bar: "20/20     THE LEGION OF ...     Troops" ───────── */}
        <div
          data-ui-layer="true"
          style={{
            background: 'linear-gradient(180deg, #1f1811 0%, #130f0a 100%)',
            borderBottom: '1.5px solid #c89e43',
            padding: '5px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Left: Capacity Counter (X/20) matching screenshot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                color: '#ffe18f',
                fontWeight: 900,
                fontSize: '12px',
                fontFamily: "'Cinzel', serif",
                letterSpacing: '0.8px',
              }}
            >
              {units.length}/{maxUnits}
            </span>
          </div>

          {/* Center: Legion Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '12px', color: '#ffd700' }}>🦅</span>
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#f5e4bd', letterSpacing: '1.2px', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
              THE LEGION OF {general.name.replace('General ', '').toUpperCase()}
            </span>
          </div>

          {/* Right: Total Troops & Close Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '10.5px', color: '#58d68d', fontWeight: 800 }}>
              🛡️ {totalTroops.toLocaleString()} SOLDIERS
            </span>

            <button
              data-ui-layer="true"
              onClick={onClose}
              style={{
                background: '#2b1008',
                border: '1px solid #732a18',
                color: '#ffe18f',
                padding: '2px 7px',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '11px',
              }}
              title="Deselect Division (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── 20 Unit Slots Horizontal Row (As in Attached Screenshot) ──────── */}
        <div
          data-ui-layer="true"
          style={{
            background: 'linear-gradient(180deg, #10151d 0%, #090c10 100%)',
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            overflowX: 'auto',
            borderBottom: '1.5px solid #4a3820',
          }}
        >
          {Array.from({ length: 20 }).map((_, idx) => (
            <UnitSlotCard
              key={idx}
              slotIndex={idx}
              unit={units[idx]}
              isSelected={selectedUnitId === units[idx]?.id}
              onClick={() => {
                if (units[idx]) {
                  setSelectedUnitId(units[idx].id);
                  RomanAudio.playClick();
                } else {
                  setShowRecruitDrawer(true);
                  RomanAudio.playClick();
                }
              }}
              onDisband={onDisbandUnit}
            />
          ))}
        </div>

        {/* ── Bottom Roman Marble Plinth with "Raise Units" & Medallions ────── */}
        <div
          data-ui-layer="true"
          style={{
            background: 'linear-gradient(180deg, #e4dac7 0%, #cfc2ac 100%)',
            padding: '4px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #fcf7ed',
          }}
        >
          {/* Status info & hint */}
          <div style={{ fontSize: '9.5px', color: '#3d2d1b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>
              <b>Status:</b> {general.status === 'marching' ? '🏃 Marching' : '🛡️ Fortified / Ready'}
            </span>
            <span style={{ color: '#8e1b12', fontWeight: 800 }}>
              Right-click map terrain to order march
            </span>
          </div>

          {/* Center Medallions Row (From the Total War Screenshot) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <RomanMedallion icon="🚩" label="Vexillum Banner" onClick={() => RomanAudio.playClick()} />
            <RomanMedallion icon="👥" label="Staff Officers" onClick={() => RomanAudio.playClick()} />
            <RomanMedallion icon="🦅" label="Aquila Crest" onClick={() => RomanAudio.playClick()} />
            <RomanMedallion icon="🏆" label="Legion Honors" onClick={() => RomanAudio.playClick()} />
            <RomanMedallion icon="⚔️" label="Tactical Stances" onClick={() => RomanAudio.playClick()} />
          </div>

          {/* The Single "Raise Units" Button (As Requested by User) */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              data-ui-layer="true"
              onClick={() => {
                RomanAudio.playClick();
                setShowRecruitDrawer(prev => !prev);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 16px',
                background: showRecruitDrawer
                  ? 'linear-gradient(180deg, #d4af37 0%, #997316 100%)'
                  : 'linear-gradient(180deg, #a62217 0%, #68140e 100%)',
                border: '1.5px solid #ffd700',
                borderRadius: 5,
                color: showRecruitDrawer ? '#1a0d02' : '#ffffff',
                fontFamily: "'Cinzel', Georgia, serif",
                fontSize: '11px',
                fontWeight: 900,
                cursor: 'pointer',
                letterSpacing: '0.8px',
                boxShadow: '0 3px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>⚔️</span>
              <span>{showRecruitDrawer ? 'HIDE RECRUITS' : 'RAISE UNITS'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
