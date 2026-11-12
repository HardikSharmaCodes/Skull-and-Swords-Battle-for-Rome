// Classical Roman Vector Icons for Campaign Map Sites
// Directly inspired by classical sepia-terracotta architectural silhouette icons.
// All icons are procedurally drawn with Canvas 2D paths.

export function getSiteCategory(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('temple') || t.includes('sanctuary') || t.includes('oracle') || t.includes('healing')) {
    return 'temple';
  }
  if (t.includes('frontier') || t.includes('fortress') || t.includes('hill fort') || t.includes('pass fort') || t.includes('military base') || t.includes('stronghold')) {
    return 'fort';
  }
  if (t.includes('seaport') || t.includes('harbor') || t.includes('naval') || t.includes('river port') || t.includes('landing') || t.includes('emporium')) {
    return 'harbor';
  }
  if (t.includes('imperial capital') || t.includes('metropolis') || t.includes('regional capital') || t.includes('royal residence') || t.includes('royal capital')) {
    return 'city';
  }
  if (t.includes('river crossing') || t.includes('bridge')) {
    return 'bridge';
  }
  if (t.includes('mountain') || t.includes('rock-cut')) {
    return 'mountain_village';
  }
  if (t.includes('caravan') || t.includes('oasis') || t.includes('desert')) {
    return 'desert';
  }
  if (t.includes('mining') || t.includes('industrial') || t.includes('quarry')) {
    return 'quarry';
  }
  if (t.includes('village') || t.includes('farm')) {
    return 'farm';
  }
  if (t.includes('forest') || t.includes('grove')) {
    return 'forest';
  }
  if (t.includes('lighthouse') || t.includes('beacon')) {
    return 'lighthouse';
  }
  if (t.includes('oppidum')) {
    return 'fort';
  }
  // Default for market towns, roman colonies, greek colonies, road junction towns
  return 'town';
}

// ─── Procedural Canvas Drawers ──────────────────────────────────────────────

// 1. CITY: Grand domed basilica, pediments, colonnaded wings, cypress trees
function drawCity(ctx, x, y, s) {
  const w = s * 1.5;
  const h = s * 1.1;
  const bx = x - w / 2;
  const by = y + h * 0.45;

  // Central Dome
  ctx.beginPath();
  ctx.arc(x, by - h * 0.55, w * 0.22, Math.PI, 0);
  ctx.fill();
  // Dome Finial / Lantern
  ctx.fillRect(x - w * 0.04, by - h * 0.85, w * 0.08, h * 0.12);
  ctx.beginPath();
  ctx.arc(x, by - h * 0.86, w * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Central Drum / Colonnade under Dome
  ctx.fillRect(x - w * 0.22, by - h * 0.55, w * 0.44, h * 0.25);

  // Left Multi-story Buildings
  ctx.fillRect(bx + w * 0.05, by - h * 0.35, w * 0.24, h * 0.35);
  // Pitched Roof Left
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.02, by - h * 0.35);
  ctx.lineTo(bx + w * 0.17, by - h * 0.52);
  ctx.lineTo(bx + w * 0.31, by - h * 0.35);
  ctx.closePath();
  ctx.fill();

  // Right Multi-story Buildings
  ctx.fillRect(bx + w * 0.72, by - h * 0.32, w * 0.23, h * 0.32);
  // Pitched Roof Right
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.69, by - h * 0.32);
  ctx.lineTo(bx + w * 0.83, by - h * 0.48);
  ctx.lineTo(bx + w * 0.97, by - h * 0.32);
  ctx.closePath();
  ctx.fill();

  // Central Portico / Gateway Arch
  ctx.fillRect(x - w * 0.26, by - h * 0.32, w * 0.52, h * 0.32);
  // Triangular Pediment over Portico
  ctx.beginPath();
  ctx.moveTo(x - w * 0.28, by - h * 0.32);
  ctx.lineTo(x, by - h * 0.46);
  ctx.lineTo(x + w * 0.28, by - h * 0.32);
  ctx.closePath();
  ctx.fill();

  // Cypress Trees on Far Flanks
  drawCypress(ctx, bx - w * 0.02, by, h * 0.55, w * 0.09);
  drawCypress(ctx, bx + w * 1.02, by, h * 0.55, w * 0.09);
}

// 2. FORT: Curtain wall, twin crenellated towers, central keep with standard/flag, arched gate
function drawFort(ctx, x, y, s) {
  const w = s * 1.45;
  const h = s * 0.95;
  const bx = x - w / 2;
  const by = y + h * 0.45;

  // Curtain Wall
  ctx.fillRect(bx + w * 0.2, by - h * 0.5, w * 0.6, h * 0.5);

  // Left Bastion Tower
  ctx.fillRect(bx, by - h * 0.72, w * 0.24, h * 0.72);
  // Left Crenellations
  ctx.fillRect(bx - w * 0.02, by - h * 0.82, w * 0.09, h * 0.1);
  ctx.fillRect(bx + w * 0.09, by - h * 0.82, w * 0.08, h * 0.1);
  ctx.fillRect(bx + w * 0.19, by - h * 0.82, w * 0.09, h * 0.1);

  // Right Bastion Tower
  ctx.fillRect(bx + w * 0.76, by - h * 0.72, w * 0.24, h * 0.72);
  // Right Crenellations
  ctx.fillRect(bx + w * 0.74, by - h * 0.82, w * 0.09, h * 0.1);
  ctx.fillRect(bx + w * 0.85, by - h * 0.82, w * 0.08, h * 0.1);
  ctx.fillRect(bx + w * 0.95, by - h * 0.82, w * 0.09, h * 0.1);

  // Central Keep Tower
  ctx.fillRect(x - w * 0.14, by - h * 0.75, w * 0.28, h * 0.35);
  // Central Keep Crenellations
  ctx.fillRect(x - w * 0.16, by - h * 0.85, w * 0.1, h * 0.1);
  ctx.fillRect(x + w * 0.06, by - h * 0.85, w * 0.1, h * 0.1);

  // Standard / Flag on Central Keep
  ctx.fillRect(x - w * 0.02, by - h * 1.08, w * 0.04, h * 0.25);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.02, by - h * 1.08);
  ctx.lineTo(x + w * 0.16, by - h * 1.01);
  ctx.lineTo(x + w * 0.02, by - h * 0.94);
  ctx.closePath();
  ctx.fill();

  // Arched Portcullis / Gate
  ctx.beginPath();
  ctx.arc(x, by - h * 0.26, w * 0.1, Math.PI, 0);
  ctx.lineTo(x + w * 0.1, by);
  ctx.lineTo(x - w * 0.1, by);
  ctx.closePath();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  ctx.restore();
}

// 3. TOWN: Clustered Italian hill houses with square campanile/tower, tiled roofs, cypress
function drawTown(ctx, x, y, s) {
  const w = s * 1.45;
  const h = s * 1.05;
  const bx = x - w / 2;
  const by = y + h * 0.45;

  // Tall Square Campanile (Bell Tower)
  ctx.fillRect(bx + w * 0.62, by - h * 0.75, w * 0.22, h * 0.75);
  // Campanile Pyramid Roof
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.59, by - h * 0.75);
  ctx.lineTo(bx + w * 0.73, by - h * 0.96);
  ctx.lineTo(bx + w * 0.87, by - h * 0.75);
  ctx.closePath();
  ctx.fill();

  // Main Town House
  ctx.fillRect(bx + w * 0.12, by - h * 0.5, w * 0.38, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.08, by - h * 0.5);
  ctx.lineTo(bx + w * 0.31, by - h * 0.68);
  ctx.lineTo(bx + w * 0.52, by - h * 0.5);
  ctx.closePath();
  ctx.fill();

  // Lower Forward Houses
  ctx.fillRect(bx + w * 0.28, by - h * 0.3, w * 0.32, h * 0.3);
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.26, by - h * 0.3);
  ctx.lineTo(bx + w * 0.44, by - h * 0.44);
  ctx.lineTo(bx + w * 0.62, by - h * 0.3);
  ctx.closePath();
  ctx.fill();

  // Right Side Annex
  ctx.fillRect(bx + w * 0.68, by - h * 0.32, w * 0.26, h * 0.32);
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.66, by - h * 0.32);
  ctx.lineTo(bx + w * 0.81, by - h * 0.44);
  ctx.lineTo(bx + w * 0.96, by - h * 0.32);
  ctx.closePath();
  ctx.fill();

  // Cypress Trees
  drawCypress(ctx, bx + w * 0.02, by, h * 0.5, w * 0.08);
  drawCypress(ctx, bx + w * 0.97, by, h * 0.55, w * 0.09);
}

// 4. FARM: Roman villa rustica, pitched barn roof, rolling furrowed crop fields, cypress
function drawFarm(ctx, x, y, s) {
  const w = s * 1.5;
  const h = s * 0.95;
  const bx = x - w / 2;
  const by = y + h * 0.45;

  // Farmhouse Body
  ctx.fillRect(bx + w * 0.3, by - h * 0.58, w * 0.38, h * 0.35);
  // Pitched Roof
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.26, by - h * 0.58);
  ctx.lineTo(bx + w * 0.49, by - h * 0.82);
  ctx.lineTo(bx + w * 0.72, by - h * 0.58);
  ctx.closePath();
  ctx.fill();

  // Attached Granary / Shed
  ctx.fillRect(bx + w * 0.65, by - h * 0.42, w * 0.22, h * 0.22);
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.63, by - h * 0.42);
  ctx.lineTo(bx + w * 0.76, by - h * 0.55);
  ctx.lineTo(bx + w * 0.89, by - h * 0.42);
  ctx.closePath();
  ctx.fill();

  // Arched Barn Door
  ctx.beginPath();
  ctx.arc(bx + w * 0.48, by - h * 0.32, w * 0.07, Math.PI, 0);
  ctx.lineTo(bx + w * 0.55, by - h * 0.23);
  ctx.lineTo(bx + w * 0.41, by - h * 0.23);
  ctx.closePath();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();
  ctx.restore();

  // Rolling Furrowed Fields (Curved Lines)
  ctx.lineWidth = Math.max(1.2, s * 0.09);
  ctx.beginPath();
  ctx.arc(x - w * 0.1, by + h * 0.6, w * 0.75, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - w * 0.05, by + h * 0.85, w * 0.95, Math.PI * 1.18, Math.PI * 1.82);
  ctx.stroke();

  // Cypress Trees
  drawCypress(ctx, bx + w * 0.1, by - h * 0.2, h * 0.45, w * 0.08);
  drawCypress(ctx, bx + w * 0.2, by - h * 0.2, h * 0.55, w * 0.09);
  drawCypress(ctx, bx + w * 0.94, by - h * 0.2, h * 0.5, w * 0.08);
}

// 5. TEMPLE: Hexastyle classical columns, triangular pediment, entablature, stepped base
function drawTemple(ctx, x, y, s) {
  const w = s * 1.35;
  const h = s * 1.05;
  const bx = x - w / 2;
  const by = y + h * 0.45;

  // Stepped Stylobate (3 steps)
  ctx.fillRect(bx, by - h * 0.06, w, h * 0.06);
  ctx.fillRect(bx + w * 0.04, by - h * 0.12, w * 0.92, h * 0.06);
  ctx.fillRect(bx + w * 0.08, by - h * 0.17, w * 0.84, h * 0.05);

  // 4 Fluted Columns
  const colW = w * 0.11;
  const colH = h * 0.48;
  const colY = by - h * 0.17 - colH;
  const gap = (w * 0.84 - colW * 4) / 3;
  for (let i = 0; i < 4; i++) {
    const cx = bx + w * 0.08 + i * (colW + gap);
    ctx.fillRect(cx, colY, colW, colH);
    // Column Base & Capital
    ctx.fillRect(cx - colW * 0.15, colY + colH - h * 0.03, colW * 1.3, h * 0.03);
    ctx.fillRect(cx - colW * 0.15, colY, colW * 1.3, h * 0.03);
  }

  // Entablature / Architrave
  const entY = colY - h * 0.1;
  ctx.fillRect(bx + w * 0.06, entY, w * 0.88, h * 0.1);

  // Triangular Pediment / Tympanum
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.03, entY);
  ctx.lineTo(x, entY - h * 0.24);
  ctx.lineTo(bx + w * 0.97, entY);
  ctx.closePath();
  ctx.fill();

  // Acroterion Finial at peak
  ctx.fillRect(x - w * 0.03, entY - h * 0.29, w * 0.06, h * 0.06);
}

// 6. HARBOR: Lighthouse tower / mole with arches, Roman galley / trireme with square sail on ocean waves
function drawHarbor(ctx, x, y, s) {
  const w = s * 1.5;
  const h = s * 1.05;
  const bx = x - w / 2;
  const by = y + h * 0.45;

  // Sea Wall / Mole on Left
  ctx.fillRect(bx + w * 0.05, by - h * 0.42, w * 0.5, h * 0.28);
  // Arched Gates in Mole
  ctx.beginPath();
  ctx.arc(bx + w * 0.22, by - h * 0.18, w * 0.09, Math.PI, 0);
  ctx.arc(bx + w * 0.42, by - h * 0.18, w * 0.09, Math.PI, 0);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();
  ctx.restore();

  // Lighthouse Beacon on Mole
  ctx.fillRect(bx + w * 0.08, by - h * 0.8, w * 0.14, h * 0.4);
  ctx.fillRect(bx + w * 0.05, by - h * 0.88, w * 0.2, h * 0.08);
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.06, by - h * 0.88);
  ctx.lineTo(bx + w * 0.15, by - h * 0.98);
  ctx.lineTo(bx + w * 0.24, by - h * 0.88);
  ctx.closePath();
  ctx.fill();

  // Ancient Roman Galley / Trireme
  const gx = bx + w * 0.62;
  const gy = by - h * 0.2;
  // Curved Hull
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.quadraticCurveTo(gx + w * 0.15, gy + h * 0.18, gx + w * 0.35, gy - h * 0.05);
  ctx.lineTo(gx + w * 0.31, gy - h * 0.12);
  ctx.quadraticCurveTo(gx + w * 0.15, gy + h * 0.08, gx + w * 0.02, gy - h * 0.08);
  ctx.closePath();
  ctx.fill();

  // Mast & Square Sail
  ctx.fillRect(gx + w * 0.16, gy - h * 0.58, w * 0.03, h * 0.45);
  ctx.beginPath();
  ctx.moveTo(gx + w * 0.06, gy - h * 0.52);
  ctx.quadraticCurveTo(gx + w * 0.2, gy - h * 0.48, gx + w * 0.28, gy - h * 0.52);
  ctx.lineTo(gx + w * 0.31, gy - h * 0.22);
  ctx.quadraticCurveTo(gx + w * 0.2, gy - h * 0.18, gx + w * 0.04, gy - h * 0.22);
  ctx.closePath();
  ctx.fill();

  // Ocean Waves
  ctx.lineWidth = Math.max(1.2, s * 0.08);
  drawWave(ctx, bx, by + h * 0.04, w);
  drawWave(ctx, bx, by + h * 0.16, w);
}

// 7. MOUNTAIN VILLAGE: Alpine mountain peaks, stone huts with chimneys, pine trees
function drawMountainVillage(ctx, x, y, s) {
  const w = s * 1.5;
  const h = s * 1.1;
  const bx = x - w / 2;
  const by = y + h * 0.45;

  // Mountain Peaks in Background
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.05, by - h * 0.25);
  ctx.lineTo(bx + w * 0.38, by - h * 0.95);
  ctx.lineTo(bx + w * 0.65, by - h * 0.45);
  ctx.lineTo(bx + w * 0.85, by - h * 0.82);
  ctx.lineTo(bx + w * 0.98, by - h * 0.25);
  ctx.closePath();
  ctx.save();
  ctx.fillStyle = 'rgba(140, 80, 50, 0.45)';
  ctx.fill();
  ctx.restore();

  // Village Houses
  ctx.fillRect(bx + w * 0.25, by - h * 0.42, w * 0.28, h * 0.32);
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.22, by - h * 0.42);
  ctx.lineTo(bx + w * 0.39, by - h * 0.58);
  ctx.lineTo(bx + w * 0.56, by - h * 0.42);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(bx + w * 0.52, by - h * 0.32, w * 0.24, h * 0.26);
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.5, by - h * 0.32);
  ctx.lineTo(bx + w * 0.64, by - h * 0.46);
  ctx.lineTo(bx + w * 0.78, by - h * 0.32);
  ctx.closePath();
  ctx.fill();

  // Pine / Cypress Trees
  drawCypress(ctx, bx + w * 0.08, by - h * 0.05, h * 0.5, w * 0.09);
  drawCypress(ctx, bx + w * 0.88, by - h * 0.05, h * 0.55, w * 0.09);
}

// 8. BRIDGE: Roman monumental stone arched bridge, roadway, piers, flowing river waves
function drawBridge(ctx, x, y, s) {
  const w = s * 1.5;
  const h = s * 0.85;
  const bx = x - w / 2;
  const by = y + h * 0.45;

  // Roadway Deck & Parapets
  ctx.fillRect(bx, by - h * 0.65, w, h * 0.16);

  // Left & Right Piers / Towers
  ctx.fillRect(bx, by - h * 0.82, w * 0.16, h * 0.82);
  ctx.fillRect(bx + w * 0.84, by - h * 0.82, w * 0.16, h * 0.82);

  // Pier tops / merlons
  ctx.fillRect(bx - w * 0.02, by - h * 0.9, w * 0.2, h * 0.09);
  ctx.fillRect(bx + w * 0.82, by - h * 0.9, w * 0.2, h * 0.09);

  // Semicircular Stone Arch
  ctx.fillRect(bx + w * 0.16, by - h * 0.55, w * 0.68, h * 0.55);
  ctx.beginPath();
  ctx.arc(x, by, w * 0.32, Math.PI, 0);
  ctx.closePath();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  ctx.restore();

  // River Waves underneath
  ctx.lineWidth = Math.max(1.2, s * 0.08);
  drawWave(ctx, bx, by + h * 0.12, w);
}

// 9. FOREST: Grove of classical umbrella pines and tall cypresses on a mound
function drawForest(ctx, x, y, s) {
  const w = s * 1.45;
  const h = s * 1.05;
  const bx = x - w / 2;
  const by = y + h * 0.45;

  // Grassy Mound / Hillock
  ctx.beginPath();
  ctx.arc(x, by + h * 0.45, w * 0.6, Math.PI * 1.25, Math.PI * 1.75);
  ctx.fill();

  // Tall Cypresses on Flanks
  drawCypress(ctx, bx + w * 0.08, by - h * 0.05, h * 0.65, w * 0.09);
  drawCypress(ctx, bx + w * 0.92, by - h * 0.05, h * 0.7, w * 0.09);

  // Roman Umbrella Pines (Round Stone Pines)
  // Left Pine
  ctx.fillRect(bx + w * 0.26, by - h * 0.55, w * 0.04, h * 0.45);
  ctx.beginPath();
  ctx.arc(bx + w * 0.28, by - h * 0.62, w * 0.17, 0, Math.PI * 2);
  ctx.fill();

  // Center Tall Pine
  ctx.fillRect(x - w * 0.02, by - h * 0.72, w * 0.04, h * 0.6);
  ctx.beginPath();
  ctx.arc(x, by - h * 0.8, w * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Right Pine
  ctx.fillRect(bx + w * 0.7, by - h * 0.55, w * 0.04, h * 0.45);
  ctx.beginPath();
  ctx.arc(bx + w * 0.72, by - h * 0.62, w * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

// 10. DESERT: Adobe mudbrick dwelling with dome, date palm tree, cactus, sand dunes
function drawDesert(ctx, x, y, s) {
  const w = s * 1.5;
  const h = s * 1.05;
  const bx = x - w / 2;
  const by = y + h * 0.45;

  // Undulating Sand Dunes
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(bx + w * 0.35, by - h * 0.15, bx + w * 0.7, by + h * 0.05);
  ctx.quadraticCurveTo(bx + w * 0.85, by - h * 0.1, bx + w, by);
  ctx.lineTo(bx + w, by + h * 0.1);
  ctx.lineTo(bx, by + h * 0.1);
  ctx.closePath();
  ctx.fill();

  // Mudbrick Adobe House
  ctx.fillRect(bx + w * 0.35, by - h * 0.48, w * 0.32, h * 0.38);
  // Domed Roof
  ctx.beginPath();
  ctx.arc(bx + w * 0.48, by - h * 0.48, w * 0.11, Math.PI, 0);
  ctx.fill();
  // Arched Door
  ctx.beginPath();
  ctx.arc(bx + w * 0.52, by - h * 0.22, w * 0.06, Math.PI, 0);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  ctx.restore();

  // Palm Tree on Right
  const px = bx + w * 0.82;
  const py = by - h * 0.15;
  // Curved Trunk
  ctx.beginPath();
  ctx.moveTo(px - w * 0.02, py);
  ctx.quadraticCurveTo(px + w * 0.02, py - h * 0.4, px + w * 0.05, py - h * 0.65);
  ctx.lineTo(px + w * 0.09, py - h * 0.65);
  ctx.quadraticCurveTo(px + w * 0.05, py - h * 0.4, px + w * 0.02, py);
  ctx.closePath();
  ctx.fill();
  // Palm Fronds
  const fx = px + w * 0.07;
  const fy = py - h * 0.65;
  drawFrond(ctx, fx, fy, -w * 0.16, -h * 0.15);
  drawFrond(ctx, fx, fy, w * 0.16, -h * 0.12);
  drawFrond(ctx, fx, fy, -w * 0.14, h * 0.1);
  drawFrond(ctx, fx, fy, w * 0.15, h * 0.1);
  drawFrond(ctx, fx, fy, 0, -h * 0.22);
}

// 11. QUARRY: Stepped cut-stone cliff face, ashlar blocks, column drums, shelter
function drawQuarry(ctx, x, y, s) {
  const w = s * 1.5;
  const h = s * 1.05;
  const bx = x - w / 2;
  const by = y + h * 0.45;

  // Stepped Rocky Escarpment
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + w * 0.08, by - h * 0.7);
  ctx.lineTo(bx + w * 0.28, by - h * 0.85);
  ctx.lineTo(bx + w * 0.48, by - h * 0.6);
  ctx.lineTo(bx + w * 0.52, by - h * 0.35);
  ctx.lineTo(bx + w * 0.72, by - h * 0.35);
  ctx.lineTo(bx + w * 0.75, by - h * 0.15);
  ctx.lineTo(bx + w, by - h * 0.15);
  ctx.lineTo(bx + w, by);
  ctx.closePath();
  ctx.fill();

  // Extraction Hut / Shelter
  ctx.fillRect(bx + w * 0.52, by - h * 0.35, w * 0.18, h * 0.35);
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.48, by - h * 0.35);
  ctx.lineTo(bx + w * 0.61, by - h * 0.48);
  ctx.lineTo(bx + w * 0.73, by - h * 0.35);
  ctx.closePath();
  ctx.fill();

  // Classical Column Drums in Ruins / Waiting for transport
  ctx.fillRect(bx + w * 0.75, by - h * 0.35, w * 0.05, h * 0.25);
  ctx.fillRect(bx + w * 0.83, by - h * 0.35, w * 0.05, h * 0.25);
  ctx.fillRect(bx + w * 0.91, by - h * 0.35, w * 0.05, h * 0.25);
  ctx.fillRect(bx + w * 0.73, by - h * 0.4, w * 0.25, h * 0.06);
}

// 12. LIGHTHOUSE: Pharos-style stone beacon tower on sea crag, lantern room, cottage, ocean waves
function drawLighthouse(ctx, x, y, s) {
  const w = s * 1.35;
  const h = s * 1.15;
  const bx = x - w / 2;
  const by = y + h * 0.45;

  // Rocky Sea Crag Base
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.1, by);
  ctx.lineTo(bx + w * 0.22, by - h * 0.2);
  ctx.lineTo(bx + w * 0.75, by - h * 0.2);
  ctx.lineTo(bx + w * 0.92, by);
  ctx.closePath();
  ctx.fill();

  // Tapered Stone Lighthouse Tower
  const tx = bx + w * 0.35;
  const ty = by - h * 0.2;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + w * 0.04, ty - h * 0.52);
  ctx.lineTo(tx + w * 0.22, ty - h * 0.52);
  ctx.lineTo(tx + w * 0.26, ty);
  ctx.closePath();
  ctx.fill();

  // Lantern Gallery / Balcony
  ctx.fillRect(tx - w * 0.02, ty - h * 0.58, w * 0.3, h * 0.06);
  // Lantern Glass Room
  ctx.fillRect(tx + w * 0.02, ty - h * 0.72, w * 0.22, h * 0.14);
  // Conical Lantern Roof & Spire
  ctx.beginPath();
  ctx.moveTo(tx, ty - h * 0.72);
  ctx.lineTo(tx + w * 0.13, ty - h * 0.9);
  ctx.lineTo(tx + w * 0.26, ty - h * 0.72);
  ctx.closePath();
  ctx.fill();

  // Keeper's Cottage on Right
  ctx.fillRect(bx + w * 0.62, by - h * 0.35, w * 0.22, h * 0.15);
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.6, by - h * 0.35);
  ctx.lineTo(bx + w * 0.73, by - h * 0.45);
  ctx.lineTo(bx + w * 0.86, by - h * 0.35);
  ctx.closePath();
  ctx.fill();

  // Ocean Waves
  ctx.lineWidth = Math.max(1.2, s * 0.08);
  drawWave(ctx, bx, by + h * 0.08, w);
}

// ─── Shared Helper Drawers ──────────────────────────────────────────────────

function drawCypress(ctx, cx, cy, h, w) {
  // Slender Italian Cypress
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.quadraticCurveTo(cx - w, cy - h * 0.5, cx, cy - h);
  ctx.quadraticCurveTo(cx + w, cy - h * 0.5, cx + w / 2, cy);
  ctx.closePath();
  ctx.fill();
}

function drawWave(ctx, x, y, w) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  const segments = 4;
  const segW = w / segments;
  for (let i = 0; i < segments; i++) {
    const sx = x + i * segW;
    ctx.quadraticCurveTo(sx + segW * 0.5, y - segW * 0.25, sx + segW, y);
  }
  ctx.stroke();
}

function drawFrond(ctx, fx, fy, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.quadraticCurveTo(fx + dx * 0.5, fy + dy * 0.3, fx + dx, fy + dy);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ─── Master Site Vector Renderer ────────────────────────────────────────────

export function drawSiteVectorIcon(ctx, x, y, type, size, options = {}) {
  const category = getSiteCategory(type);
  const {
    isHovered = false,
    isSelected = false,
    isRomeOwned = false,
    color = '#8b4b2c', // Classical Terracotta
    stroke = '#3a1f12',
  } = options;

  ctx.save();

  // Terracotta & Antique styling based on state
  let fillCol = color;
  let strokeCol = stroke;

  if (isRomeOwned) {
    fillCol = '#c0392b'; // Roman Crimson
    strokeCol = '#ffd700'; // Gold rim
  }
  if (isSelected) {
    fillCol = '#ffd700';
    strokeCol = '#fff';
  } else if (isHovered) {
    fillCol = '#e59866';
    strokeCol = '#fff';
  }

  ctx.fillStyle = fillCol;
  ctx.strokeStyle = strokeCol;

  // Render appropriate icon based on category
  switch (category) {
    case 'city':
      drawCity(ctx, x, y, size);
      break;
    case 'fort':
      drawFort(ctx, x, y, size);
      break;
    case 'farm':
      drawFarm(ctx, x, y, size);
      break;
    case 'temple':
      drawTemple(ctx, x, y, size);
      break;
    case 'harbor':
      drawHarbor(ctx, x, y, size);
      break;
    case 'mountain_village':
      drawMountainVillage(ctx, x, y, size);
      break;
    case 'bridge':
      drawBridge(ctx, x, y, size);
      break;
    case 'forest':
      drawForest(ctx, x, y, size);
      break;
    case 'desert':
      drawDesert(ctx, x, y, size);
      break;
    case 'quarry':
      drawQuarry(ctx, x, y, size);
      break;
    case 'lighthouse':
      drawLighthouse(ctx, x, y, size);
      break;
    case 'town':
    default:
      drawTown(ctx, x, y, size);
      break;
  }

  ctx.restore();
}
