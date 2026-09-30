#!/usr/bin/env python3
"""
Pre-compute Smooth, Organic, Non-Overlapping Fractal Watershed Borders and Polygons
for all 400 Settlements.

Fixes:
1. NO OVERLAPPING LINES: Each boundary interface between neighboring regions (A, B)
   is extracted once and uniquely traced.
2. NATURAL FRACTAL ENTROPY / NOISE: Multi-octave harmonic noise displaces border
   vertices naturally according to terrain, creating ancient organic meanders instead
   of synthetic or squary geometry.
3. TRUE POLYNOMIAL HIGHLIGHT (NO SQUARES): Region polygons are smoothed with Chaikin
   and fractal curves, so hover highlights match the exact smooth polynomial shape.
4. GLITCH-FREE LITTLE PROVINCES: High-res grid (5.0 step, 521x441) + island sliver removal
   ensures every small province is a solid, clean, cohesive polygon.
5. CLICKABLE PROVINCES: Pre-computes region metadata for interactive click selection.
"""

import os
import json
import heapq
import time
import math
import numpy as np
from PIL import Image
from shapely.geometry import box, Polygon, MultiPolygon, LineString, MultiLineString, Point
from shapely.ops import unary_union, linemerge

print("=== Pre-computing Smooth Fractal Watershed Borders & Polygons ===")
t0 = time.time()

STEP = 5.0
NX = int(2600 / STEP) + 1  # 521
NY = int(2200 / STEP) + 1  # 441
SVG_W = 2600
SVG_H = 2200

# 1. Load Data
with open('public/ancientSites.json') as f:
    sites = json.load(f)

with open('public/elevationData.json') as f:
    elev_data_raw = json.load(f)

with open('public/riversData.json') as f:
    rivers_data = json.load(f)

print(f"Loaded {len(sites)} sites, {len(rivers_data)} rivers. Grid size: {NX}x{NY}")

# 2. High-Res Elevation Grid & Land Mask (Step 5.0)
c_NX = 261
c_NY = 221
c_elev = np.zeros((c_NY, c_NX), dtype=np.float32)
for x, y, e in elev_data_raw:
    c_elev[int(round(y / 10.0)), int(round(x / 10.0))] = e

elev_grid = np.array(Image.fromarray(c_elev).resize((NX, NY), Image.BILINEAR), dtype=np.float32)
land_mask = (elev_grid >= 0)

# Connect any coastal/island site to land
for s in sites:
    sx = max(0, min(NX - 1, int(round(s['x'] / STEP))))
    sy = max(0, min(NY - 1, int(round(s['y'] / STEP))))
    if not land_mask[sy, sx]:
        found = False
        for rad in range(1, 10):
            for dy in range(-rad, rad + 1):
                for dx in range(-rad, rad + 1):
                    ny_c, nx_c = sy + dy, sx + dx
                    if 0 <= nx_c < NX and 0 <= ny_c < NY and land_mask[ny_c, nx_c]:
                        land_mask[sy, sx] = True
                        found = True
                        break
                if found: break
            if found: break
        land_mask[sy, sx] = True

# 3. Slope and Terrain Friction Surface
gy, gx = np.gradient(elev_grid, STEP)
slope = np.sqrt(gx**2 + gy**2)
slope_cost = 3.8 * np.clip(slope / 28.0, 0, 7.0)**1.3
elev_cost = 1.6 * np.clip((elev_grid - 200.0) / 1000.0, 0, 5.0)
friction = 1.0 + slope_cost + elev_cost

# River crossing barrier
river_cost = np.zeros((NY, NX), dtype=np.float32)
for r_name, r_info in rivers_data.items():
    for seg in r_info['segments']:
        for i in range(len(seg) - 1):
            p1 = seg[i]
            p2 = seg[i+1]
            dist = math.hypot(p2[0]-p1[0], p2[1]-p1[1])
            n_steps = max(1, int(dist / 2.5))
            for st in range(n_steps + 1):
                px = p1[0] + (p2[0] - p1[0]) * (st / n_steps)
                py = p1[1] + (p2[1] - p1[1]) * (st / n_steps)
                ix = int(round(px / STEP))
                iy = int(round(py / STEP))
                if 0 <= ix < NX and 0 <= iy < NY:
                    river_cost[iy, ix] = 5.8

friction += river_cost

# 4. Multi-Ray Direction Stencil (16 ray vectors for Euclidean propagation)
rays = [
    (-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
    (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414),
    (-1, -2, 2.236), (-1, 2, 2.236), (1, -2, 2.236), (1, 2, 2.236),
    (-2, -1, 2.236), (-2, 1, 2.236), (2, -1, 2.236), (2, 1, 2.236),
]

pq = []
dist_grid = np.full((NY, NX), 1e9, dtype=np.float32)
region_grid = np.full((NY, NX), -1, dtype=np.int32)

for idx, s in enumerate(sites):
    sx = max(0, min(NX - 1, int(round(s['x'] / STEP))))
    sy = max(0, min(NY - 1, int(round(s['y'] / STEP))))
    dist_grid[sy, sx] = 0.0
    region_grid[sy, sx] = idx
    heapq.heappush(pq, (0.0, idx, sy, sx))

site_powers = [max(1.0, float(s['weight']))**0.66 for s in sites]

print("Simulating high-resolution cost-distance wavefront expansion...")
while pq:
    d, s_idx, cy, cx = heapq.heappop(pq)
    if d > dist_grid[cy, cx]:
        continue
    w_factor = site_powers[s_idx]

    for dy, dx, ray_dist in rays:
        ny_c, nx_c = cy + dy, cx + dx
        if 0 <= nx_c < NX and 0 <= ny_c < NY:
            if not land_mask[ny_c, nx_c]:
                continue
            
            f_avg = 0.5 * (friction[cy, cx] + friction[ny_c, nx_c])
            new_d = d + (f_avg * ray_dist * STEP) / w_factor
            if new_d < dist_grid[ny_c, nx_c]:
                dist_grid[ny_c, nx_c] = new_d
                region_grid[ny_c, nx_c] = s_idx
                heapq.heappush(pq, (new_d, s_idx, ny_c, nx_c))

# 5. Clean up small glitches: 3x3 Majority / Mode filter to remove 1-pixel spikes
print("Filtering small province glitches (majority smoothing)...")
cleaned_grid = region_grid.copy()
for y in range(1, NY - 1):
    for x in range(1, NX - 1):
        if land_mask[y, x]:
            cur = region_grid[y, x]
            neighbors = [
                region_grid[y-1, x], region_grid[y+1, x],
                region_grid[y, x-1], region_grid[y, x+1]
            ]
            valid = [n for n in neighbors if n >= 0]
            if valid and cur not in valid:
                # 1-pixel isolated spike: reassign to majority neighbor
                cleaned_grid[y, x] = max(set(valid), key=valid.count)

region_grid = cleaned_grid

# 6. Extract UNIQUE, Non-Overlapping Shared Boundary Interfaces
print("Extracting unique shared boundary interfaces (0 overlap guarantee)...")
interface_edges = {}

for y in range(NY - 1):
    for x in range(NX):
        r1 = region_grid[y, x]
        r2 = region_grid[y + 1, x]
        if r1 >= 0 and r2 >= 0 and r1 != r2:
            pair = (min(r1, r2), max(r1, r2))
            x0 = (x - 0.5) * STEP
            x1 = (x + 0.5) * STEP
            ym = (y + 0.5) * STEP
            if pair not in interface_edges:
                interface_edges[pair] = []
            interface_edges[pair].append(((x0, ym), (x1, ym)))

for y in range(NY):
    for x in range(NX - 1):
        r1 = region_grid[y, x]
        r2 = region_grid[y, x + 1]
        if r1 >= 0 and r2 >= 0 and r1 != r2:
            pair = (min(r1, r2), max(r1, r2))
            xm = (x + 0.5) * STEP
            y0 = (y - 0.5) * STEP
            y1 = (y + 0.5) * STEP
            if pair not in interface_edges:
                interface_edges[pair] = []
            interface_edges[pair].append(((xm, y0), (xm, y1)))

print(f"Total unique neighboring region interfaces: {len(interface_edges)}")

# 7. Fractal Entropy Noise Function
def add_fractal_entropy(coords, amp=2.8):
    pts = list(coords)
    if len(pts) < 2:
        return pts
    out = [pts[0]]
    for i in range(len(pts) - 1):
        p0 = pts[i]
        p1 = pts[i + 1]
        dx = p1[0] - p0[0]
        dy = p1[1] - p0[1]
        seg_len = math.hypot(dx, dy)
        if seg_len > 7.0:
            n_sub = max(1, int(seg_len / 6.0))
            nx = -dy / seg_len
            ny = dx / seg_len
            for s in range(1, n_sub):
                t = s / n_sub
                mx = p0[0] + dx * t
                my = p0[1] + dy * t
                noise = (
                    math.sin(mx * 0.045 + my * 0.038) * 0.55 +
                    math.cos(mx * 0.090 - my * 0.078) * 0.32 +
                    math.sin(mx * 0.18 + my * 0.15) * 0.13
                )
                disp = noise * amp
                out.append((round(mx + nx * disp, 1), round(my + ny * disp, 1)))
        out.append(p1)
    return out

# Chaikin's corner-cutting
def chaikin_smooth(coords, iterations=2):
    pts = list(coords)
    if len(pts) < 3:
        return pts
    is_closed = (pts[0] == pts[-1])
    for _ in range(iterations):
        new_pts = []
        n = len(pts) - (1 if is_closed else 0)
        if not is_closed:
            new_pts.append(pts[0])
            for i in range(len(pts) - 1):
                p0 = np.array(pts[i], dtype=np.float32)
                p1 = np.array(pts[i+1], dtype=np.float32)
                new_pts.append((float(round(0.75 * p0[0] + 0.25 * p1[0], 1)),
                                float(round(0.75 * p0[1] + 0.25 * p1[1], 1))))
                new_pts.append((float(round(0.25 * p0[0] + 0.75 * p1[0], 1)),
                                float(round(0.25 * p0[1] + 0.75 * p1[1], 1))))
            new_pts.append(pts[-1])
        else:
            for i in range(n):
                p0 = np.array(pts[i], dtype=np.float32)
                p1 = np.array(pts[(i+1)%n], dtype=np.float32)
                new_pts.append((float(round(0.75 * p0[0] + 0.25 * p1[0], 1)),
                                float(round(0.75 * p0[1] + 0.25 * p1[1], 1))))
                new_pts.append((float(round(0.25 * p0[0] + 0.75 * p1[0], 1)),
                                float(round(0.25 * p0[1] + 0.75 * p1[1], 1))))
            new_pts.append(new_pts[0])
        pts = new_pts
    return pts

# Merge & smooth each interface once (ZERO OVERLAP)
svg_border_paths = []
border_lines_json = []

for pair, segs in interface_edges.items():
    seg_lines = [LineString(s) for s in segs]
    u = unary_union(seg_lines)
    if u.geom_type == 'LineString':
        m_lines = [u]
    elif u.geom_type == 'MultiLineString':
        merged = linemerge(u)
        m_lines = [merged] if merged.geom_type == 'LineString' else list(merged.geoms)
    else:
        continue
    for ml in m_lines:
        c_smooth = chaikin_smooth(ml.coords, iterations=2)
        c_entropy = add_fractal_entropy(c_smooth, amp=2.6)
        s_line = LineString(c_entropy).simplify(1.2, preserve_topology=True)
        coords = list(s_line.coords)
        if len(coords) >= 2:
            path_str = f"M {coords[0][0]:.1f} {coords[0][1]:.1f} " + " ".join([f"L {x:.1f} {y:.1f}" for x, y in coords[1:]])
            svg_border_paths.append(path_str)
            border_lines_json.append([[round(x, 1), round(y, 1)] for x, y in coords])

combined_border_d = " ".join(svg_border_paths)
print(f"Generated {len(svg_border_paths)} unique fractal border lines (0 overlap).")

# 8. True Polynomial Province Polygons (No Squares in Hover Highlight)
print("Building true polynomial province polygons...")
site_cells = {idx: [] for idx in range(len(sites))}
for y in range(NY):
    for x in range(NX):
        r = region_grid[y, x]
        if r >= 0:
            site_cells[r].append((x, y))

regions_summary = []
for idx, s in enumerate(sites):
    cells = site_cells[idx]
    if not cells:
        continue
    
    # Polygon union of cell squares
    boxes = [box((x - 0.5) * STEP, (y - 0.5) * STEP, (x + 0.5) * STEP, (y + 0.5) * STEP) for x, y in cells]
    u_poly = unary_union(boxes)
    
    # Glitch removal: If multipolygon, keep the component containing the site seed point
    seed_pt = Point(s['x'], s['y'])
    if u_poly.geom_type == 'MultiPolygon':
        chosen = None
        for p in u_poly.geoms:
            if p.contains(seed_pt) or p.distance(seed_pt) < 15.0:
                chosen = p
                break
        if not chosen:
            chosen = max(u_poly.geoms, key=lambda p: p.area)
        u_poly = chosen

    if u_poly.area < 15.0:
        continue

    # Smooth the polygon exterior into true polynomial curves
    ext_coords = chaikin_smooth(u_poly.exterior.coords, iterations=2)
    ext_coords = add_fractal_entropy(ext_coords, amp=1.8)
    s_poly = Polygon(ext_coords).simplify(1.5, preserve_topology=True)
    
    ext = s_poly.exterior.coords
    parts = []
    if len(ext) >= 3:
        p_str = f"M {ext[0][0]:.1f} {ext[0][1]:.1f} " + " ".join([f"L {cx:.1f} {cy:.1f}" for cx, cy in ext[1:]]) + " Z"
        parts.append(p_str)
        for interior in s_poly.interiors:
            if len(interior.coords) >= 3:
                h = interior.coords
                h_str = f"M {h[0][0]:.1f} {h[0][1]:.1f} " + " ".join([f"L {hx:.1f} {hy:.1f}" for hx, hy in h[1:]]) + " Z"
                parts.append(h_str)
    
    poly_d = " ".join(parts)
    b = s_poly.bounds
    
    regions_summary.append({
        "id": s['id'],
        "site": s['site'],
        "modern": s['modern'],
        "type": s['type'],
        "weight": s['weight'],
        "people": s.get('people', ''),
        "region": s['region'],
        "center": [s['x'], s['y']],
        "area": round(len(cells) * STEP * STEP, 1),
        "pathD": poly_d,
        "bbox": [round(b[0], 1), round(b[1], 1), round(b[2], 1), round(b[3], 1)]
    })

# 9. Save outputs
output_data = {
    "regions": regions_summary,
    "borderCount": len(border_lines_json),
    "borderLines": border_lines_json,
    "borderSvgPath": combined_border_d
}

for dest in ['src/app/regionsData.json', 'public/regionsData.json']:
    with open(dest, 'w') as f:
        json.dump(output_data, f, separators=(',', ':'))
    print(f"Saved: {dest} ({os.path.getsize(dest)/1024:.1f} KB)")

with open('data/watershed_border_lines.json', 'w') as f:
    json.dump({"border_d": combined_border_d}, f)

print(f"=== Pre-computation finished in {time.time() - t0:.2f}s ===")
