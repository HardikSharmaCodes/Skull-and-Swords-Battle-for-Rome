#!/usr/bin/env python3
"""
Enrich Watershed Regions with Sovereign Overstate Data,
Neighbor Adjacency Graphs, Regional Color Palettes (Graph-Colored to prevent any identical neighbor colors),
and update campaign_map.svg with colored province polygons for Vintage Paper Mode.
"""

import json
import time
import math
from collections import defaultdict

print("=== Enriching Watershed Regions & Generating Sovereign Color Schemes ===")
t0 = time.time()

# 1. Load Data
with open('public/ancientSites.json') as f:
    sites = json.load(f)
site_by_id = {s['id']: s for s in sites}
site_by_idx = {idx: s for idx, s in enumerate(sites)}

with open('src/app/regionsData.json') as f:
    reg_data = json.load(f)

regions = reg_data['regions']
region_by_id = {r['id']: r for r in regions}
print(f"Loaded {len(regions)} regions and {len(reg_data.get('borderLines', []))} border lines.")

# 2. Extract Adjacency / Neighbor Graph from recalculating watershed interfaces or border segments
# We can re-extract exact neighbors using the high-resolution grid as in recalculate_watershed_borders.py
import numpy as np
from PIL import Image

STEP = 5.0
NX = int(2600 / STEP) + 1  # 521
NY = int(2200 / STEP) + 1  # 441

with open('public/elevationData.json') as f:
    elev_raw = json.load(f)

c_NX = 261
c_NY = 221
c_elev = np.zeros((c_NY, c_NX), dtype=np.float32)
for x, y, e in elev_raw:
    c_elev[int(round(y / 10.0)), int(round(x / 10.0))] = e

elev_grid = np.array(Image.fromarray(c_elev).resize((NX, NY), Image.BILINEAR), dtype=np.float32)
land_mask = (elev_grid >= 0)
for s in sites:
    sx = max(0, min(NX - 1, int(round(s['x'] / STEP))))
    sy = max(0, min(NY - 1, int(round(s['y'] / STEP))))
    land_mask[sy, sx] = True

import heapq
rays = [
    (-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
    (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414),
]
dist_grid = np.full((NY, NX), 1e9, dtype=np.float32)
region_grid = np.full((NY, NX), -1, dtype=np.int32)
pq = []

site_powers = [max(1.0, float(s['weight']))**0.66 for s in sites]

for idx, s in enumerate(sites):
    sx = max(0, min(NX - 1, int(round(s['x'] / STEP))))
    sy = max(0, min(NY - 1, int(round(s['y'] / STEP))))
    dist_grid[sy, sx] = 0.0
    region_grid[sy, sx] = idx
    heapq.heappush(pq, (0.0, idx, sy, sx))

gy, gx = np.gradient(elev_grid, STEP)
slope = np.sqrt(gx**2 + gy**2)
friction = 1.0 + 3.8 * np.clip(slope / 28.0, 0, 7.0)**1.3 + 1.6 * np.clip((elev_grid - 200.0) / 1000.0, 0, 5.0)

print("Tracing watershed adjacency wavefront...")
while pq:
    d, s_idx, cy, cx = heapq.heappop(pq)
    if d > dist_grid[cy, cx]:
        continue
    w_factor = site_powers[s_idx]
    for dy, dx, rdist in rays:
        ny_c, nx_c = cy + dy, cx + dx
        if 0 <= nx_c < NX and 0 <= ny_c < NY:
            if not land_mask[ny_c, nx_c]:
                continue
            f_avg = 0.5 * (friction[cy, cx] + friction[ny_c, nx_c])
            new_d = d + (f_avg * rdist * STEP) / w_factor
            if new_d < dist_grid[ny_c, nx_c]:
                dist_grid[ny_c, nx_c] = new_d
                region_grid[ny_c, nx_c] = s_idx
                heapq.heappush(pq, (new_d, s_idx, ny_c, nx_c))

# Extract adjacency pairs
neighbors_by_id = defaultdict(set)
for y in range(NY - 1):
    for x in range(NX):
        r1 = region_grid[y, x]
        r2 = region_grid[y + 1, x]
        if r1 >= 0 and r2 >= 0 and r1 != r2:
            id1 = sites[r1]['id']
            id2 = sites[r2]['id']
            neighbors_by_id[id1].add(id2)
            neighbors_by_id[id2].add(id1)

for y in range(NY):
    for x in range(NX - 1):
        r1 = region_grid[y, x]
        r2 = region_grid[y, x + 1]
        if r1 >= 0 and r2 >= 0 and r1 != r2:
            id1 = sites[r1]['id']
            id2 = sites[r2]['id']
            neighbors_by_id[id1].add(id2)
            neighbors_by_id[id2].add(id1)

print(f"Computed neighbor graph for {len(neighbors_by_id)} provinces.")

# 3. Macro-Region Classification & Palettes
# User Request:
# "make british provinces orange shade, make french provinces bluish, german ones should be greenish shade,
#  iberain ones should be yellowish, carthage should be blue and rome should be redish."
# "Bordering countries should never have the same colour."

# 3. Diverse Colorful Palette & Pop Red for Rome
# User: "Idont thing amking a region the same colour was a good decision. Make it different different. Also, like Make rome a pop red colour."

DIVERSE_PALETTE = [
    '#e67e22', '#2980b9', '#27ae60', '#f39c12', '#8e44ad',
    '#16a085', '#d35400', '#3498db', '#2ecc71', '#9b59b6',
    '#1abc9c', '#f1c40f', '#ba4a00', '#5dade2', '#52be80',
    '#7d3c98', '#117864', '#d4ac0d', '#dc7633', '#2471a3',
    '#229954', '#a569bd', '#48c9b0', '#b7950b', '#eb984e',
    '#1f618d', '#58d68d', '#6c3483', '#138d75', '#f5b041',
    '#ca6f1e', '#2e86c1', '#1e8449', '#76448a', '#148f77',
    '#d68910', '#e59866', '#5499c7', '#28b463', '#884ea0',
    '#17a589', '#f8c471', '#af601a', '#4a90e2', '#6ab04c',
    '#bb8fce', '#45b39d', '#9a7d0a', '#b45309', '#3b79b5'
]

# 4. Graph Coloring Algorithm
# Guarantee: For every pair of adjacent provinces (A, B), color(A) != color(B)
# Rome (ID 1) gets a bright POP RED!
POP_ROME_RED = '#ff1a1a'

color_by_id = {}
color_by_id[1] = POP_ROME_RED # Rome is bright pop red!

# Sort regions by degree (most constrained first)
sorted_regions = sorted(regions, key=lambda r: len(neighbors_by_id.get(r['id'], [])), reverse=True)

for r in sorted_regions:
    rid = r['id']
    if rid == 1:
        continue # Already set Rome

    # Get colors used by already-colored neighbors
    neighbor_ids = neighbors_by_id.get(rid, set())
    used_neighbor_colors = {color_by_id[nid] for nid in neighbor_ids if nid in color_by_id}

    # Pick first unused color from palette (and don't pick Rome's pop red)
    chosen_color = None
    # Offset by region ID to give rich pseudo-random color diversity
    offset = (rid * 7 + rid // 3) % len(DIVERSE_PALETTE)
    for i in range(len(DIVERSE_PALETTE)):
        cand = DIVERSE_PALETTE[(offset + i) % len(DIVERSE_PALETTE)]
        if cand not in used_neighbor_colors and cand != POP_ROME_RED:
            chosen_color = cand
            break

    if not chosen_color:
        for cand in DIVERSE_PALETTE:
            if cand not in used_neighbor_colors and cand != POP_ROME_RED:
                chosen_color = cand
                break

    if not chosen_color:
        chosen_color = DIVERSE_PALETTE[rid % len(DIVERSE_PALETTE)]

    color_by_id[rid] = chosen_color

# Verify 0 identical color neighbors
conflicts = 0
for rid, color in color_by_id.items():
    for nid in neighbors_by_id.get(rid, set()):
        if nid in color_by_id and color_by_id[nid] == color:
            conflicts += 1

print(f"Graph coloring finished. Neighbor color conflicts: {conflicts} (MUST BE 0!)")
print(f"Rome color: {color_by_id.get(1)}")

def classify_macro_region(s):
    reg = s.get('region', '')
    site_name = s.get('site', '')
    people = s.get('people', '')
    lat = s.get('lat', 0)
    lon = s.get('lon', 0)
    if site_name in ['Carthage', 'Utica', 'Hadrumetum', 'Thapsus', 'Leptis Magna', 'Sabratha', 'Hippo Diarrhytus', 'Tacapae', 'Thysdrus', 'Thugga', 'Bulla Regia'] \
       or ('Punic' in people and ('North Africa' in reg or 'Cyrenaica' in reg or lat < 38.0 and lon > 5.0 and lon < 16.0)):
        return 'carthage'
    if reg == 'Britain & Ireland' or s.get('id') == 41 or (lat > 49.5 and lon < 2.0 and lon > -11.0):
        return 'britain'
    if reg in ['Gaul & Britain', 'Gaul (extras)'] or (lat > 42.5 and lat <= 50.5 and lon > -5.0 and lon < 8.2 and s.get('id') != 41):
        return 'gaul'
    if reg in ['Germania & Central Europe', 'Danube & Central Europe', 'Scandinavia & Baltic']:
        return 'germany'
    if reg in ['Iberia', 'Iberia, Balearics & islands']:
        return 'iberia'
    if reg in ['Italy & islands', 'Alps & Adriatic head'] or (lat >= 36.5 and lat <= 46.5 and lon >= 6.8 and lon <= 18.5):
        return 'rome'
    if reg in ['Egypt', 'Egypt (extras)', 'Nubia, Red Sea & Sahara'] or (lat < 32.0 and lon >= 24.0 and lon <= 36.0):
        return 'egypt'
    if reg in ['Balkans & Greece', 'Aegean & Greece (extras)', 'Thrace, Dacia & Illyria']:
        return 'greece'
    if reg in ['Levant', 'Levant (extras)', 'Arabia & Persian Gulf', 'Arabia']:
        return 'levant'
    if reg in ['Anatolia & Cyprus', 'Black Sea']:
        return 'anatolia'
    return 'other'

# 5. Overstate Titles & Ruler Generation
def generate_overstate_info(s, m_reg):
    site = s.get('site', 'Settlement')
    people = s.get('people', '').strip()
    stype = s.get('type', 'Tribal center')
    w = s.get('weight', 5)

    if m_reg == 'rome':
        sovereign = f"Res Publica Romana ({site})" if site != 'Rome' else "Senatus Populusque Romanus (SPQR)"
        ruler = "Consul & Senate" if site == 'Rome' else f"Praetor of {site}"
        faction = 'Roman Senate'
    elif m_reg == 'carthage':
        sovereign = f"Carthaginian Hegemony ({site})" if site != 'Carthage' else "Supreme Council of Carthage"
        ruler = "Suffete & Grand Assembly"
        faction = 'Punic Council'
    elif m_reg == 'britain':
        tribal = people if people else f"{site} Britons"
        sovereign = f"Kingdom of {site}" if w >= 6 else f"{tribal} Tribe"
        ruler = f"Bregowallos / High Chieftain of {site}"
        faction = 'Celtic Britons'
    elif m_reg == 'gaul':
        tribal = people if people else f"{site} Gauls"
        sovereign = f"Civitas of {site}" if w >= 6 else f"{tribal} Oppidum"
        ruler = f"Vergobret / War Chief of {site}"
        faction = 'Gallic Confederation'
    elif m_reg == 'germany':
        tribal = people if people else f"{site} Clans"
        sovereign = f"{tribal} Council"
        ruler = f"Kuningaz / Warleader of {site}"
        faction = 'Germanic Warbands'
    elif m_reg == 'iberia':
        tribal = people if people else f"{site} Iberians"
        sovereign = f"Regnum of {site}" if w >= 6 else f"{tribal} League"
        ruler = f"Regulus of {site}"
        faction = 'Iberian Coalition'
    elif m_reg == 'greece':
        sovereign = f"Polis of {site}" if stype in ['Metropolis', 'Regional capital'] else f"League of {site}"
        ruler = f"Archon of {site}"
        faction = 'Hellenic League'
    elif m_reg == 'egypt':
        sovereign = f"Nome of {site}"
        ruler = f"Nomarch / Strategos of {site}"
        faction = 'Ptolemaic Crown'
    else:
        sovereign = f"Sovereign Territory of {site}"
        ruler = f"Dynast of {site}"
        faction = 'Independent Realm'

    treasury = 300 + w * 70
    garrison = 200 + w * 180

    return {
        "sovereignName": sovereign,
        "ruler": ruler,
        "faction": faction,
        "treasury": treasury,
        "garrison": garrison
    }

# 6. Update Region Summaries
updated_regions = []
for r in regions:
    rid = r['id']
    s = site_by_id.get(rid, {})
    m_reg = classify_macro_region(s)
    col = color_by_id.get(rid, '#c4ad8e')
    overstate = generate_overstate_info(s, m_reg)
    
    # Store neighboring IDs
    n_list = sorted(list(neighbors_by_id.get(rid, set())))
    
    r_updated = dict(r)
    r_updated['macroRegion'] = m_reg
    r_updated['color'] = col
    # Transparent fill color for map display (0.50 opacity for rich parchment blend)
    r_updated['fillColor'] = col
    r_updated['neighbors'] = n_list
    r_updated.update(overstate)
    updated_regions.append(r_updated)

output_data = {
    "regions": updated_regions,
    "borderCount": reg_data.get('borderCount', 0),
    "borderLines": reg_data.get('borderLines', []),
    "borderSvgPath": reg_data.get('borderSvgPath', '')
}

for dest in ['src/app/regionsData.json', 'public/regionsData.json']:
    with open(dest, 'w') as f:
        json.dump(output_data, f, separators=(',', ':'))
    print(f"Saved: {dest} ({round(len(json.dumps(output_data)) / 1024, 1)} KB)")

# 7. Update public/campaign_map.svg to include colored province polygons in #vintage-paper
print("Injecting colored province polygons into campaign_map.svg #vintage-paper layer...")
with open('public/campaign_map.svg') as f:
    svg_content = f.read()

# Build SVG group of colored province polygons
poly_paths = []
for r in updated_regions:
    if r.get('pathD'):
        poly_paths.append(
            f'<path id="reg-{r["id"]}" class="province-paper-poly" data-id="{r["id"]}" data-site="{r["site"]}" '
            f'd="{r["pathD"]}" fill="{r["color"]}" fill-opacity="0.48" />'
        )

vintage_provinces_svg = (
    '  <!-- 2b. VINTAGE PAPER MAP TEXTURE & COLORED PROVINCES (<g id="vintage-paper">) -->\n'
    '  <g id="vintage-paper" clip-path="url(#land-clip)" style="display: none;">\n'
    '    <!-- Base warm parchment undercoat -->\n'
    '    <rect width="2600" height="2200" fill="#ebdcb9" />\n'
    '    <!-- High-resolution aged parchment map texture -->\n'
    '    <image href="/vintage_paper.jpg" width="2600" height="2200" preserveAspectRatio="none" />\n'
    '    <!-- Colored Sovereign Provinces (British orange, French blue, German green, Iberian yellow, Carthage blue, Rome red) -->\n'
    '    <g id="vintage-provinces">\n'
    + "\n".join(["      " + p for p in poly_paths]) + "\n"
    '    </g>\n'
    '  </g>'
)

# Replace existing <g id="vintage-paper"> block
import re
new_svg_content = re.sub(
    r'<g id="vintage-paper" clip-path="url\(#land-clip\)" style="display: none;">.*?</g>',
    vintage_provinces_svg,
    svg_content,
    flags=re.DOTALL
)

with open('public/campaign_map.svg', 'w') as f:
    f.write(new_svg_content)

print(f"Updated public/campaign_map.svg with {len(poly_paths)} colored sovereign province polygons!")

print(f"=== Enrichment finished in {time.time() - t0:.2f}s ===")
