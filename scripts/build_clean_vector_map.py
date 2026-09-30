#!/usr/bin/env python3
"""
Build a pristine vector campaign map from Natural Earth 10m and NASA SRTM DEM data.
- NO mountain peak glyphs / triangles (shaded vector elevation contours only)
- NO clouds (clean, unobstructed view)
- NO static labels inside SVG (rendered dynamically in React at fixed screen size)
- Clean Natural Earth 1:10m coastline and water layers
- Real Natural Earth 1:10m country borders exported for fixed-screen stroke rendering
"""

import os
import json
import time
import math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image
from shapely.geometry import shape, Polygon, MultiPolygon, LineString, MultiLineString
from shapely.ops import transform, unary_union

print("--- Building Clean Vector Campaign Map ---")
t0 = time.time()

# ---------------------------------------------------------
# 1. PROJECTION (Lambert Azimuthal Equal Area)
# ---------------------------------------------------------
LON0 = 24.0
LAT0 = 38.0
LON0_RAD = np.radians(LON0)
LAT0_RAD = np.radians(LAT0)

def project_lonlat(lon, lat):
    lons_rad = np.radians(lon)
    lats_rad = np.radians(lat)
    dlon = lons_rad - LON0_RAD
    cos_c = np.sin(LAT0_RAD)*np.sin(lats_rad) + np.cos(LAT0_RAD)*np.cos(lats_rad)*np.cos(dlon)
    cos_c = np.clip(cos_c, -1.0, 1.0)
    k = np.sqrt(2.0 / (1.0 + cos_c))
    x = k * np.cos(lats_rad) * np.sin(dlon)
    y = k * (np.cos(LAT0_RAD)*np.sin(lats_rad) - np.sin(LAT0_RAD)*np.cos(lats_rad)*np.cos(dlon))
    return x, y

SVG_W = 2600
SVG_H = 2200
MARGIN = 60

XMIN_P = -0.545
XMAX_P = 0.545
YMIN_P = -0.470
YMAX_P = 0.565

AVAIL_W = SVG_W - 2 * MARGIN
AVAIL_H = SVG_H - 2 * MARGIN
SCALE_P = min(AVAIL_W / (XMAX_P - XMIN_P), AVAIL_H / (YMAX_P - YMIN_P))
OFFSET_X = MARGIN + (AVAIL_W - (XMAX_P - XMIN_P) * SCALE_P) / 2.0
OFFSET_Y = MARGIN + (AVAIL_H - (YMAX_P - YMIN_P) * SCALE_P) / 2.0

def project_to_svg(lon, lat):
    px, py = project_lonlat(lon, lat)
    sx = OFFSET_X + (px - XMIN_P) * SCALE_P
    sy = SVG_H - (OFFSET_Y + (py - YMIN_P) * SCALE_P)
    return sx, sy

def shapely_transform_to_svg(x, y):
    lons = np.asarray(x)
    lats = np.asarray(y)
    return project_to_svg(lons, lats)

# ---------------------------------------------------------
# 2. BOUNDARY POLYGON (Playable Campaign Area)
# ---------------------------------------------------------
MAP_BOUNDARY_COORDS = [
    (-13.0, 71.0),
    (61.5, 71.0),
    (61.5, 36.0),
    (61.5, 25.0),
    (59.8, 22.5),
    (55.0, 17.0),
    (48.5, 13.8),
    (43.2, 12.4),
    (38.0, 14.5),
    (34.0, 19.5),
    (24.0, 20.0),
    (10.0, 20.5),
    (-2.0, 21.0),
    (-13.0, 25.0),
    (-13.0, 71.0)
]
boundary_poly_geo = Polygon(MAP_BOUNDARY_COORDS)
boundary_poly_svg = transform(shapely_transform_to_svg, boundary_poly_geo)

def geom_to_svg_path(geom, min_area=25.0, tolerance=1.4):
    if geom.is_empty:
        return ""
    if tolerance > 0:
        geom = geom.simplify(tolerance, preserve_topology=True)
    if geom.is_empty:
        return ""
    if geom.geom_type == 'Polygon':
        geoms = [geom]
    elif geom.geom_type == 'MultiPolygon':
        geoms = geom.geoms
    else:
        return ""
    
    parts = []
    for p in geoms:
        if p.area < min_area:
            continue
        ext = p.exterior.coords
        if len(ext) < 3:
            continue
        p_str = f"M {ext[0][0]:.1f} {ext[0][1]:.1f} " + " ".join([f"L {x:.1f} {y:.1f}" for x, y in ext[1:]]) + " Z"
        parts.append(p_str)
        for interior in p.interiors:
            if len(interior.coords) < 3:
                continue
            h = interior.coords
            h_str = f"M {h[0][0]:.1f} {h[0][1]:.1f} " + " ".join([f"L {x:.1f} {y:.1f}" for x, y in h[1:]]) + " Z"
            parts.append(h_str)
    return " ".join(parts)

# ---------------------------------------------------------
# 3. LOAD NATURAL EARTH 10M DATA
# ---------------------------------------------------------
print("Loading Natural Earth 10m datasets...")

with open('data/ne_10m_land.geojson') as f:
    land_geojson = json.load(f)

with open('data/ne_10m_lakes.geojson') as f:
    lakes_geojson = json.load(f)

with open('data/ne_10m_coastline.geojson') as f:
    coast_geojson = json.load(f)

land_geoms = []
for feat in land_geojson['features']:
    g = shape(feat['geometry'])
    if g.intersects(boundary_poly_geo):
        try:
            clipped = g.intersection(boundary_poly_geo)
            if not clipped.is_empty:
                land_geoms.append(clipped)
        except Exception:
            pass

land_geo_union = unary_union(land_geoms)
land_svg = transform(shapely_transform_to_svg, land_geo_union)
land_svg_simp = land_svg.simplify(1.2, preserve_topology=True)

lake_geoms = []
for feat in lakes_geojson['features']:
    g = shape(feat['geometry'])
    if g.intersects(boundary_poly_geo):
        try:
            clipped = g.intersection(boundary_poly_geo)
            if not clipped.is_empty and clipped.area > 0.005:
                lake_geoms.append(clipped)
        except Exception:
            pass

lakes_geo_union = unary_union(lake_geoms) if lake_geoms else Polygon()
lakes_svg = transform(shapely_transform_to_svg, lakes_geo_union) if not lakes_geo_union.is_empty else None
lakes_svg_simp = lakes_svg.simplify(1.2, preserve_topology=True) if lakes_svg else None

if lakes_svg_simp and not lakes_svg_simp.is_empty:
    try:
        pure_land_svg = land_svg_simp.difference(lakes_svg_simp)
    except Exception:
        pure_land_svg = land_svg_simp
else:
    pure_land_svg = land_svg_simp

coast_paths_svg = []
for feat in coast_geojson['features']:
    g = shape(feat['geometry'])
    if g.intersects(boundary_poly_geo):
        try:
            clipped = g.intersection(boundary_poly_geo)
            if not clipped.is_empty:
                g_svg = transform(shapely_transform_to_svg, clipped)
                g_svg = g_svg.simplify(1.0, preserve_topology=True)
                lines = [g_svg] if g_svg.geom_type == 'LineString' else (g_svg.geoms if g_svg.geom_type == 'MultiLineString' else [])
                for ln in lines:
                    coords = ln.coords
                    if len(coords) >= 2:
                        p_str = f"M {coords[0][0]:.1f} {coords[0][1]:.1f} " + " ".join([f"L {x:.1f} {y:.1f}" for x, y in coords[1:]])
                        coast_paths_svg.append(p_str)
        except Exception:
            pass

print(f"Coastline segments: {len(coast_paths_svg)}")

# ---------------------------------------------------------
# 4. ELEVATION GRID & CLEAN VECTOR COLOR THRESHOLDS (NASA SRTM DEM)
# ---------------------------------------------------------
print("Stitching elevation raster...")

Z = 5
X_MIN_T, X_MAX_T = 14, 21
Y_MIN_T, Y_MAX_T = 6, 15

nx_tiles = X_MAX_T - X_MIN_T + 1
ny_tiles = Y_MAX_T - Y_MIN_T + 1
full_nx = nx_tiles * 256
full_ny = ny_tiles * 256
dem_grid = np.zeros((full_ny, full_nx), dtype=np.float32)

for ix, tx in enumerate(range(X_MIN_T, X_MAX_T + 1)):
    for iy, ty in enumerate(range(Y_MIN_T, Y_MAX_T + 1)):
        tile_path = f'data/tiles_z5/{Z}_{tx}_{ty}.png'
        if os.path.exists(tile_path):
            img = Image.open(tile_path).convert('RGB')
            arr = np.array(img, dtype=np.float32)
            elev = (arr[:,:,0] * 256.0 + arr[:,:,1] + arr[:,:,2] / 256.0) - 32768.0
            dem_grid[iy*256:(iy+1)*256, ix*256:(ix+1)*256] = elev

DS = 4
grid_sub = dem_grid[::DS, ::DS]
sub_ny, sub_nx = grid_sub.shape

px_idx = np.arange(0, full_nx, DS)[:sub_nx]
py_idx = np.arange(0, full_ny, DS)[:sub_ny]
PX, PY = np.meshgrid(px_idx, py_idx)
X_tile = X_MIN_T + PX / 256.0
Y_tile = Y_MIN_T + PY / 256.0

n_pow = 1 << Z
GRID_LONS = X_tile / n_pow * 360.0 - 180.0
GRID_LATS = np.degrees(np.arctan(np.sinh(np.pi * (1.0 - 2.0 * Y_tile / n_pow))))

X_SVG_GRID, Y_SVG_GRID = project_to_svg(GRID_LONS, GRID_LATS)

# Beautiful vector colors on elevation thresholds (plains, hills, highlands, mountains)
# All warm harmonious tones - NO dark/charcoal/black shapes!
TERRAIN_LEVELS = [0, 200, 500, 1000, 1500, 2500, 9000]

TERRAIN_CONFIGS = [
    {"name": "coastal_plain", "fill": "#82a166", "desc": "0–200m Coastal Plain"},
    {"name": "plains",        "fill": "#99b275", "desc": "200–500m Plains"},
    {"name": "hills",         "fill": "#c4b580", "desc": "500–1000m Hills"},
    {"name": "highlands",     "fill": "#b89f70", "desc": "1000–1500m Highlands"},
    {"name": "mountains",     "fill": "#a78c5d", "desc": "1500–2500m Mountains"},
    {"name": "major_mount",   "fill": "#967b4e", "desc": "2500m+ Major Mountains"},
]

cs = plt.contourf(X_SVG_GRID, Y_SVG_GRID, grid_sub, levels=TERRAIN_LEVELS)
contour_paths = cs.get_paths()

terrain_svg_layers = []
for i, (path, cfg) in enumerate(zip(contour_paths, TERRAIN_CONFIGS)):
    polys = path.to_polygons()
    path_strs = []
    for poly in polys:
        if len(poly) < 4:
            continue
        step = 2 if len(poly) > 40 else 1
        sub_poly = poly[::step]
        p_str = f"M {sub_poly[0][0]:.1f} {sub_poly[0][1]:.1f} " + " ".join([f"L {x:.1f} {y:.1f}" for x, y in sub_poly[1:]]) + " Z"
        path_strs.append(p_str)
    
    combined_d = " ".join(path_strs)
    terrain_svg_layers.append({
        "id": f"terrain-{cfg['name']}",
        "fill": cfg["fill"],
        "d": combined_d,
        "desc": cfg["desc"]
    })
    print(f"  Contour {cfg['desc']}: {len(path_strs)} streamlined vector polygons")

# ---------------------------------------------------------
# 5. MAJOR RIVERS (Natural Earth 10m)
# ---------------------------------------------------------
print("Loading Natural Earth 10m rivers...")

MAJOR_RIVERS_KEYS = {
    'Nile': ['nile'],
    'Danube': ['danube', 'donau'],
    'Rhine': ['rhine', 'rhein', 'rhin'],
    'Rhône': ['rhone', 'rhône'],
    'Po': ['po'],
    'Tiber': ['tiber', 'tevere'],
    'Dnieper': ['dnieper', 'dnipro', 'dnepr'],
    'Don': ['don'],
    'Volga': ['volga'],
    'Euphrates': ['euphrates', 'al-furat', 'firat'],
    'Tigris': ['tigris', 'dijla', 'dicle'],
    'Jordan': ['jordan'],
    'Seine': ['seine'],
    'Loire': ['loire'],
    'Tagus': ['tagus', 'tajo', 'tejo'],
    'Ebro': ['ebro']
}

major_river_paths_svg = {k: [] for k in MAJOR_RIVERS_KEYS}

for rf in ['data/ne_10m_rivers.geojson', 'data/ne_10m_rivers_europe.geojson']:
    with open(rf) as f:
        rdata = json.load(f)
    for feat in rdata['features']:
        p = feat['properties']
        geom = shape(feat['geometry'])
        if not geom.intersects(boundary_poly_geo):
            continue
        try:
            clipped = geom.intersection(boundary_poly_geo)
            if clipped.is_empty:
                continue
            name_str = ' '.join([str(p.get(k,'')) for k in ['name', 'NAME', 'name_en', 'name_alt', 'name_fr', 'name_de', 'name_es']]).lower()
            words = name_str.replace('-', ' ').replace('_', ' ').split()
            matched_key = None
            for rk, aliases in MAJOR_RIVERS_KEYS.items():
                if any(alias in words for alias in aliases):
                    matched_key = rk
                    break
            
            if matched_key:
                g_svg = transform(shapely_transform_to_svg, clipped)
                g_svg = g_svg.simplify(1.2, preserve_topology=True)
                lines = [g_svg] if g_svg.geom_type == 'LineString' else (g_svg.geoms if g_svg.geom_type == 'MultiLineString' else [])
                for ln in lines:
                    coords = ln.coords
                    if len(coords) >= 2:
                        p_str = f"M {coords[0][0]:.1f} {coords[0][1]:.1f} " + " ".join([f"L {x:.1f} {y:.1f}" for x, y in coords[1:]])
                        major_river_paths_svg[matched_key].append(p_str)
        except Exception:
            pass

# ---------------------------------------------------------
# 6. ASSEMBLE CLEAN SVG
# ---------------------------------------------------------
print("Assembling clean vector campaign map SVG...")

svg_out = []
svg_out.append(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SVG_W} {SVG_H}" width="100%" height="100%"
     shape-rendering="geometricPrecision" text-rendering="geometricPrecision">
  <defs>
    <!-- Land Clipping Path (Land minus Lakes) -->
    <clipPath id="land-clip">
      <path d="{geom_to_svg_path(pure_land_svg, min_area=30, tolerance=1.4)}" />
    </clipPath>
  </defs>

  <!-- ========================================== -->
  <!-- 1. SEA LAYER (<g id="sea">)                -->
  <!-- ========================================== -->
  <g id="sea">
    <!-- Deep Sea Background -->
    <rect width="{SVG_W}" height="{SVG_H}" fill="#192c3d" />

    <!-- Coastal Shallows / Water Glow -->
    <path d="{geom_to_svg_path(land_svg_simp, min_area=40, tolerance=1.5)}" fill="none" stroke="#25425c" stroke-width="14" stroke-opacity="0.4" stroke-linejoin="round" />
    <path d="{geom_to_svg_path(land_svg_simp, min_area=40, tolerance=1.5)}" fill="none" stroke="#315577" stroke-width="6" stroke-opacity="0.45" stroke-linejoin="round" />

    <!-- Major Inland Lakes -->
    {f'<path d="{geom_to_svg_path(lakes_svg_simp, min_area=20, tolerance=1.2)}" fill="#1a3044" stroke="#284764" stroke-width="1.2" />' if lakes_svg_simp else ''}
  </g>

  <!-- ========================================== -->
  <!-- 2. TERRAIN ELEVATION (NASA SRTM Vector Contours) -->
  <!-- ========================================== -->
  <g id="terrain" clip-path="url(#land-clip)">
    <!-- Base Lowland Grassland -->
    <rect width="{SVG_W}" height="{SVG_H}" fill="#8cb070" />
    
    <!-- Arid Steppe & Desert (Sahara, Sinai, Arabia) -->
    <path d="M 0 1200 L 2600 1200 L 2600 2200 L 0 2200 Z" fill="#ded09f" opacity="0.88" />
''')

# Elevation contour vector fills
for lyr in terrain_svg_layers:
    svg_out.append(f'''    <!-- {lyr["desc"]} -->
    <path id="{lyr["id"]}" d="{lyr["d"]}" fill="{lyr["fill"]}" />''')

svg_out.append('''  </g>

  <!-- ========================================== -->
  <!-- 3. COASTLINES (<g id="coastlines">)        -->
  <!-- ========================================== -->
  <g id="coastlines">
    <path d="''' + ' '.join(coast_paths_svg) + '''' fill="none" stroke="#1d1610" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" />
  </g>

  <!-- ========================================== -->
  <!-- 4. RIVERS (<g id="rivers">)                -->
  <!-- ========================================== -->
  <g id="rivers" clip-path="url(#land-clip)">
''')

for rk, paths in major_river_paths_svg.items():
    if paths:
        w = 2.4 if rk in ['Nile', 'Danube', 'Rhine', 'Volga', 'Euphrates'] else 1.8
        glow_w = w + 1.8
        svg_out.append(f'''    <!-- River {rk} -->
    <g id="river-{rk.lower()}">
      <path d="{' '.join(paths)}" fill="none" stroke="#376288" stroke-width="{glow_w}" stroke-linecap="round" stroke-linejoin="round" opacity="0.35" />
      <path d="{' '.join(paths)}" fill="none" stroke="#183f60" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" />
    </g>''')

svg_out.append('''  </g>
</svg>
''')

final_svg = "\n".join(svg_out)
print(f"Generated clean SVG: {len(final_svg):,} characters.")

for dest in ["public/campaign_map.svg", "campaign_map.svg"]:
    with open(dest, "w", encoding="utf-8") as f:
        f.write(final_svg)

print(f"--- Finished in {time.time() - t0:.1f}s ---")
