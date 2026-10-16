/**
 * Tactical Game Engine for Skull and Swords: Battle for Rome
 * 
 * Features:
 * 1. High-Performance A* Terrain-Aware Pathfinding (avoids mountains, prefers plains/valleys, avoids deep sea)
 * 2. Real-Time Terrain Speed & Traversal Cost (Plains: 100%, Hills: 70%, Highlands: 45%, Mountains: 24%)
 * 3. Modular Unit System (Scout Equites traveling 350 km/minute/turn, uniform vision sphere, level up)
 * 4. Fog of War & Discovery Engine (Province borders known around home, terra incognita, scout vision reveal)
 * 5. Turn Simulation Clock (1 minute = 1 turn, manual advance or auto-march playback)
 */

import elevationData from './elevationData.json';
import regionsData from './regionsData.json';

export const MAP_WIDTH = 2600;
export const MAP_HEIGHT = 2200;
export const KM_PER_PIXEL = 1.73; // ~4500 km across 2600 pixels

// Elevation grid constants
const GRID_W = 261;
const GRID_H = 221;
const GRID_STEP = 10;

// Flat Float32 array of elevation values
const ELEVATION_GRID = new Float32Array(GRID_W * GRID_H);
for (let i = 0; i < elevationData.length; i++) {
  ELEVATION_GRID[i] = elevationData[i][2];
}

export function getElevationAt(x, y) {
  const ix = Math.max(0, Math.min(GRID_W - 1, Math.round(x / GRID_STEP)));
  const iy = Math.max(0, Math.min(GRID_H - 1, Math.round(y / GRID_STEP)));
  return ELEVATION_GRID[iy * GRID_W + ix];
}

export function getTerrainSpeedMultiplier(elevation) {
  if (elevation < 0) return 0.0; // Sea (impassable for land units)
  if (elevation <= 300) return 1.0; // Plains / Coastal plains (fastest)
  if (elevation <= 700) return 0.70; // Low hills
  if (elevation <= 1300) return 0.45; // Highlands
  return 0.24; // High mountain passes (very slow, arduous)
}

export function getTerrainClassification(elevation) {
  if (elevation < 0) return { name: 'Mediterranean Sea', penalty: 'Impassable', speedMult: 0 };
  if (elevation <= 200) return { name: 'Coastal Plains', penalty: 'None (Full Speed)', speedMult: 1.0 };
  if (elevation <= 500) return { name: 'Plains & Lowlands', penalty: 'None (Full Speed)', speedMult: 1.0 };
  if (elevation <= 900) return { name: 'Rolling Hills', penalty: '-30% Speed', speedMult: 0.70 };
  if (elevation <= 1500) return { name: 'Rough Highlands', penalty: '-55% Speed', speedMult: 0.45 };
  return { name: 'Alpine Mountains', penalty: '-76% Arduous', speedMult: 0.24 };
}

// ─── Modular Unit Type Infrastructure ──────────────────────────────────────────
export const UNIT_TYPES = {
  scout: {
    id: 'scout',
    name: 'Equites Speculatores',
    title: 'Roman Scout Cavalry',
    icon: '🐎',
    cost: 50,
    baseSpeedKmPerMin: 150, // 150 km per month (turn)
    baseVisionRadiusKm: 150, // Uniform base vision radius (~87 map pixels)
    visionRadiusPerLevel: 35, // +35 km per level up
    description: 'Rapid mounted reconnaissance unit. Traverses 150 km/month across open plains and reveals terra incognita.',
  },
  // Extensible for future unit types:
  cohort: {
    id: 'cohort',
    name: 'Legionary Cohort',
    title: 'Heavy Infantry',
    icon: '🛡️',
    cost: 150,
    baseSpeedKmPerMin: 120,
    baseVisionRadiusKm: 80,
    visionRadiusPerLevel: 20,
    description: 'Disciplined heavy infantry cohort with strong combat defense.',
  },
  diplomat: {
    id: 'diplomat',
    name: 'Legatus Emissary',
    title: 'Diplomatic Envoy',
    icon: '📜',
    cost: 100,
    baseSpeedKmPerMin: 220,
    baseVisionRadiusKm: 100,
    visionRadiusPerLevel: 25,
    description: 'Diplomatic envoy able to negotiate treaties with sovereign overstates.',
  }
};

// ─── Fast Binary Heap for A* ──────────────────────────────────────────────────
class FastMinHeap {
  constructor() { this.data = []; }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const bottom = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this._sinkDown(0);
    }
    return top;
  }
  isEmpty() { return this.data.length === 0; }
  _bubbleUp(i) {
    const item = this.data[i];
    while (i > 0) {
      const p = (i - 1) >> 1;
      const parent = this.data[p];
      if (item.f >= parent.f) break;
      this.data[i] = parent;
      i = p;
    }
    this.data[i] = item;
  }
  _sinkDown(i) {
    const n = this.data.length;
    const item = this.data[i];
    const half = n >> 1;
    while (i < half) {
      let left = (i << 1) + 1;
      let right = left + 1;
      let best = (right < n && this.data[right].f < this.data[left].f) ? right : left;
      if (this.data[best].f >= item.f) break;
      this.data[i] = this.data[best];
      i = best;
    }
    this.data[i] = item;
  }
}

// ─── A* Pathfinding Engine ─────────────────────────────────────────────────────
export function calculatePath(startX, startY, targetX, targetY, pathMode = 'terrain') {
  // Clamp start and target to grid
  const sx = Math.max(0, Math.min(GRID_W - 1, Math.round(startX / GRID_STEP)));
  const sy = Math.max(0, Math.min(GRID_H - 1, Math.round(startY / GRID_STEP)));
  let tx = Math.max(0, Math.min(GRID_W - 1, Math.round(targetX / GRID_STEP)));
  let ty = Math.max(0, Math.min(GRID_H - 1, Math.round(targetY / GRID_STEP)));

  // If target is in deep water, find closest coastal land cell
  let targetElev = ELEVATION_GRID[ty * GRID_W + tx];
  if (targetElev < 0) {
    let bestDistSq = 999999;
    let bestTx = tx, bestTy = ty;
    for (let rad = 1; rad <= 12; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const nx = tx + dx, ny = ty + dy;
          if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
            if (ELEVATION_GRID[ny * GRID_W + nx] >= 0) {
              const dsq = dx * dx + dy * dy;
              if (dsq < bestDistSq) {
                bestDistSq = dsq;
                bestTx = nx;
                bestTy = ny;
              }
            }
          }
        }
      }
      if (bestDistSq < 999999) break;
    }
    tx = bestTx;
    ty = bestTy;
  }

  const startIdx = sy * GRID_W + sx;
  const targetIdx = ty * GRID_W + tx;

  if (startIdx === targetIdx) {
    return [{ x: startX, y: startY }, { x: targetX, y: targetY }];
  }

  const gScore = new Float32Array(GRID_W * GRID_H).fill(1e9);
  const cameFrom = new Int32Array(GRID_W * GRID_H).fill(-1);
  const closed = new Uint8Array(GRID_W * GRID_H);

  gScore[startIdx] = 0;
  const open = new FastMinHeap();
  const h0 = Math.hypot(tx - sx, ty - sy);
  open.push({ idx: startIdx, x: sx, y: sy, f: h0 });

  const dxs = [-1, 1, 0, 0, -1, 1, -1, 1];
  const dys = [0, 0, -1, 1, -1, -1, 1, 1];
  const dists = [1.0, 1.0, 1.0, 1.0, 1.414, 1.414, 1.414, 1.414];

  let found = false;
  let iterations = 0;
  let closestIdx = startIdx;
  let closestH = h0;

  while (!open.isEmpty() && iterations < 30000) {
    iterations++;
    const cur = open.pop();
    if (cur.idx === targetIdx || (Math.abs(cur.x - tx) <= 1 && Math.abs(cur.y - ty) <= 1)) {
      found = true;
      targetIdx_final = cur.idx;
      break;
    }
    if (closed[cur.idx]) continue;
    closed[cur.idx] = 1;

    const curElev = ELEVATION_GRID[cur.idx];
    const curH = Math.hypot(tx - cur.x, ty - cur.y);
    if (curH < closestH) {
      closestH = curH;
      closestIdx = cur.idx;
    }

    for (let d = 0; d < 8; d++) {
      const nx = cur.x + dxs[d];
      const ny = cur.y + dys[d];
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
      const nIdx = ny * GRID_W + nx;
      if (closed[nIdx]) continue;

      const nElev = ELEVATION_GRID[nIdx];
      // Land units cannot traverse open sea
      if (nElev < -15) continue;

      let stepCost = dists[d];

      if (pathMode === 'terrain') {
        // High terrain penalty: mountains are severely avoided, plains preferred!
        let elevPenalty = 1.0;
        if (nElev > 1800) elevPenalty = 7.5;
        else if (nElev > 1200) elevPenalty = 4.2;
        else if (nElev > 600) elevPenalty = 2.2;
        else if (nElev > 250) elevPenalty = 1.4;
        else elevPenalty = 1.0;

        const slope = Math.abs(nElev - curElev) / 70.0;
        stepCost *= (elevPenalty + slope * 1.8);
      }

      const tentativeG = gScore[cur.idx] + stepCost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = cur.idx;
        gScore[nIdx] = tentativeG;
        const h = Math.hypot(tx - nx, ty - ny);
        open.push({ idx: nIdx, x: nx, y: ny, f: tentativeG + h * 1.06 });
      }
    }
  }

  // Reconstruct path
  let curr = found ? (targetIdx_final !== undefined ? targetIdx_final : targetIdx) : closestIdx;
  const pathCells = [];
  while (curr !== -1 && curr !== startIdx) {
    const cx = (curr % GRID_W) * GRID_STEP;
    const cy = Math.floor(curr / GRID_W) * GRID_STEP;
    pathCells.push({ x: cx, y: cy });
    curr = cameFrom[curr];
  }
  pathCells.push({ x: startX, y: startY });
  pathCells.reverse();
  pathCells.push({ x: targetX, y: targetY });

  // Simplify and smooth path
  return smoothPath(pathCells);
}

let targetIdx_final;

function smoothPath(points) {
  if (points.length <= 2) return points;
  // Sample every few waypoints to reduce jitter
  const decimated = [points[0]];
  for (let i = 1; i < points.length - 1; i += 2) {
    decimated.push(points[i]);
  }
  decimated.push(points[points.length - 1]);
  return decimated;
}

// Calculate total length in km and terrain travel time in minutes (turns)
export function analyzeRoute(path, baseSpeedKmPerMin = 150) {
  if (!path || path.length < 2) return { distanceKm: 0, turnsEta: 0, segments: [] };
  let totalKm = 0;
  let totalMinutes = 0;
  const segments = [];

  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[i];
    const p1 = path[i + 1];
    const distPx = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const distKm = distPx * KM_PER_PIXEL;
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    const elev = getElevationAt(midX, midY);
    const mult = Math.max(0.18, getTerrainSpeedMultiplier(elev));
    const effectiveSpeed = baseSpeedKmPerMin * mult;
    const segMinutes = distKm / effectiveSpeed;

    totalKm += distKm;
    totalMinutes += segMinutes;
    segments.push({
      from: p0, to: p1, distKm, elev, mult, segMinutes
    });
  }

  return {
    distanceKm: Math.round(totalKm),
    turnsEta: Math.max(1, Math.ceil(totalMinutes)),
    segments
  };
}

// ─── Roman Procedural Web Audio Synthesizer ────────────────────────────────────
export class RomanAudio {
  static getCtx() {
    if (typeof window === 'undefined') return null;
    try {
      if (!window.__romanAudioCtx) {
        window.__romanAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (window.__romanAudioCtx.state === 'suspended') {
        window.__romanAudioCtx.resume();
      }
      return window.__romanAudioCtx;
    } catch {
      return null;
    }
  }

  static playClick() {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.11);
    } catch {}
  }

  static playHover() {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {}
  }

  // Roman Cornu / Buccina Brass Fanfare for scout recruitment
  static playRecruit() {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [
        { f: 293.66, t: 0, d: 0.15 }, // D4
        { f: 369.99, t: 0.15, d: 0.15 }, // F#4
        { f: 440.00, t: 0.30, d: 0.18 }, // A4
        { f: 587.33, t: 0.48, d: 0.38 }  // D5
      ].forEach(({ f, t, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now + t);
        gain.gain.setValueAtTime(0.12, now + t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + d + 0.02);
      });
    } catch {}
  }

  // Cavalry Gallop / Marching drum sound
  static playMarch() {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [0, 0.08, 0.18, 0.26].forEach(dt => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now + dt);
        osc.frequency.exponentialRampToValueAtTime(60, now + dt + 0.06);
        gain.gain.setValueAtTime(0.15, now + dt);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dt + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + dt);
        osc.stop(now + dt + 0.07);
      });
    } catch {}
  }

  // Triumphant Discovery Chime when an unknown province is revealed
  static playDiscovery() {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [
        { f: 523.25, t: 0, d: 0.25 }, // C5
        { f: 659.25, t: 0.12, d: 0.30 }, // E5
        { f: 783.99, t: 0.24, d: 0.35 }, // G5
        { f: 1046.50, t: 0.38, d: 0.60 } // C6
      ].forEach(({ f, t, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + t);
        gain.gain.setValueAtTime(0.10, now + t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + d + 0.02);
      });
    } catch {}
  }
}

