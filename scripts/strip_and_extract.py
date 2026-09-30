#!/usr/bin/env python3
"""
Strip mountains, clouds, labels, and map-frame from campaign_map.svg.
Compute label positions and export as JSON for React overlay rendering.
"""
import math
import json
import re

# ─── Projection math (from generate_map.py) ───
LON0, LAT0 = 24.0, 38.0
LON0_R, LAT0_R = math.radians(LON0), math.radians(LAT0)
SVG_W, SVG_H = 2600, 2200
MARGIN = 60
XMIN_P, XMAX_P = -0.545, 0.545
YMIN_P, YMAX_P = -0.470, 0.565
AVAIL_W = SVG_W - 2 * MARGIN
AVAIL_H = SVG_H - 2 * MARGIN
SCALE_P = min(AVAIL_W / (XMAX_P - XMIN_P), AVAIL_H / (YMAX_P - YMIN_P))
OFFSET_X = MARGIN + (AVAIL_W - (XMAX_P - XMIN_P) * SCALE_P) / 2.0
OFFSET_Y = MARGIN + (AVAIL_H - (YMAX_P - YMIN_P) * SCALE_P) / 2.0

def proj(lon, lat):
    lr, ar = math.radians(lon), math.radians(lat)
    dlon = lr - LON0_R
    cc = math.sin(LAT0_R)*math.sin(ar) + math.cos(LAT0_R)*math.cos(ar)*math.cos(dlon)
    cc = max(-1, min(1, cc))
    k = math.sqrt(2.0 / (1.0 + cc))
    px = k * math.cos(ar) * math.sin(dlon)
    py = k * (math.cos(LAT0_R)*math.sin(ar) - math.sin(LAT0_R)*math.cos(ar)*math.cos(dlon))
    return round(OFFSET_X + (px - XMIN_P) * SCALE_P, 1), round(SVG_H - (OFFSET_Y + (py - YMIN_P) * SCALE_P), 1)

# ─── Label source data (from generate_map.py) ───
SEA_LABELS = [
    {"name": "MEDITERRANEAN SEA", "lon": 18.0, "lat": 35.5, "angle": 0, "size": 22},
    {"name": "OCEANUS ATLANTICUS", "lon": -10.0, "lat": 44.0, "angle": -50, "size": 24},
    {"name": "PONTUS EUXINUS", "lon": 34.5, "lat": 43.5, "angle": 4, "size": 18},
    {"name": "MARE CASPIUM", "lon": 50.8, "lat": 42.0, "angle": 80, "size": 18},
    {"name": "NORTH SEA", "lon": 3.0, "lat": 56.5, "angle": 12, "size": 18},
    {"name": "MARE BALTICUM", "lon": 19.5, "lat": 57.5, "angle": 30, "size": 18},
    {"name": "SINUS PERSICUS", "lon": 52.0, "lat": 27.5, "angle": -38, "size": 18},
    {"name": "SINUS ARABICUS", "lon": 37.0, "lat": 23.5, "angle": -55, "size": 20},
    {"name": "ARABIAN SEA", "lon": 58.0, "lat": 18.0, "angle": 20, "size": 20},
]

MOUNTAIN_LABELS = [
    {"name": "ATLAS MOUNTAINS", "lon": -4.0, "lat": 32.5, "angle": 18},
    {"name": "PYRENEES", "lon": 0.5, "lat": 42.7, "angle": -4},
    {"name": "ALPS", "lon": 10.0, "lat": 46.5, "angle": 12},
    {"name": "APENNINES", "lon": 13.0, "lat": 42.8, "angle": -52},
    {"name": "CARPATHIANS", "lon": 23.5, "lat": 47.5, "angle": -25},
    {"name": "DINARIC ALPS", "lon": 17.5, "lat": 43.5, "angle": -40},
    {"name": "BALKAN MOUNTAINS", "lon": 25.2, "lat": 42.8, "angle": -2},
    {"name": "SCANDINAVIAN MOUNTAINS", "lon": 12.0, "lat": 64.0, "angle": 55},
    {"name": "SCOTTISH HIGHLANDS", "lon": -4.5, "lat": 57.2, "angle": 38},
    {"name": "CAUCASUS", "lon": 44.5, "lat": 42.6, "angle": -22},
    {"name": "PONTIC MOUNTAINS", "lon": 36.8, "lat": 40.9, "angle": 2},
    {"name": "TAURUS MOUNTAINS", "lon": 34.0, "lat": 37.4, "angle": 14},
    {"name": "ZAGROS MOUNTAINS", "lon": 50.0, "lat": 32.0, "angle": -48},
    {"name": "ELBURZ MOUNTAINS", "lon": 52.5, "lat": 36.3, "angle": 5},
    {"name": "LEBANON MOUNTAINS", "lon": 36.0, "lat": 34.2, "angle": 65},
    {"name": "JUDEAN HIGHLANDS", "lon": 35.15, "lat": 31.7, "angle": 85},
    {"name": "SARAWAT MOUNTAINS", "lon": 41.5, "lat": 20.0, "angle": -60},
]

RIVER_LABELS = [
    {"name": "Danube", "lon": 21.0, "lat": 44.8, "angle": -15},
    {"name": "Rhine", "lon": 7.8, "lat": 49.5, "angle": -65},
    {"name": "Nile", "lon": 31.4, "lat": 27.5, "angle": -84},
    {"name": "Euphrates", "lon": 41.5, "lat": 34.8, "angle": -35},
    {"name": "Tigris", "lon": 44.2, "lat": 34.5, "angle": -45},
    {"name": "Volga", "lon": 47.0, "lat": 50.5, "angle": -40},
    {"name": "Dnieper", "lon": 33.5, "lat": 48.0, "angle": -50},
    {"name": "Don", "lon": 41.5, "lat": 48.5, "angle": -30},
    {"name": "Po", "lon": 10.8, "lat": 45.0, "angle": 0},
    {"name": "Rhône", "lon": 4.8, "lat": 44.8, "angle": -75},
    {"name": "Ebro", "lon": -0.2, "lat": 41.5, "angle": -35},
    {"name": "Tagus", "lon": -4.0, "lat": 39.8, "angle": -15},
    {"name": "Seine", "lon": 1.5, "lat": 49.0, "angle": -30},
    {"name": "Loire", "lon": 0.5, "lat": 47.3, "angle": -15},
    {"name": "Tiber", "lon": 12.4, "lat": 42.1, "angle": -55},
    {"name": "Jordan", "lon": 35.5, "lat": 32.2, "angle": -85},
]

# ─── Compute projected positions ───
labels = {"sea": [], "mountain": [], "river": []}

for s in SEA_LABELS:
    x, y = proj(s["lon"], s["lat"])
    labels["sea"].append({"name": s["name"], "x": x, "y": y, "angle": s["angle"], "size": s["size"]})

for m in MOUNTAIN_LABELS:
    x, y = proj(m["lon"], m["lat"])
    labels["mountain"].append({"name": m["name"], "x": x, "y": y, "angle": m["angle"]})

for r in RIVER_LABELS:
    x, y = proj(r["lon"], r["lat"])
    labels["river"].append({"name": r["name"], "x": x, "y": y, "angle": r["angle"]})

with open("src/app/mapLabels.json", "w") as f:
    json.dump(labels, f, indent=2)
print(f"Labels exported: {len(labels['sea'])} sea, {len(labels['mountain'])} mountain, {len(labels['river'])} river")

# ─── Strip SVG ───
with open("public/campaign_map.svg", "r", encoding="utf-8") as f:
    svg = f.read()

original_size = len(svg)

def remove_group(text, group_id):
    """Remove a <g id='...'>...</g> group, accounting for nested <g> tags."""
    # Find the opening tag
    for pat in [f'<g id="{group_id}">', f'<g id="{group_id}" ']:
        idx = text.find(pat)
        if idx != -1:
            break
    else:
        print(f"  Warning: <g id='{group_id}'> not found")
        return text

    start = idx
    # Find end of opening <g ...> tag
    tag_end = text.find(">", idx)
    if tag_end == -1:
        return text

    pos = tag_end + 1
    depth = 1
    end = len(text)

    while depth > 0 and pos < len(text):
        next_open = text.find("<g", pos)
        next_close = text.find("</g>", pos)

        if next_close == -1:
            print(f"  Warning: no matching </g> for '{group_id}'")
            return text

        if next_open != -1 and next_open < next_close:
            # Verify it's a real <g tag, not <gradient etc.
            ch = text[next_open + 2] if next_open + 2 < len(text) else ""
            if ch in " >\n\r\t":
                depth += 1
            pos = next_open + 3
        else:
            depth -= 1
            if depth == 0:
                end = next_close + 4  # len('</g>')
                break
            pos = next_close + 4

    # Extend backwards to include preceding HTML comment lines
    scan = start
    while scan > 0:
        nl = text.rfind("\n", 0, scan)
        if nl == -1:
            break
        line = text[nl + 1 : scan].strip()
        if (line.startswith("<!--") and line.endswith("-->")) or line == "":
            scan = nl
        else:
            break

    removed_len = end - scan
    print(f"  Removed <g id='{group_id}'>: {removed_len} chars")
    return text[:scan] + text[end:]


for gid in ["mountains", "clouds", "labels", "map-frame"]:
    svg = remove_group(svg, gid)

# Remove empty placeholder groups
for gid in ["province-borders", "province-fills", "settlements"]:
    svg = re.sub(
        rf'\s*<!--[^-]*-->\s*<!--[^-]*-->\s*<!--[^-]*-->\s*<g id="{gid}"></g>',
        "",
        svg,
    )
    # Also try simpler pattern
    svg = re.sub(rf'\s*<g id="{gid}"></g>', "", svg)

# Clean up CSS classes no longer used
svg = re.sub(r"\s*\.mountain-label\s*\{[^}]*\}", "", svg)
svg = re.sub(r"\s*\.sea-label\s*\{[^}]*\}", "", svg)
svg = re.sub(r"\s*\.river-label\s*\{[^}]*\}", "", svg)
svg = re.sub(r"\s*@import url\([^)]+\);", "", svg)

# Remove vignette gradient (only used by map-frame)
svg = re.sub(
    r"\s*<radialGradient id=\"vignette\"[^>]*>.*?</radialGradient>",
    "",
    svg,
    flags=re.DOTALL,
)

# Save
for path in ["public/campaign_map.svg", "campaign_map.svg"]:
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)

print(f"SVG stripped: {original_size:,} → {len(svg):,} chars ({(1 - len(svg)/original_size)*100:.1f}% smaller)")
print("Done!")
