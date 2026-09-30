#!/usr/bin/env python3
"""
Generate Territorial Regions & Vector Borders using Cost-Weighted Distance Algorithm
and Marker-Controlled Watershed Transformation from 200 Ancient Sites.

Features:
- Cost / Friction Surface based on NASA SRTM DEM (elevation + steep slope penalty)
- River barriers (crossing major rivers adds substantial impedance)
- Cost-Weighted expansion based on site Weight (1 to 10)
- Sea cells are strictly impassable (regions NEVER enter the sea)
- High-quality vectorization using Shapely:
  * Generates clean region polygons
  * Generates crisp vector border lines (watershed divides along mountain ridges and rivers)
  * Prepares SVG layers and JSON data for instant interactive rendering
"""

import os
import json
import heapq
import time
import math
import numpy as np
from shapely.geometry import box, Polygon, MultiPolygon, LineString, MultiLineString
from shapely.ops import unary_union, linemerge

print("=== Computing Cost-Weighted Distance & Watershed Regions ===")
t0 = time.time()

NX = 261
NY = 221
STEP = 10.0
SVG_W = 2600
SVG_H = 2200

# 1. Load Data
with open('public/ancientSites.json') as f:
    sites = json.load(f)

with open('public/elevationData.json') as f:
    elev_data = json.load(f)

with open('public/riversData.json') as f:
    rivers_data = json.load(f)

print(f"Loaded {len(sites)} sites, {len(elev_data)} elevation points, {len(rivers_data)} rivers.")

# 2. Build Elevation and Land Mask Grids
elev_grid = np.zeros((NY, NX), dtype=np.float32)
for x, y, e in elev_data:
    ix = int(round(x / STEP))
    iy = int(round(y / STEP))
    if 0 <= ix < NX and 0 <= iy < NY:
        elev_grid[iy, ix] = e

land_mask = (elev_grid >= 0)

# Ensure every site's cell and immediate neighborhood is classified as land
for s in sites:
    sx = int(round(s['x'] / STEP))
    sy = int(round(s['y'] / STEP))
    sx = max(0, min(NX - 1, sx))
    sy = max(0, min(NY - 1, sy))
    if not land_mask[sy, sx]:
        found = False
        for rad in range(1, 6):
            for dy in range(-rad, rad + 1):
                for dx in range(-rad, rad + 1):
                    ny_c, nx_c = sy + dy, sx + dx
                    if 0 <= nx_c < NX and 0 <= ny_c < NY and land_mask[ny_c, nx_c]:
                        land_mask[sy, sx] = True
                        found = True
                        break
                if found:
                    break
            if found:
                break
        if not found:
            land_mask[sy, sx] = True

# 3. Compute Slope and Terrain Cost Surface
gy, gx = np.gradient(elev_grid, STEP)
slope = np.sqrt(gx**2 + gy**2)

# Friction / Cost surface:
# Base friction = 1.0 (flat plains)
# Steep slope friction: up to 8x (mountains act as natural borders)
# High elevation: passes above 1200m cost significantly more
slope_cost = 4.5 * np.clip(slope / 35.0, 0, 7.0)**1.5
elev_cost = 2.0 * np.clip((elev_grid - 200.0) / 1200.0, 0, 6.0)
friction = 1.0 + slope_cost + elev_cost

# River crossing barrier:
# Rasterize major river segments with extra barrier cost
river_cost = np.zeros((NY, NX), dtype=np.float32)
for r_name, r_info in rivers_data.items():
    for seg in r_info['segments']:
        for i in range(len(seg) - 1):
            p1 = seg[i]
            p2 = seg[i+1]
            dist = math.hypot(p2[0]-p1[0], p2[1]-p1[1])
            n_steps = max(1, int(dist / 3.0))
            for st in range(n_steps + 1):
                px = p1[0] + (p2[0] - p1[0]) * (st / n_steps)
                py = p1[1] + (p2[1] - p1[1]) * (st / n_steps)
                ix = int(round(px / STEP))
                iy = int(round(py / STEP))
                if 0 <= ix < NX and 0 <= iy < NY:
                    river_cost[iy, ix] = 5.5 # crossing river has strong impedance

friction += river_cost

# 4. Multi-Source Cost-Weighted Distance & Watershed Transformation
pq = []
dist_grid = np.full((NY, NX), 1e9, dtype=np.float32)
region_grid = np.full((NY, NX), -1, dtype=np.int32)

for idx, s in enumerate(sites):
    sx = int(round(s['x'] / STEP))
    sy = int(round(s['y'] / STEP))
    sx = max(0, min(NX - 1, sx))
    sy = max(0, min(NY - 1, sy))
    dist_grid[sy, sx] = 0.0
    region_grid[sy, sx] = idx
    heapq.heappush(pq, (0.0, idx, sy, sx))

# Weight impedance factor: site with weight 10 travels much easier than weight 2
site_powers = [max(1.0, float(s['weight']))**0.68 for s in sites]

neighbors = [
    (-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
    (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414)
]

print("Simulating cost-distance wavefront expansion...")
while pq:
    d, s_idx, cy, cx = heapq.heappop(pq)
    if d > dist_grid[cy, cx]:
        continue
    w_factor = site_powers[s_idx]

    for dy, dx, step_dist in neighbors:
        ny_c, nx_c = cy + dy, cx + dx
        if 0 <= nx_c < NX and 0 <= ny_c < NY:
            if not land_mask[ny_c, nx_c]:
                continue # strictly stop at sea coastlines!
            
            f_avg = 0.5 * (friction[cy, cx] + friction[ny_c, nx_c])
            step_cost = (f_avg * step_dist * STEP) / w_factor
            new_d = d + step_cost
            
            if new_d < dist_grid[ny_c, nx_c]:
                dist_grid[ny_c, nx_c] = new_d
                region_grid[ny_c, nx_c] = s_idx
                heapq.heappush(pq, (new_d, s_idx, ny_c, nx_c))

# Fill any small disconnected land patches to nearest claimed neighbor
for y in range(NY):
    for x in range(NX):
        if land_mask[y, x] and region_grid[y, x] < 0:
            # find closest claimed cell
            best_d = 1e9
            best_idx = 0
            for dy in range(-4, 5):
                for dx in range(-4, 5):
                    ny_c, nx_c = y + dy, x + dx
                    if 0 <= nx_c < NX and 0 <= ny_c < NY and region_grid[ny_c, nx_c] >= 0:
                        dist = math.hypot(dx, dy)
                        if dist < best_d:
                            best_d = dist
                            best_idx = region_grid[ny_c, nx_c]
            if best_d < 1e9:
                region_grid[y, x] = best_idx

print(f"Watershed completed. Total land cells claimed: {np.sum(region_grid >= 0)}")

# 5. Extract Vector Borders (Watershed Ridge Lines)
print("Extracting vector border segments...")
border_segments = []
# Horizontal segments (between (y, x) and (y+1, x))
for y in range(NY - 1):
    for x in range(NX):
        r1 = region_grid[y, x]
        r2 = region_grid[y + 1, x]
        if r1 >= 0 and r2 >= 0 and r1 != r2:
            x0 = round((x - 0.5) * STEP, 1)
            x1 = round((x + 0.5) * STEP, 1)
            y_mid = round((y + 0.5) * STEP, 1)
            border_segments.append(((x0, y_mid), (x1, y_mid)))

# Vertical segments (between (y, x) and (y, x+1))
for y in range(NY):
    for x in range(NX - 1):
        r1 = region_grid[y, x]
        r2 = region_grid[y, x + 1]
        if r1 >= 0 and r2 >= 0 and r1 != r2:
            y0 = round((y - 0.5) * STEP, 1)
            y1 = round((y + 0.5) * STEP, 1)
            x_mid = round((x + 0.5) * STEP, 1)
            border_segments.append(((x_mid, y0), (x_mid, y1)))

print(f"Total internal border segments: {len(border_segments)}")

# Merge into continuous LineStrings with shapely
lines = [LineString(s) for s in border_segments]
merged_borders = linemerge(unary_union(lines))
border_lines = [merged_borders] if merged_borders.geom_type == 'LineString' else list(merged_borders.geoms)
print(f"Merged into {len(border_lines)} continuous vector border lines.")

# Convert merged border lines to SVG path data
svg_border_paths = []
border_lines_json = []

for line in border_lines:
    # Simplify slightly to reduce vertex count while preserving natural curves
    s_line = line.simplify(1.5, preserve_topology=True)
    coords = list(s_line.coords)
    if len(coords) >= 2:
        path_str = f"M {coords[0][0]:.1f} {coords[0][1]:.1f} " + " ".join([f"L {x:.1f} {y:.1f}" for x, y in coords[1:]])
        svg_border_paths.append(path_str)
        border_lines_json.append([[round(x, 1), round(y, 1)] for x, y in coords])

# 6. Extract Regional Polygons and Color Palette
print("Building regional polygons and styling...")

# Distinct classical region color palette based on historical cultural spheres
CULTURE_PALETTE = {
    'Italy & islands': ['#9c342b', '#b3473b', '#852820', '#a83e32', '#bf5345'], # Roman Crimson/Tyrian
    'Greece & Aegean': ['#2a5a8a', '#366d9f', '#1e4872', '#2f6396', '#4177ab'], # Aegean Azure
    'Asia Minor': ['#9e6e28', '#b07f33', '#855b1e', '#a3742c', '#b8873d'],      # Anatolian Bronze/Gold
    'Levant': ['#703378', '#83408c', '#5e2766', '#7a3882', '#914a9b'],          # Phoenician Purple
    'Egypt & Cyrenaica': ['#a68529', '#ba9633', '#8e701e', '#b08e2d', '#c4a23b'], # Nilotic Ochre/Sand
    'Mesopotamia': ['#2d6b63', '#397d74', '#215750', '#33746c', '#44877e'],     # Mesopotamian Turquoise
    'Gaul': ['#3b6834', '#477a3f', '#2f5429', '#417139', '#508548'],            # Celtic Forest Green
    'Hispania': ['#a8522e', '#ba6038', '#914222', '#b05832', '#c46940'],        # Iberian Terracotta
    'Britannia': ['#455d3b', '#526e47', '#384d2f', '#4b6540', '#5c7951'],       # Brittonic Sage
    'Germania & Raetia': ['#5a523b', '#6b6147', '#4b432f', '#615840', '#73684e'],# Germanic Earth
    'Danube & Balkans': ['#8c4d32', '#9e5a3c', '#753e26', '#945336', '#a86344'], # Thracian/Illyrian Copper
    'North Africa': ['#b06e30', '#c27d3b', '#965b24', '#b87434', '#cb8544']     # Punic Amber/Clay
}

# Group cells by site
site_cells = {idx: [] for idx in range(len(sites))}
for y in range(NY):
    for x in range(NX):
        r = region_grid[y, x]
        if r >= 0:
            site_cells[r].append((x, y))

region_polygons_svg = []
regions_export_data = []

for idx, s in enumerate(sites):
    cells = site_cells[idx]
    if not cells:
        continue
    
    # Culture color
    cult_colors = CULTURE_PALETTE.get(s['region'], ['#705030', '#85603a', '#5a4025'])
    color = cult_colors[idx % len(cult_colors)]
    
    # Build polygon from cell boxes
    boxes = [box((x - 0.5) * STEP, (y - 0.5) * STEP, (x + 0.5) * STEP, (y + 0.5) * STEP) for x, y in cells]
    u_poly = unary_union(boxes)
    # Simplify slightly to smooth staircase edges
    s_poly = u_poly.simplify(2.0, preserve_topology=True)
    
    # Generate SVG path for the polygon
    poly_list = [s_poly] if s_poly.geom_type == 'Polygon' else (s_poly.geoms if s_poly.geom_type == 'MultiPolygon' else [])
    parts = []
    for p in poly_list:
        if p.area < 10.0:
            continue
        ext = p.exterior.coords
        if len(ext) >= 3:
            p_str = f"M {ext[0][0]:.1f} {ext[0][1]:.1f} " + " ".join([f"L {cx:.1f} {cy:.1f}" for cx, cy in ext[1:]]) + " Z"
            parts.append(p_str)
            for interior in p.interiors:
                if len(interior.coords) >= 3:
                    h = interior.coords
                    h_str = f"M {h[0][0]:.1f} {h[0][1]:.1f} " + " ".join([f"L {hx:.1f} {hy:.1f}" for hx, hy in h[1:]]) + " Z"
                    parts.append(h_str)
    
    if parts:
        d_path = " ".join(parts)
        region_polygons_svg.append({
            "id": f"region-{s['id']}",
            "siteId": s['id'],
            "siteName": s['site'],
            "type": s['type'],
            "weight": s['weight'],
            "region": s['region'],
            "color": color,
            "d": d_path,
            "area": round(s_poly.area, 1)
        })
        regions_export_data.append({
            "id": s['id'],
            "site": s['site'],
            "modern": s['modern'],
            "type": s['type'],
            "weight": s['weight'],
            "region": s['region'],
            "color": color,
            "center": [s['x'], s['y']],
            "area": round(s_poly.area, 1)
        })

print(f"Generated {len(region_polygons_svg)} regional polygons.")

# 7. Save outputs
# Save regionsData.json for app
output_json = {
    "regions": regions_export_data,
    "borderCount": len(border_lines_json),
    "borderLines": border_lines_json
}

for dest in ['src/app/regionsData.json', 'public/regionsData.json']:
    with open(dest, 'w') as f:
        json.dump(output_json, f, separators=(',', ':'))
    print(f"Saved: {dest} ({os.path.getsize(dest)/1024:.1f} KB)")

# Also save the SVG snippet so it can be directly embedded into campaign_map.svg
combined_border_d = " ".join(svg_border_paths)

with open('data/watershed_regions_svg_data.json', 'w') as f:
    json.dump({
        "border_d": combined_border_d,
        "polygons": region_polygons_svg
    }, f)

print(f"=== Completed in {time.time() - t0:.2f}s ===")
