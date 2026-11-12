'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import elevationData from './elevationData.json';
import ancientSites from './ancientSites.json';
import regionsData from './regionsData.json';
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  KM_PER_PIXEL,
  getElevationAt,
  getTerrainSpeedMultiplier,
  getTerrainClassification,
  calculatePath,
  analyzeRoute,
  RomanAudio,
} from './gameEngine';
import RomanSettlementBar from './RomanSettlementBar';
import RomanArmyBar, { UNIT_CLASSES } from './RomanArmyBar';
import { getRecruitOptions, composeLocalArmy } from './troopCatalog';
import BattleModal, { generateGarrison, computeBattle, simulateFieldBattleOutcome, computeFieldBattle } from './BattleModal';
import { drawSiteVectorIcon } from './SiteIcons';
import {
  FACTION_CONFIG,
  FACTION_NAME_MAP,
  INITIAL_AI_GENERALS,
  initializeDiplomacyState,
  calculateOpinionScore,
  tickDiplomacyAndEconomy,
  evaluateAiMilitaryDecisions,
  resolveAiAssault,
  areRootsAtWar,
  declareWar,
  noteClash,
  getRootController,
  getProvinceDisplayColor,
  computeWasta,
  computeEmpireWasta,
  getEmpireAllegianceName,
  wastaLabel,
} from './aiDiplomacyEngine';

// Path2D cache for instant, zero-cost polygon fills & hover effects
const pathCache = new Map();
function getRegionPath(pathD) {
  if (!pathD) return null;
  let p = pathCache.get(pathD);
  if (!p && typeof window !== 'undefined' && window.Path2D) {
    try {
      p = new Path2D(pathD);
      pathCache.set(pathD, p);
    } catch {
      return null;
    }
  }
  return p;
}

// Check if a mouse event target belongs to any UI layer (prevents map click-through & deselection)
function isInsideUiLayer(target) {
  if (!target) return false;
  let curr = target.nodeType === 1 ? target : target.parentElement;
  while (curr) {
    if (curr.getAttribute && curr.getAttribute('data-ui-layer') === 'true') {
      return true;
    }
    curr = curr.parentElement;
  }
  return false;
}

// Marker style dictionary for historical settlement types
const TYPE_STYLE = {
  'Imperial capital':      { shape: 'star',         color: '#ffd700', stroke: '#7a3800' },
  'Metropolis':            { shape: 'doubleCircle', color: '#ff8c00', stroke: '#5a1a00' },
  'Regional capital':      { shape: 'circle',       color: '#e05c20', stroke: '#6a1c00' },
  'Royal capital':         { shape: 'star',         color: '#e8a020', stroke: '#6a3c00' },
  'Royal residence':       { shape: 'diamond',      color: '#c060d0', stroke: '#4a0060' },
  'Ceremonial royal site': { shape: 'star',         color: '#d880e0', stroke: '#500060' },
  'Seaport':               { shape: 'anchor',       color: '#3088cc', stroke: '#0c2c55' },
  'Naval base':            { shape: 'shield',       color: '#1a5fa8', stroke: '#081a38' },
  'Fortified harbor':      { shape: 'shield',       color: '#2272b8', stroke: '#0a2040' },
  'Trading emporium':      { shape: 'square',       color: '#d4a020', stroke: '#5a3800' },
  'Market town':           { shape: 'square',       color: '#c49018', stroke: '#4a2c00' },
  'Caravan city':          { shape: 'tent',         color: '#e08828', stroke: '#5c2c00' },
  'Oasis town':            { shape: 'circle',       color: '#48b870', stroke: '#1a4820' },
  'Greek colony':          { shape: 'triangle',     color: '#5890e0', stroke: '#1830a0' },
  'Roman colony':          { shape: 'triangle',     color: '#e04040', stroke: '#800000' },
  'Oppidum':               { shape: 'pentagon',     color: '#60a040', stroke: '#204000' },
  'Hill fort':             { shape: 'cross',        color: '#886030', stroke: '#381800' },
  'Broch stronghold':      { shape: 'shield',       color: '#787060', stroke: '#28241c' },
  'Frontier fortress':     { shape: 'cross',        color: '#c83028', stroke: '#600010' },
  'Military base':         { shape: 'cross',        color: '#d84838', stroke: '#680018' },
  'Fortified palace':      { shape: 'diamond',      color: '#b070e0', stroke: '#380058' },
  'Mountain pass fort':    { shape: 'cross',        color: '#a06840', stroke: '#402000' },
  'Road junction town':    { shape: 'square',       color: '#b8902a', stroke: '#483200' },
  'River crossing':        { shape: 'diamond',      color: '#3898b8', stroke: '#0c3048' },
  'River port':            { shape: 'anchor',       color: '#2878a8', stroke: '#0a2038' },
  'Temple/sanctuary':      { shape: 'star',         color: '#e8d050', stroke: '#5a4000' },
  'Healing sanctuary':     { shape: 'star',         color: '#c8e858', stroke: '#3a5000' },
  'Oracle center':         { shape: 'star',         color: '#d860c0', stroke: '#500048' },
  'Religious city':        { shape: 'star',         color: '#d8a840', stroke: '#5a3800' },
  'Industrial/mining town':{ shape: 'pentagon',     color: '#888888', stroke: '#303030' },
  'Tribal center':         { shape: 'pentagon',     color: '#82a838', stroke: '#304810' },
  'Village':               { shape: 'circle',       color: '#789068', stroke: '#283820' },
  'Rock-cut town':         { shape: 'square',       color: '#b08050', stroke: '#483018' },
  'Landing place':         { shape: 'anchor',       color: '#50a0b0', stroke: '#103840' },
};

function minZoomForWeight(w) {
  if (w >= 5) return 0;
  const table = { 4: 1.05, 3: 2.10, 2: 3.30, 1: 4.80 };
  return table[w] ?? 2.0;
}

function minZoomForLabel(w) {
  if (w >= 8) return 0.45;
  if (w >= 6) return 0.75;
  const table = { 5: 1.15, 4: 1.75, 3: 2.60, 2: 3.80, 1: 5.50 };
  return table[w] ?? 3.0;
}

function drawMarker(ctx, x, y, type, r) {
  const style = TYPE_STYLE[type] || { shape: 'circle', color: '#aaaaaa', stroke: '#444444' };
  const { shape, color, stroke } = style;
  ctx.fillStyle = color;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(0.8, r * 0.28);
  ctx.beginPath();

  switch (shape) {
    case 'star': {
      const spikes = 5;
      const outer = r;
      const inner = r * 0.42;
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outer : inner;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        if (i === 0) ctx.moveTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
        else ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'doubleCircle': {
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.6, r * 0.2);
      ctx.stroke();
      break;
    }
    case 'circle': {
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'square': {
      ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'diamond': {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.75, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.75, y);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'triangle': {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.9, y + r * 0.7);
      ctx.lineTo(x - r * 0.9, y + r * 0.7);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'cross': {
      const t = r * 0.32;
      ctx.rect(x - t, y - r, t * 2, r * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.rect(x - r, y - t, r * 2, t * 2);
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'pentagon': {
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        if (i === 0) ctx.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
        else ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'anchor': {
      ctx.arc(x, y - r * 0.5, r * 0.32, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.2);
      ctx.lineTo(x, y + r * 0.8);
      ctx.moveTo(x - r * 0.7, y + r * 0.1);
      ctx.lineTo(x + r * 0.7, y + r * 0.1);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.9, r * 0.3);
      ctx.stroke();
      break;
    }
    case 'shield': {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.85, y - r * 0.4);
      ctx.lineTo(x + r * 0.85, y + r * 0.2);
      ctx.quadraticCurveTo(x + r * 0.85, y + r * 0.9, x, y + r);
      ctx.quadraticCurveTo(x - r * 0.85, y + r * 0.9, x - r * 0.85, y + r * 0.2);
      ctx.lineTo(x - r * 0.85, y - r * 0.4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }
    default: {
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  }
}

// Tactical Map Pointer Marker for Roman Reconnaissance Units
function drawMapPointer(ctx, sx, sy, isSelected, isMarching, scout, now, headingAngle) {
  const trot = isMarching ? Math.sin(now * 0.02) * 2.5 : 0;
  const py = sy + trot;

  ctx.save();

  // Drop shadow on ground under pointer tip
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 2, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing golden beacon halo when selected
  if (isSelected) {
    const pulse = (Math.sin(now * 0.007) + 1) / 2;
    ctx.strokeStyle = `rgba(255, 215, 0, ${0.45 + pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, 14 + pulse * 6, 6 + pulse * 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Pointer Body
  ctx.beginPath();
  ctx.moveTo(sx, py);
  ctx.bezierCurveTo(sx - 4, py - 11, sx - 14, py - 18, sx - 14, py - 27);
  ctx.arc(sx, py - 27, 14, Math.PI, 0, false);
  ctx.bezierCurveTo(sx + 14, py - 18, sx + 4, py - 11, sx, py);
  ctx.closePath();

  // Roman Crimson gradient
  const grad = ctx.createLinearGradient(sx, py - 42, sx, py);
  grad.addColorStop(0, isSelected ? '#b8271d' : '#8e1b12');
  grad.addColorStop(0.65, '#6b110b');
  grad.addColorStop(1, '#420804');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = isSelected ? '#ffffff' : '#ffd700';
  ctx.lineWidth = isSelected ? 2.5 : 2;
  ctx.stroke();

  // Inner emblem
  ctx.beginPath();
  ctx.arc(sx, py - 27, 9.5, 0, Math.PI * 2);
  ctx.fillStyle = '#22110c';
  ctx.fill();
  ctx.strokeStyle = '#d4a34b';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Cavalry icon
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐎', sx, py - 27);

  // Directional arrow if marching
  if (isMarching && headingAngle != null) {
    ctx.save();
    ctx.translate(sx, py - 46);
    ctx.rotate(headingAngle);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 2);
    ctx.lineTo(0, 0);
    ctx.lineTo(-4, 2);
    ctx.closePath();
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.restore();
  }

  // Level Badge
  ctx.font = "bold 9px 'Cinzel', serif";
  ctx.fillStyle = '#ffe18f';
  ctx.textAlign = 'center';
  ctx.fillText(`★ Lv.${scout.level}`, sx, py + 14);

  // Unit Name Label
  ctx.font = "bold 11px 'Cinzel', serif";
  ctx.strokeStyle = 'rgba(0,0,0,0.92)';
  ctx.lineWidth = 3;
  ctx.strokeText(scout.name, sx, py - 44);
  ctx.fillStyle = isSelected ? '#ffe18f' : '#ffffff';
  ctx.fillText(scout.name, sx, py - 44);

  ctx.restore();
}

// Military Banner (Vexillum) for Army Generals (Roman & AI Factions) ────────
function drawGeneralBanner(ctx, sx, sy, isSelected, isMarching, general, now, headingAngle) {
  const sway = isMarching ? Math.sin(now * 0.014) * 2.0 : 0;
  const py = sy + sway;

  const fKey = general.faction || 'rome';
  const fConf = FACTION_CONFIG[fKey] || FACTION_CONFIG.rome;

  ctx.save();

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 3, 14, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing halo when selected
  if (isSelected) {
    const pulse = (Math.sin(now * 0.006) + 1) / 2;
    ctx.strokeStyle = `rgba(255,215,0,${0.5 + pulse * 0.45})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 3, 18 + pulse * 7, 7 + pulse * 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Pole (vertical staff)
  const poleTop = py - 64;
  const poleBot = py + 2;
  const poleGrad = ctx.createLinearGradient(sx - 2, 0, sx + 2, 0);
  poleGrad.addColorStop(0, '#c4a028');
  poleGrad.addColorStop(0.5, '#ffd700');
  poleGrad.addColorStop(1, '#8a6c10');
  ctx.beginPath();
  ctx.moveTo(sx - 2, poleTop);
  ctx.lineTo(sx - 2, poleBot);
  ctx.lineTo(sx + 2, poleBot);
  ctx.lineTo(sx + 2, poleTop);
  ctx.closePath();
  ctx.fillStyle = poleGrad;
  ctx.fill();

  // Faction Crest Finial on top of pole
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fConf.bannerIcon || '🦅', sx, poleTop - 7);

  // Horizontal cross-arm (transverse)
  const armY = poleTop + 6;
  ctx.beginPath();
  ctx.rect(sx - 18, armY - 2, 36, 4);
  ctx.fillStyle = '#ffd700';
  ctx.fill();
  ctx.strokeStyle = '#8a6c10';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Banner Cloth rectangle hanging from cross-arm
  const bannerTop = armY + 2;
  const bannerH = 28;
  const bannerW = 34;

  // Cloth gradient — faction primary color
  const clothGrad = ctx.createLinearGradient(sx - bannerW / 2, bannerTop, sx + bannerW / 2, bannerTop + bannerH);
  clothGrad.addColorStop(0, isSelected ? '#ffd700' : (fConf.color || '#9e1b12'));
  clothGrad.addColorStop(0.6, fConf.fillColor || '#7a1209');
  clothGrad.addColorStop(1, '#110804');
  ctx.beginPath();
  ctx.rect(sx - bannerW / 2, bannerTop, bannerW, bannerH);
  ctx.fillStyle = clothGrad;
  ctx.fill();
  ctx.strokeStyle = fConf.strokeColor || '#ffd700';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Faction text inside cloth banner
  ctx.font = "bold 6.5px 'Cinzel', serif";
  ctx.fillStyle = fConf.textColor || '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const bannerTag = fKey === 'rome' ? 'SPQR' : (fConf.shortName.length > 7 ? fConf.shortName.substring(0, 6) : fConf.shortName).toUpperCase();
  ctx.fillText(bannerTag, sx, bannerTop + 8);

  // Eagle / Faction symbol in banner center
  ctx.font = '10px sans-serif';
  ctx.fillText(fConf.bannerIcon || '⚔️', sx, bannerTop + 20);

  // Tassel fringe at bottom of banner
  ctx.strokeStyle = fConf.strokeColor || '#ffd700';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const tx = (sx - bannerW / 2) + 2 + i * (bannerW - 4) / 6;
    ctx.beginPath();
    ctx.moveTo(tx, bannerTop + bannerH);
    ctx.lineTo(tx, bannerTop + bannerH + 5);
    ctx.stroke();
  }

  // Directional arrow if marching
  if (isMarching && headingAngle != null) {
    ctx.save();
    ctx.translate(sx, py - 68);
    ctx.rotate(headingAngle);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 2);
    ctx.lineTo(0, -1);
    ctx.lineTo(-5, 2);
    ctx.closePath();
    ctx.fillStyle = fConf.strokeColor || '#ffd700';
    ctx.fill();
    ctx.restore();
  }

  // Unit count badge (number of cohorts)
  const unitCount = general.units ? general.units.length : 0;
  if (unitCount > 0) {
    ctx.beginPath();
    ctx.arc(sx + 17, poleTop - 1, 9, 0, Math.PI * 2);
    ctx.fillStyle = fConf.strokeColor || '#ffd700';
    ctx.fill();
    ctx.strokeStyle = '#1a0d02';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = "bold 8px 'Cinzel', serif";
    ctx.fillStyle = '#1a0d02';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unitCount, sx + 17, poleTop - 1);
  }

  // General name label above banner
  const shortName = general.name.length > 18 ? general.name.substring(0, 16) + '…' : general.name;
  ctx.font = "bold 10px 'Cinzel', serif";
  ctx.strokeStyle = 'rgba(0,0,0,0.95)';
  ctx.lineWidth = 3;
  ctx.strokeText(shortName, sx, poleTop - 18);
  ctx.fillStyle = isSelected ? '#ffd700' : (fKey === 'rome' ? '#ffffff' : '#ffd59e');
  ctx.fillText(shortName, sx, poleTop - 18);

  ctx.restore();
}

// Pre-compute site zoom thresholds - all settlement centers always visible
const SITES = ancientSites.map(s => ({
  ...s,
  minZoom: 0,
  minLabelZoom: minZoomForLabel(s.weight),
}));

const FACTION_KEY_MAP = {
  spqr: 'rome',
  carthage: 'carthage',
  macedon: 'hellas',
  arverni: 'gaul',
  ptolemaic: 'ptolemy',
  seleucid: 'independent',
};

const romeRegion = regionsData.regions.find(r => r.id === 1) || regionsData.regions[0];

export default function CampaignMapView({ onExitToMenu, selectedFaction = 'spqr', campaignEra = '218 BC' }) {
  const containerRef    = useRef(null);
  const svgContainerRef = useRef(null);
  const svgElRef        = useRef(null);
  const canvasRef       = useRef(null); // canvas for boundaries & region hover
  const fogCanvasRef    = useRef(null); // canvas for Fog of War / Terra Incognita
  const unitsCanvasRef  = useRef(null); // canvas for scouts, march paths & orders
  const sitesCanvasRef  = useRef(null); // canvas for markers & names
  const minimapCanvasRef= useRef(null);

  const playerFactionKey = FACTION_KEY_MAP[selectedFaction] || selectedFaction || 'rome';
  const playerHomeRegion = regionsData.regions.find(r => FACTION_NAME_MAP[r.faction] === playerFactionKey) || romeRegion;
  const initialKnownIds = new Set([playerHomeRegion.id, ...(playerHomeRegion.neighbors || [])]);

  const cam = useRef({ x: 0, y: 0, zoom: 1, minZoom: 0.4, maxZoom: 32.0 });
  const keys = useRef({ w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false });
  const drag = useRef({ isDragging: false, wasDownOnMap: false, lastX: 0, lastY: 0, downX: 0, downY: 0 });

  // Map Visual Mode: 'vintage' | 'terrain'
  const [visualMode, setVisualMode] = useState('vintage');
  const visualModeRef = useRef('vintage');

  const [showBorders, setShowBorders] = useState(true);
  const showBordersRef = useRef(true);

  // Fog of War / Exploration System
  const [fogEnabled, setFogEnabled] = useState(true);
  const fogEnabledRef = useRef(true);
  const [discoveredIds, setDiscoveredIds] = useState(initialKnownIds);
  const discoveredIdsRef = useRef(initialKnownIds);

  // Pathfinding Mode: 'terrain' vs 'direct'
  const [pathfindingMode, setPathfindingMode] = useState('terrain');
  const pathfindingModeRef = useRef('terrain');

  // Scouts Management
  const [scouts, setScouts] = useState([
    {
      id: 'scout-1',
      name: `I Equites Speculatores (${playerHomeRegion.site})`,
      level: 1,
      x: playerHomeRegion.center[0],
      y: playerHomeRegion.center[1],
      target: null,
      path: [],
      routeInfo: null,
      status: 'idle',
      distanceTraveledKm: 0,
      baseSpeedKmPerMin: 150,
      visionRadiusKm: 150,
      visionRadiusPx: Math.round(150 / KM_PER_PIXEL),
    }
  ]);
  const scoutsRef = useRef(scouts);

  useEffect(() => {
    scoutsRef.current = scouts;
  }, [scouts]);

  const [selectedScoutId, setSelectedScoutId] = useState('scout-1');
  const selectedScoutRef = useRef('scout-1');
  const lastTickTimeRef = useRef(null);

  // Generals / Army Management
  const [generals, setGenerals] = useState([]);
  const generalsRef = useRef([]);
  useEffect(() => { generalsRef.current = generals; }, [generals]);

  const [selectedGeneralId, setSelectedGeneralId] = useState(null);
  const selectedGeneralRef = useRef(null);

  // Selected Province
  const [selectedProvince, setSelectedProvince] = useState(null);
  const selectedProvinceRef = useRef(null);

  // Minimap & Persistent Fog Exploration Mask Refs
  const minimapBaseRef     = useRef(null);
  const minimapDraggingRef = useRef(false);
  const exploredMaskRef    = useRef(null);

  // Province ownership tracking: Map<regionId, ownerId>
  // PROVINCE-BASED SOVEREIGNTY: each province starts as its OWN sovereign entity.
  // Owner is the province's own numeric ID (self-sovereign), not a faction group name.
  // When a province is conquered, it maps to the conquering province's ID.
  // Use getRootController() to follow ownership chains for color cascading.
  const [conqueredRegions, setConqueredRegions] = useState(() => {
    const m = new Map();
    for (const reg of regionsData.regions) {
      m.set(reg.id, reg.id); // self-sovereign at start
    }
    return m;
  });
  const conqueredRegionsRef = useRef(conqueredRegions);
  useEffect(() => { conqueredRegionsRef.current = conqueredRegions; }, [conqueredRegions]);

  // Precomputed lookup: region id → region object (for color cascading)
  const regionsById = React.useMemo(() => {
    const m = {};
    for (const reg of regionsData.regions) m[reg.id] = reg;
    return m;
  }, []);
  const regionsByIdRef = useRef(regionsById);
  useEffect(() => { regionsByIdRef.current = regionsById; }, [regionsById]);

  // Simulation Time, Pause & Play Controls
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [gameSpeed, setGameSpeed] = useState('1x'); // 'pause' | '1x' | '2x'
  const gameSpeedRef = useRef('1x');
  const [turnNumber, setTurnNumber] = useState(1);
  const [turnProgressSec, setTurnProgressSec] = useState(0);

  // Imperial Treasury & Economics State (Denarii)
  const [playerTreasury, setPlayerTreasury] = useState(7500);
  const [playerIncome, setPlayerIncome] = useState(3900); // 39 Roman provinces initially
  const [playerUpkeep, setPlayerUpkeep] = useState(275);  // ~11 initial cohorts * 25
  const [playerNet, setPlayerNet] = useState(3625);

  // Whole-Map AI & Diplomacy State
  const [diplomacyState, setDiplomacyState] = useState(() => initializeDiplomacyState(regionsData.regions));
  const diplomacyStateRef = useRef(diplomacyState);
  useEffect(() => { diplomacyStateRef.current = diplomacyState; }, [diplomacyState]);
  const lastAiDecisionTimeRef = useRef(0);

  const handleSetSpeed = useCallback((speed) => {
    RomanAudio.playClick();
    if (speed === 'pause') {
      setIsPaused(true);
      isPausedRef.current = true;
      setGameSpeed('pause');
      gameSpeedRef.current = 'pause';
    } else if (speed === '1x') {
      setIsPaused(false);
      isPausedRef.current = false;
      setGameSpeed('1x');
      gameSpeedRef.current = '1x';
    } else if (speed === '2x') {
      setIsPaused(false);
      isPausedRef.current = false;
      setGameSpeed('2x');
      gameSpeedRef.current = '2x';
    }
  }, []);

  // Persistent Settlement Garrisons: Map<siteId, { cohortCount, units, totalMen }>
  const [settlementGarrisons, setSettlementGarrisons] = useState(new Map());
  const settlementGarrisonsRef = useRef(new Map());
  useEffect(() => { settlementGarrisonsRef.current = settlementGarrisons; }, [settlementGarrisons]);

  // War Declaration Prompt State: { general, site, screenX, screenY }
  const [warDeclarationPrompt, setWarDeclarationPrompt] = useState(null);

  // Battle Modal State: { attacker, defSite, defWeight, elevation, existingGarrison }
  const [battleModal, setBattleModal] = useState(null);

  // Notifications
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-3), { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const [hudInfo, setHudInfo] = useState({
    zoom: 100,
    elevation: null,
    terrain: null,
    coord: null,
    territory: null,
    culture: null,
  });
  const hoverRef = useRef({ elevation: null, terrain: null, coord: null, territory: null, culture: null });
  const [tooltip, setTooltip] = useState(null);
  const hoveredSiteRef = useRef(null);
  const hoveredRegionRef = useRef(null);

  // Initialize or get persistent explored mask canvas
  const getExploredMask = useCallback(() => {
    if (exploredMaskRef.current) return exploredMaskRef.current;
    if (typeof window === 'undefined') return null;

    const mCanvas = document.createElement('canvas');
    mCanvas.width = MAP_WIDTH;
    mCanvas.height = MAP_HEIGHT;
    const mctx = mCanvas.getContext('2d');

    mctx.fillStyle = '#000000';
    mctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    mctx.fillStyle = '#ffffff';
    mctx.strokeStyle = '#ffffff';
    mctx.lineWidth = 100;
    mctx.lineJoin = 'round';
    mctx.lineCap = 'round';

    for (const reg of regionsData.regions) {
      if (initialKnownIds.has(reg.id)) {
        if (reg.pathD) {
          const p = getRegionPath(reg.pathD);
          if (p) {
            mctx.fill(p);
            mctx.stroke(p);
          }
        }
        mctx.beginPath();
        mctx.arc(reg.center[0], reg.center[1], 160, 0, Math.PI * 2);
        mctx.fill();
      }
    }

    // Initial scout vision sphere at Rome
    mctx.beginPath();
    mctx.arc(romeRegion.center[0], romeRegion.center[1], Math.round(150 / KM_PER_PIXEL) + 25, 0, Math.PI * 2);
    mctx.fill();

    exploredMaskRef.current = mCanvas;
    return mCanvas;
  }, []);

  const stampScoutVisionToMask = useCallback((x, y, radiusPx) => {
    const mask = exploredMaskRef.current || getExploredMask();
    if (!mask) return;
    const mctx = mask.getContext('2d');
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.arc(x, y, radiusPx, 0, Math.PI * 2);
    mctx.fill();
  }, [getExploredMask]);

  // Pre-render static minimap
  const getMinimapBase = useCallback(() => {
    if (minimapBaseRef.current) return minimapBaseRef.current;
    if (typeof window === 'undefined') return null;

    const mCanvas = document.createElement('canvas');
    mCanvas.width = 236;
    mCanvas.height = 200;
    const ctx = mCanvas.getContext('2d');

    ctx.save();
    ctx.scale(236 / MAP_WIDTH, 200 / MAP_HEIGHT);

    for (const reg of regionsData.regions) {
      if (reg.pathD) {
        const p = getRegionPath(reg.pathD);
        if (p) {
          ctx.fillStyle = reg.color || '#5a4632';
          ctx.fill(p);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1.0;
          ctx.stroke(p);
        }
      }
    }

    for (const site of ancientSites) {
      if (site.weight >= 6) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(site.x, site.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
    minimapBaseRef.current = mCanvas;
    return mCanvas;
  }, []);

  // Minimap pan / click handler
  const handleMinimapPan = useCallback((clientX, clientY) => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const clickY = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const targetMapX = (clickX / rect.width) * MAP_WIDTH;
    const targetMapY = (clickY / rect.height) * MAP_HEIGHT;

    const vw = window.innerWidth, vh = window.innerHeight;
    const c = cam.current;
    c.x = vw / 2 - targetMapX * c.zoom;
    c.y = vh / 2 - targetMapY * c.zoom;

    const curW = MAP_WIDTH * c.zoom, curH = MAP_HEIGHT * c.zoom;
    if (curW < vw) c.x = (vw - curW) / 2;
    else c.x = Math.max(vw - curW - 80, Math.min(80, c.x));
    if (curH < vh) c.y = (vh - curH) / 2;
    else c.y = Math.max(vh - curH - 80, Math.min(80, c.y));

    if (svgElRef.current) {
      svgElRef.current.setAttribute('viewBox',
        `${-c.x / c.zoom} ${-c.y / c.zoom} ${vw / c.zoom} ${vh / c.zoom}`);
    }
  }, []);

  // Toggle SVG layers
  const applySvgState = (mode, bordersOn) => {
    if (!svgElRef.current) return;
    const terrainG = svgElRef.current.querySelector('#terrain');
    const vintageG = svgElRef.current.querySelector('#vintage-paper');
    const bordersG = svgElRef.current.querySelector('#watershed-borders');
    const seaTerr  = svgElRef.current.querySelector('#sea-terrain-bg');
    const seaVint  = svgElRef.current.querySelector('#sea-vintage-bg');

    if (mode === 'vintage') {
      if (terrainG) terrainG.style.display = 'none';
      if (vintageG) vintageG.style.display = 'block';
      if (seaTerr)  seaTerr.style.display  = 'none';
      if (seaVint)  seaVint.style.display  = 'block';
    } else {
      if (terrainG) terrainG.style.display = 'block';
      if (vintageG) vintageG.style.display = 'none';
      if (seaTerr)  seaTerr.style.display  = 'block';
      if (seaVint)  seaVint.style.display  = 'none';
    }

    if (bordersG) {
      // Dynamic canvas borders handle ownership-aware rendering so same-owner borders disappear
      bordersG.style.display = 'none';
    }
  };

  useEffect(() => {
    applySvgState(visualMode, showBorders);
  }, [visualMode, showBorders]);

  // Load SVG inline
  useEffect(() => {
    fetch('/campaign_map.svg')
      .then(r => r.text())
      .then(svgText => {
        if (!svgContainerRef.current) return;
        svgContainerRef.current.innerHTML = svgText;
        const svg = svgContainerRef.current.querySelector('svg');
        if (svg) {
          svg.style.position = 'absolute';
          svg.style.top = '0';
          svg.style.left = '0';
          svg.style.width = '100vw';
          svg.style.height = '100vh';
          svg.style.pointerEvents = 'none';
          svg.setAttribute('preserveAspectRatio', 'none');
          svgElRef.current = svg;
          applySvgState(visualModeRef.current, showBordersRef.current);
        }
      });
  }, []);

  // ─── Set Scout Destination & Order March ─────────────────────────────────────
  const handleOrderMarch = useCallback((targetX, targetY) => {
    const currentScout = scoutsRef.current.find(s => s.id === selectedScoutRef.current);
    if (!currentScout) return;

    const path = calculatePath(currentScout.x, currentScout.y, targetX, targetY, pathfindingModeRef.current);
    const route = analyzeRoute(path, currentScout.baseSpeedKmPerMin);

    RomanAudio.playMarch();
    setScouts(prev => prev.map(s => {
      if (s.id !== currentScout.id) return s;
      return {
        ...s,
        target: { x: targetX, y: targetY },
        path,
        routeInfo: route,
        status: 'marching',
      };
    }));

    addToast(`🏇 Route plotted: ${route.distanceKm} km (Est. ${route.turnsEta} months / turns)`, 'info');
  }, [addToast]);

  // ─── Hire Scout & Raise General Handlers ─────────────────────────────────────
  const handleHireScout = useCallback((candidate) => {
    const prov = selectedProvinceRef.current || romeRegion;
    const newId = `scout-${Date.now()}`;
    const newScout = {
      id: newId,
      name: `${candidate.name} (Scout)`,
      level: 1,
      x: prov.center[0],
      y: prov.center[1],
      target: null,
      path: [],
      routeInfo: null,
      status: 'idle',
      distanceTraveledKm: 0,
      baseSpeedKmPerMin: 150,
      visionRadiusKm: 150,
      visionRadiusPx: Math.round(150 / KM_PER_PIXEL),
    };
    setScouts(prev => [...prev, newScout]);
    setSelectedScoutId(newId);
    selectedScoutRef.current = newId;
    stampScoutVisionToMask(newScout.x, newScout.y, newScout.visionRadiusPx);
    addToast(`🐎 Scout ${candidate.name} mustered at ${prov.site}!`, 'success');
  }, [addToast, stampScoutVisionToMask]);

  const handleRaiseGeneral = useCallback((candidate) => {
    const prov = selectedProvinceRef.current || romeRegion;
    const newId = `general-${Date.now()}`;
    const newGeneral = {
      id: newId,
      name: `General ${candidate.name}`,
      role: 'Legatus Legionis',
      legionName: null,
      provinceId: prov.id,
      provinceName: prov.site,
      x: prov.center[0],
      y: prov.center[1],
      target: null,
      path: [],
      routeInfo: null,
      status: 'idle',
      distanceTraveledKm: 0,
      baseSpeedKmPerMin: 38,   // Legions march ~38 km/day — much slower than scouts
      maxUnits: 20,
      units: [],
    };
    setGenerals(prev => [...prev, newGeneral]);
    setSelectedGeneralId(newId);
    selectedGeneralRef.current = newId;
    setSelectedScoutId(null);
    selectedScoutRef.current = null;
    setSelectedProvince(null);
    selectedProvinceRef.current = null;
    addToast(`🦅 ${newGeneral.name} raised at ${prov.site} — Legion banner planted!`, 'success');
  }, [addToast]);

  // Spend / earn the player's gold in BOTH the UI state and the simulation ledger
  // (the turn tick re-reads the ledger, so spending only in React state would be refunded).
  const adjustPlayerGold = useCallback((delta) => {
    const dip = diplomacyStateRef.current;
    if (dip?.treasuries) dip.treasuries.rome = Math.max(0, (dip.treasuries.rome || 0) + delta);
    setPlayerTreasury(t => Math.max(0, t + delta));
  }, []);

  const handleRecruitUnit = useCallback((newUnit, cost = 0) => {
    if (!selectedGeneralRef.current) return;
    if (cost > 0) {
      const have = diplomacyStateRef.current?.treasuries?.rome ?? 0;
      if (have < cost) {
        addToast(`Treasury insufficient! ${newUnit.name} costs ${cost} Denarii.`, 'error');
        return;
      }
    }
    const targetGenId = selectedGeneralRef.current;
    setGenerals(prev => prev.map(g => {
      if (g.id !== targetGenId) return g;
      if ((g.units || []).length >= (g.maxUnits || 20)) return g;
      return { ...g, units: [...(g.units || []), newUnit] };
    }));
    const gRef = generalsRef.current.find(g => g.id === targetGenId);
    if (gRef && (gRef.units || []).length < (gRef.maxUnits || 20)) {
      gRef.units = [...(gRef.units || []), newUnit];
    }
    if (cost > 0) adjustPlayerGold(-cost);
    RomanAudio.playMarch();
    addToast(`🛡️ ${newUnit.name} (1,000 troops) equipped to legion${cost ? ` (-${cost} 🪙)` : ''}!`, 'success');
  }, [addToast, adjustPlayerGold]);

  const handleDisbandUnit = useCallback((unitId) => {
    if (!selectedGeneralRef.current) return;
    const targetGenId = selectedGeneralRef.current;
    setGenerals(prev => prev.map(g => {
      if (g.id !== targetGenId) return g;
      return { ...g, units: (g.units || []).filter(u => u.id !== unitId) };
    }));
    const gRef = generalsRef.current.find(g => g.id === targetGenId);
    if (gRef) {
      gRef.units = (gRef.units || []).filter(u => u.id !== unitId);
    }
    RomanAudio.playClick();
    addToast('Cohort disbanded from legion.', 'info');
  }, [addToast]);

  // ─── Handle Go For War – Legion Marches to Settlement Center ────────────────
  const handleGoForWar = useCallback((general, site) => {
    // Army marches straight to the settlement center of origin (site.x, site.y)
    const path = calculatePath(general.x, general.y, site.x, site.y, pathfindingModeRef.current);
    const route = analyzeRoute(path, general.baseSpeedKmPerMin);
    RomanAudio.playMarch();

    setGenerals(prev => prev.map(g => {
      if (g.id !== general.id) return g;
      return {
        ...g,
        target: { x: site.x, y: site.y },
        path,
        routeInfo: route,
        status: 'marching',
        battleTargetSite: site,
      };
    }));

    const gRef = generalsRef.current.find(g => g.id === general.id);
    if (gRef) {
      gRef.target = { x: site.x, y: site.y };
      gRef.path = path;
      gRef.routeInfo = route;
      gRef.status = 'marching';
      gRef.battleTargetSite = site;
    }

    {
      const dip = diplomacyStateRef.current;
      const targetRoot = dip ? getRootController(site.id, dip.provinceOwners) : null;
      if (dip && targetRoot !== null && targetRoot !== playerHomeRegion.id) {
        declareWar(dip, regionsData.regions, playerHomeRegion.id, targetRoot);
      }
    }
    addToast(`⚔️ WAR DECLARED! ${general.name}'s legion marches on ${site.site}!`, 'error');
    setWarDeclarationPrompt(null);
  }, [addToast]);

  // ─── Handle Battle Victory – capture province & eliminate garrison ───────────
  const handleBattleVictory = useCallback(({ defSite, survivingUnits, atkCasualties, defCasualties }) => {
    const matchingReg = regionsData.regions.find(r => r.id === defSite.id || r.site === defSite.site);
    const victorProvinceId = playerHomeRegion.id;

    if (matchingReg) {
      setConqueredRegions(prev => {
        const next = new Map(prev);
        next.set(matchingReg.id, victorProvinceId);
        return next;
      });
      diplomacyStateRef.current?.provinceOwners?.set(matchingReg.id, victorProvinceId);

      if (typeof window !== 'undefined') {
        const svgPath = document.querySelector(`#reg-${matchingReg.id}`);
        if (svgPath) {
          svgPath.setAttribute('fill', '#ffffff');
          svgPath.setAttribute('fill-opacity', '0.22');
        }
      }
    }

    // Since soldiers of the garrison were killed in the assault, claimed settlement has 0 garrison
    const emptyGarrison = { cohortCount: 0, units: [], totalMen: 0 };
    setSettlementGarrisons(prev => new Map(prev).set(defSite.id, emptyGarrison));
    settlementGarrisonsRef.current.set(defSite.id, emptyGarrison);

    // Update attacker general's units (depleted health / dead units removed)
    if (survivingUnits) {
      const atkGenId = battleModal?.attacker?.id || selectedGeneralRef.current;
      setGenerals(prev => prev.map(g => {
        if (g.id !== atkGenId) return g;
        return { ...g, units: survivingUnits };
      }));
      const gRef = generalsRef.current.find(g => g.id === atkGenId);
      if (gRef) {
        gRef.units = survivingUnits;
      }
    }

    addToast(`🦅 VICTORIA! ${defSite.site} conquered and united with ${playerHomeRegion.site}! Garrison eliminated in assault.`, 'success');
    RomanAudio.playDiscovery();
  }, [addToast, battleModal, playerHomeRegion]);

  // ─── Handle Battle Defeat – retreat and apply real casualties to both sides ───
  const handleBattleDefeat = useCallback(({ defSite, survivingUnits, atkCasualties, defCasualties, existingGarrison }) => {
    // Update attacker general's units (losses taken, destroyed units removed)
    if (survivingUnits) {
      const atkGenId = battleModal?.attacker?.id || selectedGeneralRef.current;
      setGenerals(prev => prev.map(g => {
        if (g.id !== atkGenId) return g;
        return { ...g, units: survivingUnits };
      }));
      const gRef = generalsRef.current.find(g => g.id === atkGenId);
      if (gRef) {
        gRef.units = survivingUnits;
      }
    }

    // Deplete defender garrison units based on defCasualties
    const defCohorts = existingGarrison?.units || [];
    const lossPerCohort = Math.round((defCasualties || 0) / Math.max(1, defCohorts.length));
    const survivingDefUnits = [];
    for (const gu of defCohorts) {
      const cur = Math.max(0, gu.men ?? gu.count ?? 1000);
      const remaining = cur - lossPerCohort;
      if (remaining > 0) {
        survivingDefUnits.push({ ...gu, men: remaining, count: remaining });
      }
    }
    const updatedGarrison = {
      cohortCount: survivingDefUnits.length,
      units: survivingDefUnits,
      totalMen: survivingDefUnits.reduce((s, u) => s + (u.men || u.count || 0), 0),
    };
    setSettlementGarrisons(prev => new Map(prev).set(defSite.id, updatedGarrison));
    settlementGarrisonsRef.current.set(defSite.id, updatedGarrison);

    addToast(`🛡️ Assault repelled at ${defSite.site}! Roman losses: ${(atkCasualties || 0).toLocaleString()}, Defenders suffered ${(defCasualties || 0).toLocaleString()} losses.`, 'error');
  }, [addToast, battleModal]);


  useEffect(() => {
    const container   = containerRef.current;
    const canvas      = canvasRef.current;
    const fogCanvas   = fogCanvasRef.current;
    const unitsCanvas = unitsCanvasRef.current;
    const sitesCanvas = sitesCanvasRef.current;
    if (!container || !canvas || !fogCanvas || !unitsCanvas || !sitesCanvas) return;

    const updateDimensions = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      for (const cv of [canvas, fogCanvas, unitsCanvas, sitesCanvas]) {
        cv.width  = vw * dpr; cv.height = vh * dpr;
        cv.style.width = `${vw}px`; cv.style.height = `${vh}px`;
      }
      const fitZoom = Math.min(vw / MAP_WIDTH, vh / MAP_HEIGHT) * 0.96;
      cam.current.minZoom = fitZoom;
      if (cam.current.zoom < fitZoom) cam.current.zoom = fitZoom;
      if (cam.current.x === 0 && cam.current.y === 0) {
        const startZoom = Math.max(fitZoom * 1.5, 0.9);
        cam.current.zoom = startZoom;
        cam.current.x = vw / 2 - playerHomeRegion.center[0] * startZoom;
        cam.current.y = vh / 2 - playerHomeRegion.center[1] * startZoom;
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    let animId;
    let lastHudUpdate = 0;

    const tick = (now) => {
      if (lastTickTimeRef.current == null) lastTickTimeRef.current = now;
      const rawDt = Math.min(0.08, (now - lastTickTimeRef.current) / 1000);
      lastTickTimeRef.current = now;

      // When paused, simulation dt is 0 (freezes scouts, armies, AI, upkeep & timers)
      const speedMult = isPausedRef.current ? 0 : (gameSpeedRef.current === '2x' ? 2.0 : 1.0);
      const dt = rawDt * speedMult;
      const cqMap = conqueredRegionsRef.current;

      let anyNewDiscovery = false;
      const discSet = discoveredIdsRef.current;
      const currentScouts = scoutsRef.current;

      // Real-time Scout March Animation
      for (const scout of currentScouts) {
        if (scout.status === 'marching' && scout.path && scout.path.length >= 2) {
          const elev = getElevationAt(scout.x, scout.y);
          const mult = Math.max(0.18, getTerrainSpeedMultiplier(elev));
          const kmStep = 30.0 * mult * dt;
          let pxStep = kmStep / KM_PER_PIXEL;

          while (pxStep > 0.05 && scout.path.length >= 2) {
            const p1 = scout.path[1];
            const segDist = Math.hypot(p1.x - scout.x, p1.y - scout.y);
            if (pxStep >= segDist) {
              scout.x = p1.x;
              scout.y = p1.y;
              const movedKm1 = segDist * KM_PER_PIXEL;
              scout.distanceTraveledKm = (scout.distanceTraveledKm || 0) + movedKm1;
              pxStep -= segDist;
              scout.path.shift();
            } else {
              const fraction = pxStep / segDist;
              scout.x += (p1.x - scout.x) * fraction;
              scout.y += (p1.y - scout.y) * fraction;
              const movedKm = pxStep * KM_PER_PIXEL;
              scout.distanceTraveledKm = (scout.distanceTraveledKm || 0) + movedKm;
              scout.path[0] = { x: scout.x, y: scout.y };
              pxStep = 0;
            }
          }

          stampScoutVisionToMask(scout.x, scout.y, scout.visionRadiusPx);

          if (scout.path.length < 2) {
            scout.status = 'idle';
            scout.path = [];
            scout.routeInfo = null;
          }

          // Fog of war discovery
          for (const reg of regionsData.regions) {
            if (!discSet.has(reg.id)) {
              const dist = Math.hypot(scout.x - reg.center[0], scout.y - reg.center[1]);
              if (dist <= scout.visionRadiusPx + 15) {
                discSet.add(reg.id);
                anyNewDiscovery = true;
                addToast(`🏛️ Discovered: ${reg.site} (${reg.sovereignName || reg.site})`, 'success');
              }
            }
          }
        }
      }

      if (anyNewDiscovery) {
        RomanAudio.playDiscovery();
        setDiscoveredIds(new Set(discSet));
      }

      // Real-time General / Army March Animation (much slower — legion pace)
      const currentGenerals = generalsRef.current;
      for (const gen of currentGenerals) {
        if (gen.status === 'marching' && gen.path && gen.path.length >= 2) {
          const elev = getElevationAt(gen.x, gen.y);
          const mult = Math.max(0.12, getTerrainSpeedMultiplier(elev));
          // Generals march at 38 km/month base speed (~4x slower than scouts)
          const kmStep = gen.baseSpeedKmPerMin * mult * dt;
          let pxStep = kmStep / KM_PER_PIXEL;

          while (pxStep > 0.05 && gen.path.length >= 2) {
            const p1 = gen.path[1];
            const segDist = Math.hypot(p1.x - gen.x, p1.y - gen.y);
            if (pxStep >= segDist) {
              gen.x = p1.x;
              gen.y = p1.y;
              gen.distanceTraveledKm = (gen.distanceTraveledKm || 0) + segDist * KM_PER_PIXEL;
              pxStep -= segDist;
              gen.path.shift();
            } else {
              const fraction = pxStep / segDist;
              gen.x += (p1.x - gen.x) * fraction;
              gen.y += (p1.y - gen.y) * fraction;
              gen.distanceTraveledKm = (gen.distanceTraveledKm || 0) + pxStep * KM_PER_PIXEL;
              gen.path[0] = { x: gen.x, y: gen.y };
              pxStep = 0;
            }
          }

          // Check collision with enemy AI generals in open field during march
          const curDipState = diplomacyStateRef.current;
          let interceptedAiGen = null;
          if (curDipState && curDipState.aiGenerals) {
            for (let i = 0; i < curDipState.aiGenerals.length; i++) {
              const aiGen = curDipState.aiGenerals[i];
              if (!aiGen || !aiGen.units || aiGen.units.length === 0) continue;
              const aiRoot = getRootController(aiGen.homeProvinceId || aiGen.faction, cqMap);
              if (aiRoot === playerHomeRegion.id) continue;
              const distToAi = Math.hypot(gen.x - aiGen.x, gen.y - aiGen.y);
              if (distToAi <= 42) {
                interceptedAiGen = aiGen;
                break;
              }
            }
          }

          if (interceptedAiGen) {
            // Marching into a foreign host is an act of war.
            {
              const aiRootI = getRootController(interceptedAiGen.homeProvinceId || interceptedAiGen.faction, cqMap);
              if (curDipState && declareWar(curDipState, regionsData.regions, playerHomeRegion.id, aiRootI)) {
                addToast(`⚔️ Your legion attacked a ${FACTION_CONFIG[interceptedAiGen.faction]?.shortName || 'foreign'} host — war is declared!`, 'error');
              }
            }
            gen.status = 'idle';
            gen.path = [];
            gen.routeInfo = null;
            delete gen.battleTargetSite;
            const elev = Math.max(0, getElevationAt(gen.x, gen.y));
            const res = simulateFieldBattleOutcome(gen, interceptedAiGen, elev);
            const fConf = FACTION_CONFIG[interceptedAiGen.faction] || FACTION_CONFIG.independent;

            if (res.atkWins) {
              // Player wins
              gen.units = res.winnerUnits;
              setGenerals(prev => prev.map(g => g.id === gen.id ? { ...g, units: res.winnerUnits } : g));
              if (res.isLoserDeleted) {
                curDipState.aiGenerals = curDipState.aiGenerals.filter(g => g.id !== interceptedAiGen.id);
                addToast(`🦅 TOTAL ANNIHILATION! ${gen.name} crushed and destroyed ${interceptedAiGen.name} (${fConf.shortName})'s host in the field! Enemy unit deleted!`, 'success');
                RomanAudio.playDiscovery();
              } else {
                interceptedAiGen.units = res.loserUnits;
                addToast(`⚔️ FIELD VICTORY! ${gen.name} defeated ${interceptedAiGen.name} in open combat! Enemy casualties: -${res.loserLosses.toLocaleString()}.`, 'success');
                RomanAudio.playDiscovery();
              }
            } else {
              // AI wins
              interceptedAiGen.units = res.winnerUnits;
              if (res.isLoserDeleted) {
                setGenerals(prev => prev.filter(g => g.id !== gen.id));
                generalsRef.current = generalsRef.current.filter(g => g.id !== gen.id);
                if (selectedGeneralRef.current === gen.id) {
                  setSelectedGeneralId(null);
                  selectedGeneralRef.current = null;
                }
                addToast(`💀 CATASTROPHIC FIELD ROUT! ${gen.name}'s legion was enveloped and annihilated by ${interceptedAiGen.name} (${fConf.shortName})! Entire force wiped out!`, 'error');
                RomanAudio.playWar();
              } else {
                gen.units = res.loserUnits;
                setGenerals(prev => prev.map(g => g.id === gen.id ? { ...g, units: res.loserUnits } : g));
                addToast(`⚔️ FIELD DEFEAT! ${gen.name} was repelled by ${interceptedAiGen.name}! Legion casualties: -${res.loserLosses.toLocaleString()}.`, 'error');
                RomanAudio.playWar();
              }
            }
          } else if (gen.path.length < 2) {
            gen.status = 'idle';
            gen.path = [];
            gen.routeInfo = null;

            // Check if this army was marching to war at a settlement!
            if (gen.battleTargetSite) {
              const targetSite = gen.battleTargetSite;
              delete gen.battleTargetSite;
              // Snap to the exact settlement center of origin (not borders)
              gen.x = targetSite.x;
              gen.y = targetSite.y;
              const elev = getElevationAt(targetSite.x, targetSite.y);
              const existingG = settlementGarrisonsRef.current.get(targetSite.id) || generateGarrison(targetSite.weight || 5);
              RomanAudio.playDiscovery();
              addToast(`🎺 ${gen.name}'s legion arrived at ${targetSite.site} center! Choose battle stance to commence siege.`, 'success');
              setBattleModal({
                attacker: { ...gen },
                defSite: targetSite,
                defWeight: targetSite.weight || 5,
                elevation: Math.max(0, elev),
                existingGarrison: existingG,
              });
            }
          }
        }
      }

      // ── Whole-Map AI Simulation & Diplomacy Tick ─────────────────────────
      if (dt > 0) {
        const curDip = diplomacyStateRef.current;
        const updatedDip = tickDiplomacyAndEconomy({
          state: curDip,
          dt,
          regions: regionsData.regions,
          playerLegionUnits: currentGenerals[0]?.units || [],
          onWarDeclared: ({ aggressor, target, announcement, involvesPlayer }) => {
            RomanAudio.playWar();
            addToast(involvesPlayer ? `${announcement} Your frontier is in danger!` : announcement, 'error');
          },
          onPeaceMade: ({ aName, bName, involvesPlayer }) => {
            addToast(`🕊️ PEACE: ${aName} and ${bName} have agreed to a truce.`, involvesPlayer ? 'success' : 'info');
          },
          onTurnComplete: ({ turn, playerIncome, playerUpkeep, playerNet, treasury }) => {
            RomanAudio.playCoin();
            setTurnNumber(turn);
            setPlayerTreasury(treasury);
            setPlayerIncome(playerIncome);
            setPlayerUpkeep(playerUpkeep);
            setPlayerNet(playerNet);
            addToast(`💰 Turn ${turn} Ledger: +${playerIncome.toLocaleString()} Denarii income, -${playerUpkeep.toLocaleString()} upkeep (Net: ${playerNet >= 0 ? '+' : ''}${playerNet.toLocaleString()})`, 'info');
          },
        });
        diplomacyStateRef.current = updatedDip;

        // Periodic AI Military Decisions (every 3.5 seconds)
        if (now - lastAiDecisionTimeRef.current > 3500) {
          lastAiDecisionTimeRef.current = now;
          evaluateAiMilitaryDecisions({
            state: updatedDip,
            regions: regionsData.regions,
            settlementGarrisons: settlementGarrisonsRef.current,
            playerLegion: currentGenerals[0],
            playerGenerals: generalsRef.current,
            onAiMarchOrder: ({ general, action, targetRegion, powerRatio, reason }) => {
              const path = calculatePath(general.x, general.y, targetRegion.center[0], targetRegion.center[1], 'terrain');
              general.target = { x: targetRegion.center[0], y: targetRegion.center[1] };
              general.path = path;
              general.status = action === 'attack' ? 'marching' : 'retreating';
              general.targetSettlement = targetRegion;
              general.action = action;
              const hostLabel = general.homeSite || FACTION_CONFIG[general.faction]?.shortName || 'Provincial Host';
              if (action === 'attack') {
                addToast(`⚔️ ${general.name} (${hostLabel}) advancing across border to assault ${targetRegion.site}!`, 'warning');
              } else if (reason === 'defend') {
                addToast(`🛡️ ${general.name} (${hostLabel}) rushing to defend ${targetRegion.site}!`, 'info');
              }
            },
          });
        }

        // Real-time AI Generals March Animation
        for (const aiGen of updatedDip.aiGenerals) {
          if ((aiGen.status === 'marching' || aiGen.status === 'retreating') && aiGen.path && aiGen.path.length >= 2) {
            const elev = getElevationAt(aiGen.x, aiGen.y);
            const mult = Math.max(0.12, getTerrainSpeedMultiplier(elev));
            const kmStep = (aiGen.baseSpeedKmPerMin || 35) * mult * dt;
            let pxStep = kmStep / KM_PER_PIXEL;

            while (pxStep > 0.05 && aiGen.path.length >= 2) {
              const p1 = aiGen.path[1];
              const segDist = Math.hypot(p1.x - aiGen.x, p1.y - aiGen.y);
              if (pxStep >= segDist) {
                aiGen.x = p1.x;
                aiGen.y = p1.y;
                pxStep -= segDist;
                aiGen.path.shift();
              } else {
                const fraction = pxStep / segDist;
                aiGen.x += (p1.x - aiGen.x) * fraction;
                aiGen.y += (p1.y - aiGen.y) * fraction;
                aiGen.path[0] = { x: aiGen.x, y: aiGen.y };
                pxStep = 0;
              }
            }

            if (aiGen.path.length < 2) {
              aiGen.path = [];
              const targetReg = aiGen.targetSettlement;
              aiGen.targetSettlement = null;

              if (aiGen.action === 'attack' && targetReg) {
                aiGen.status = 'idle';
                const targetOwner = updatedDip.provinceOwners.get(targetReg.id);

                // Check if player general is near the target — if so, fight the player general first!
                const playerGens = generalsRef.current;
                let engagedPlayerGen = null;
                for (const pg of playerGens) {
                  const dist = Math.hypot(aiGen.x - pg.x, aiGen.y - pg.y);
                  if (dist < 80) { // Within engagement range (~80 map pixels)
                    engagedPlayerGen = pg;
                    break;
                  }
                }

                if (engagedPlayerGen) {
                  // ── AI vs PLAYER FIELD BATTLE (Simulated with Unit Deletion Chance) ──
                  const elev = getElevationAt(aiGen.x, aiGen.y);
                  const res = simulateFieldBattleOutcome(aiGen, engagedPlayerGen, Math.max(0, elev));
                  const fConf = FACTION_CONFIG[aiGen.faction] || FACTION_CONFIG.independent;

                  if (res.atkWins) {
                    // AI wins
                    aiGen.units = res.winnerUnits;
                    if (res.isLoserDeleted) {
                      setGenerals(prev => prev.filter(g => g.id !== engagedPlayerGen.id));
                      generalsRef.current = generalsRef.current.filter(g => g.id !== engagedPlayerGen.id);
                      if (selectedGeneralRef.current === engagedPlayerGen.id) {
                        setSelectedGeneralId(null);
                        selectedGeneralRef.current = null;
                      }
                      addToast(`💀 CATASTROPHIC FIELD ROUT! ${aiGen.name} (${fConf.shortName}) annihilated ${engagedPlayerGen.name}'s entire force! The legion has been wiped from the map!`, 'error');
                      RomanAudio.playWar();
                    } else {
                      engagedPlayerGen.units = res.loserUnits;
                      setGenerals(prev => prev.map(g => g.id === engagedPlayerGen.id ? { ...g, units: res.loserUnits } : g));
                      addToast(`⚔️ FIELD BATTLE! ${aiGen.name} (${fConf.shortName}) defeated ${engagedPlayerGen.name} in open combat! Casualties: -${res.loserLosses.toLocaleString()}.`, 'error');
                      RomanAudio.playWar();
                    }
                  } else {
                    // Player wins
                    engagedPlayerGen.units = res.winnerUnits;
                    setGenerals(prev => prev.map(g => g.id === engagedPlayerGen.id ? { ...g, units: res.winnerUnits } : g));
                    if (res.isLoserDeleted) {
                      updatedDip.aiGenerals = updatedDip.aiGenerals.filter(g => g.id !== aiGen.id);
                      addToast(`🦅 TOTAL ANNIHILATION! ${engagedPlayerGen.name} completely crushed and wiped out ${aiGen.name} (${fConf.shortName})'s host in the field! Enemy force eliminated!`, 'success');
                      RomanAudio.playDiscovery();
                    } else {
                      aiGen.units = res.loserUnits;
                      addToast(`🛡️ FIELD BATTLE! ${engagedPlayerGen.name} repelled ${aiGen.name} (${fConf.shortName}) in open field! Enemy casualties: -${res.loserLosses.toLocaleString()}.`, 'success');
                      RomanAudio.playDiscovery();
                    }
                  }
                } else {
                  // Auto-simulate the assault against the settlement garrison (both sides bleed)
                  const atkRoot = getRootController(aiGen.homeProvinceId || aiGen.faction, updatedDip.provinceOwners);
                  const defRoot = getRootController(targetReg.id, updatedDip.provinceOwners);
                  if (atkRoot === defRoot) {
                    // Someone else already took it — nothing to assault.
                  } else {
                    noteClash(updatedDip, atkRoot, defRoot);
                    const out = resolveAiAssault(aiGen, targetReg, settlementGarrisonsRef.current);
                    const isTargetPlayerOwned = (getRootController(targetReg.id, conqueredRegionsRef.current) === playerHomeRegion.id);
                    aiGen.units = out.survivingAtk;

                    if (out.atkWins) {
                      // Conquering realm claims the settlement into its empire tree
                      updatedDip.provinceOwners.set(targetReg.id, atkRoot);
                      setConqueredRegions(prev => new Map(prev).set(targetReg.id, atkRoot));
                      settlementGarrisonsRef.current.set(targetReg.id, {
                        cohortCount: 1,
                        units: [{ id: `occ-${Date.now()}`, name: `${aiGen.name} Garrison`, type: 'sword_levis', men: 500, attack: 30, defense: 30, morale: 60 }],
                        totalMen: 500,
                      });
                      addToast(isTargetPlayerOwned
                        ? `⚔️ ${aiGen.name} overwhelmed the garrison and conquered ${targetReg.site} from your realm!`
                        : `⚔️ ${aiGen.name} conquered ${targetReg.site}!`, isTargetPlayerOwned ? 'error' : 'warning');
                    } else {
                      settlementGarrisonsRef.current.set(targetReg.id, out.newGarrison);
                      addToast(isTargetPlayerOwned
                        ? `🛡️ Garrison at ${targetReg.site} repelled the assault by ${aiGen.name}!`
                        : `🛡️ ${targetReg.site} garrison repelled ${aiGen.name}!`, isTargetPlayerOwned ? 'success' : 'info');
                    }

                    if (aiGen.units.length === 0) {
                      updatedDip.aiGenerals = updatedDip.aiGenerals.filter(g => g.id !== aiGen.id);
                      addToast(`💀 ${aiGen.name} was shattered at ${targetReg.site} and disbanded.`, 'info');
                    }
                  }
                }
              } else {
                aiGen.status = 'idle';
              }
            }
          }
        }

        // ── Real-time AI vs AI Field Battles in Open Ground ─────────────────
        const aliveAiGens = [...updatedDip.aiGenerals];
        for (let i = 0; i < aliveAiGens.length; i++) {
          const g1 = aliveAiGens[i];
          if (!g1 || !g1.units || g1.units.length === 0) continue;
          for (let j = i + 1; j < aliveAiGens.length; j++) {
            const g2 = aliveAiGens[j];
            if (!g2 || !g2.units || g2.units.length === 0) continue;

            const root1 = getRootController(g1.homeProvinceId || g1.faction, cqMap);
            const root2 = getRootController(g2.homeProvinceId || g2.faction, cqMap);
            if (root1 === root2) continue; // Same faction/empire alliance
            if (!areRootsAtWar(updatedDip, root1, root2)) continue; // Only fight realms we are at war with

            const dist = Math.hypot(g1.x - g2.x, g1.y - g2.y);
            if (dist < 45) {
              noteClash(updatedDip, root1, root2);
              const elev = Math.max(0, getElevationAt(g1.x, g1.y));
              const res = simulateFieldBattleOutcome(g1, g2, elev);
              const fConfWinner = FACTION_CONFIG[res.winner.faction] || FACTION_CONFIG.independent;
              const fConfLoser = FACTION_CONFIG[res.loser.faction] || FACTION_CONFIG.independent;

              if (res.isLoserDeleted) {
                updatedDip.aiGenerals = updatedDip.aiGenerals.filter(g => g.id !== res.loser.id);
                addToast(`⚔️ FIELD BATTLE: ${res.winner.name} (${fConfWinner.shortName}) completely wiped out ${res.loser.name} (${fConfLoser.shortName})'s host in open field combat! Defeated force deleted!`, 'warning');
              } else {
                res.loser.units = res.loserUnits;
                res.winner.units = res.winnerUnits;
                addToast(`⚔️ FIELD BATTLE: ${res.winner.name} (${fConfWinner.shortName}) defeated ${res.loser.name} (${fConfLoser.shortName}) in open combat!`, 'info');
              }
              break;
            }
          }
        }
      }

      // Camera panning via keyboard
      const c = cam.current, k = keys.current;
      const moveSpeed = Math.max(1.8, 16 / c.zoom);
      if (k.w || k.ArrowUp)    c.y += moveSpeed;
      if (k.s || k.ArrowDown)  c.y -= moveSpeed;
      if (k.a || k.ArrowLeft)  c.x += moveSpeed;
      if (k.d || k.ArrowRight) c.x -= moveSpeed;

      const vw = window.innerWidth, vh = window.innerHeight;
      const curW = MAP_WIDTH * c.zoom, curH = MAP_HEIGHT * c.zoom;
      if (curW < vw) c.x = (vw - curW) / 2;
      else c.x = Math.max(vw - curW - 80, Math.min(80, c.x));
      if (curH < vh) c.y = (vh - curH) / 2;
      else c.y = Math.max(vh - curH - 80, Math.min(80, c.y));

      // 1. Dynamic SVG viewBox
      if (svgElRef.current) {
        svgElRef.current.setAttribute('viewBox',
          `${-c.x / c.zoom} ${-c.y / c.zoom} ${vw / c.zoom} ${vh / c.zoom}`);
      }

      const dpr = window.devicePixelRatio || 1;

      // 2. Boundaries & Region Hover Lightening Canvas
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Selected Province Illumination
      const selected = selectedProvinceRef.current;
      if (selected && selected.pathD) {
        const selPath = getRegionPath(selected.pathD);
        if (selPath) {
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.scale(c.zoom, c.zoom);
          ctx.fillStyle = 'rgba(255, 215, 0, 0.22)';
          ctx.fill(selPath);
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = Math.max(1.2, 2.4 / c.zoom);
          ctx.stroke(selPath);
          ctx.restore();
        }
      }

      // Hovered Region Light-Up
      const activeRegion = hoveredRegionRef.current;
      if (activeRegion && activeRegion.pathD && (!selected || selected.id !== activeRegion.id)) {
        const rPath = getRegionPath(activeRegion.pathD);
        if (rPath) {
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.scale(c.zoom, c.zoom);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
          ctx.fill(rPath);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.lineWidth = Math.max(0.9, 2.0 / c.zoom);
          ctx.stroke(rPath);
          ctx.restore();
        }
      }

      // Outer map frame
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#b08a46';
      ctx.strokeRect(c.x, c.y, MAP_WIDTH * c.zoom, MAP_HEIGHT * c.zoom);

      // ── Conquered Territory & Border Rendering ──────────────────────────────
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.zoom, c.zoom);

      // 1. Fill ALL provinces with their display color (each province has its own
      //    color when self-sovereign, or takes the root controller's color after conquest)
      for (const reg of regionsData.regions) {
        if (!reg.pathD) continue;
        const rp = getRegionPath(reg.pathD);
        if (!rp) continue;
        // Get the display color (follows ownership tree for cascading)
        const hex = getProvinceDisplayColor(reg.id, cqMap, regionsByIdRef.current);
        if (!hex) continue;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.32)`;
        ctx.fill(rp);
      }

      // 2. Dynamic Province & Empire Borders:
      //    User Requirement: If two provinces have the same owner, the borders between them (not all borders), disappear!
      //    Borders only appear at frontiers between different sovereign owners.
      if (showBordersRef.current) {
        const borderList = regionsData.borders || [];
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);

        // Pass 1: Dark outer shadow for crisp contrast against any terrain/province fill
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
        ctx.lineWidth = Math.max(2.4, 3.2 / c.zoom);
        for (let i = 0; i < borderList.length; i++) {
          const b = borderList[i];
          const root1 = getRootController(b.id1, cqMap);
          const root2 = getRootController(b.id2, cqMap);
          // If two provinces have the same owner, their shared border disappears!
          if (root1 === root2) continue;
          const bp = getRegionPath(b.d);
          if (bp) ctx.stroke(bp);
        }

        // Pass 2: Bright gold-parchment frontier line
        ctx.strokeStyle = 'rgba(255, 248, 220, 0.95)';
        ctx.lineWidth = Math.max(1.1, 1.5 / c.zoom);
        for (let i = 0; i < borderList.length; i++) {
          const b = borderList[i];
          const root1 = getRootController(b.id1, cqMap);
          const root2 = getRootController(b.id2, cqMap);
          if (root1 === root2) continue;
          const bp = getRegionPath(b.d);
          if (bp) ctx.stroke(bp);
        }
      }

      ctx.restore();

      ctx.restore();

      // 3. Fog of War Canvas
      const fctx = fogCanvas.getContext('2d');
      fctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);

      if (fogEnabledRef.current) {
        fctx.save();
        fctx.scale(dpr, dpr);
        fctx.fillStyle = 'rgba(8, 12, 18, 0.96)';
        fctx.fillRect(0, 0, vw, vh);

        fctx.globalCompositeOperation = 'destination-out';
        fctx.save();
        fctx.translate(c.x, c.y);
        fctx.scale(c.zoom, c.zoom);

        const exploredMask = getExploredMask();
        if (exploredMask) {
          fctx.drawImage(exploredMask, 0, 0);
        }

        // Real-time smooth vision around each scout
        for (const scout of currentScouts) {
          fctx.beginPath();
          fctx.arc(scout.x, scout.y, scout.visionRadiusPx, 0, Math.PI * 2);
          fctx.fill();
        }

        fctx.restore();
        fctx.restore();
      }

      // 4. Scouts & March Paths Canvas
      const uctx = unitsCanvas.getContext('2d');
      uctx.clearRect(0, 0, unitsCanvas.width, unitsCanvas.height);
      uctx.save();
      uctx.scale(dpr, dpr);

      // Draw march routes for scouts
      for (const scout of scoutsRef.current) {
        if (scout.path && scout.path.length >= 2) {
          const isSelected = scout.id === selectedScoutRef.current;
          uctx.save();
          uctx.translate(c.x, c.y);
          uctx.scale(c.zoom, c.zoom);

          // Route dashed line
          uctx.beginPath();
          uctx.moveTo(scout.x, scout.y);
          for (let i = 1; i < scout.path.length; i++) {
            uctx.lineTo(scout.path[i].x, scout.path[i].y);
          }
          uctx.strokeStyle = isSelected ? '#ffd700' : '#d4a34b';
          uctx.lineWidth = Math.max(1.5, 3.0 / c.zoom);
          uctx.setLineDash([10 / c.zoom, 8 / c.zoom]);
          uctx.stroke();
          uctx.setLineDash([]);

          // Destination marker flag
          const targetPt = scout.path[scout.path.length - 1];
          uctx.beginPath();
          uctx.arc(targetPt.x, targetPt.y, 4.5 / c.zoom, 0, Math.PI * 2);
          uctx.fillStyle = '#ff4444';
          uctx.fill();
          uctx.strokeStyle = '#ffffff';
          uctx.lineWidth = 1.5 / c.zoom;
          uctx.stroke();

          uctx.restore();
        }
      }

      // Draw Scout unit tokens
      for (const scout of scoutsRef.current) {
        const sx = c.x + scout.x * c.zoom;
        const sy = c.y + scout.y * c.zoom;
        const isSelected = scout.id === selectedScoutRef.current;
        const isMarching = scout.status === 'marching';

        let headingAngle = null;
        if (isMarching && scout.path && scout.path.length >= 2) {
          const p0 = scout.path[0];
          const p1 = scout.path[1];
          headingAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x) + Math.PI / 2;
        }

        drawMapPointer(uctx, sx, sy, isSelected, isMarching, scout, now, headingAngle);
      }

      // Draw march routes for Generals (dark scarlet dashed lines)
      for (const gen of generalsRef.current) {
        if (gen.path && gen.path.length >= 2) {
          const isSelected = gen.id === selectedGeneralRef.current;
          uctx.save();
          uctx.translate(c.x, c.y);
          uctx.scale(c.zoom, c.zoom);

          uctx.beginPath();
          uctx.moveTo(gen.x, gen.y);
          for (let i = 1; i < gen.path.length; i++) {
            uctx.lineTo(gen.path[i].x, gen.path[i].y);
          }
          uctx.strokeStyle = isSelected ? '#ffd700' : '#c0392b';
          uctx.lineWidth = Math.max(2, 4.0 / c.zoom);
          uctx.setLineDash([12 / c.zoom, 7 / c.zoom]);
          uctx.stroke();
          uctx.setLineDash([]);

          // Destination eagle flag marker
          const targetPt = gen.path[gen.path.length - 1];
          uctx.font = `${Math.max(10, 14 / c.zoom)}px sans-serif`;
          uctx.textAlign = 'center';
          uctx.textBaseline = 'middle';
          uctx.fillText('🦅', targetPt.x, targetPt.y);

          uctx.restore();
        }
      }

      // Draw General vexillum (military banner) tokens
      for (const gen of generalsRef.current) {
        const sx = c.x + gen.x * c.zoom;
        const sy = c.y + gen.y * c.zoom;
        const isSelected = gen.id === selectedGeneralRef.current;
        const isMarching = gen.status === 'marching';

        let headingAngle = null;
        if (isMarching && gen.path && gen.path.length >= 2) {
          const p0 = gen.path[0];
          const p1 = gen.path[1];
          headingAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x) + Math.PI / 2;
        }

        drawGeneralBanner(uctx, sx, sy, isSelected, isMarching, gen, now, headingAngle);
      }

      // Draw march routes and vexillum banners for all AI Generals
      const aiGens = diplomacyStateRef.current?.aiGenerals || [];
      for (const aiGen of aiGens) {
        if (aiGen.path && aiGen.path.length >= 2) {
          uctx.save();
          uctx.translate(c.x, c.y);
          uctx.scale(c.zoom, c.zoom);

          uctx.beginPath();
          uctx.moveTo(aiGen.x, aiGen.y);
          for (let i = 1; i < aiGen.path.length; i++) {
            uctx.lineTo(aiGen.path[i].x, aiGen.path[i].y);
          }
          const fConf = FACTION_CONFIG[aiGen.faction] || FACTION_CONFIG.carthage;
          uctx.strokeStyle = fConf.color || '#e74c3c';
          uctx.lineWidth = Math.max(1.8, 3.5 / c.zoom);
          uctx.setLineDash([10 / c.zoom, 7 / c.zoom]);
          uctx.stroke();
          uctx.setLineDash([]);
          uctx.restore();
        }

        const sx = c.x + aiGen.x * c.zoom;
        const sy = c.y + aiGen.y * c.zoom;
        const isMarching = aiGen.status === 'marching' || aiGen.status === 'retreating';

        let headingAngle = null;
        if (isMarching && aiGen.path && aiGen.path.length >= 2) {
          const p0 = aiGen.path[0];
          const p1 = aiGen.path[1];
          headingAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x) + Math.PI / 2;
        }

        drawGeneralBanner(uctx, sx, sy, false, isMarching, aiGen, now, headingAngle);
      }

      uctx.restore();

      // 5. Sites Canvas (Markers + Names)
      const sctx = sitesCanvas.getContext('2d');
      sctx.clearRect(0, 0, sitesCanvas.width, sitesCanvas.height);
      sctx.save();
      sctx.scale(dpr, dpr);

      const frustumX0 = -c.x / c.zoom;
      const frustumY0 = -c.y / c.zoom;
      const frustumX1 = frustumX0 + vw / c.zoom;
      const frustumY1 = frustumY0 + vh / c.zoom;

      const activeHoverSite = hoveredSiteRef.current;
      const discSitesSet = discoveredIdsRef.current;
      const isFogOn = fogEnabledRef.current;

      for (const site of SITES) {
        if (site.x < frustumX0 || site.x > frustumX1 || site.y < frustumY0 || site.y > frustumY1) continue;

        const sx = c.x + site.x * c.zoom;
        const sy = c.y + site.y * c.zoom;

        const rootId = getRootController(site.id, cqMap);
        const rootReg = regionsByIdRef.current[rootId] || site;
        const isSelfSovereign = (rootId === site.id);
        const isPlayerOwned = (rootId === playerHomeRegion.id);
        const siteDisplayColor = getProvinceDisplayColor(site.id, cqMap, regionsByIdRef.current);
        const isHovered = activeHoverSite && activeHoverSite.id === site.id;
        const isSelected = selected && selected.id === site.id;
        const isDiscovered = !isFogOn || discSitesSet.has(site.id);

        const baseR = site.weight >= 9 ? 8.5 : site.weight >= 7 ? 7.0 : site.weight >= 5 ? 5.5 : 4.5;
        const iconSize = Math.max(8.5, Math.min(22, baseR * 1.55 + (isHovered || isSelected ? 2.5 : 0)));

        // Settlement background aura (takes controller's color via ownership tree)
        if (siteDisplayColor) {
          const r = parseInt(siteDisplayColor.slice(1, 3), 16);
          const g = parseInt(siteDisplayColor.slice(3, 5), 16);
          const b = parseInt(siteDisplayColor.slice(5, 7), 16);
          sctx.beginPath();
          sctx.arc(sx, sy, iconSize + 4, 0, Math.PI * 2);
          sctx.fillStyle = isPlayerOwned ? 'rgba(218, 41, 28, 0.55)' : `rgba(${r}, ${g}, ${b}, 0.52)`;
          sctx.fill();
          const strokeHex = isPlayerOwned ? '#ffd700' : (isSelfSovereign ? siteDisplayColor : (rootReg.color || '#ffffff'));
          sctx.strokeStyle = strokeHex;
          sctx.lineWidth = 1.5;
          sctx.stroke();
        } else if (isHovered || isSelected) {
          sctx.beginPath();
          sctx.arc(sx, sy, iconSize + 4, 0, Math.PI * 2);
          sctx.fillStyle = isSelected ? 'rgba(255, 215, 0, 0.50)' : 'rgba(255, 255, 255, 0.40)';
          sctx.fill();
        }

        // Draw Classical Architectural Silhouette Vector Icon (City, Fort, Farm, Town, etc.)
        drawSiteVectorIcon(sctx, sx, sy, site.type, iconSize, {
          isHovered,
          isSelected,
          isRomeOwned: isPlayerOwned,
          color: isDiscovered ? '#8b4b2c' : '#5c331e',
          stroke: isDiscovered ? '#3a1f12' : '#221108',
        });

        const showLabel = isHovered || isSelected || (c.zoom >= (site.minLabelZoom || 1.2)) || (site.weight >= 8);
        if (showLabel) {
          const fontSize = site.weight >= 9 ? 12 : site.weight >= 7 ? 11 : 9.5;
          sctx.font = `bold ${fontSize}px 'Cinzel', serif, Georgia`;
          sctx.textBaseline = 'middle';
          sctx.textAlign = 'left';

          const textX = sx + iconSize + 6;
          const textY = sy;

          sctx.strokeStyle = 'rgba(6, 10, 16, 0.95)';
          sctx.lineWidth = 3.2;
          const ownerIcon = isPlayerOwned ? '🦅 ' : (!isSelfSovereign ? '👑 ' : '');
          const labelText = ownerIcon + site.site;
          sctx.strokeText(labelText, textX, textY);

          // Use controller's display color for label
          const labelColor = isSelected
            ? '#ffd700'
            : (isPlayerOwned
                ? '#ffd700'
                : (isHovered ? '#ffffff' : (siteDisplayColor || (site.weight >= 9 ? '#ffe18f' : site.weight >= 7 ? '#f7e3bf' : '#ebd5b7'))));
          sctx.fillStyle = labelColor;
          sctx.fillText(labelText, textX, textY);
        }
      }

      sctx.restore();

      // 6. Minimap render
      const minimapCanvas = minimapCanvasRef.current;
      if (minimapCanvas) {
        const mw = minimapCanvas.width;
        const mh = minimapCanvas.height;
        const mctx = minimapCanvas.getContext('2d');
        mctx.clearRect(0, 0, mw, mh);

        mctx.fillStyle = '#0c1018';
        mctx.fillRect(0, 0, mw, mh);

        const base = getMinimapBase();
        if (base) mctx.drawImage(base, 0, 0, mw, mh);

        // Overlay live custom empire territory colors on minimap (uses ownership tree cascade)
        const minimapCqMap = conqueredRegionsRef.current;
        mctx.save();
        mctx.scale(mw / MAP_WIDTH, mh / MAP_HEIGHT);
        for (const reg of regionsData.regions) {
          if (!reg.pathD) continue;
          const hex = getProvinceDisplayColor(reg.id, minimapCqMap, regionsByIdRef.current);
          if (!hex) continue;
          const rp = getRegionPath(reg.pathD);
          if (rp) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            mctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
            mctx.fill(rp);
          }
        }
        mctx.restore();

        const exploredMask = exploredMaskRef.current;
        if (fogEnabledRef.current && exploredMask) {
          mctx.save();
          mctx.globalCompositeOperation = 'destination-in';
          mctx.drawImage(exploredMask, 0, 0, mw, mh);
          mctx.restore();
        }

        // Viewport rectangle
        const vpX = ((-c.x / c.zoom) / MAP_WIDTH) * mw;
        const vpY = ((-c.y / c.zoom) / MAP_HEIGHT) * mh;
        const vpW = ((vw / c.zoom) / MAP_WIDTH) * mw;
        const vpH = ((vh / c.zoom) / MAP_HEIGHT) * mh;

        mctx.strokeStyle = '#ffd700';
        mctx.lineWidth = 1.5;
        mctx.strokeRect(vpX, vpY, vpW, vpH);

        // Scout pin on minimap (white)
        for (const scout of currentScouts) {
          const mx = (scout.x / MAP_WIDTH) * mw;
          const my = (scout.y / MAP_HEIGHT) * mh;
          mctx.fillStyle = '#ffffff';
          mctx.beginPath();
          mctx.arc(mx, my, 3, 0, Math.PI * 2);
          mctx.fill();
        }

        // Player general pins on minimap (gold)
        for (const gen of generalsRef.current) {
          const mx = (gen.x / MAP_WIDTH) * mw;
          const my = (gen.y / MAP_HEIGHT) * mh;
          mctx.fillStyle = '#ffd700';
          mctx.strokeStyle = '#1a0d02';
          mctx.lineWidth = 1;
          mctx.beginPath();
          mctx.arc(mx, my, 4, 0, Math.PI * 2);
          mctx.fill();
          mctx.stroke();
        }

        // AI general pins on minimap (faction color)
        for (const aiGen of diplomacyStateRef.current?.aiGenerals || []) {
          const fConf = FACTION_CONFIG[aiGen.faction];
          if (!fConf) continue;
          const mx = (aiGen.x / MAP_WIDTH) * mw;
          const my = (aiGen.y / MAP_HEIGHT) * mh;
          mctx.fillStyle = fConf.color || '#888';
          mctx.strokeStyle = '#000';
          mctx.lineWidth = 0.8;
          mctx.beginPath();
          mctx.arc(mx, my, 3, 0, Math.PI * 2);
          mctx.fill();
          mctx.stroke();
        }
      }

      // Throttle HUD react state updates to ~10 Hz
      if (now - lastHudUpdate > 100) {
        setHudInfo({
          zoom: Math.round(c.zoom * 100),
          elevation: hoverRef.current.elevation,
          terrain: hoverRef.current.terrain,
          coord: hoverRef.current.coord,
          territory: hoverRef.current.territory,
          culture: hoverRef.current.culture,
        });

        const refScouts = scoutsRef.current;
        setScouts(prev => prev.map(s => {
          const ref = refScouts.find(r => r.id === s.id);
          if (!ref) return s;
          return {
            ...s,
            x: ref.x,
            y: ref.y,
            distanceTraveledKm: ref.distanceTraveledKm || 0,
            status: ref.status,
            path: ref.path,
          };
        }));

        // Sync general positions from animation ref to React state
        const refGenerals = generalsRef.current;
        setGenerals(prev => prev.map(g => {
          const ref = refGenerals.find(r => r.id === g.id);
          if (!ref) return g;
          return {
            ...g,
            x: ref.x,
            y: ref.y,
            distanceTraveledKm: ref.distanceTraveledKm || 0,
            status: ref.status,
            path: ref.path,
          };
        }));

        setTurnProgressSec(diplomacyStateRef.current?.gameTimeSec || 0);
        setPlayerTreasury(diplomacyStateRef.current?.treasuries?.rome || 7500);
        lastHudUpdate = now;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    // Mouse & Touch events
    const onMouseDown = (e) => {
      // Block map interaction if clicking inside any UI layer
      if (isInsideUiLayer(e.target)) {
        drag.current.wasDownOnMap = false;
        drag.current.isDragging = false;
        return;
      }

      // Right click: order selected unit (general or scout) to march
      if (e.button === 2) {
        const c = cam.current;
        const mapX = (e.clientX - c.x) / c.zoom;
        const mapY = (e.clientY - c.y) / c.zoom;

        // If a general is selected, check if right-clicking ON an AI general → Army Battle!
        if (selectedGeneralRef.current) {
          const currentGeneral = generalsRef.current.find(g => g.id === selectedGeneralRef.current);
          if (currentGeneral) {
            // First: Check if right-clicking directly ON an AI General banner → Player vs AI army battle!
            const aiGens = diplomacyStateRef.current?.aiGenerals || [];
            let clickedAiGen = null;
            for (const aiGen of aiGens) {
              const gx = c.x + aiGen.x * c.zoom;
              const gy = c.y + aiGen.y * c.zoom;
              const dx = Math.abs(e.clientX - gx);
              const dy = e.clientY - gy;
              if (dx <= 30 && dy >= -80 && dy <= 20) {
                clickedAiGen = aiGen;
                break;
              }
            }

            if (clickedAiGen) {
              // Simulate player attacking an AI general's army directly!
              const aiGenFConf = FACTION_CONFIG[clickedAiGen.faction] || FACTION_CONFIG.independent;
              RomanAudio.playWar();
              // Use computeBattle to simulate a field battle between armies
              const playerMen = (currentGeneral.units || []).reduce((s, u) => s + (u.men ?? 1000), 0);
              const aiMen = (clickedAiGen.units || []).reduce((s, u) => s + (u.men ?? 1000), 0);
              const playerWinChance = Math.min(90, Math.max(10, 50 + (playerMen - aiMen) / 100));
              const playerWins = Math.random() * 100 < playerWinChance;
              if (playerWins) {
                // Player wins — remove some of AI general's units, weaken them
                const lossCount = Math.max(1, Math.floor((clickedAiGen.units || []).length * 0.5));
                clickedAiGen.units = (clickedAiGen.units || []).slice(lossCount);
                addToast(`⚔️ FIELD BATTLE WON! ${currentGeneral.name} routed ${clickedAiGen.name} (${aiGenFConf.shortName})! Enemy army shattered!`, 'success');
              } else {
                // Player loses — deplete player general's units
                const playerLossCount = Math.max(1, Math.floor((currentGeneral.units || []).length * 0.4));
                const survivingUnits = (currentGeneral.units || []).slice(playerLossCount);
                setGenerals(prev => prev.map(g => g.id === currentGeneral.id ? { ...g, units: survivingUnits } : g));
                const gRef = generalsRef.current.find(g => g.id === currentGeneral.id);
                if (gRef) gRef.units = survivingUnits;
                addToast(`🛡️ FIELD BATTLE LOST! ${clickedAiGen.name} (${aiGenFConf.shortName}) repelled your assault! Roman cohorts scattered!`, 'error');
              }
              return;
            }

            // Check if right-clicking on a site marker
            const clickedSiteForBattle = SITES.find(site => {
              const sx = c.x + site.x * c.zoom;
              const sy = c.y + site.y * c.zoom;
              return Math.hypot(e.clientX - sx, e.clientY - sy) <= 30;
            });

            if (clickedSiteForBattle) {
              // Don't allow war declaration on territories already controlled in the player's tree
              const rootId = getRootController(clickedSiteForBattle.id, conqueredRegionsRef.current);
              if (rootId === playerHomeRegion.id) {
                addToast(`🏛️ ${clickedSiteForBattle.site} is already part of your realm — no war needed!`, 'info');
                return;
              }
              // Show "Go for War" prompt div
              setWarDeclarationPrompt({
                general: currentGeneral,
                site: clickedSiteForBattle,
                screenX: e.clientX,
                screenY: e.clientY,
              });
              RomanAudio.playClick();
              return;
            }

            // Otherwise: order the general's army to march to clicked position
            const path = calculatePath(currentGeneral.x, currentGeneral.y, mapX, mapY, pathfindingModeRef.current);
            const route = analyzeRoute(path, currentGeneral.baseSpeedKmPerMin);
            RomanAudio.playMarch();
            setGenerals(prev => prev.map(g => {
              if (g.id !== currentGeneral.id) return g;
              return { ...g, target: { x: mapX, y: mapY }, path, routeInfo: route, status: 'marching', battleTargetSite: null };
            }));
            const gRef = generalsRef.current.find(g => g.id === currentGeneral.id);
            if (gRef) {
              gRef.target = { x: mapX, y: mapY };
              gRef.path = path;
              gRef.routeInfo = route;
              gRef.status = 'marching';
              gRef.battleTargetSite = null;
            }
            addToast(`🦅 ${currentGeneral.name} — Legion ordered to march! ${route.distanceKm} km`, 'info');
            return;
          }
        }

        // Otherwise, order the selected scout
        handleOrderMarch(mapX, mapY);
        return;
      }

      if (e.button !== 0) return;
      drag.current = {
        isDragging: true,
        wasDownOnMap: true,
        lastX: e.clientX,
        lastY: e.clientY,
        downX: e.clientX,
        downY: e.clientY,
      };
      container.style.cursor = 'grabbing';
    };

    const onContextMenu = (e) => {
      e.preventDefault();
      if (!selectedGeneralRef.current) return;
      const activePlayerGen = generalsRef.current.find(g => g.id === selectedGeneralRef.current);
      if (!activePlayerGen) return;

      const c = cam.current;
      const mapX = (e.clientX - c.x) / c.zoom;
      const mapY = (e.clientY - c.y) / c.zoom;

      // Check if right-clicked on an AI General
      const curAiGens = diplomacyStateRef.current?.aiGenerals || [];
      for (const aiGen of curAiGens) {
        const gx = c.x + aiGen.x * c.zoom;
        const gy = c.y + aiGen.y * c.zoom;
        const dx = Math.abs(e.clientX - gx);
        const dy = e.clientY - gy;
        if (dx <= 28 && dy >= -76 && dy <= 14) {
          const path = calculatePath(activePlayerGen.x, activePlayerGen.y, aiGen.x, aiGen.y, pathfindingModeRef.current);
          const route = analyzeRoute(path, activePlayerGen.baseSpeedKmPerMin);
          RomanAudio.playMarch();
          activePlayerGen.target = { x: aiGen.x, y: aiGen.y };
          activePlayerGen.path = path;
          activePlayerGen.routeInfo = route;
          activePlayerGen.status = 'marching';
          delete activePlayerGen.battleTargetSite;
          setGenerals(prev => prev.map(g => g.id === activePlayerGen.id ? { ...activePlayerGen } : g));
          const fConf = FACTION_CONFIG[aiGen.faction] || FACTION_CONFIG.independent;
          addToast(`⚔️ FIELD MARCH: ${activePlayerGen.name} marching to engage ${aiGen.name} (${fConf.shortName}) in the field!`, 'warning');
          return;
        }
      }

      // Check if right-clicked on a settlement
      let targetSite = null;
      for (const site of SITES) {
        const dist = Math.hypot(mapX - site.x, mapY - site.y);
        if (dist <= 25) {
          targetSite = site;
          break;
        }
      }

      if (targetSite) {
        const isPlayerOwned = (getRootController(targetSite.id, conqueredRegionsRef.current) === playerHomeRegion.id);
        if (!isPlayerOwned) {
          setWarDeclarationPrompt({ general: activePlayerGen, site: targetSite });
          return;
        }
      }

      // Open field march
      const elev = getElevationAt(mapX, mapY);
      if (elev >= 0) {
        const path = calculatePath(activePlayerGen.x, activePlayerGen.y, mapX, mapY, pathfindingModeRef.current);
        const route = analyzeRoute(path, activePlayerGen.baseSpeedKmPerMin);
        RomanAudio.playMarch();
        activePlayerGen.target = { x: mapX, y: mapY };
        activePlayerGen.path = path;
        activePlayerGen.routeInfo = route;
        activePlayerGen.status = 'marching';
        delete activePlayerGen.battleTargetSite;
        setGenerals(prev => prev.map(g => g.id === activePlayerGen.id ? { ...activePlayerGen } : g));
        addToast(`🦅 ${activePlayerGen.name} marching to designated coordinates in the field!`, 'info');
      }
    };

    const onMouseMove = (e) => {
      // Don't hover territories or show site tooltips when pointer is over UI layers
      if (isInsideUiLayer(e.target)) {
        hoveredSiteRef.current = null;
        hoveredRegionRef.current = null;
        setTooltip(null);
        return;
      }

      const c = cam.current;
      const mapX = (e.clientX - c.x) / c.zoom;
      const mapY = (e.clientY - c.y) / c.zoom;

      const elev = getElevationAt(mapX, mapY);
      const terrInfo = getTerrainClassification(elev);

      // Find governing territory
      let nearestTerritory = null;
      if (elev >= 0) {
        const ctx = canvas.getContext('2d');
        for (const reg of regionsData.regions) {
          if (!reg.bbox || !reg.pathD) continue;
          const [minX, minY, maxX, maxY] = reg.bbox;
          if (mapX >= minX && mapX <= maxX && mapY >= minY && mapY <= maxY) {
            const p = getRegionPath(reg.pathD);
            if (p && ctx && ctx.isPointInPath(p, mapX, mapY)) {
              nearestTerritory = reg;
              break;
            }
          }
        }
        if (!nearestTerritory) {
          let bestDistSq = 35 * 35;
          for (const reg of regionsData.regions) {
            const dx = mapX - reg.center[0];
            const dy = mapY - reg.center[1];
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDistSq) {
              bestDistSq = distSq;
              nearestTerritory = reg;
            }
          }
        }
      }

      hoveredRegionRef.current = nearestTerritory;

      hoverRef.current = {
        elevation: elev,
        terrain: `${terrInfo.name} (${terrInfo.penalty})`,
        coord: `(${Math.round(mapX)}, ${Math.round(mapY)})`,
        territory: nearestTerritory ? `${nearestTerritory.site} (${nearestTerritory.sovereignName || nearestTerritory.type})` : null,
        culture: nearestTerritory ? `${nearestTerritory.region} [${nearestTerritory.macroRegion?.toUpperCase() || ''}]` : null,
      };

      // Check hover on General banner first (Roman generals then AI generals)
      let hoveredUnit = null;
      for (const gen of generalsRef.current) {
        const gx = c.x + gen.x * c.zoom;
        const gy = c.y + gen.y * c.zoom;
        const dx = Math.abs(e.clientX - gx);
        const dy = e.clientY - gy;
        // General banner width +-28px, height from top eagle (gy-76px) to base (gy+14px)
        if (dx <= 28 && dy >= -76 && dy <= 14) {
          hoveredUnit = { ...gen, isGeneral: true };
          break;
        }
      }

      if (!hoveredUnit && diplomacyStateRef.current?.aiGenerals) {
        for (const aiGen of diplomacyStateRef.current.aiGenerals) {
          const gx = c.x + aiGen.x * c.zoom;
          const gy = c.y + aiGen.y * c.zoom;
          const dx = Math.abs(e.clientX - gx);
          const dy = e.clientY - gy;
          if (dx <= 28 && dy >= -76 && dy <= 14) {
            hoveredUnit = { ...aiGen, isGeneral: true, isAi: true };
            break;
          }
        }
      }

      // Check hover on Scout marker
      if (!hoveredUnit) {
        for (const scout of scoutsRef.current) {
          const sx = c.x + scout.x * c.zoom;
          const sy = c.y + scout.y * c.zoom;
          const dx = Math.abs(e.clientX - sx);
          const dy = e.clientY - sy;
          // Scout pointer width +-22px, height from label/pinhead (sy-54px) to base (sy+14px)
          if (dx <= 22 && dy >= -54 && dy <= 14) {
            hoveredUnit = scout;
            break;
          }
        }
      }

      // Check hover on site markers
      let found = null;
      let bestDist = 22;
      for (const site of SITES) {
        const sx = c.x + site.x * c.zoom;
        const sy = c.y + site.y * c.zoom;
        const dist = Math.hypot(e.clientX - sx, e.clientY - sy);
        if (dist < bestDist) {
          bestDist = dist;
          found = site;
        }
      }

      hoveredSiteRef.current = found;
      setTooltip(
        hoveredUnit
          ? { isUnit: true, unit: hoveredUnit, screenX: e.clientX, screenY: e.clientY }
          : found
            ? { site: found, screenX: e.clientX, screenY: e.clientY }
            : null
      );

      if (!drag.current.isDragging) return;
      const dx = e.clientX - drag.current.lastX;
      const dy = e.clientY - drag.current.lastY;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      c.x += dx; c.y += dy;
    };

    const onMouseUp = (e) => {
      const wasDownOnMap = drag.current.wasDownOnMap;
      drag.current.wasDownOnMap = false;
      drag.current.isDragging = false;
      container.style.cursor = 'grab';

      // Block map clicks and prevent deselecting province if releasing inside UI layer or mousedown didn't start on map
      if (!wasDownOnMap || isInsideUiLayer(e.target)) {
        return;
      }

      const dist = Math.hypot(e.clientX - drag.current.downX, e.clientY - drag.current.downY);
      if (dist < 6) {
        const c = cam.current;
        const mapX = (e.clientX - c.x) / c.zoom;
        const mapY = (e.clientY - c.y) / c.zoom;

        // 1. Check if clicked directly on a General banner
        for (const gen of generalsRef.current) {
          const gx = c.x + gen.x * c.zoom;
          const gy = c.y + gen.y * c.zoom;
          const dx = Math.abs(e.clientX - gx);
          const dy = e.clientY - gy;
          // General banner width +-28px, height from top eagle (gy-76px) to base (gy+14px)
          if (dx <= 28 && dy >= -76 && dy <= 14) {
            setSelectedGeneralId(gen.id);
            selectedGeneralRef.current = gen.id;
            setSelectedScoutId(null);
            selectedScoutRef.current = null;
            setSelectedProvince(null);
            selectedProvinceRef.current = null;
            RomanAudio.playClick();
            return;
          }
        }

        // 1b. Check if clicked directly on an AI General banner
        const curAiGens = diplomacyStateRef.current?.aiGenerals || [];
        for (const aiGen of curAiGens) {
          const gx = c.x + aiGen.x * c.zoom;
          const gy = c.y + aiGen.y * c.zoom;
          const dx = Math.abs(e.clientX - gx);
          const dy = e.clientY - gy;
          if (dx <= 28 && dy >= -76 && dy <= 14) {
            if (selectedGeneralRef.current) {
              const activePlayerGen = generalsRef.current.find(g => g.id === selectedGeneralRef.current);
              if (activePlayerGen) {
                const path = calculatePath(activePlayerGen.x, activePlayerGen.y, aiGen.x, aiGen.y, pathfindingModeRef.current);
                const route = analyzeRoute(path, activePlayerGen.baseSpeedKmPerMin);
                RomanAudio.playMarch();
                activePlayerGen.target = { x: aiGen.x, y: aiGen.y };
                activePlayerGen.path = path;
                activePlayerGen.routeInfo = route;
                activePlayerGen.status = 'marching';
                delete activePlayerGen.battleTargetSite;
                setGenerals(prev => prev.map(g => g.id === activePlayerGen.id ? { ...activePlayerGen } : g));
                const fConf = FACTION_CONFIG[aiGen.faction] || FACTION_CONFIG.independent;
                addToast(`⚔️ MARCH ORDER: ${activePlayerGen.name} marching to engage ${aiGen.name} (${fConf.shortName}) in the field!`, 'warning');
                return;
              }
            }
          }
        }

        // 2. Check if clicked directly on a Scout token
        for (const scout of scoutsRef.current) {
          const sx = c.x + scout.x * c.zoom;
          const sy = c.y + scout.y * c.zoom;
          const dx = Math.abs(e.clientX - sx);
          const dy = e.clientY - sy;
          // Scout pointer width +-22px, height from label/pinhead (sy-54px) to base (sy+14px)
          if (dx <= 22 && dy >= -54 && dy <= 14) {
            setSelectedScoutId(scout.id);
            selectedScoutRef.current = scout.id;
            setSelectedGeneralId(null);
            selectedGeneralRef.current = null;
            setSelectedProvince(null);
            selectedProvinceRef.current = null;
            RomanAudio.playClick();
            return;
          }
        }

        // Direct click on a site marker
        let clickedSite = hoveredSiteRef.current;
        if (!clickedSite) {
          for (const site of SITES) {
            const sx = c.x + site.x * c.zoom;
            const sy = c.y + site.y * c.zoom;
            if (Math.hypot(e.clientX - sx, e.clientY - sy) <= 24) {
              clickedSite = site;
              break;
            }
          }
        }
        if (clickedSite) {
          const matchingReg = regionsData.regions.find(r => r.id === clickedSite.id || r.site === clickedSite.site);
          if (matchingReg) {
            setSelectedProvince(matchingReg);
            selectedProvinceRef.current = matchingReg;
            setSelectedGeneralId(null);
            selectedGeneralRef.current = null;
            RomanAudio.playClick();
            return;
          }
        }

        // Click on map canvas
        const elev = getElevationAt(mapX, mapY);
        if (elev >= 0) {
          const ctx = canvas.getContext('2d');
          let clicked = null;
          for (const reg of regionsData.regions) {
            if (!reg.bbox || !reg.pathD) continue;
            const [minX, minY, maxX, maxY] = reg.bbox;
            if (mapX >= minX && mapX <= maxX && mapY >= minY && mapY <= maxY) {
              const p = getRegionPath(reg.pathD);
              if (p && ctx && ctx.isPointInPath(p, mapX, mapY)) {
                clicked = reg;
                break;
              }
            }
          }
          if (!clicked) {
            let bestDistSq = 45 * 45;
            for (const reg of regionsData.regions) {
              const dx = mapX - reg.center[0];
              const dy = mapY - reg.center[1];
              const distSq = dx * dx + dy * dy;
              if (distSq < bestDistSq) {
                bestDistSq = distSq;
                clicked = reg;
              }
            }
          }
          if (clicked) {
            setSelectedProvince(clicked);
            selectedProvinceRef.current = clicked;
            setSelectedGeneralId(null);
            selectedGeneralRef.current = null;
            RomanAudio.playClick();
          }
        } else {
          setSelectedProvince(null);
          selectedProvinceRef.current = null;
          setSelectedGeneralId(null);
          selectedGeneralRef.current = null;
        }
      }
    };

    const onWheel = (e) => {
      if (isInsideUiLayer(e.target)) return;
      e.preventDefault();
      const c = cam.current;
      const factor = Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.0016);
      const newZoom = Math.max(c.minZoom, Math.min(c.maxZoom, c.zoom * factor));
      if (newZoom === c.zoom) return;
      const mx = e.clientX, my = e.clientY;
      const wx = (mx - c.x) / c.zoom, wy = (my - c.y) / c.zoom;
      c.zoom = newZoom;
      c.x = mx - wx * newZoom;
      c.y = my - wy * newZoom;
    };

    const onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w') keys.current.w = true;
      if (k === 'a') keys.current.a = true;
      if (k === 's') keys.current.s = true;
      if (k === 'd') keys.current.d = true;
      if (e.key === 'ArrowUp')    keys.current.ArrowUp    = true;
      if (e.key === 'ArrowDown')  keys.current.ArrowDown  = true;
      if (e.key === 'ArrowLeft')  keys.current.ArrowLeft  = true;
      if (e.key === 'ArrowRight') keys.current.ArrowRight = true;
      if (e.key === 'Escape') {
        setSelectedProvince(null);
        selectedProvinceRef.current = null;
      }
    };
    const onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w') keys.current.w = false;
      if (k === 'a') keys.current.a = false;
      if (k === 's') keys.current.s = false;
      if (k === 'd') keys.current.d = false;
      if (e.key === 'ArrowUp')    keys.current.ArrowUp    = false;
      if (e.key === 'ArrowDown')  keys.current.ArrowDown  = false;
      if (e.key === 'ArrowLeft')  keys.current.ArrowLeft  = false;
      if (e.key === 'ArrowRight') keys.current.ArrowRight = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', updateDimensions);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [addToast, getExploredMask, getMinimapBase, handleOrderMarch, stampScoutVisionToMask]);

  const handleReset = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const fitZoom = Math.min(vw / MAP_WIDTH, vh / MAP_HEIGHT) * 0.96;
    cam.current.zoom = fitZoom;
    cam.current.x = (vw - MAP_WIDTH * fitZoom) / 2;
    cam.current.y = (vh - MAP_HEIGHT * fitZoom) / 2;
  };

  const handleFocusPoint = (x, y) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const targetZoom = Math.max(cam.current.zoom, 2.5);
    cam.current.zoom = targetZoom;
    cam.current.x = vw / 2 - x * targetZoom;
    cam.current.y = vh / 2 - y * targetZoom;
  };

  const activeScout = scouts.find(s => s.id === selectedScoutId) || scouts[0];
  const selectedGeneral = generals.find(g => g.id === selectedGeneralId);

  // Location-based recruitment: troop types come from the province the army is standing in.
  const recruitCtx = (() => {
    if (!selectedGeneral) return null;
    let near = null, bd = Infinity;
    for (const r of regionsData.regions) {
      const d = Math.hypot(selectedGeneral.x - r.center[0], selectedGeneral.y - r.center[1]);
      if (d < bd) { bd = d; near = r; }
    }
    const owners = diplomacyStateRef.current?.provinceOwners;
    const owned = !!near && !!owners && getRootController(near.id, owners) === playerHomeRegion.id;
    return { near, owned, options: getRecruitOptions(near, owned) };
  })();

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#0c1622',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      {/* ── HUD Control Panel (Top-Left) ──────────────────────────────────── */}
      <div
        data-ui-layer="true"
        style={{
        position: 'absolute', top: 18, left: 18, zIndex: 100,
        background: 'rgba(16, 22, 30, 0.94)', border: '1px solid #7a5c30',
        borderRadius: 8, padding: '12px 16px', backdropFilter: 'blur(8px)',
        color: '#edd8b4', boxShadow: '0 8px 30px rgba(0,0,0,0.85)',
        fontFamily: "'Cinzel', serif, Georgia, sans-serif", fontSize: '12px',
        pointerEvents: 'auto', maxWidth: 310,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <div style={{ fontWeight: 900, fontSize: '14px', color: '#e8c988', letterSpacing: '1.2px' }}>
            CAMPAIGN MAP DEBUG
          </div>
          {onExitToMenu && (
            <button
              onClick={onExitToMenu}
              style={{
                padding: '3px 8px',
                background: '#1a140e',
                border: '1px solid #73512a',
                borderRadius: 4,
                color: '#d4ad82',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
              }}
            >
              ◀ MENU
            </button>
          )}
        </div>
        <div style={{ fontSize: '10px', color: '#a89474', marginBottom: 10 }}>
          Interactive Map • Scout Reconnaissance • Ancient Settlements
        </div>

        {/* Visual Map Mode */}
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: '10px', color: '#d6b882', fontWeight: 800,
            letterSpacing: '1px', marginBottom: 5, textTransform: 'uppercase'
          }}>
            Map Aesthetic
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'vintage', label: '📜 Paper' },
              { id: 'terrain', label: '🏔️ Elevation' }
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setVisualMode(m.id)}
                style={{
                  flex: 1, padding: '6px 8px', borderRadius: 4,
                  border: visualMode === m.id ? '1.5px solid #e8c988' : '1px solid #4a3820',
                  backgroundColor: visualMode === m.id ? '#3d2b19' : '#1a140e',
                  color: visualMode === m.id ? '#f3e1b9' : '#8f7d67',
                  fontSize: '10.5px', fontWeight: 800, cursor: 'pointer',
                  fontFamily: "'Cinzel', serif", textAlign: 'center',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pathfinding Mode Toggle: Terrain-Aware vs Direct */}
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: '10px', color: '#d6b882', fontWeight: 800,
            letterSpacing: '1px', marginBottom: 5, textTransform: 'uppercase'
          }}>
            Pathfinding Algorithm
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                setPathfindingMode('terrain');
                pathfindingModeRef.current = 'terrain';
                RomanAudio.playClick();
              }}
              style={{
                flex: 1, padding: '5px 7px', borderRadius: 4,
                border: pathfindingMode === 'terrain' ? '1.5px solid #27ae60' : '1px solid #3d2c18',
                backgroundColor: pathfindingMode === 'terrain' ? '#142c1b' : '#141c26',
                color: pathfindingMode === 'terrain' ? '#2ecc71' : '#887a6c',
                fontSize: '10px', fontWeight: 800, cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
              }}
              title="Avoids mountains & water"
            >
              🧠 Smart (Terrain)
            </button>
            <button
              onClick={() => {
                setPathfindingMode('direct');
                pathfindingModeRef.current = 'direct';
                RomanAudio.playClick();
              }}
              style={{
                flex: 1, padding: '5px 7px', borderRadius: 4,
                border: pathfindingMode === 'direct' ? '1.5px solid #e8c988' : '1px solid #3d2c18',
                backgroundColor: pathfindingMode === 'direct' ? '#3d2b19' : '#141c26',
                color: pathfindingMode === 'direct' ? '#f3e1b9' : '#887a6c',
                fontSize: '10px', fontWeight: 800, cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
              }}
              title="Direct geometrical line"
            >
              🧭 Direct Line
            </button>
          </div>
        </div>

        {/* Fog of War & Borders Toggles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
          <button
            onClick={() => {
              setFogEnabled(prev => {
                fogEnabledRef.current = !prev;
                return !prev;
              });
              RomanAudio.playClick();
            }}
            style={{
              padding: '6px 8px', borderRadius: 4,
              fontSize: '10px', fontWeight: 800,
              backgroundColor: fogEnabled ? '#2d1808' : '#121e14',
              color: fogEnabled ? '#ffd700' : '#48c9b0',
              border: `1px solid ${fogEnabled ? '#d4a34b' : '#16a085'}`,
              cursor: 'pointer', fontFamily: "'Cinzel', serif",
            }}
          >
            {fogEnabled ? '🌫️ FOG: ACTIVE' : '👁️ REVEAL ALL'}
          </button>

          <button
            onClick={() => setShowBorders(prev => !prev)}
            style={{
              padding: '6px 8px', borderRadius: 4,
              fontSize: '10px', fontWeight: 800,
              backgroundColor: showBorders ? '#ffffff' : '#221a14',
              color: showBorders ? '#000000' : '#887a6c',
              border: showBorders ? '1px solid #ffffff' : '1px solid #554433',
              cursor: 'pointer', fontFamily: "'Cinzel', serif",
            }}
          >
            {showBorders ? '✓ BORDERS ON' : 'BORDERS OFF'}
          </button>
        </div>

        {/* Controls Guide */}
        <div style={{ fontSize: '10.5px', color: '#c4ad8e', lineHeight: 1.5, marginBottom: 8, background: '#120f0c', padding: '6px 8px', borderRadius: 4, border: '1px solid #3d2b19' }}>
          <div><b style={{ color: '#ffd700' }}>Right-Click:</b> Move Scout</div>
          <div><b style={{ color: '#ffd700' }}>Left-Click:</b> Select Scout / Settlement</div>
          <div><b style={{ color: '#ffd700' }}>Drag / WASD:</b> Pan Map</div>
        </div>

        {/* Terrain Readout */}
        <div style={{
          fontSize: '11px', color: '#c9b79c', borderTop: '1px solid #4a3820',
          paddingTop: 8, marginBottom: 8, lineHeight: 1.6
        }}>
          <div>
            <b style={{ color: '#e8c988' }}>Terrain:</b>{' '}
            <span style={{ color: '#f3e1b9', fontWeight: 600 }}>
              {hudInfo.terrain || 'Hover over map'}
            </span>
            {hudInfo.elevation != null && (
              <span style={{ color: '#c8a870', marginLeft: 6 }}>
                ({hudInfo.elevation}m)
              </span>
            )}
          </div>
          {hudInfo.territory && (
            <div>
              <b style={{ color: '#e8c988' }}>Territory:</b>{' '}
              <span style={{ color: '#ffffff', fontWeight: 700 }}>
                {hudInfo.territory}
              </span>
            </div>
          )}
          {hudInfo.culture && (
            <div>
              <b style={{ color: '#e8c988' }}>Polity / Realm:</b>{' '}
              <span style={{ color: '#ddc898' }}>{hudInfo.culture}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10.5px', color: '#9e8c74' }}>Zoom: {hudInfo.zoom}%</span>
          <button
            onClick={handleReset}
            style={{
              padding: '3px 10px', backgroundColor: '#2e2014', color: '#d6b882',
              border: '1px solid #7a5c30', borderRadius: 4, fontSize: '10px',
              cursor: 'pointer', fontWeight: 700, fontFamily: "'Cinzel', serif",
            }}
          >
            Reset View
          </button>
        </div>
      </div>

      {/* ── Scouts Roster Panel (Bottom-Left) ─────────────────────────────── */}
      <div
        data-ui-layer="true"
        style={{
        position: 'absolute', bottom: 18, left: 18, zIndex: 100,
        background: 'rgba(14, 18, 26, 0.95)', border: '1.5px solid #d4a34b',
        borderRadius: 8, padding: '12px 14px', backdropFilter: 'blur(8px)',
        color: '#f3e1b9', boxShadow: '0 8px 30px rgba(0,0,0,0.85)',
        fontFamily: "'Cinzel', serif", fontSize: '11px',
        pointerEvents: 'auto', maxWidth: 360, width: '90vw',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: '11px', color: '#ffd700', letterSpacing: '0.5px' }}>
            🐎 SCOUT RECONNAISSANCE CORPS
          </div>
          <span style={{ fontSize: '9.5px', color: '#a08868' }}>{scouts.length} Active</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
          {scouts.map(scout => {
            const isSelected = scout.id === selectedScoutId;
            return (
              <div
                key={scout.id}
                onClick={() => {
                  setSelectedScoutId(scout.id);
                  selectedScoutRef.current = scout.id;
                  RomanAudio.playClick();
                }}
                style={{
                  padding: '7px 10px', borderRadius: 5,
                  backgroundColor: isSelected ? 'rgba(212, 163, 75, 0.22)' : 'rgba(20, 26, 36, 0.6)',
                  border: isSelected ? '1.5px solid #ffd700' : '1px solid #4a3820',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, color: isSelected ? '#ffd700' : '#ffffff' }}>
                    🐎 {scout.name}
                  </div>
                  <span style={{
                    fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: 3,
                    backgroundColor: scout.status === 'marching' ? 'rgba(46,204,113,0.2)' : 'rgba(212,163,75,0.2)',
                    color: scout.status === 'marching' ? '#2ecc71' : '#ffd700',
                  }}>
                    {scout.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '9.5px', color: '#c4ad8e' }}>
                  <span>Speed: 150 km/month</span>
                  <span>Traveled: {Math.round(scout.distanceTraveledKm || 0)} km</span>
                </div>

                {scout.routeInfo && (
                  <div style={{ marginTop: 3, fontSize: '9.5px', color: '#ffe18f', borderTop: '1px dashed #5a4220', paddingTop: 2 }}>
                    Route: {scout.routeInfo.distanceKm} km • ETA: {scout.routeInfo.turnsEta} turns
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleFocusPoint(scout.x, scout.y); }}
                    style={{
                      flex: 1, padding: '3px 6px', backgroundColor: '#221a12',
                      border: '1px solid #73512a', borderRadius: 3,
                      color: '#d4a34b', fontSize: '9.5px', cursor: 'pointer',
                      fontFamily: "'Cinzel', serif",
                    }}
                  >
                    🎯 Focus
                  </button>
                </div>

                {isSelected && (
                  <div style={{ marginTop: 4, fontSize: '8.5px', color: '#ffe18f', textAlign: 'center', fontStyle: 'italic' }}>
                    ⚡ Right-click map to order march
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {generals.length > 0 && (
          <div style={{ marginTop: 10, borderTop: '1px solid #4a3820', paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 800, fontSize: '11px', color: '#ffd700', letterSpacing: '0.5px' }}>
                🦅 ROMAN LEGIONS & GENERALS
              </div>
              <span style={{ fontSize: '9.5px', color: '#a08868' }}>{generals.length} Raised</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
              {generals.map(gen => {
                const isSelected = gen.id === selectedGeneralId;
                const unitCount = (gen.units || []).length;
                return (
                  <div
                    key={gen.id}
                    onClick={() => {
                      setSelectedGeneralId(gen.id);
                      selectedGeneralRef.current = gen.id;
                      setSelectedScoutId(null);
                      selectedScoutRef.current = null;
                      setSelectedProvince(null);
                      selectedProvinceRef.current = null;
                      RomanAudio.playClick();
                    }}
                    style={{
                      padding: '7px 10px', borderRadius: 5,
                      backgroundColor: isSelected ? 'rgba(184, 39, 29, 0.35)' : 'rgba(20, 26, 36, 0.6)',
                      border: isSelected ? '1.5px solid #ffd700' : '1px solid #732a18',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 800, color: isSelected ? '#ffd700' : '#ffffff' }}>
                        🦅 {gen.name}
                      </div>
                      <span style={{
                        fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: 3,
                        backgroundColor: gen.status === 'marching' ? 'rgba(46,204,113,0.2)' : 'rgba(212,163,75,0.2)',
                        color: gen.status === 'marching' ? '#2ecc71' : '#ffd700',
                      }}>
                        {gen.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '9.5px', color: '#c4ad8e' }}>
                      <span>Cohorts: {unitCount}/20 ({unitCount * 1000} men)</span>
                      <span>Pace: {gen.baseSpeedKmPerMin || 38} km/mo</span>
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFocusPoint(gen.x, gen.y); }}
                        style={{
                          flex: 1, padding: '3px 6px', backgroundColor: '#221a12',
                          border: '1px solid #73512a', borderRadius: 3,
                          color: '#d4a34b', fontSize: '9.5px', cursor: 'pointer',
                          fontFamily: "'Cinzel', serif",
                        }}
                      >
                        🎯 Focus Banner
                      </button>
                    </div>

                    {isSelected && (
                      <div style={{ marginTop: 4, fontSize: '8.5px', color: '#ffe18f', textAlign: 'center', fontStyle: 'italic' }}>
                        ⚡ Right-click map to order march
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Settlement / Province Dossier (Top-Right) ────────────────────── */}
      {selectedProvince && (
        <div
          data-ui-layer="true"
          style={{
          position: 'absolute', top: 18, right: 18, zIndex: 110,
          background: 'rgba(14, 20, 29, 0.96)', border: `2px solid ${selectedProvince.color || '#d4a34b'}`,
          borderRadius: 8, padding: '14px 18px', backdropFilter: 'blur(10px)',
          color: '#f3e1b9', boxShadow: '0 12px 35px rgba(0,0,0,0.9), 0 0 15px rgba(212,163,75,0.25)',
          fontFamily: "'Cinzel', serif, Georgia, sans-serif", fontSize: '12px',
          maxWidth: 320, width: '90vw', lineHeight: 1.6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <div style={{
                fontSize: '10px', color: selectedProvince.color || '#d4a34b',
                fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase'
              }}>
                SETTLEMENT • {selectedProvince.macroRegion?.toUpperCase() || 'PROVINCIA'}
              </div>
              <div style={{ fontSize: '17px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.8px' }}>
                {selectedProvince.site}
              </div>
            </div>
            <button
              onClick={() => { setSelectedProvince(null); selectedProvinceRef.current = null; }}
              style={{
                background: 'transparent', border: 'none', color: '#a08868',
                fontSize: '16px', cursor: 'pointer', padding: '0 4px', fontWeight: 700,
              }}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>

          <div style={{ fontSize: '11px', color: '#b8a080', marginBottom: 8 }}>
            {selectedProvince.modern}
          </div>

          {(() => {
            const cqMap = conqueredRegionsRef.current;
            const rootId = getRootController(selectedProvince.id, cqMap);
            const rootProv = regionsById[rootId] || selectedProvince;
            const isSelfSovereign = (rootId === selectedProvince.id);
            const isPlayerOwned = (rootId === playerHomeRegion.id);
            const provDisplayColor = getProvinceDisplayColor(selectedProvince.id, cqMap, regionsById);
            const wastaRes = computeEmpireWasta(playerHomeRegion.id, selectedProvince.id, cqMap, regionsData.regions);
            const wastaScore = wastaRes.wastaScore;
            const wastaInfo = wastaLabel(wastaScore, wastaRes.nearestProvinceName, wastaRes.hops, wastaRes.isOwnEmpire);
            const targetEmpireName = wastaRes.targetEmpireName;

            const w = selectedProvince.weight || 1;
            const g = settlementGarrisons.get(selectedProvince.id)
              ?? settlementGarrisonsRef.current.get(selectedProvince.id)
              ?? generateGarrison(w);
            const swordCount = (g.units || []).filter(u => u.type === 'sword_levis').length;
            const javelCount = (g.units || []).filter(u => u.type === 'javelins').length;
            const isEliminated = g.cohortCount === 0 || g.totalMen === 0;

            return (
              <>
                {/* Sovereign Status & Empire Allegiance */}
                <div style={{
                  padding: '7px 11px', borderRadius: 5, backgroundColor: '#201610',
                  border: `1.5px solid ${provDisplayColor}88`, fontSize: '11px', color: '#ffe18f',
                  marginBottom: 10, lineHeight: 1.5,
                }}>
                  {isSelfSovereign ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13 }}>🏛️</span>
                        <b style={{ color: provDisplayColor, fontSize: '11.5px' }}>{selectedProvince.sovereignName || selectedProvince.site}</b>
                      </div>
                      <div style={{ color: '#d4ad82', fontSize: '10px', marginTop: 2 }}>
                        <b>Allegiance:</b> <span style={{ color: '#58d68d' }}>Sovereign Independent Nation</span>
                      </div>
                      <div style={{ color: '#b8a080', fontSize: '9.5px', marginTop: 1 }}>
                        <b>Ruler:</b> {selectedProvince.ruler || 'Assembly of Magistrates'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13 }}>{isPlayerOwned ? '🦅' : '👑'}</span>
                        <b style={{ color: provDisplayColor, fontSize: '11.5px' }}>
                          {targetEmpireName}
                        </b>
                      </div>
                      <div style={{ color: '#d4ad82', fontSize: '10px', marginTop: 2 }}>
                        <b>Overlord:</b> {rootProv.ruler || rootProv.site} • <b>Subject Province:</b> {selectedProvince.site}
                      </div>
                    </>
                  )}
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px',
                  fontSize: '11px', color: '#c8b498', borderTop: '1px solid #4a3820',
                  paddingTop: 8, marginBottom: 10,
                }}>
                  <div><b style={{ color: '#d4a34b' }}>Classification:</b></div>
                  <div style={{ color: '#ffffff' }}>{selectedProvince.type}</div>

                  <div><b style={{ color: '#d4a34b' }}>Province Yield:</b></div>
                  <div style={{ color: '#ffd700' }}>+{(selectedProvince.weight || 4) * 100} / turn</div>
                </div>

                {/* ── WASTA METER (Diplomatic Geographic Influence) ── */}
                <div style={{
                  marginBottom: 10,
                  padding: '9px 11px',
                  background: 'linear-gradient(145deg, rgba(26,19,14,0.95) 0%, rgba(15,10,8,0.95) 100%)',
                  border: `1.5px solid ${wastaInfo.color}66`,
                  borderRadius: 6,
                  boxShadow: `0 0 14px ${wastaInfo.color}22`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#e8c37d', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                      📡 Diplomatic Wasta
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: 900, color: wastaInfo.color,
                      padding: '1px 6px', borderRadius: 3, background: `${wastaInfo.color}22`,
                      border: `1px solid ${wastaInfo.color}55`
                    }}>
                      {wastaScore}% • {wastaInfo.label.toUpperCase()}
                    </span>
                  </div>

                  {/* Nearest Province / Frontier context */}
                  <div style={{ fontSize: '9px', color: '#ffd700', marginBottom: 4 }}>
                    {wastaRes.isOwnEmpire
                      ? '✓ Domestic Province within your Realm'
                      : `Measured from closest province: ${wastaRes.nearestProvinceName} (${wastaRes.hops} border hop${wastaRes.hops === 1 ? '' : 's'})`}
                  </div>

                  {/* Visual Wasta Progress Bar */}
                  <div style={{
                    width: '100%', height: 7, background: 'rgba(0,0,0,0.7)',
                    borderRadius: 4, overflow: 'hidden', marginBottom: 6,
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div style={{
                      width: `${wastaScore}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${wastaInfo.color}77, ${wastaInfo.color})`,
                      borderRadius: 4,
                      boxShadow: `0 0 10px ${wastaInfo.color}`,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>

                  <div style={{ fontSize: '9.5px', color: '#c8b498', lineHeight: 1.4, marginBottom: 7 }}>
                    {wastaInfo.desc}
                  </div>

                  {/* Diplomatic Actions based on Wasta reach */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      disabled={wastaScore < 25}
                      onClick={() => {
                        if (wastaScore >= 25) {
                          RomanAudio.playCoin();
                          addToast(`📜 Diplomatic envoy sent to ${selectedProvince.site} (Wasta: ${wastaScore}%). Ties strengthened!`, 'info');
                        }
                      }}
                      style={{
                        flex: 1, padding: '5px 8px',
                        background: wastaScore >= 25 ? 'linear-gradient(135deg, #2e2316 0%, #1e160e 100%)' : '#14100c',
                        border: `1px solid ${wastaScore >= 25 ? '#b08a3c' : '#3d3022'}`,
                        borderRadius: 4,
                        color: wastaScore >= 25 ? '#ffd700' : '#5a4a3a',
                        fontSize: '9.5px', fontWeight: 800,
                        cursor: wastaScore >= 25 ? 'pointer' : 'not-allowed',
                        fontFamily: "'Cinzel', serif"
                      }}
                      title={wastaScore < 25 ? 'Province too far — Wasta too low' : 'Send diplomatic envoy'}
                    >
                      🕊️ Send Envoy
                    </button>

                    <button
                      disabled={wastaScore < 60}
                      onClick={() => {
                        if (wastaScore >= 60) {
                          RomanAudio.playCoin();
                          adjustPlayerGold(150);
                          addToast(`🏺 Trade caravan established with ${selectedProvince.site}! +150 Denarii bonus received.`, 'success');
                        }
                      }}
                      style={{
                        flex: 1, padding: '5px 8px',
                        background: wastaScore >= 60 ? 'linear-gradient(135deg, #1b3820 0%, #0f2214 100%)' : '#14100c',
                        border: `1px solid ${wastaScore >= 60 ? '#2ecc71' : '#3d3022'}`,
                        borderRadius: 4,
                        color: wastaScore >= 60 ? '#2ecc71' : '#5a4a3a',
                        fontSize: '9.5px', fontWeight: 800,
                        cursor: wastaScore >= 60 ? 'pointer' : 'not-allowed',
                        fontFamily: "'Cinzel', serif"
                      }}
                      title={wastaScore < 60 ? 'Requires near region reach (Wasta >= 60%)' : 'Open profitable trade route'}
                    >
                      🏺 Open Trade
                    </button>
                  </div>
                </div>

                {/* Garrison Status */}
                <div style={{ marginBottom: 10, borderTop: '1px solid #3d2b19', paddingTop: 8 }}>
                  <div style={{ fontSize: '10px', color: '#d4a34b', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                    🏛️ Garrison & Military Tree
                    {!isSelfSovereign && (
                      <span style={{ marginLeft: 8, color: isEliminated ? '#e74c3c' : provDisplayColor, fontSize: 9 }}>
                        {isPlayerOwned ? '🦅 UNITED IN REALM' : `👑 ${rootProv.site.toUpperCase()} CONTROLLED`}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {Array.from({ length: 20 }, (_, i) => (
                          <div key={i} style={{
                            width: 10, height: 10, borderRadius: 2,
                            background: i < g.cohortCount
                              ? (i < swordCount ? `rgba(${parseInt(provDisplayColor.slice(1,3),16)},${parseInt(provDisplayColor.slice(3,5),16)},${parseInt(provDisplayColor.slice(5,7),16)},0.85)` : 'rgba(60,120,220,0.9)')
                              : 'rgba(60,60,60,0.4)',
                            border: i < g.cohortCount ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(60,60,60,0.3)',
                          }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 9, color: isEliminated ? '#e74c3c' : '#a08868', marginTop: 3 }}>
                        {isEliminated
                          ? '0 / 20 Cohorts (0 Soldiers — Garrison wiped out in assault)'
                          : `${g.cohortCount} / 20 Cohorts (${g.totalMen.toLocaleString()} troops)`}
                      </div>
                    </div>
                  </div>
                  {!isEliminated && (
                    <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                      <div style={{ color: '#e88080' }}>⚔️ Sword Levis ×{swordCount}</div>
                      <div style={{ color: '#80a8e8' }}>🏹 Javelins ×{javelCount}</div>
                    </div>
                  )}
                  {selectedGeneralId && !isPlayerOwned && (
                    <div style={{ marginTop: 6, fontSize: 9, color: '#ffd700', fontStyle: 'italic' }}>
                      Right-click this settlement with your general selected to declare war!
                    </div>
                  )}
                  {isPlayerOwned && (
                    <div style={{ marginTop: 8, borderTop: '1px solid #4a3820', paddingTop: 8 }}>
                      <button
                        onClick={() => {
                          if (playerTreasury < 500) {
                            addToast('Treasury insufficient! Mobilizing a provincial legion requires 500 Denarii.', 'error');
                            return;
                          }
                          adjustPlayerGold(-500);
                          const newId = `general-${Date.now()}`;
                          const newGeneral = {
                            id: newId,
                            name: `Legio ${selectedProvince.site}`,
                            role: 'Legatus Legionis',
                            legionName: `${selectedProvince.site} Provincial Legion`,
                            provinceId: selectedProvince.id,
                            provinceName: selectedProvince.site,
                            x: selectedProvince.center[0] + (Math.random() - 0.5) * 6,
                            y: selectedProvince.center[1] + (Math.random() - 0.5) * 6,
                            target: null,
                            path: [],
                            routeInfo: null,
                            status: 'idle',
                            distanceTraveledKm: 0,
                            baseSpeedKmPerMin: 38,
                            maxUnits: 20,
                            units: [
                              { id: `${newId}-u1`, name: `${selectedProvince.site} Veteran Cohort`, typeId: 'sword_levis', type: 'sword_levis', unitClass: 'melee', men: 1000, attack: 35, defense: 33, morale: 80 },
                              { id: `${newId}-u2`, name: `${selectedProvince.site} Hastati`, typeId: 'sword_levis', type: 'sword_levis', unitClass: 'melee', men: 1000, attack: 33, defense: 30, morale: 75 },
                              ...composeLocalArmy(selectedProvince, `${newId}-loc`, 0.3).slice(0, 2),
                            ],
                          };
                          setGenerals(prev => [...prev, newGeneral]);
                          setSelectedGeneralId(newId);
                          selectedGeneralRef.current = newId;
                          RomanAudio.playMarch();
                          addToast(`🦅 Legio ${selectedProvince.site} mobilized with 4,000 men — Romans plus local levies (-500 Denarii)! Banner planted.`, 'success');
                        }}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          background: 'linear-gradient(135deg, #8a1d1d 0%, #da291c 100%)',
                          border: '1px solid #ffd700',
                          borderRadius: 5,
                          color: '#ffffff',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          fontFamily: "'Cinzel', serif",
                          boxShadow: '0 2px 10px rgba(218, 41, 28, 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <span>⚔️</span>
                        <span>Mobilize Legion at {selectedProvince.site} (-500 💰)</span>
                      </button>
                      <div style={{ marginTop: 5, fontSize: 9, color: '#58d68d', fontStyle: 'italic', textAlign: 'center' }}>
                        ✓ Province is united within your realm — ready to raise troops.
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}


          {selectedProvince.neighbors && selectedProvince.neighbors.length > 0 && (
            <div style={{ marginBottom: 12, borderTop: '1px solid #3d2b19', paddingTop: 6 }}>
              <div style={{ fontSize: '10px', color: '#d4a34b', fontWeight: 800, marginBottom: 4, textTransform: 'uppercase' }}>
                Adjacent Settlements ({selectedProvince.neighbors.length}):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 65, overflowY: 'auto' }}>
                {selectedProvince.neighbors.map(nid => {
                  const nProv = regionsData.regions.find(r => r.id === nid);
                  if (!nProv) return null;
                  return (
                    <button
                      key={nid}
                      onClick={() => {
                        setSelectedProvince(nProv);
                        selectedProvinceRef.current = nProv;
                        handleFocusPoint(nProv.center[0], nProv.center[1]);
                      }}
                      style={{
                        padding: '2px 6px', background: '#1c1510',
                        border: `1px solid ${nProv.color || '#553e20'}`,
                        borderRadius: 3, color: '#f3e1b9', fontSize: '9.5px',
                        cursor: 'pointer', fontFamily: "'Cinzel', serif",
                      }}
                    >
                      {nProv.site}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => handleFocusPoint(selectedProvince.center[0], selectedProvince.center[1])}
              style={{
                width: '100%', padding: '6px 10px', backgroundColor: '#221a12',
                color: '#d4a34b', border: '1px solid #73512a', borderRadius: 4,
                fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
              }}
            >
              🎯 Focus Settlement
            </button>
          </div>
        </div>
      )}

      {/* ── Army Legion Dossier (Top-Right, Just Like Settlement Dossier) ─── */}
      {selectedGeneral && (
        <div
          data-ui-layer="true"
          style={{
            position: 'absolute', top: 18, right: 18, zIndex: 110,
            background: 'rgba(14, 20, 29, 0.96)', border: '2px solid #ffd700',
            borderRadius: 8, padding: '14px 18px', backdropFilter: 'blur(10px)',
            color: '#f3e1b9', boxShadow: '0 12px 35px rgba(0,0,0,0.9), 0 0 18px rgba(255,215,0,0.3)',
            fontFamily: "'Cinzel', serif, Georgia, sans-serif", fontSize: '12px',
            maxWidth: 320, width: '90vw', lineHeight: 1.6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <div style={{
                fontSize: '10px', color: '#ffd700',
                fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase'
              }}>
                ROMAN LEGION • {selectedGeneral.role || 'LEGATUS LEGIONIS'}
              </div>
              <div style={{ fontSize: '17px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.8px' }}>
                🦅 {selectedGeneral.name}
              </div>
            </div>
            <button
              onClick={() => { setSelectedGeneralId(null); selectedGeneralRef.current = null; }}
              style={{
                background: 'transparent', border: 'none', color: '#a08868',
                fontSize: '16px', cursor: 'pointer', padding: '0 4px', fontWeight: 700,
              }}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>

          <div style={{
            padding: '6px 10px', borderRadius: 4, backgroundColor: '#221a12',
            border: '1px solid #ffd70066', fontSize: '11px', color: '#ffe18f',
            marginBottom: 10, lineHeight: 1.5,
          }}>
            <div><b>Status:</b> {selectedGeneral.status === 'marching' ? '🏃 Marching across province' : '🛡️ Fortified / Ready'}</div>
            <div style={{ color: '#d4ad82', fontSize: '10.5px' }}>
              <b>Origin:</b> {selectedGeneral.provinceName || 'Roma'}
            </div>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px',
            fontSize: '11px', color: '#c8b498', borderTop: '1px solid #4a3820',
            paddingTop: 8, marginBottom: 10,
          }}>
            <div><b style={{ color: '#d4a34b' }}>Total Strength:</b></div>
            <div style={{ color: '#58d68d', fontWeight: 800 }}>
              {(selectedGeneral.units || []).reduce((sum, u) => sum + Math.max(0, u.men ?? u.count ?? 1000), 0).toLocaleString()} Soldiers
            </div>

            <div><b style={{ color: '#d4a34b' }}>Active Cohorts:</b></div>
            <div style={{ color: '#ffffff' }}>{(selectedGeneral.units || []).length} / {selectedGeneral.maxUnits || 20}</div>

            <div><b style={{ color: '#d4a34b' }}>March Pace:</b></div>
            <div style={{ color: '#ffffff' }}>{selectedGeneral.baseSpeedKmPerMin || 38} km/month</div>

            <div><b style={{ color: '#d4a34b' }}>Distance:</b></div>
            <div style={{ color: '#ffffff' }}>{Math.round(selectedGeneral.distanceTraveledKm || 0)} km</div>
          </div>

          {selectedGeneral.routeInfo && (
            <div style={{ marginBottom: 10, padding: '5px 8px', background: '#1c1510', border: '1px solid #73512a', borderRadius: 4, fontSize: '10.5px', color: '#ffe18f' }}>
              📍 <b>Route ETA:</b> {selectedGeneral.routeInfo.turnsEta} turns ({selectedGeneral.routeInfo.distanceKm} km)
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => handleFocusPoint(selectedGeneral.x, selectedGeneral.y)}
              style={{
                width: '100%', padding: '6px 10px', backgroundColor: '#221a12',
                color: '#d4a34b', border: '1px solid #73512a', borderRadius: 4,
                fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
              }}
            >
              🎯 Focus Legion Banner
            </button>
          </div>
        </div>
      )}

      {/* ── Classic Rome: Total War Settlement Options Bar (When General is not Selected) ─── */}
      {!selectedGeneral && (
        <RomanSettlementBar
          province={selectedProvince}
          onAction={(btn) => {
            RomanAudio.playClick();
            addToast(btn.toastMsg || `🏛️ ${btn.label} [Preset Action]`, 'success');
          }}
          onHireScout={handleHireScout}
          onRaiseGeneral={handleRaiseGeneral}
        />
      )}

      {/* ── Rome: Total War Army Division Unit Bar (When General Banner is Clicked) ─────── */}
      {selectedGeneral && (
        <RomanArmyBar
          general={selectedGeneral}
          recruitOptions={recruitCtx?.options}
          locationName={recruitCtx?.near?.site}
          locationOwned={recruitCtx?.owned}
          treasury={playerTreasury}
          onRecruitUnit={handleRecruitUnit}
          onDisbandUnit={handleDisbandUnit}
          onClose={() => {
            setSelectedGeneralId(null);
            selectedGeneralRef.current = null;
          }}
        />
      )}

      {/* ── Toast Notifications ────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 220, right: 18, zIndex: 120,
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              background: 'rgba(18, 24, 34, 0.96)',
              border: '1.5px solid #ffd700',
              borderLeft: `5px solid ${t.type === 'error' ? '#e74c3c' : t.type === 'warning' ? '#f39c12' : t.type === 'success' ? '#2ecc71' : '#5dade2'}`,
              maxWidth: 380,
              animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              borderRadius: 6,
              padding: '10px 14px',
              color: '#ffe18f',
              fontFamily: "'Cinzel', serif",
              fontSize: '11px',
              fontWeight: 800,
              boxShadow: '0 8px 25px rgba(0,0,0,0.85)',
              letterSpacing: '0.5px',
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── Layer 1: Vector Map (Inline SVG) ───────────────────────────────── */}
      <div
        ref={svgContainerRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100vw', height: '100vh', pointerEvents: 'none',
        }}
      />

      {/* ── Layer 2: Boundaries & Region Hover Lightening Canvas ─────────────── */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          pointerEvents: 'none', zIndex: 10,
        }}
      />

      {/* ── Layer 3: Fog of War Canvas ───────────────────────────────────────── */}
      <canvas
        ref={fogCanvasRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          pointerEvents: 'none', zIndex: 15,
        }}
      />

      {/* ── Layer 4: Scouts & March Paths Canvas ─────────────────────────────── */}
      <canvas
        ref={unitsCanvasRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          pointerEvents: 'none', zIndex: 20,
        }}
      />

      {/* ── Layer 5: Ancient Sites Markers & Names Canvas ────────────────────── */}
      <canvas
        ref={sitesCanvasRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          pointerEvents: 'none', zIndex: 25,
        }}
      />

      {/* ── Imperial Treasury & Strategic Overview Header (Top-Center) ────────── */}
      <div
        data-ui-layer="true"
        style={{
          position: 'absolute',
          top: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'rgba(16, 12, 8, 0.94)',
          border: '1.5px solid #b08a3c',
          borderRadius: 8,
          padding: '6px 18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.9), 0 0 15px rgba(212,172,13,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontFamily: "'Cinzel', serif",
          fontSize: 12,
          color: '#f5e6cc',
          userSelect: 'none',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 18 }}>💰</span>
          <div>
            <div style={{ fontSize: 8.5, color: '#d4ac0d', fontWeight: 800, letterSpacing: 0.8 }}>SPQR TREASURY</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#ffd700' }}>
              {playerTreasury.toLocaleString()} <span style={{ fontSize: 9.5, color: '#d4ac0d' }}>Denarii</span>
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 26, background: '#5a3e1b' }} />

        <div style={{ fontSize: 9.5, lineHeight: 1.3 }}>
          <div>Income: <b style={{ color: '#58d68d' }}>+{playerIncome.toLocaleString()}</b> / turn</div>
          <div>Upkeep: <b style={{ color: '#e74c3c' }}>-{playerUpkeep.toLocaleString()}</b> / turn</div>
        </div>

        <div style={{ width: 1, height: 26, background: '#5a3e1b' }} />

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 8.5, color: '#c8a868', fontWeight: 800 }}>NET / MINUTE</div>
          <div style={{ fontSize: 12.5, fontWeight: 900, color: playerNet >= 0 ? '#58d68d' : '#e74c3c' }}>
            {playerNet >= 0 ? `+${playerNet.toLocaleString()}` : playerNet.toLocaleString()}
          </div>
        </div>

        <div style={{ width: 1, height: 26, background: '#5a3e1b' }} />

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8.5, color: '#c8a868', fontWeight: 800 }}>STRATEGIC CYCLE</div>
          <div style={{ fontSize: 11, fontWeight: 900, color: isPaused ? '#e74c3c' : '#ffd700' }}>
            {isPaused ? '⏸ PAUSED' : `Month ${((turnNumber - 1) % 12) + 1} (${60 - Math.floor(turnProgressSec % 60)}s)`}
          </div>
        </div>
      </div>

      {/* ── Minimap (Bottom-Right, Positioned above Controls) ────────────────── */}
      <canvas
        ref={minimapCanvasRef}
        width={236}
        height={175}
        onMouseDown={(e) => { minimapDraggingRef.current = true; handleMinimapPan(e.clientX, e.clientY); }}
        onMouseMove={(e) => { if (minimapDraggingRef.current) handleMinimapPan(e.clientX, e.clientY); }}
        onMouseUp={() => { minimapDraggingRef.current = false; }}
        onMouseLeave={() => { minimapDraggingRef.current = false; }}
        onClick={(e) => handleMinimapPan(e.clientX, e.clientY)}
        style={{
          position: 'absolute',
          bottom: 74,
          right: 18,
          width: 236,
          height: 175,
          zIndex: 110,
          borderRadius: 6,
          boxShadow: '0 8px 28px rgba(0,0,0,0.85), 0 0 0 1.5px #8e6c38',
          cursor: 'crosshair',
          imageRendering: 'pixelated',
        }}
      />

      {/* ── Time & Pause / Play Controls (Directly Below Minimap) ─────────────── */}
      <div
        data-ui-layer="true"
        style={{
          position: 'absolute',
          bottom: 12,
          right: 18,
          width: 236,
          zIndex: 110,
          background: 'linear-gradient(180deg, #1c140c 0%, #0d0905 100%)',
          border: '1.5px solid #8e6c38',
          borderRadius: 6,
          padding: '6px 10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.9)',
          fontFamily: "'Cinzel', serif",
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 9.5, color: '#f3e1b9', fontWeight: 800 }}>
            🗓️ Year {218 - Math.floor(turnNumber / 12)} BC • M{((turnNumber - 1) % 12) + 1}
          </div>
          <div style={{ fontSize: 8.5, color: isPaused ? '#e74c3c' : '#2ecc71', fontWeight: 800 }}>
            {isPaused ? '⏸ PAUSED' : `${60 - Math.floor(turnProgressSec % 60)}s to turn`}
          </div>
        </div>

        {/* Turn Progress Bar */}
        <div style={{ height: 4, background: '#0a0704', borderRadius: 2, overflow: 'hidden', marginBottom: 5, border: '1px solid #332211' }}>
          <div style={{
            height: '100%',
            width: `${((turnProgressSec % 60) / 60) * 100}%`,
            background: isPaused ? '#888' : 'linear-gradient(90deg, #d4ac0d, #f1c40f)',
            transition: 'width 0.1s linear',
          }} />
        </div>

        {/* Speed & Pause Buttons */}
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            onClick={() => handleSetSpeed('pause')}
            style={{
              flex: 1, padding: '4px 0',
              background: isPaused ? 'linear-gradient(180deg, #8b1a1a 0%, #5a0e0e 100%)' : '#140e09',
              border: isPaused ? '1px solid #ff4444' : '1px solid #5a3e1b',
              borderRadius: 3, color: isPaused ? '#fff' : '#b08a3c',
              fontSize: 9.5, fontWeight: 900, cursor: 'pointer', fontFamily: "'Cinzel', serif",
            }}
          >
            ⏸ PAUSE
          </button>
          <button
            onClick={() => handleSetSpeed('1x')}
            style={{
              flex: 1, padding: '4px 0',
              background: (!isPaused && gameSpeed === '1x') ? 'linear-gradient(180deg, #1e6b2c 0%, #0e3b16 100%)' : '#140e09',
              border: (!isPaused && gameSpeed === '1x') ? '1px solid #2ecc71' : '1px solid #5a3e1b',
              borderRadius: 3, color: (!isPaused && gameSpeed === '1x') ? '#fff' : '#b08a3c',
              fontSize: 9.5, fontWeight: 900, cursor: 'pointer', fontFamily: "'Cinzel', serif",
            }}
          >
            ▶ PLAY
          </button>
          <button
            onClick={() => handleSetSpeed('2x')}
            style={{
              flex: 1, padding: '4px 0',
              background: (!isPaused && gameSpeed === '2x') ? 'linear-gradient(180deg, #b8860b 0%, #6b4e05 100%)' : '#140e09',
              border: (!isPaused && gameSpeed === '2x') ? '1px solid #ffd700' : '1px solid #5a3e1b',
              borderRadius: 3, color: (!isPaused && gameSpeed === '2x') ? '#fff' : '#b08a3c',
              fontSize: 9.5, fontWeight: 900, cursor: 'pointer', fontFamily: "'Cinzel', serif",
            }}
          >
            ⏩ 2X
          </button>
        </div>
      </div>

      {/* ── Rich Tooltip ────────────────────────────────────────────────────── */}
      {tooltip && (() => {
        if (tooltip.isUnit) {
          const { unit, screenX, screenY } = tooltip;
          if (unit.isGeneral) {
            const unitCount = (unit.units || []).length;
            const fKey = unit.faction || 'rome';
            const fConf = FACTION_CONFIG[fKey] || FACTION_CONFIG.rome;
            const isAi = fKey !== 'rome';

            // Calculate opinion with Rome if AI
            let opinionText = null;
            if (isAi && diplomacyStateRef.current?.relations) {
              const relData = diplomacyStateRef.current.relations[fKey]?.rome;
              if (relData && (relData.areNeighbors || relData.atWar)) {
                const opScore = calculateOpinionScore(fKey, 'rome', relData, diplomacyStateRef.current.gameTimeSec, diplomacyStateRef.current.relations);
                const isWithin3M = (diplomacyStateRef.current.gameTimeSec - (relData.firstContactTime || 0)) < 180;
                opinionText = {
                  score: opScore,
                  status: relData.atWar ? 'AT WAR' : (opScore <= -40 ? 'HOSTILE' : opScore >= 30 ? 'FRIENDLY' : 'NEUTRAL'),
                  aversionActive: isWithin3M,
                };
              }
            }

            return (
              <div style={{
                position: 'absolute',
                left: screenX + 16,
                top: screenY - 10,
                zIndex: 200,
                background: 'rgba(14,19,28,0.97)',
                border: `1.5px solid ${fConf.strokeColor || '#ffd700'}`,
                borderRadius: 7,
                padding: '10px 14px',
                fontFamily: "'Cinzel',serif,Georgia",
                color: '#f0ddb8',
                fontSize: '11px',
                pointerEvents: 'none',
                boxShadow: '0 6px 28px rgba(0,0,0,0.85)',
                maxWidth: 295,
                lineHeight: 1.6,
              }}>
                <div style={{ fontWeight: 900, fontSize: '13.5px', color: fConf.strokeColor || '#ffd700', marginBottom: 2 }}>
                  {fConf.bannerIcon || '🦅'} {unit.name}
                </div>
                <div style={{ color: isAi ? '#f39c12' : '#e74c3c', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', marginBottom: 4 }}>
                  {fConf.shortName} • {unit.status.toUpperCase()}
                </div>
                <div><b>Faction Trait:</b> <span style={{ color: '#ffd700' }}>{fConf.trait}</span></div>
                <div><b>Forces:</b> {unitCount} Cohorts ({unitCount * 1000} Warriors)</div>
                <div><b>Pace:</b> {unit.baseSpeedKmPerMin || 36} km/month</div>
                {opinionText && (
                  <div style={{ marginTop: 4, borderTop: '1px solid #4a3820', paddingTop: 3, fontSize: '10px' }}>
                    <b>Relation to Rome:</b> <span style={{ color: opinionText.status === 'AT WAR' || opinionText.score <= -40 ? '#e74c3c' : '#2ecc71' }}>
                      {opinionText.score} ({opinionText.status})
                    </span>
                    {opinionText.aversionActive && (
                      <div style={{ color: '#e67e22', fontSize: '9px' }}>⚠️ -15 Recent Contact Aversion active (month 1-3)</div>
                    )}
                  </div>
                )}
                {!isAi && (
                  <div style={{ color: '#ffd700', marginTop: 4, borderTop: '1px solid #4a3820', paddingTop: 3, fontSize: '9.5px', fontStyle: 'italic' }}>
                    Left-click to select & raise units • Right-click to march
                  </div>
                )}
              </div>
            );
          }

          return (
            <div style={{
              position: 'absolute',
              left: screenX + 16,
              top: screenY - 10,
              zIndex: 200,
              background: 'rgba(14,19,28,0.97)',
              border: '1.5px solid #ffd700',
              borderRadius: 7,
              padding: '10px 14px',
              fontFamily: "'Cinzel',serif,Georgia",
              color: '#f0ddb8',
              fontSize: '11px',
              pointerEvents: 'none',
              boxShadow: '0 6px 28px rgba(0,0,0,0.85)',
              maxWidth: 260,
              lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 900, fontSize: '13px', color: '#ffd700', marginBottom: 2 }}>
                🐎 {unit.name}
              </div>
              <div style={{ color: '#2ecc71', fontWeight: 800, fontSize: '10.5px', marginBottom: 4 }}>
                Status: {unit.status.toUpperCase()}
              </div>
              <div><b>Speed:</b> 150 km/month</div>
              <div><b>Vision Sphere:</b> {unit.visionRadiusKm} km</div>
              <div><b>Traveled:</b> {Math.round(unit.distanceTraveledKm || 0)} km</div>
              {unit.routeInfo && (
                <div style={{ color: '#ffe18f', marginTop: 4, borderTop: '1px solid #4a3820', paddingTop: 3 }}>
                  ETA: {unit.routeInfo.turnsEta} turns ({unit.routeInfo.distanceKm} km)
                </div>
              )}
            </div>
          );
        }

        const { site, screenX, screenY } = tooltip;
        const style = TYPE_STYLE[site.type] || { color: '#bbb', stroke: '#444' };
        const cqMap = conqueredRegionsRef.current;
        const rootId = getRootController(site.id, cqMap);
        const rootReg = regionsByIdRef.current[rootId] || site;
        const siteReg = regionsByIdRef.current[site.id] || site;
        const isSelfSovereign = (rootId === site.id);
        const isPlayerOwned = (rootId === playerHomeRegion.id);
        const siteDisplayColor = getProvinceDisplayColor(site.id, cqMap, regionsByIdRef.current);
        const wastaRes = computeEmpireWasta(playerHomeRegion.id, site.id, cqMap, regionsData.regions);
        const wastaScore = wastaRes.wastaScore;
        const wastaInfo = wastaLabel(wastaScore, wastaRes.nearestProvinceName, wastaRes.hops, wastaRes.isOwnEmpire);
        const targetEmpireName = wastaRes.targetEmpireName;

        return (
          <div style={{
            position: 'absolute',
            left: screenX + 16,
            top: screenY - 10,
            zIndex: 200,
            background: 'rgba(14,19,28,0.97)',
            border: `1.5px solid ${isPlayerOwned ? '#ffd700' : (siteDisplayColor || style.color)}`,
            borderRadius: 7,
            padding: '10px 14px',
            fontFamily: "'Cinzel',serif,Georgia",
            color: '#f0ddb8',
            fontSize: '11px',
            pointerEvents: 'none',
            boxShadow: `0 6px 28px rgba(0,0,0,0.85), 0 0 0 1px ${style.stroke}55`,
            maxWidth: 295,
            lineHeight: 1.65,
          }}>
            <div style={{ fontWeight: 900, fontSize: '13.5px', color: isPlayerOwned ? '#ffd700' : (siteDisplayColor || style.color), marginBottom: 2 }}>
              {isPlayerOwned ? '🦅 ' : (!isSelfSovereign ? '👑 ' : '')}{site.site}
            </div>
            <div style={{ fontSize: '10px', color: '#a08868', marginBottom: 4 }}>
              {site.modern}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: siteDisplayColor || '#ddc898', textTransform: 'uppercase' }}>
                {targetEmpireName}
              </span>
            </div>
            <div><b>Classification:</b> {site.type} (Weight: {site.weight || 4}/10)</div>
            <div><b>Province Yield:</b> <span style={{ color: '#ffd700' }}>+{(site.weight || 4) * 100} Denarii/turn</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <b>Wasta:</b>
              <span style={{ color: wastaInfo.color, fontWeight: 800, fontSize: '10px' }}>
                {wastaScore}% ({wastaInfo.label} via {wastaRes.nearestProvinceName})
              </span>
            </div>
            <div style={{ color: '#ffd700', marginTop: 4, borderTop: '1px solid #4a3820', paddingTop: 3, fontSize: '9.5px', fontStyle: 'italic' }}>
              Left-click to inspect • Right-click with army to declare war & march
            </div>
          </div>
        );
      })()}

      {/* War Declaration Prompt Div */}
      {warDeclarationPrompt && (() => {
        const cqMap = conqueredRegionsRef.current;
        const promptWastaRes = computeEmpireWasta(playerHomeRegion.id, warDeclarationPrompt.site.id, cqMap, regionsData.regions);
        const promptWasta = promptWastaRes.wastaScore;
        const promptWastaInfo = wastaLabel(promptWasta, promptWastaRes.nearestProvinceName, promptWastaRes.hops, promptWastaRes.isOwnEmpire);
        const targetEmpireName = promptWastaRes.targetEmpireName;

        return (
          <div
            data-ui-layer="true"
            style={{
              position: 'fixed',
              left: Math.min(window.innerWidth - 300, Math.max(20, warDeclarationPrompt.screenX - 140)),
              top: Math.min(window.innerHeight - 240, Math.max(20, warDeclarationPrompt.screenY - 110)),
              zIndex: 600,
              background: 'linear-gradient(160deg, #20130b 0%, #0d0805 100%)',
              border: '2px solid #b08a3c',
              borderRadius: 8,
              padding: '14px 18px',
              width: 295,
              boxShadow: '0 0 35px rgba(255, 60, 0, 0.4), 0 10px 40px rgba(0,0,0,0.95)',
              fontFamily: "'Cinzel', serif",
              userSelect: 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, borderBottom: '1px solid #5a4020', paddingBottom: 6 }}>
              <div style={{ fontSize: 11, color: '#e74c3c', fontWeight: 900, letterSpacing: 2 }}>
                ⚔️ WAR DECLARATION
              </div>
              <button
                onClick={() => setWarDeclarationPrompt(null)}
                style={{
                  background: 'transparent', border: 'none', color: '#a08060',
                  cursor: 'pointer', fontSize: 14, fontWeight: 700
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 2 }}>
              {warDeclarationPrompt.site.site}
            </div>
            <div style={{ fontSize: 10.5, color: '#c8b498', marginBottom: 8, lineHeight: 1.4 }}>
              <div><b>Allegiance:</b> <span style={{ color: '#ffd700' }}>{targetEmpireName}</span></div>
              <div><b>Classification:</b> {warDeclarationPrompt.site.type}</div>
              <div style={{ color: '#e8c37d', marginTop: 2 }}>
                <b>{warDeclarationPrompt.general.name}</b> will march to assault this settlement.
              </div>
            </div>

            {/* Wasta Meter in War Declaration */}
            <div style={{
              background: 'rgba(0,0,0,0.6)', border: `1px solid ${promptWastaInfo.color}55`,
              borderRadius: 5, padding: '7px 9px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', marginBottom: 4 }}>
                <span style={{ color: '#d4ad82', fontWeight: 800 }}>DIPLOMATIC WASTA:</span>
                <span style={{ color: promptWastaInfo.color, fontWeight: 900 }}>{promptWasta}% • {promptWastaInfo.label.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: '9px', color: '#ffd700', marginBottom: 4 }}>
                Measured from closest province: <b>{promptWastaRes.nearestProvinceName}</b> ({promptWastaRes.hops} border hop{promptWastaRes.hops === 1 ? '' : 's'})
              </div>
              <div style={{ width: '100%', height: 5, background: '#221610', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ width: `${promptWasta}%`, height: '100%', background: promptWastaInfo.color, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: '9px', color: '#a89880', fontStyle: 'italic' }}>
                {promptWasta >= 100
                  ? `✓ Direct neighbour to ${promptWastaRes.nearestProvinceName}: immediate frontier assault feasible.`
                  : promptWasta >= 60
                  ? `Near frontier (${promptWastaRes.hops} hops from ${promptWastaRes.nearestProvinceName}): supply train will take standard route.`
                  : `⚠️ Distant frontier (${promptWastaRes.hops} hops from ${promptWastaRes.nearestProvinceName}): expedition through foreign borders required.`}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setWarDeclarationPrompt(null)}
                style={{
                  padding: '6px 12px', background: 'rgba(50,40,30,0.8)',
                  border: '1px solid #5a4020', borderRadius: 4, color: '#a08060',
                  fontSize: 10.5, cursor: 'pointer', fontFamily: "'Cinzel', serif"
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleGoForWar(warDeclarationPrompt.general, warDeclarationPrompt.site)}
                style={{
                  padding: '7px 18px',
                  background: 'linear-gradient(135deg, #a61c1c 0%, #e74c3c 100%)',
                  border: '1px solid #ffd700', borderRadius: 5, color: '#fff',
                  fontWeight: 900, fontSize: 11.5, cursor: 'pointer',
                  letterSpacing: 1, fontFamily: "'Cinzel', serif",
                  boxShadow: '0 2px 10px rgba(231,76,60,0.5)'
                }}
              >
                ⚔️ GO FOR WAR
              </button>
            </div>
          </div>
        );
      })()}

      {/* Battle Modal */}
      {battleModal && (
        <BattleModal
          attacker={battleModal.attacker}
          defSite={battleModal.defSite}
          defWeight={battleModal.defWeight}
          elevation={battleModal.elevation}
          existingGarrison={battleModal.existingGarrison}
          onClose={() => setBattleModal(null)}
          onVictory={handleBattleVictory}
          onDefeat={handleBattleDefeat}
        />
      )}
    </div>
  );
}
