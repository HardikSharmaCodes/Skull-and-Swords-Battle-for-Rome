'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RomanAudio } from './gameEngine';

// ─── Roman Name Presets Generator ───────────────────────────────────────────
// Combinatorial generation using firstnameprefix1, firstnameprefix2, secondnameprefix1, secondnameprefix2
export const FIRST_NAME_PREFIX_1 = [
  'Max', 'Her', 'Pan', 'Xan', 'Luc', 'Tib', 'Dec', 'Aul', 'Pub', 'Val', 'App', 'Gai', 'Mar', 'Sev', 'Fab'
];

export const FIRST_NAME_PREFIX_2 = [
  'imus', 'issus', 'ius', 'inus', 'ellus', 'ianus', 'or', 'icus', 'atus', 'illus', 'o'
];

export const SECOND_NAME_PREFIX_1 = [
  'Corn', 'Jul', 'Claud', 'Fab', 'Scip', 'Flav', 'Anton', 'Sempr', 'Octav', 'Aemil', 'Tull', 'Valer', 'Cass'
];

export const SECOND_NAME_PREFIX_2 = [
  'ius', 'ianus', 'ellus', 'or', 'icus', 'inus', 'atus', 'io', 'ina', 'ian'
];

export function generateRomanName() {
  const firstnameprefix1 = FIRST_NAME_PREFIX_1[Math.floor(Math.random() * FIRST_NAME_PREFIX_1.length)];
  const firstnameprefix2 = FIRST_NAME_PREFIX_2[Math.floor(Math.random() * FIRST_NAME_PREFIX_2.length)];
  const secondnameprefix1 = SECOND_NAME_PREFIX_1[Math.floor(Math.random() * SECOND_NAME_PREFIX_1.length)];
  const secondnameprefix2 = SECOND_NAME_PREFIX_2[Math.floor(Math.random() * SECOND_NAME_PREFIX_2.length)];
  return `${firstnameprefix1}${firstnameprefix2} ${secondnameprefix1}${secondnameprefix2}`;
}

// ─── Crisp Vector SVG Icons for Rome: Total War Medallions ──────────────────
function MedallionIcon({ type }) {
  const shadow = 'drop-shadow(0 1.5px 2px rgba(0,0,0,0.85))';

  switch (type) {
    case 'scroll':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ filter: shadow }}>
          <path d="M6 5C4.5 5 3.5 6 3.5 7.5S4.5 10 6 10H8V20C8 21.5 7 22.5 5.5 22.5H20C21.5 22.5 22.5 21.5 22.5 20V8C22.5 6.5 21.5 5.5 20 5.5H6Z" fill="#edd9b4" stroke="#5a3d1c" strokeWidth="1.2" />
          <path d="M10 9H18M10 13H18M10 17H15" stroke="#7a5528" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M16 22L24 6C24 6 22 10 20 14L16 22Z" fill="#ffd700" stroke="#7a5528" strokeWidth="1" />
        </svg>
      );

    case 'temple':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ filter: shadow }}>
          <polygon points="14,4 3,11 25,11" fill="#ffe18f" stroke="#7a5528" strokeWidth="1.2" />
          <polygon points="14,6.5 6,10 22,10" fill="#912822" />
          <rect x="2" y="11" width="24" height="2.2" fill="#fff4cf" stroke="#684218" strokeWidth="1" />
          <rect x="4.5" y="13.2" width="2.8" height="9.5" rx="0.5" fill="#ffe18f" stroke="#684218" strokeWidth="0.8" />
          <rect x="10" y="13.2" width="2.8" height="9.5" rx="0.5" fill="#ffe18f" stroke="#684218" strokeWidth="0.8" />
          <rect x="15.2" y="13.2" width="2.8" height="9.5" rx="0.5" fill="#ffe18f" stroke="#684218" strokeWidth="0.8" />
          <rect x="20.7" y="13.2" width="2.8" height="9.5" rx="0.5" fill="#ffe18f" stroke="#684218" strokeWidth="0.8" />
          <rect x="2" y="22.7" width="24" height="2" fill="#ffe18f" stroke="#684218" strokeWidth="1" />
          <rect x="1" y="24.7" width="26" height="2" fill="#d4ad68" stroke="#503210" strokeWidth="1" />
        </svg>
      );

    case 'inspect':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ filter: shadow }}>
          <rect x="13" y="9" width="2" height="12" fill="#d4ad68" opacity="0.8" />
          <rect x="17" y="9" width="2" height="12" fill="#d4ad68" opacity="0.8" />
          <rect x="21" y="9" width="2" height="12" fill="#d4ad68" opacity="0.8" />
          <rect x="11" y="6.5" width="14" height="2.5" fill="#ffe18f" stroke="#684218" strokeWidth="0.8" />
          <circle cx="10" cy="11" r="6" fill="#681812" stroke="#ffe18f" strokeWidth="2" />
          <circle cx="10" cy="11" r="4.2" fill="#ffffff" fillOpacity="0.25" stroke="#ffffff" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="14.5" y1="15.5" x2="20.5" y2="21.5" stroke="#ffe18f" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="14.5" y1="15.5" x2="20.5" y2="21.5" stroke="#5a3d1c" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );

    case 'recruit':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ filter: shadow }}>
          <path d="M7 16C7 10 10 7 15 7C20 7 22 10 22 16V17H7V16Z" fill="#d4af37" stroke="#684218" strokeWidth="1" />
          <path d="M6 16H23V18H6V16Z" fill="#ffe18f" stroke="#503210" strokeWidth="0.8" />
          <path d="M12 4C14 4 16 5 17 7L11 7C11 5 11.5 4 12 4Z" fill="#c0392b" stroke="#7a1008" strokeWidth="0.8" />
          <path d="M8 18L10 23L13 21L12 18H8Z" fill="#d4af37" stroke="#684218" strokeWidth="0.8" />
          <circle cx="20.5" cy="9.5" r="4.8" fill="#c0392b" stroke="#ffd700" strokeWidth="1.2" />
          <path d="M20.5 7V12M18 9.5H23" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'eagle':
      return (
        <svg width="34" height="34" viewBox="0 0 36 36" fill="none" style={{ filter: shadow }}>
          <circle cx="18" cy="18" r="16.5" stroke="#ffe18f" strokeWidth="1.2" strokeDasharray="3 2" />
          <path
            d="M18 7C17 7 16 8 16 9.5C16 10.2 16.5 10.8 17 11.2C13 11.5 9 13.5 5 17C7.5 16.5 10.5 16.8 13 18C10 20 7.5 22.5 6 25C9.5 24 13 22 15 20C14.5 22.5 14 25 14 28L18 26L22 28C22 25 21.5 22.5 21 20C23 22 26.5 24 30 25C28.5 22.5 26 20 23 18C25.5 16.8 28.5 16.5 31 17C27 13.5 23 11.5 19 11.2C19.5 10.8 20 10.2 20 9.5C20 8 19 7 18 7Z"
            fill="#ffe18f"
            stroke="#684218"
            strokeWidth="0.8"
          />
          <path d="M15 25L21 25M13 27L23 27" stroke="#ffd700" strokeWidth="1.5" strokeLinecap="round" />
          <text x="18" y="32.5" textAnchor="middle" fill="#ffe18f" fontSize="5.5" fontWeight="900" letterSpacing="0.8" fontFamily="'Cinzel', serif">
            SPQR
          </text>
        </svg>
      );

    case 'trophy':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ filter: shadow }}>
          <path d="M8 6H20V12C20 15.3 17.3 18 14 18C10.7 18 8 15.3 8 12V6Z" fill="#ffe18f" stroke="#684218" strokeWidth="1.2" />
          <path d="M8 8H5C3.9 8 3 8.9 3 10V11C3 13.2 4.8 15 7 15H8" stroke="#ffe18f" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M20 8H23C24.1 8 25 8.9 25 10V11C25 13.2 23.2 15 21 15H20" stroke="#ffe18f" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="12.5" y="18" width="3" height="4" fill="#ffd700" stroke="#684218" strokeWidth="0.8" />
          <path d="M9 24C9 22.5 11 22 14 22C17 22 19 22.5 19 24H9Z" fill="#ffe18f" stroke="#684218" strokeWidth="1" />
        </svg>
      );

    case 'chest':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ filter: shadow }}>
          <path d="M4 11C4 8.5 7 7 14 7C21 7 24 8.5 24 11H4Z" fill="#c49038" stroke="#4a2e0a" strokeWidth="1.2" />
          <rect x="4" y="11" width="20" height="12" rx="1" fill="#915a20" stroke="#4a2e0a" strokeWidth="1.2" />
          <rect x="8" y="7" width="2" height="16" fill="#ffe18f" stroke="#503210" strokeWidth="0.6" />
          <rect x="18" y="7" width="2" height="16" fill="#ffe18f" stroke="#503210" strokeWidth="0.6" />
          <rect x="12.5" y="12" width="3" height="4.5" rx="0.5" fill="#ffd700" stroke="#4a2e0a" strokeWidth="0.8" />
          <circle cx="14" cy="10" r="1.5" fill="#ffe18f" />
        </svg>
      );

    case 'weapons':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ filter: shadow }}>
          <line x1="5" y1="23" x2="23" y2="5" stroke="#d0d0d0" strokeWidth="1.6" strokeLinecap="round" />
          <polygon points="23,5 21,9 25,7" fill="#ffffff" />
          <line x1="23" y1="23" x2="5" y2="5" stroke="#d0d0d0" strokeWidth="1.6" strokeLinecap="round" />
          <polygon points="5,5 9,7 7,9" fill="#ffffff" />
          <rect x="10" y="8" width="8" height="12" rx="1.5" fill="#8e1b12" stroke="#ffe18f" strokeWidth="1.2" />
          <circle cx="14" cy="14" r="2" fill="#ffd700" stroke="#5a1208" strokeWidth="0.8" />
        </svg>
      );

    case 'wreath':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ filter: shadow }}>
          <path d="M14 24C9 24 5 19 5 13C5 10 6 7 8 5" stroke="#2ecc71" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <ellipse cx="6.5" cy="17" rx="2" ry="1.2" transform="rotate(-30 6.5 17)" fill="#48b870" />
          <ellipse cx="5" cy="12" rx="2" ry="1.2" transform="rotate(-15 5 12)" fill="#48b870" />
          <ellipse cx="6.5" cy="8" rx="2" ry="1.2" transform="rotate(15 6.5 8)" fill="#48b870" />
          <path d="M14 24C19 24 23 19 23 13C23 10 22 7 20 5" stroke="#2ecc71" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <ellipse cx="21.5" cy="17" rx="2" ry="1.2" transform="rotate(30 21.5 17)" fill="#48b870" />
          <ellipse cx="23" cy="12" rx="2" ry="1.2" transform="rotate(15 23 12)" fill="#48b870" />
          <ellipse cx="21.5" cy="8" rx="2" ry="1.2" transform="rotate(-15 21.5 8)" fill="#48b870" />
          <circle cx="14" cy="24" r="2" fill="#ffe18f" stroke="#7a5528" strokeWidth="0.8" />
        </svg>
      );

    case 'anchor':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ filter: shadow }}>
          <circle cx="14" cy="6" r="2.5" stroke="#ffe18f" strokeWidth="1.4" />
          <line x1="14" y1="8.5" x2="14" y2="23" stroke="#ffe18f" strokeWidth="2" />
          <line x1="9" y1="11" x2="19" y2="11" stroke="#ffe18f" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7 17C7 22 14 24 14 24C14 24 21 22 21 17" stroke="#ffe18f" strokeWidth="2" strokeLinecap="round" fill="none" />
          <polygon points="6,15 8.5,17 5.5,18" fill="#ffe18f" />
          <polygon points="22,15 19.5,17 22.5,18" fill="#ffe18f" />
        </svg>
      );

    case 'ship':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ filter: shadow }}>
          <path d="M3 17C7 17 14 19 23 16L25 13L21 13C16 15 10 15 5 14L3 17Z" fill="#c49038" stroke="#4a2e0a" strokeWidth="1" />
          <line x1="13" y1="6" x2="13" y2="17" stroke="#684218" strokeWidth="1.5" />
          <rect x="8" y="7" width="10" height="6" fill="#fdfbf7" stroke="#8e1b12" strokeWidth="0.8" />
          <line x1="6" y1="18" x2="4" y2="22" stroke="#d4ad68" strokeWidth="1" />
          <line x1="10" y1="18" x2="8" y2="22" stroke="#d4ad68" strokeWidth="1" />
          <line x1="14" y1="18" x2="12" y2="22" stroke="#d4ad68" strokeWidth="1" />
          <line x1="18" y1="18" x2="16" y2="22" stroke="#d4ad68" strokeWidth="1" />
        </svg>
      );

    case 'shield':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ filter: shadow }}>
          <path d="M6 6H22V15C22 20 14 24 14 24C14 24 6 20 6 15V6Z" fill="#8e1b12" stroke="#ffe18f" strokeWidth="1.5" />
          <circle cx="14" cy="14" r="3.5" fill="#ffd700" stroke="#5a1208" strokeWidth="1" />
          <line x1="14" y1="8" x2="14" y2="20" stroke="#ffd700" strokeWidth="0.8" />
        </svg>
      );

    case 'grain':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ filter: shadow }}>
          <line x1="14" y1="5" x2="14" y2="24" stroke="#d4a020" strokeWidth="1.6" strokeLinecap="round" />
          <ellipse cx="11.5" cy="8" rx="2" ry="3.5" transform="rotate(-30 11.5 8)" fill="#ffe18f" stroke="#7a5528" strokeWidth="0.8" />
          <ellipse cx="16.5" cy="8" rx="2" ry="3.5" transform="rotate(30 16.5 8)" fill="#ffe18f" stroke="#7a5528" strokeWidth="0.8" />
          <ellipse cx="11.5" cy="14" rx="2" ry="3.5" transform="rotate(-30 11.5 14)" fill="#ffe18f" stroke="#7a5528" strokeWidth="0.8" />
          <ellipse cx="16.5" cy="14" rx="2" ry="3.5" transform="rotate(30 16.5 14)" fill="#ffe18f" stroke="#7a5528" strokeWidth="0.8" />
          <ellipse cx="14" cy="5" rx="1.8" ry="3.2" fill="#ffe18f" stroke="#7a5528" strokeWidth="0.8" />
        </svg>
      );

    default:
      return null;
  }
}

// ─── Single Roman Medallion Button Component ────────────────────────────────
function MedallionButton({
  id,
  icon,
  label,
  subtitle,
  badge = null,
  isCenter = false,
  highlight = false,
  onClick,
  onHover,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const size = isCenter ? 54 : 44;

  return (
    <button
      onClick={() => onClick({ id, label, subtitle })}
      onMouseEnter={(e) => {
        setIsHovered(true);
        RomanAudio.playHover();
        onHover({ id, label, subtitle, rect: e.currentTarget.getBoundingClientRect() });
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHover(null);
      }}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        padding: 0,
        margin: '0 3px',
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        background: highlight || isCenter
          ? 'conic-gradient(from 45deg, #fff2a1 0deg, #d4af37 60deg, #785208 140deg, #3d2402 180deg, #d4af37 260deg, #fff2a1 360deg)'
          : 'conic-gradient(from 45deg, #ffffff 0deg, #cccccc 60deg, #666666 140deg, #2a2a2a 180deg, #b8b8b8 260deg, #ffffff 360deg)',
        boxShadow: isHovered || highlight
          ? '0 0 16px rgba(255, 215, 0, 0.85), 0 6px 16px rgba(0,0,0,0.8)'
          : '0 4px 10px rgba(0,0,0,0.65), inset 0 1.5px 2px rgba(255,255,255,0.7), inset 0 -1.5px 2px rgba(0,0,0,0.7)',
        transform: isHovered ? 'translateY(-3.5px) scale(1.08)' : (highlight ? 'translateY(-2px)' : 'translateY(0) scale(1)'),
        transition: 'transform 0.15s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      title={label}
    >
      <div
        style={{
          width: `${size - (isCenter ? 8 : 7)}px`,
          height: `${size - (isCenter ? 8 : 7)}px`,
          borderRadius: '50%',
          background: isCenter
            ? 'radial-gradient(circle at 45% 35%, #8e1b12 0%, #6b1009 50%, #3a0804 100%)'
            : (highlight
                ? 'radial-gradient(circle at 45% 35%, #a82017 0%, #7d130c 55%, #3d0704 100%)'
                : 'radial-gradient(circle at 42% 35%, #7a1714 0%, #540e0a 60%, #290604 100%)'),
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.85), 0 1px 1px rgba(255,255,255,0.3)',
          border: isCenter || highlight ? '1.5px solid #ffd700' : '1px solid #200402',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <MedallionIcon type={icon} />
      </div>

      {badge != null && (
        <div
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 17,
            height: 17,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            border: '1.5px solid #1a1a1a',
            color: '#111111',
            fontSize: '10px',
            fontWeight: 900,
            fontFamily: "'Cinzel', serif, sans-serif",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
          }}
        >
          {badge}
        </div>
      )}
    </button>
  );
}

// ─── Emergent Muster Panel (Hire Scouts & Raise Forces) ──────────────────────
// Contains ONLY two buttons: Hire Scouts and Raise Forces
function RaiseForcesPanel({ province, onClose, onMusterScout, onAppointGeneral }) {
  // Mode: 'scouts' | 'forces'
  const [activeTab, setActiveTab] = useState('scouts');

  // Candidate generation using combinatorial Roman name prefixes
  const generateCandidates = useCallback((mode = 'scouts') => {
    return [
      {
        id: 1,
        name: generateRomanName(),
        specialty: mode === 'scouts' ? 'Swift Vanguard' : 'Legion Tactician',
        units: [],
      },
      {
        id: 2,
        name: generateRomanName(),
        specialty: mode === 'scouts' ? 'Eagle-Eyed Traversal' : 'Disciplined Cohorts',
        units: [],
      },
      {
        id: 3,
        name: generateRomanName(),
        specialty: mode === 'scouts' ? 'Frontier Veteran' : 'Siege & Field Commander',
        units: [],
      },
    ];
  }, []);

  const [candidates, setCandidates] = useState(() => generateCandidates('scouts'));

  const handleSelectTab = (tab) => {
    RomanAudio.playClick();
    setActiveTab(tab);
    setCandidates(generateCandidates(tab));
  };

  const siteName = province?.site || 'Roma';

  return (
    <div
      data-ui-layer="true"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 14px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '640px',
        maxWidth: '95vw',
        zIndex: 130,
        background: 'linear-gradient(180deg, #fdfbf7 0%, #ece4d4 40%, #ddd2be 100%)',
        border: '2px solid #8e7c65',
        borderRadius: '10px',
        boxShadow: '0 16px 40px rgba(0,0,0,0.92), inset 0 1.5px 0 #ffffff, inset 0 -1.5px 0 #9c8a74',
        overflow: 'hidden',
        fontFamily: "'Cinzel', Georgia, serif",
        animation: 'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'auto',
      }}
    >
      {/* ── Modal Header with Close Button ──────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(180deg, #2a0b08 0%, #150504 100%)',
          borderBottom: '1.5px solid #d4a34b',
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '13px', color: '#ffd700', fontWeight: 900, letterSpacing: '0.8px' }}>
            🏛️ PROVINCIAL MUSTER — {siteName.toUpperCase()}
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            background: '#220806',
            border: '1px solid #7a2218',
            borderRadius: 4,
            color: '#ffe18f',
            fontSize: '13px',
            padding: '2px 8px',
            cursor: 'pointer',
            fontWeight: 800,
            lineHeight: 1,
          }}
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* ── Exactly Two Buttons in the Tab Row (As Requested) ─────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '10px 16px',
          background: 'linear-gradient(180deg, #18110b 0%, #0d0905 100%)',
          borderBottom: '1px solid #4a341e',
        }}
      >
        <button
          onClick={() => handleSelectTab('scouts')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 6,
            background: activeTab === 'scouts'
              ? 'linear-gradient(180deg, #8e1b12 0%, #58110b 100%)'
              : '#161d28',
            border: activeTab === 'scouts' ? '1.5px solid #ffd700' : '1px solid #3d2b19',
            color: activeTab === 'scouts' ? '#ffd700' : '#887a6c',
            fontFamily: "'Cinzel', serif",
            fontSize: '12px',
            fontWeight: 900,
            cursor: 'pointer',
            letterSpacing: '0.6px',
            boxShadow: activeTab === 'scouts' ? '0 3px 12px rgba(142,27,18,0.5)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            transition: 'all 0.15s ease',
          }}
        >
          <span>🐎</span> HIRE SCOUTS
        </button>

        <button
          onClick={() => handleSelectTab('forces')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 6,
            background: activeTab === 'forces'
              ? 'linear-gradient(180deg, #8e1b12 0%, #58110b 100%)'
              : '#161d28',
            border: activeTab === 'forces' ? '1.5px solid #ffd700' : '1px solid #3d2b19',
            color: activeTab === 'forces' ? '#ffd700' : '#887a6c',
            fontFamily: "'Cinzel', serif",
            fontSize: '12px',
            fontWeight: 900,
            cursor: 'pointer',
            letterSpacing: '0.6px',
            boxShadow: activeTab === 'forces' ? '0 3px 12px rgba(142,27,18,0.5)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            transition: 'all 0.15s ease',
          }}
        >
          <span>🦅</span> RAISE FORCES
        </button>
      </div>

      {/* ── Three Randomly Generated Roman Commander / Scout Cards ───────── */}
      <div
        style={{
          padding: '14px 16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          background: '#0d1118',
        }}
      >
        {candidates.map((cand) => (
          <div
            key={cand.id}
            style={{
              background: 'rgba(20, 26, 36, 0.95)',
              border: '1.5px solid #4a3820',
              borderRadius: 7,
              padding: '12px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
              position: 'relative',
            }}
          >
            {/* Medallion Avatar */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 40% 35%, #8e1b12 0%, #58110b 60%, #290604 100%)',
                border: '1.5px solid #ffd700',
                boxShadow: '0 3px 8px rgba(0,0,0,0.8), inset 0 2px 3px rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                marginBottom: 8,
              }}
            >
              {activeTab === 'scouts' ? '🐎' : '🦅'}
            </div>

            {/* Generated Roman Name (Combinatorial Prefix1 + Prefix2 + Last1 + Last2) */}
            <div style={{ fontSize: '12px', fontWeight: 900, color: '#ffd700', minHeight: 28, display: 'flex', alignItems: 'center' }}>
              {activeTab === 'scouts' ? cand.name : `General ${cand.name}`}
            </div>

            <div style={{ fontSize: '9px', color: '#c4ad8e', marginTop: 2, marginBottom: 6 }}>
              {activeTab === 'scouts' ? 'Roman Vanguard Scout' : 'Legatus Legionis (Army General)'}
            </div>

            {/* Army General: Display units: [] in JSON format under it */}
            {activeTab === 'forces' && (
              <div
                style={{
                  width: '100%',
                  background: '#070a10',
                  border: '1.5px solid #3d2b1a',
                  borderRadius: 5,
                  padding: '6px 8px',
                  marginBottom: 8,
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  textAlign: 'left',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
                }}
              >
                <div style={{ color: '#8899aa', fontSize: '8.5px', marginBottom: 2 }}>// Roster Manifest (JSON)</div>
                <div style={{ color: '#ffffff' }}>
                  &#123; <span style={{ color: '#ffd700' }}>&quot;units&quot;</span>: <span style={{ color: '#34d399' }}>[]</span> &#125;
                </div>
              </div>
            )}

            {/* Stats pill box for Scouts */}
            {activeTab === 'scouts' && (
              <div
                style={{
                  width: '100%',
                  background: 'rgba(6, 9, 14, 0.85)',
                  border: '1px solid #281d12',
                  borderRadius: 4,
                  padding: '5px 4px',
                  marginBottom: 8,
                  fontSize: '8.5px',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ color: '#60a5fa' }}><b>Speed:</b> 150 km/month</div>
                <div style={{ color: '#34d399' }}><b>Vision:</b> 150 km sphere</div>
                <div style={{ color: '#ffd700', fontWeight: 800 }}>🪙 50 Denarii</div>
              </div>
            )}

            {/* Action button */}
            <button
              onClick={() => {
                if (activeTab === 'scouts') {
                  onMusterScout(cand);
                } else {
                  onAppointGeneral(cand);
                }
              }}
              style={{
                width: '100%',
                padding: '6px 4px',
                background: 'linear-gradient(180deg, #8e1b12 0%, #58110b 100%)',
                border: '1.5px solid #ffd700',
                borderRadius: 4,
                color: '#ffffff',
                fontSize: '9.5px',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
                boxShadow: '0 2px 8px rgba(142,27,18,0.5)',
                transition: 'transform 0.1s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.03)';
                RomanAudio.playHover();
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {activeTab === 'scouts' ? 'HIRE SCOUT' : 'APPOINT GENERAL'}
            </button>
          </div>
        ))}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(180deg, #ede4d4 0%, #dfd5c2 100%)',
          borderTop: '1px solid #a89882',
          padding: '6px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '9px',
          color: '#5a4632',
        }}
      >
        <span>
          {activeTab === 'scouts'
            ? '🐎 Scouts deploy directly at settlement center and clear Fog of War.'
            : '🦅 Generals appointed with an empty units[] list under them.'}
        </span>
        <span style={{ color: '#8e1b12', fontWeight: 800 }}>PROVINCIAL MUSTER</span>
      </div>
    </div>
  );
}

// ─── Main Classic Rome: Total War Bottom Options Bar Component ──────────────
export default function RomanSettlementBar({
  province,
  onAction,
  onHireScout,
  onRaiseGeneral,
}) {
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [showRecruitPanel, setShowRecruitPanel] = useState(false);

  // If province is null, the left four buttons are NOT rendered!
  const hasLeftButtons = Boolean(province);

  const isRome = province ? (province.site === 'Roma' || province.id === 1) : true;
  const isPort = province ? (
    (province.type || '').toLowerCase().includes('port') ||
    (province.type || '').toLowerCase().includes('harbor') ||
    (province.type || '').toLowerCase().includes('seaport')
  ) : false;
  const isFort = province ? (
    (province.type || '').toLowerCase().includes('fort') ||
    (province.type || '').toLowerCase().includes('military')
  ) : false;

  // Reset recruit panel when province changes or deselects
  useEffect(() => {
    if (!province) {
      setShowRecruitPanel(false);
    }
  }, [province]);

  // ─── 4 Buttons on the Left (Only shown when a province is selected!) ───────
  const leftButtons = [
    {
      id: 'forum',
      icon: 'temple',
      label: 'Forum & Senate Hall',
      subtitle: 'Civic development, public order, and municipal governance.',
    },
    {
      id: 'edicts',
      icon: 'scroll',
      label: 'Provincial Edicts & Taxes',
      subtitle: 'Tax policies, grain doles, and imperial levies.',
    },
    {
      id: 'census',
      icon: 'inspect',
      label: 'Magistrate & Census',
      subtitle: 'Census ledger, patrician families, and municipal treasury.',
    },
    {
      id: 'raise_forces',
      icon: 'recruit',
      label: 'Raise Forces & Scouts',
      subtitle: 'Hire Scouts or Raise Forces with generated Roman commanders.',
      highlight: showRecruitPanel,
    },
  ];

  // ─── 1 Button in the Center (The Imperial Aquila Crest) ─────────────────
  const centerButton = {
    id: 'spqr_seal',
    icon: 'eagle',
    label: province ? `SPQR Imperial Medallion — ${province.site}` : 'SPQR Imperial Roman Seal',
    subtitle: province
      ? `${province.sovereignName || province.site} • Seat of Sovereign Authority`
      : 'Senatus Populusque Romanus • Sovereign Republic',
    isCenter: true,
  };

  // ─── 4 Buttons on the Right (Settlement-Dependent Presets) ───────────────
  let rightButtons = [];

  if (isRome) {
    rightButtons = [
      {
        id: 'colosseum',
        icon: 'trophy',
        label: 'Colosseum & Circus Maximus',
        subtitle: 'Imperial gladiatorial munera & chariot races (+Order).',
      },
      {
        id: 'aerarium',
        icon: 'chest',
        label: 'Aerarium Saturni Treasury',
        subtitle: 'Imperial denarii bullion reserves and tribute coffers.',
      },
      {
        id: 'praetorians',
        icon: 'weapons',
        label: 'Praetorian Guard Cohorts',
        subtitle: 'Elite Imperial household guard protecting the capital.',
        badge: 3,
      },
      {
        id: 'pax_romana',
        icon: 'wreath',
        label: 'Pax Romana Decree',
        subtitle: 'Promulgate sovereign imperial pax across all legions.',
      },
    ];
  } else if (isPort) {
    rightButtons = [
      {
        id: 'classis',
        icon: 'anchor',
        label: 'Classis Navalis Anchorage',
        subtitle: 'Naval trireme squadrons and coastal defense patrols.',
      },
      {
        id: 'annona_fleet',
        icon: 'ship',
        label: 'Annona Grain Fleet',
        subtitle: 'Mediterranean merchant trade routes & grain convoys.',
      },
      {
        id: 'customs',
        icon: 'chest',
        label: 'Harbor Customs & Docks',
        subtitle: 'Seaport trade tariffs and warehouse inventory.',
        badge: 2,
      },
      {
        id: 'seawall',
        icon: 'shield',
        label: 'Seawall & Watchtowers',
        subtitle: 'Breakwater chain defenses and beacon towers.',
      },
    ];
  } else if (isFort) {
    rightButtons = [
      {
        id: 'castrum',
        icon: 'weapons',
        label: 'Legio Castrum Cohorts',
        subtitle: 'Frontier garrison veterans and border centuriae.',
      },
      {
        id: 'artillery',
        icon: 'fort',
        label: 'Ballista & Scorpio Ramparts',
        subtitle: 'Torsion siege artillery mounted along battlements.',
      },
      {
        id: 'scout_corps',
        icon: 'trophy',
        label: 'Equites Border Patrol',
        subtitle: 'Cavalry reconnaissance scouting barbarian terrain.',
        badge: 1,
      },
      {
        id: 'vallum',
        icon: 'shield',
        label: 'Stone Vallum & Palisade',
        subtitle: 'Deep defensive ditches and curtain wall ramparts.',
      },
    ];
  } else {
    rightButtons = [
      {
        id: 'granary',
        icon: 'grain',
        label: 'Provincial Granary Tithe',
        subtitle: 'Agricultural harvest storage & civic food supply.',
      },
      {
        id: 'aqueduct',
        icon: 'temple',
        label: 'Aqueducts & Public Baths',
        subtitle: 'Fresh water distribution & Roman public baths.',
      },
      {
        id: 'town_watch',
        icon: 'shield',
        label: 'Municipal Town Watch',
        subtitle: 'City gate sentinels & municipal security cohorts.',
        badge: 1,
      },
      {
        id: 'nundinae',
        icon: 'chest',
        label: 'Nundinae Market Fair',
        subtitle: 'Weekly artisan trade fairs & olive oil exchange.',
        badge: 4,
      },
    ];
  }

  const handleButtonClick = (btn) => {
    if (btn.id === 'raise_forces') {
      setShowRecruitPanel((prev) => !prev);
      RomanAudio.playClick();
      return;
    }
    onAction(btn);
  };

  const handleMusterScoutCandidate = (candidate) => {
    RomanAudio.playMarch();
    if (onHireScout) {
      onHireScout(candidate);
    }
    setShowRecruitPanel(false);
  };

  const handleAppointGeneralCandidate = (candidate) => {
    RomanAudio.playClick();
    if (onRaiseGeneral) {
      onRaiseGeneral(candidate);
    }
    setShowRecruitPanel(false);
  };

  const plinthWidth = hasLeftButtons ? 600 : 330;

  return (
    <div
      data-ui-layer="true"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 115,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      {/* ── Emerging Muster Panel (Only two buttons: Hire Scouts & Raise Forces) ─── */}
      {showRecruitPanel && hasLeftButtons && (
        <RaiseForcesPanel
          province={province}
          onClose={() => setShowRecruitPanel(false)}
          onMusterScout={handleMusterScoutCandidate}
          onAppointGeneral={handleAppointGeneralCandidate}
        />
      )}

      {/* ── Floating Tooltip ────────────────────────────────────────────── */}
      {activeTooltip && !showRecruitPanel && (
        <div
          data-ui-layer="true"
          style={{
            marginBottom: 8,
            background: 'rgba(12, 10, 8, 0.96)',
            border: '1.5px solid #d4a34b',
            borderRadius: 6,
            padding: '6px 12px',
            boxShadow: '0 6px 22px rgba(0,0,0,0.9), 0 0 10px rgba(212,163,75,0.3)',
            color: '#f3e1b9',
            fontFamily: "'Cinzel', Georgia, serif",
            textAlign: 'center',
            maxWidth: 320,
            pointerEvents: 'none',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#ffd700', letterSpacing: '0.8px' }}>
            {activeTooltip.label}
          </div>
          <div style={{ fontSize: '9px', color: '#c4ad8e', marginTop: 2, lineHeight: 1.4 }}>
            {activeTooltip.subtitle}
          </div>
        </div>
      )}

      {/* ── Carved Marble Base Plinth ───────────────────────────────────── */}
      <div
        data-ui-layer="true"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 14px',
          filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.85))',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
            pointerEvents: 'none',
          }}
          viewBox={`0 0 ${plinthWidth} 58`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="rtwMarbleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="12%" stopColor="#f3eee3" />
              <stop offset="45%" stopColor="#dfd7c5" />
              <stop offset="85%" stopColor="#c8bcaa" />
              <stop offset="100%" stopColor="#9e8f7a" />
            </linearGradient>
          </defs>

          {hasLeftButtons ? (
            <>
              <path
                d="M 12 10 
                   L 252 10 
                   C 265 10, 268 1, 300 1 
                   C 332 1, 335 10, 348 10 
                   L 588 10 
                   C 595 10, 600 15, 600 22 
                   L 600 48 
                   C 600 54, 595 58, 588 58 
                   L 12 58 
                   C 5 58, 0 54, 0 48 
                   L 0 22 
                   C 0 15, 5 10, 12 10 Z"
                fill="url(#rtwMarbleGrad)"
                stroke="#756450"
                strokeWidth="1.6"
              />
              <path
                d="M 16 16 L 254 16 C 266 16, 270 7, 300 7 C 330 7, 334 16, 346 16 L 584 16"
                stroke="#96846f"
                strokeWidth="1.2"
                fill="none"
              />
              <path
                d="M 16 17 L 254 17 C 266 17, 270 8, 300 8 C 330 8, 334 17, 346 17 L 584 17"
                stroke="#ffffff"
                strokeWidth="0.8"
                fill="none"
                opacity="0.9"
              />
              <line x1="16" y1="52" x2="584" y2="52" stroke="#96846f" strokeWidth="1.2" />
              <line x1="16" y1="53" x2="584" y2="53" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
              <circle cx="300" cy="27" r="30" stroke="#b0a08a" strokeWidth="1.2" fill="none" opacity="0.4" />
            </>
          ) : (
            <>
              <path
                d="M 12 10 
                   L 18 10 
                   C 26 10, 30 1, 52 1 
                   C 74 1, 78 10, 86 10 
                   L 318 10 
                   C 325 10, 330 15, 330 22 
                   L 330 48 
                   C 330 54, 325 58, 318 58 
                   L 12 58 
                   C 5 58, 0 54, 0 48 
                   L 0 22 
                   C 0 15, 5 10, 12 10 Z"
                fill="url(#rtwMarbleGrad)"
                stroke="#756450"
                strokeWidth="1.6"
              />
              <path
                d="M 16 16 L 20 16 C 28 16, 32 7, 52 7 C 72 7, 76 16, 84 16 L 314 16"
                stroke="#96846f"
                strokeWidth="1.2"
                fill="none"
              />
              <path
                d="M 16 17 L 20 17 C 28 17, 32 8, 52 8 C 72 8, 76 17, 84 17 L 314 17"
                stroke="#ffffff"
                strokeWidth="0.8"
                fill="none"
                opacity="0.9"
              />
              <line x1="16" y1="52" x2="314" y2="52" stroke="#96846f" strokeWidth="1.2" />
              <line x1="16" y1="53" x2="314" y2="53" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
              <circle cx="52" cy="27" r="30" stroke="#b0a08a" strokeWidth="1.2" fill="none" opacity="0.4" />
            </>
          )}
        </svg>

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 8px',
          }}
        >
          {hasLeftButtons && (
            <div style={{ display: 'flex', alignItems: 'center', animation: 'fadeIn 0.2s ease' }}>
              {leftButtons.map((btn) => (
                <MedallionButton
                  key={btn.id}
                  {...btn}
                  onClick={handleButtonClick}
                  onHover={setActiveTooltip}
                />
              ))}
            </div>
          )}

          <div style={{ margin: hasLeftButtons ? '0 10px' : '0 10px 0 2px', transform: 'translateY(-6px)' }}>
            <MedallionButton
              {...centerButton}
              onClick={handleButtonClick}
              onHover={setActiveTooltip}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            {rightButtons.map((btn) => (
              <MedallionButton
                key={btn.id}
                {...btn}
                onClick={handleButtonClick}
                onHover={setActiveTooltip}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
