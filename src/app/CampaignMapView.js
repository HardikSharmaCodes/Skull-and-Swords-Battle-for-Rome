'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import elevationData from './elevationData.json';
import ancientSites from './ancientSites.json';
import regionsData from './regionsData.json';
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  KM_PER_PIXEL,
  UNIT_TYPES,
  getElevationAt,
  getTerrainSpeedMultiplier,
  getTerrainClassification,
  calculatePath,
  analyzeRoute,
  RomanAudio,
} from './gameEngine';

// Path2D cache for instant, zero-cost polygon fills, hover lightening and fog clearance
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

// Pre-compute site thresholds
const SITES = ancientSites.map(s => ({
  ...s,
  minZoom: minZoomForWeight(s.weight),
  minLabelZoom: minZoomForLabel(s.weight),
}));

export default function CampaignMapViewer({ onExitToMenu }) {
  const containerRef    = useRef(null);
  const svgContainerRef = useRef(null);
  const svgElRef        = useRef(null);
  const canvasRef       = useRef(null); // canvas for boundaries & region hover
  const fogCanvasRef    = useRef(null); // canvas for Fog of War / Terra Incognita
  const unitsCanvasRef  = useRef(null); // canvas for scouts, march paths & orders
  const sitesCanvasRef  = useRef(null); // canvas for markers & names

  const cam = useRef({ x: 0, y: 0, zoom: 1, minZoom: 0.4, maxZoom: 32.0 });
  const keys = useRef({ w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false });
  const drag = useRef({ isDragging: false, lastX: 0, lastY: 0, downX: 0, downY: 0 });

  // Map Visual Mode: 'terrain' | 'vintage'
  const [visualMode, setVisualMode] = useState('vintage'); // Default to paper style as requested!
  const visualModeRef = useRef('vintage');

  const [showBorders, setShowBorders] = useState(true);
  const showBordersRef = useRef(true);

  // Fog of War / Exploration System
  // Starting province (Rome: ID 1) knows all about the states around its borders
  const romeRegion = regionsData.regions.find(r => r.id === 1) || regionsData.regions[0];
  const initialKnownIds = new Set([romeRegion.id, ...(romeRegion.neighbors || [])]);

  const [fogEnabled, setFogEnabled] = useState(true);
  const fogEnabledRef = useRef(true);
  const [discoveredIds, setDiscoveredIds] = useState(initialKnownIds);
  const discoveredIdsRef = useRef(initialKnownIds);

  // Pathfinding Mode: 'terrain' (smart, avoids mountains/sea) vs 'direct'
  const [pathfindingMode, setPathfindingMode] = useState('terrain');
  const pathfindingModeRef = useRef('terrain');

  // Turn Simulation Clock: 1 Turn = 1 Minute
  const [turn, setTurn] = useState(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(1); // 1x | 2x | 5x
  const autoPlayRef = useRef(false);

  // Scouts / Units Management
  // Starts with 1 Roman Scout Equites deployed at Rome
  const [scouts, setScouts] = useState([
    {
      id: 'scout-1',
      name: 'I Equites Speculatores (Roma)',
      level: 1,
      x: romeRegion.center[0],
      y: romeRegion.center[1],
      target: null,
      path: [],
      routeInfo: null,
      status: 'idle',
      distanceTraveledKm: 0,
      baseSpeedKmPerMin: 350, // 350 km per minute
      visionRadiusKm: 150, // uniform base vision
      visionRadiusPx: Math.round(150 / KM_PER_PIXEL),
    }
  ]);
  const scoutsRef = useRef(scouts);
  scoutsRef.current = scouts;

  const [selectedScoutId, setSelectedScoutId] = useState('scout-1');
  const selectedScoutRef = useRef('scout-1');
  const lastTickTimeRef = useRef(null);
  const marchDistAccumRef = useRef(0);

  // Selected province state
  const [selectedProvince, setSelectedProvince] = useState(null);
  const selectedProvinceRef = useRef(null);

  // Notifications / Discovered Toasts
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

  // Apply visual mode & border layer visibility to SVG
  const applySvgState = (mode, bordersOn) => {
    visualModeRef.current = mode;
    showBordersRef.current = bordersOn;
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
      bordersG.style.display = bordersOn ? 'block' : 'none';
    }
  };

  useEffect(() => {
    applySvgState(visualMode, showBorders);
  }, [visualMode, showBorders]);

  // Load clean SVG inline
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

  // ─── Turn / Minute Simulation Action ──────────────────────────────────────────
  const advanceTurn = useCallback(() => {
    setTurn(prevTurn => {
      const nextTurn = prevTurn + 1;
      RomanAudio.playMarch();

      setScouts(currentScouts => {
        let anyNewDiscovery = false;
        const newDiscovered = new Set(discoveredIdsRef.current);

        const updated = currentScouts.map(scout => {
          if (!scout.path || scout.path.length < 2) return scout;

          // Scout travels 350 km per minute budget
          const baseBudgetKm = scout.baseSpeedKmPerMin;
          let remainingBudgetKm = baseBudgetKm;
          let curX = scout.x;
          let curY = scout.y;
          let path = [...scout.path];
          let distTraveled = scout.distanceTraveledKm;

          while (path.length >= 2 && remainingBudgetKm > 0.5) {
            const p0 = path[0];
            const p1 = path[1];
            const segDistPx = Math.hypot(p1.x - p0.x, p1.y - p0.y);
            const segDistKm = segDistPx * KM_PER_PIXEL;

            const midElev = getElevationAt((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
            const terrainMult = Math.max(0.18, getTerrainSpeedMultiplier(midElev));
            // Effective distance budget on this terrain
            const effectiveSegDistKm = segDistKm / terrainMult;

            if (remainingBudgetKm >= effectiveSegDistKm) {
              // Finish this segment
              curX = p1.x;
              curY = p1.y;
              distTraveled += Math.round(segDistKm);
              remainingBudgetKm -= effectiveSegDistKm;
              path.shift();
            } else {
              // Partial advance along segment
              const fraction = remainingBudgetKm / effectiveSegDistKm;
              curX = p0.x + (p1.x - p0.x) * fraction;
              curY = p0.y + (p1.y - p0.y) * fraction;
              distTraveled += Math.round(segDistKm * fraction);
              path[0] = { x: curX, y: curY };
              remainingBudgetKm = 0;
            }
          }

          const hasFinished = path.length < 2;

          // Check province discovery within scout's vision circle
          for (const reg of regionsData.regions) {
            if (!newDiscovered.has(reg.id)) {
              const dx = curX - reg.center[0];
              const dy = curY - reg.center[1];
              const distPx = Math.hypot(dx, dy);
              if (distPx <= scout.visionRadiusPx + 15) {
                newDiscovered.add(reg.id);
                anyNewDiscovery = true;
                addToast(`🏛️ New Province Discovered: ${reg.site} (${reg.sovereignName})`, 'success');
              }
            }
          }

          const route = hasFinished ? null : analyzeRoute(path, scout.baseSpeedKmPerMin);

          return {
            ...scout,
            x: curX,
            y: curY,
            path: hasFinished ? [] : path,
            routeInfo: route,
            status: hasFinished ? 'idle' : 'marching',
            distanceTraveledKm: distTraveled,
          };
        });

        if (anyNewDiscovery) {
          RomanAudio.playDiscovery();
          discoveredIdsRef.current = newDiscovered;
          setDiscoveredIds(newDiscovered);
        }

        return updated;
      });

      return nextTurn;
    });
  }, [addToast]);

  // Auto-play timer loop
  useEffect(() => {
    if (!isAutoPlaying) return;
    autoPlayRef.current = true;
    const intervalMs = Math.max(300, 1000 / autoSpeed);
    const timer = setInterval(() => {
      advanceTurn();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isAutoPlaying, autoSpeed, advanceTurn]);

  // ─── Scout Actions: Recruit & Level Up ───────────────────────────────────────
  const handleRecruitScout = (sourceProvince) => {
    const prov = sourceProvince || romeRegion;
    const newIdx = scoutsRef.current.length + 1;
    const newScout = {
      id: `scout-${newIdx}`,
      name: `${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][newIdx - 1] || 'Cohors'} Equites Speculatores (${prov.site})`,
      level: 1,
      x: prov.center[0],
      y: prov.center[1],
      target: null,
      path: [],
      routeInfo: null,
      status: 'idle',
      distanceTraveledKm: 0,
      baseSpeedKmPerMin: 350,
      visionRadiusKm: 150,
      visionRadiusPx: Math.round(150 / KM_PER_PIXEL),
    };

    RomanAudio.playRecruit();
    setScouts(prev => [...prev, newScout]);
    setSelectedScoutId(newScout.id);
    selectedScoutRef.current = newScout.id;
    addToast(`🎺 Recruited ${newScout.name} at ${prov.site}! (350 km/turn speed)`, 'success');
  };

  const handleLevelUpScout = (scoutId) => {
    setScouts(prev => prev.map(s => {
      if (s.id !== scoutId) return s;
      const nextLvl = s.level + 1;
      const nextRadiusKm = s.visionRadiusKm + 35;
      const nextRadiusPx = Math.round(nextRadiusKm / KM_PER_PIXEL);
      RomanAudio.playDiscovery();
      addToast(`⭐ ${s.name} promoted to Level ${nextLvl}! Vision sphere expanded to ${nextRadiusKm} km (+35 km)`, 'success');
      return {
        ...s,
        level: nextLvl,
        visionRadiusKm: nextRadiusKm,
        visionRadiusPx: nextRadiusPx,
      };
    }));
  };

  // ─── Set Scout Destination & Order March ─────────────────────────────────────
  const handleOrderMarch = (targetX, targetY) => {
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

    addToast(`🏇 Route plotted: ${route.distanceKm} km (Est. ${route.turnsEta} minutes / turns)`, 'info');
  };

  // ─── Main High-Performance Canvas Rendering Loop ─────────────────────────────
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
        cam.current.x = (vw - MAP_WIDTH * cam.current.zoom) / 2;
        cam.current.y = (vh - MAP_HEIGHT * cam.current.zoom) / 2;
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    let animId;
    let lastHudUpdate = 0;

    const tick = (now) => {
      // ─── Real-Time Slow March Animation (5 sec = 1 month = 350 km) ───
      if (lastTickTimeRef.current == null) lastTickTimeRef.current = now;
      const dt = Math.min(0.08, (now - lastTickTimeRef.current) / 1000);
      lastTickTimeRef.current = now;

      let anyNewDiscovery = false;
      const discSet = discoveredIdsRef.current;
      const currentScouts = scoutsRef.current;

      for (const scout of currentScouts) {
        if (scout.status === 'marching' && scout.path && scout.path.length >= 2) {
          const elev = getElevationAt(scout.x, scout.y);
          const mult = Math.max(0.18, getTerrainSpeedMultiplier(elev));
          // Speed: 350 km per 5 seconds = 70 km/sec (slow smooth march)
          const kmStep = 70.0 * mult * dt;
          let pxStep = kmStep / KM_PER_PIXEL;

          while (pxStep > 0.05 && scout.path.length >= 2) {
            const p1 = scout.path[1];
            const segDist = Math.hypot(p1.x - scout.x, p1.y - scout.y);
            if (pxStep >= segDist) {
              scout.x = p1.x;
              scout.y = p1.y;
              const movedKm1 = segDist * KM_PER_PIXEL;
              scout.distanceTraveledKm = (scout.distanceTraveledKm || 0) + movedKm1;
              marchDistAccumRef.current += movedKm1;
              pxStep -= segDist;
              scout.path.shift();
            } else {
              const fraction = pxStep / segDist;
              scout.x += (p1.x - scout.x) * fraction;
              scout.y += (p1.y - scout.y) * fraction;
              const movedKm = pxStep * KM_PER_PIXEL;
              scout.distanceTraveledKm = (scout.distanceTraveledKm || 0) + movedKm;
              marchDistAccumRef.current += movedKm;
              scout.path[0] = { x: scout.x, y: scout.y };
              pxStep = 0;
            }
          }

          // Advance month whenever 350 km accumulated
          if (marchDistAccumRef.current >= 350) {
            marchDistAccumRef.current -= 350;
            setTurn(t => t + 1);
          }

          if (scout.path.length < 2) {
            scout.status = 'idle';
            scout.path = [];
            scout.routeInfo = null;
          }

          // Real-time fog of war uncovering
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

      // 2. Region Hover Lightening & Boundaries Canvas
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
          ctx.fillStyle = 'rgba(255, 215, 0, 0.28)';
          ctx.fill(selPath);
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = Math.max(1.2, 2.4 / c.zoom);
          ctx.stroke(selPath);
          ctx.restore();
        }
      }

      // Hovered Region Smooth Light-Up
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
      ctx.restore();

      // 3. Fog of War / Terra Incognita Canvas
      const fctx = fogCanvas.getContext('2d');
      fctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);

      if (fogEnabledRef.current) {
        fctx.save();
        fctx.scale(dpr, dpr);

        // Draw opaque dark parchment fog over entire viewport
        fctx.fillStyle = 'rgba(18, 14, 11, 0.88)';
        fctx.fillRect(0, 0, vw, vh);

        // Punch holes through fog for explored provinces & scout vision spheres
        fctx.globalCompositeOperation = 'destination-out';
        fctx.save();
        fctx.translate(c.x, c.y);
        fctx.scale(c.zoom, c.zoom);

        // A. Punch out discovered province polygons
        const discSetCurrent = discoveredIdsRef.current;
        for (const reg of regionsData.regions) {
          if (discSetCurrent.has(reg.id) && reg.pathD) {
            const p = getRegionPath(reg.pathD);
            if (p) {
              fctx.fillStyle = '#000000';
              fctx.fill(p);
            }
          }
        }

        // B. Punch out circular vision spheres around all scouts (without dotted border, pure light/dark)
        for (const s of scoutsRef.current) {
          fctx.beginPath();
          fctx.arc(s.x, s.y, s.visionRadiusPx, 0, Math.PI * 2);
          fctx.fill();
        }

        fctx.restore();
        fctx.restore();
      }

      // 4. Units & March Paths Canvas
      const uctx = unitsCanvas.getContext('2d');
      uctx.clearRect(0, 0, unitsCanvas.width, unitsCanvas.height);
      uctx.save();
      uctx.scale(dpr, dpr);

      // Draw march routes for scouts with active paths
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

          // Target destination marker flag
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
        const isMarching = scout.status === 'marching';
        const trotBob = isMarching ? Math.sin(now * 0.018) * 3.5 : 0;
        const sy = c.y + scout.y * c.zoom + trotBob;
        const isSelected = scout.id === selectedScoutRef.current;

        const tokenRadius = 15;

        // Selection halo
        if (isSelected) {
          uctx.beginPath();
          uctx.arc(sx, sy, tokenRadius + 6, 0, Math.PI * 2);
          uctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
          uctx.fill();
          uctx.strokeStyle = '#ffd700';
          uctx.lineWidth = 2;
          uctx.stroke();
        }

        // Unit Token Base
        uctx.beginPath();
        uctx.arc(sx, sy, tokenRadius, 0, Math.PI * 2);
        uctx.fillStyle = '#8a1c14'; // Imperial Roman crimson
        uctx.fill();
        uctx.strokeStyle = isSelected ? '#ffffff' : '#d4a34b';
        uctx.lineWidth = 2.5;
        uctx.stroke();

        // Cavalry Icon with slight trot rotation
        uctx.save();
        uctx.translate(sx, sy);
        if (isMarching) {
          uctx.rotate(Math.sin(now * 0.018) * 0.08);
        }
        uctx.font = '15px sans-serif';
        uctx.textAlign = 'center';
        uctx.textBaseline = 'middle';
        uctx.fillText('🐎', 0, -1);
        uctx.restore();

        // Level Star Badge
        uctx.font = "bold 9px 'Cinzel', serif";
        uctx.fillStyle = '#ffe18f';
        uctx.fillText(`★ Lv.${scout.level}`, sx, sy + tokenRadius + 9);

        // Unit Name Label
        if (isSelected || c.zoom >= 1.2) {
          uctx.font = "bold 11px 'Cinzel', serif";
          uctx.strokeStyle = 'rgba(0,0,0,0.9)';
          uctx.lineWidth = 3;
          uctx.strokeText(scout.name, sx, sy - tokenRadius - 8);
          uctx.fillStyle = '#ffffff';
          uctx.fillText(scout.name, sx, sy - tokenRadius - 8);
        }
      }

      uctx.restore();

      // 5. Sites Canvas (Markers + Names gated by Fog of War & Zoom)
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
        // Fog of War gate: only render site if discovered or fog disabled
        if (isFogOn && !discSitesSet.has(site.id)) continue;

        if (c.zoom < site.minZoom) continue;
        if (site.x < frustumX0 || site.x > frustumX1 || site.y < frustumY0 || site.y > frustumY1) continue;

        const sx = c.x + site.x * c.zoom;
        const sy = c.y + site.y * c.zoom;

        const isHovered = activeHoverSite && activeHoverSite.id === site.id;
        const isSelected = selected && selected.id === site.id;
        const baseR = site.weight >= 9 ? 8.5 : site.weight >= 7 ? 7.0 : site.weight >= 5 ? 5.5 : 4.5;
        const r = Math.max(3.5, baseR + (isHovered || isSelected ? 2.5 : 0));

        if (isHovered || isSelected) {
          sctx.beginPath();
          sctx.arc(sx, sy, r + 4, 0, Math.PI * 2);
          sctx.fillStyle = isSelected ? 'rgba(255, 215, 0, 0.55)' : 'rgba(255, 255, 255, 0.45)';
          sctx.fill();
        }

        drawMarker(sctx, sx, sy, site.type, r);

        // Site Name Label
        const showLabel = isHovered || isSelected || (c.zoom >= site.minLabelZoom);
        if (showLabel) {
          const fontSize = site.weight >= 9 ? 12 : site.weight >= 7 ? 11 : 10;
          sctx.font = `bold ${fontSize}px 'Cinzel', serif, Georgia`;
          sctx.textBaseline = 'middle';
          sctx.textAlign = 'left';

          const textX = sx + r + 5;
          const textY = sy;

          sctx.strokeStyle = 'rgba(6, 10, 16, 0.95)';
          sctx.lineWidth = 3.4;
          sctx.strokeText(site.site, textX, textY);

          sctx.fillStyle = isSelected
            ? '#ffd700'
            : (isHovered ? '#ffffff' : (site.weight >= 9 ? '#ffe18f' : site.weight >= 7 ? '#f7e3bf' : '#ebd5b7'));
          sctx.fillText(site.site, textX, textY);
        }
      }

      sctx.restore();

      // 6. Update HUD readout + sync mutated scout positions back to React state
      if (now - lastHudUpdate > 80) {
        setHudInfo(prev => ({
          ...prev,
          zoom: Math.round(c.zoom * 100),
          elevation: hoverRef.current.elevation,
          terrain: hoverRef.current.terrain,
          coord: hoverRef.current.coord,
          territory: hoverRef.current.territory,
          culture: hoverRef.current.culture,
        }));
        // Flush animated scout state (position, distance, status) back to React state for UI display
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
        lastHudUpdate = now;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    // Mouse & Touch events
    const onMouseDown = (e) => {
      // Right click: order march for active scout!
      if (e.button === 2) {
        const c = cam.current;
        const mapX = (e.clientX - c.x) / c.zoom;
        const mapY = (e.clientY - c.y) / c.zoom;
        handleOrderMarch(mapX, mapY);
        return;
      }

      if (e.button !== 0) return;
      drag.current = {
        isDragging: true,
        lastX: e.clientX,
        lastY: e.clientY,
        downX: e.clientX,
        downY: e.clientY,
      };
      container.style.cursor = 'grabbing';
    };

    const onContextMenu = (e) => {
      e.preventDefault(); // suppress browser context menu for right-click march orders
    };

    const onMouseMove = (e) => {
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

      // Check hover on scout units
      let hoveredUnit = null;
      for (const scout of scoutsRef.current) {
        const sx = c.x + scout.x * c.zoom;
        const sy = c.y + scout.y * c.zoom;
        if (Math.hypot(e.clientX - sx, e.clientY - sy) <= 18) {
          hoveredUnit = scout;
          break;
        }
      }

      // Check hover on site markers
      let found = null;
      let bestDist = 18;
      for (const site of SITES) {
        if (fogEnabledRef.current && !discoveredIdsRef.current.has(site.id)) continue;
        if (c.zoom < site.minZoom) continue;
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
      const dist = Math.hypot(e.clientX - drag.current.downX, e.clientY - drag.current.downY);
      if (dist < 6) {
        const c = cam.current;
        const mapX = (e.clientX - c.x) / c.zoom;
        const mapY = (e.clientY - c.y) / c.zoom;

        // Check if clicked directly on a scout token
        for (const scout of scoutsRef.current) {
          const sx = c.x + scout.x * c.zoom;
          const sy = c.y + scout.y * c.zoom;
          if (Math.hypot(e.clientX - sx, e.clientY - sy) <= 18) {
            setSelectedScoutId(scout.id);
            selectedScoutRef.current = scout.id;
            RomanAudio.playClick();
            drag.current.isDragging = false;
            container.style.cursor = 'grab';
            return;
          }
        }

        // Direct click on a site marker
        if (hoveredSiteRef.current) {
          const matchingReg = regionsData.regions.find(r => r.id === hoveredSiteRef.current.id);
          if (matchingReg) {
            setSelectedProvince(matchingReg);
            selectedProvinceRef.current = matchingReg;
            RomanAudio.playClick();
            drag.current.isDragging = false;
            container.style.cursor = 'grab';
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
            RomanAudio.playClick();
          }
        } else {
          setSelectedProvince(null);
          selectedProvinceRef.current = null;
        }
      }

      drag.current.isDragging = false;
      container.style.cursor = 'grab';
    };

    const onWheel = (e) => {
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
      if (e.code === 'Space') {
        e.preventDefault();
        advanceTurn();
      }
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
  }, [advanceTurn]);

  const handleReset = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const fitZoom = Math.min(vw / MAP_WIDTH, vh / MAP_HEIGHT) * 0.96;
    cam.current.zoom = fitZoom;
    cam.current.x = (vw - MAP_WIDTH * fitZoom) / 2;
    cam.current.y = (vh - MAP_HEIGHT * fitZoom) / 2;
  };

  const handleFocusPoint = (x, y) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const targetZoom = Math.max(cam.current.zoom, 2.2);
    cam.current.zoom = targetZoom;
    cam.current.x = vw / 2 - x * targetZoom;
    cam.current.y = vh / 2 - y * targetZoom;
  };

  const activeScout = scouts.find(s => s.id === selectedScoutId) || scouts[0];

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
      {/* ── Top Game & Simulation Bar ────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(12, 10, 8, 0.94)',
        border: '1px solid #8e6c38',
        borderRadius: 8,
        padding: '7px 18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
        backdropFilter: 'blur(10px)',
        pointerEvents: 'auto',
      }}>
        {/* Turn & Month Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: '15px' }}>⏳</span>
          <span style={{
            fontSize: '13px', fontWeight: 900, color: '#ffe18f',
            letterSpacing: '1px', fontFamily: "'Cinzel', serif"
          }}>
            MONTH {turn}
          </span>
          <span style={{ fontSize: '10px', color: '#ffd700', padding: '2px 7px', background: '#241a10', borderRadius: 4, border: '1px solid #73512a' }}>
            5s = 1 Month (350 km)
          </span>
        </div>

        <span style={{ color: '#685030', fontSize: '14px' }}>|</span>

        {/* Turn Step Button */}
        <button
          onClick={() => advanceTurn()}
          style={{
            padding: '6px 14px',
            background: 'linear-gradient(180deg, #b03a2e 0%, #78281f 100%)',
            border: '1.5px solid #ffd700',
            borderRadius: 5,
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 900,
            cursor: 'pointer',
            letterSpacing: '1px',
            fontFamily: "'Cinzel', serif",
            boxShadow: '0 3px 12px rgba(176,58,46,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          title="Advance 1 Month / 350 km (Shortcut: Spacebar)"
        >
          <span>⚔️ ADVANCE 1 MONTH (350 km)</span>
          <span style={{ fontSize: '9px', opacity: 0.8 }}>(Space)</span>
        </button>

        {/* Auto March Play/Pause */}
        <button
          onClick={() => setIsAutoPlaying(prev => !prev)}
          style={{
            padding: '6px 12px',
            background: isAutoPlaying ? '#27ae60' : '#221810',
            border: `1px solid ${isAutoPlaying ? '#2ecc71' : '#5a3d1c'}`,
            borderRadius: 4,
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: "'Cinzel', serif",
          }}
        >
          {isAutoPlaying ? '⏸️ PAUSE' : '▶ AUTO-MARCH'}
        </button>

        {/* Auto Speed Selector */}
        {isAutoPlaying && (
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 5].map(spd => (
              <button
                key={spd}
                onClick={() => setAutoSpeed(spd)}
                style={{
                  padding: '3px 7px',
                  background: autoSpeed === spd ? '#d4a34b' : '#1a120b',
                  color: autoSpeed === spd ? '#000000' : '#d4a34b',
                  border: '1px solid #73512a',
                  borderRadius: 3,
                  fontSize: '9.5px',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                {spd}x
              </button>
            ))}
          </div>
        )}

        <span style={{ color: '#685030', fontSize: '14px' }}>|</span>

        {/* Recruit Scout Quick Action */}
        <button
          onClick={() => handleRecruitScout(romeRegion)}
          style={{
            padding: '5px 12px',
            background: 'linear-gradient(180deg, #4d3319 0%, #291809 100%)',
            border: '1px solid #ffd700',
            borderRadius: 4,
            color: '#ffe18f',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: "'Cinzel', serif",
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
          title="Recruit Scout Equites at Rome (350 km/turn)"
        >
          <span>🐎 RECRUIT SCOUT (50 🪙)</span>
        </button>

        {onExitToMenu && (
          <button
            onClick={onExitToMenu}
            style={{
              padding: '5px 12px',
              background: '#1a140e',
              border: '1px solid #73512a',
              borderRadius: 4,
              color: '#d4ad82',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Cinzel', serif",
            }}
          >
            ◀ MENU
          </button>
        )}
      </div>

      {/* ── HUD Control Panel ──────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 18, left: 18, zIndex: 100,
        background: 'rgba(16, 22, 30, 0.94)', border: '1px solid #7a5c30',
        borderRadius: 8, padding: '12px 16px', backdropFilter: 'blur(8px)',
        color: '#edd8b4', boxShadow: '0 8px 30px rgba(0,0,0,0.85)',
        fontFamily: "'Cinzel', serif, Georgia, sans-serif", fontSize: '12px',
        pointerEvents: 'auto', maxWidth: 310,
      }}>
        <div style={{ fontWeight: 900, fontSize: '14px', color: '#e8c988', letterSpacing: '1.2px', marginBottom: 2 }}>
          TACTICAL WAR THEATRE
        </div>
        <div style={{ fontSize: '10px', color: '#a89474', marginBottom: 10 }}>
          Sovereign Overstates • Fog of War • 350 km/min Traversal
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
              { id: 'vintage', label: '📜 Paper (Colours)' },
              { id: 'terrain', label: '🏔️ Terrain Elevation' }
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
              title="Chooses shortest path while avoiding high mountains and traversing fast plains"
            >
              🧠 Smart (Avoid Mtns)
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
              title="Direct geometrical line ignoring elevation"
            >
              🧭 Direct Line
            </button>
          </div>
        </div>

        {/* Fog of War & Vector Borders Toggles */}
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
            {showBorders ? '✓ WHITE BORDERS' : 'BORDERS OFF'}
          </button>
        </div>

        {/* Controls Guide */}
        <div style={{ fontSize: '10.5px', color: '#c4ad8e', lineHeight: 1.5, marginBottom: 8, background: '#120f0c', padding: '6px 8px', borderRadius: 4, border: '1px solid #3d2b19' }}>
          <div><b style={{ color: '#ffd700' }}>Right-Click:</b> Order Scout to March</div>
          <div><b style={{ color: '#ffd700' }}>Spacebar:</b> Advance 1 Minute (Turn)</div>
          <div><b style={{ color: '#ffd700' }}>Speed:</b> 350 km/min (slow in mountains)</div>
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

      {/* ── Active Scouts / Units Roster Panel ───────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 18, left: 18, zIndex: 100,
        background: 'rgba(14, 18, 26, 0.94)', border: '1.5px solid #d4a34b',
        borderRadius: 8, padding: '12px 14px', backdropFilter: 'blur(8px)',
        color: '#f3e1b9', boxShadow: '0 8px 30px rgba(0,0,0,0.85)',
        fontFamily: "'Cinzel', serif", fontSize: '11px',
        pointerEvents: 'auto', maxWidth: 360, width: '92vw',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 900, fontSize: '12px', color: '#ffd700', letterSpacing: '0.8px' }}>
            🐎 IMPERIAL RECONNAISSANCE SQUADRONS
          </div>
          <button
            onClick={() => handleRecruitScout(selectedProvince || romeRegion)}
            style={{
              padding: '3px 8px', backgroundColor: '#4d3319', border: '1px solid #ffd700',
              borderRadius: 3, color: '#ffffff', fontSize: '9.5px', fontWeight: 800, cursor: 'pointer',
            }}
          >
            + RECRUIT (50 🪙)
          </button>
        </div>

        {/* Scouts List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
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
                    {scout.name}
                  </div>
                  <div style={{
                    fontSize: '9.5px', padding: '1px 5px', borderRadius: 3,
                    backgroundColor: scout.status === 'marching' ? '#145a32' : '#2c1e14',
                    color: scout.status === 'marching' ? '#2ecc71' : '#d4a34b',
                    fontWeight: 700,
                  }}>
                    {scout.status === 'marching' ? '🏇 MARCHING' : '⛺ IDLE'}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: '#c4ad8e', fontSize: '10px' }}>
                  <div>
                    <b>Speed:</b> 350 km/turn • <b>Vision:</b> {scout.visionRadiusKm} km
                  </div>
                  <div>
                    <b>Traveled:</b> {Math.round(scout.distanceTraveledKm || 0).toLocaleString()} km
                  </div>
                </div>

                {scout.routeInfo && (
                  <div style={{ marginTop: 4, fontSize: '9.5px', color: '#ffd700', borderTop: '1px dashed #5a4220', paddingTop: 3 }}>
                    Route: {scout.routeInfo.distanceKm} km remaining • ETA: {scout.routeInfo.turnsEta} turns (minutes)
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLevelUpScout(scout.id);
                    }}
                    style={{
                      flex: 1, padding: '2px 6px', backgroundColor: '#3d2b19',
                      border: '1px solid #ffd700', borderRadius: 3,
                      color: '#ffe18f', fontSize: '9.5px', fontWeight: 800, cursor: 'pointer',
                    }}
                    title="Expand scout vision radius by +35 km"
                  >
                    ⭐ Promote Lv.{scout.level + 1} (+35km Vision)
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFocusPoint(scout.x, scout.y);
                    }}
                    style={{
                      padding: '2px 8px', backgroundColor: '#1f2838',
                      border: '1px solid #5a7090', borderRadius: 3,
                      color: '#ffffff', fontSize: '9.5px', cursor: 'pointer',
                    }}
                  >
                    🎯 Focus
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Interactive Clicked Province Sovereign Dossier Card ──────────────── */}
      {selectedProvince && (
        <div style={{
          position: 'absolute', top: 18, right: 18, zIndex: 110,
          background: 'rgba(14, 20, 29, 0.96)', border: `2px solid ${selectedProvince.color || '#d4a34b'}`,
          borderRadius: 8, padding: '14px 18px', backdropFilter: 'blur(10px)',
          color: '#f3e1b9', boxShadow: '0 12px 35px rgba(0,0,0,0.9), 0 0 15px rgba(212,163,75,0.25)',
          fontFamily: "'Cinzel', serif, Georgia, sans-serif", fontSize: '12px',
          maxWidth: 340, width: '90vw', lineHeight: 1.6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <div style={{
                fontSize: '10px', color: selectedProvince.color || '#d4a34b',
                fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase'
              }}>
                SOVEREIGN OVERSTATE • {selectedProvince.macroRegion?.toUpperCase() || 'PROVINCIA'}
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

          {/* Sovereign Title & Ruler */}
          <div style={{
            padding: '6px 10px', borderRadius: 4, backgroundColor: '#221a12',
            border: `1px solid ${selectedProvince.color}66`, fontSize: '11px', color: '#ffe18f',
            marginBottom: 10, lineHeight: 1.5,
          }}>
            <div><b>Polity:</b> {selectedProvince.sovereignName || selectedProvince.site}</div>
            <div style={{ color: '#d4ad82', fontSize: '10.5px' }}>
              <b>Ruler:</b> {selectedProvince.ruler || 'Assembly of Elders'}
            </div>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px',
            fontSize: '11px', color: '#c8b498', borderTop: '1px solid #4a3820',
            paddingTop: 8, marginBottom: 10,
          }}>
            <div><b style={{ color: '#d4a34b' }}>Classification:</b></div>
            <div style={{ color: '#ffffff' }}>{selectedProvince.type}</div>

            <div><b style={{ color: '#d4a34b' }}>Cultural Sphere:</b></div>
            <div style={{ color: '#ffffff' }}>{selectedProvince.region}</div>

            <div><b style={{ color: '#d4a34b' }}>Treasury:</b></div>
            <div style={{ color: '#ffd700' }}>🪙 {selectedProvince.treasury || 500} Denarii</div>

            <div><b style={{ color: '#d4a34b' }}>Garrison:</b></div>
            <div style={{ color: '#ffffff' }}>🛡️ {selectedProvince.garrison || 650} Men</div>
          </div>

          {/* Border Neighbors List (A province knows all about states around its borders!) */}
          {selectedProvince.neighbors && selectedProvince.neighbors.length > 0 && (
            <div style={{ marginBottom: 12, borderTop: '1px solid #3d2b19', paddingTop: 6 }}>
              <div style={{ fontSize: '10px', color: '#d4a34b', fontWeight: 800, marginBottom: 4, textTransform: 'uppercase' }}>
                Borders & Adjacent Overstates ({selectedProvince.neighbors.length}):
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
              onClick={() => handleRecruitScout(selectedProvince)}
              style={{
                flex: 1, padding: '6px 8px', backgroundColor: '#4d3319',
                color: '#ffe18f', border: '1px solid #ffd700', borderRadius: 4,
                fontSize: '10.5px', fontWeight: 800, cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
              }}
            >
              🐎 Recruit Scout Here
            </button>
            <button
              onClick={() => handleFocusPoint(selectedProvince.center[0], selectedProvince.center[1])}
              style={{
                padding: '6px 10px', backgroundColor: '#221a12',
                color: '#d4a34b', border: '1px solid #73512a', borderRadius: 4,
                fontSize: '10.5px', fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
              }}
            >
              🎯 Focus
            </button>
          </div>
        </div>
      )}

      {/* ── Active Discovery Toast Notifications ─────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 20, right: 20, zIndex: 120,
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              background: 'rgba(18, 24, 34, 0.96)',
              border: '1.5px solid #ffd700',
              borderRadius: 6,
              padding: '10px 14px',
              color: '#ffe18f',
              fontFamily: "'Cinzel', serif",
              fontSize: '11px',
              fontWeight: 800,
              boxShadow: '0 8px 25px rgba(0,0,0,0.85)',
              letterSpacing: '0.5px',
              animation: 'fadeIn 0.3s ease',
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── Layer 1: Pure Vector Map (Inline SVG with Colored Vintage Paper) ─── */}
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

      {/* ── Layer 3: Fog of War / Terra Incognita Canvas ─────────────────────── */}
      <canvas
        ref={fogCanvasRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          pointerEvents: 'none', zIndex: 15,
        }}
      />

      {/* ── Layer 4: Units, March Paths & Trajectories Canvas ────────────────── */}
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

      {/* ── Rich Tooltip ────────────────────────────────────────────────────── */}
      {tooltip && (() => {
        if (tooltip.isUnit) {
          const { unit, screenX, screenY } = tooltip;
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
              <div><b>Speed:</b> 350 km/turn</div>
              <div><b>Vision Sphere:</b> {unit.visionRadiusKm} km</div>
              <div><b>Traveled:</b> {unit.distanceTraveledKm} km</div>
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
        return (
          <div style={{
            position: 'absolute',
            left: screenX + 16,
            top: screenY - 10,
            zIndex: 200,
            background: 'rgba(14,19,28,0.97)',
            border: `1.5px solid ${style.color}`,
            borderRadius: 7,
            padding: '10px 14px',
            fontFamily: "'Cinzel',serif,Georgia",
            color: '#f0ddb8',
            fontSize: '11px',
            pointerEvents: 'none',
            boxShadow: `0 6px 28px rgba(0,0,0,0.85), 0 0 0 1px ${style.stroke}55`,
            maxWidth: 280,
            lineHeight: 1.65,
          }}>
            <div style={{ fontWeight: 900, fontSize: '13.5px', color: style.color, marginBottom: 2 }}>
              {site.site}
            </div>
            <div style={{ fontSize: '10px', color: '#a08868', marginBottom: 6 }}>
              {site.modern}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                backgroundColor: style.color,
                border: `1.5px solid ${style.stroke}`,
                flexShrink: 0,
              }}/>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#ddc898',
                             letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {site.type}
              </span>
            </div>
            {site.people && (
              <div style={{ fontSize: '10px', color: '#e8c988', marginBottom: 4 }}>
                <b>Polity:</b> {site.people}
              </div>
            )}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '3px 14px', fontSize: '10.5px', color: '#c8b090',
              borderTop: `1px solid ${style.color}44`, paddingTop: 5,
            }}>
              <div><b style={{ color: '#e8c988' }}>Region:</b></div>
              <div style={{ color: '#f0ddb8' }}>{site.region}</div>
              <div><b style={{ color: '#e8c988' }}>Weight:</b></div>
              <div style={{ color: '#f0ddb8' }}>
                {'★'.repeat(Math.min(site.weight, 5))} {site.weight}/10
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
