#!/usr/bin/env python3
"""
Generate Complete, Self-Contained, Re-Editable Vector Campaign Map SVG.
All features created entirely in code:
- NO mountain peak glyphs / triangles (smooth, warm tan/gold elevation contours only)
- NO white circles / border clouds / fog puffs at edges
- THICK, prominent coastline & border vector lines
- Fully structured SVG with clear groups (<g id="...">), reusable styles, and editable colors
- Major rivers, lakes, sea glow, terrain contours, and historical typography
"""

import os
import sys
import json
import time
import math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image, ImageFilter
from shapely.geometry import shape, Polygon, MultiPolygon, LineString, MultiLineString
from shapely.ops import transform, unary_union

print("--- Generating Complete Re-Editable Vector Map SVG ---")
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

def geom_to_svg_path(geom, min_area=25.0, tolerance=1.2):
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
land_svg_simp = land_svg.simplify(1.0, preserve_topology=True)

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
lakes_svg_simp = lakes_svg.simplify(1.0, preserve_topology=True) if lakes_svg else None

if lakes_svg_simp and not lakes_svg_simp.is_empty:
    try:
        pure_land_svg = land_svg_simp.difference(lakes_svg_simp)
    except Exception:
        pure_land_svg = land_svg_simp
else:
    pure_land_svg = land_svg_simp

coast_paths_svg = []
border_json_segments = []

for feat in coast_geojson['features']:
    g = shape(feat['geometry'])
    if g.intersects(boundary_poly_geo):
        try:
            clipped = g.intersection(boundary_poly_geo)
            if not clipped.is_empty:
                g_svg = transform(shapely_transform_to_svg, clipped)
                g_svg = g_svg.simplify(0.9, preserve_topology=True)
                lines = [g_svg] if g_svg.geom_type == 'LineString' else (g_svg.geoms if g_svg.geom_type == 'MultiLineString' else [])
                for ln in lines:
                    coords = ln.coords
                    if len(coords) >= 2:
                        p_str = f"M {coords[0][0]:.1f} {coords[0][1]:.1f} " + " ".join([f"L {x:.1f} {y:.1f}" for x, y in coords[1:]])
                        coast_paths_svg.append(p_str)
                        border_json_segments.append([[round(x, 1), round(y, 1)] for x, y in coords])
        except Exception:
            pass

print(f"Extracted {len(coast_paths_svg)} coastline segments.")

# Update realBorders.json for React canvas layer
with open('src/app/realBorders.json', 'w') as f:
    json.dump(border_json_segments, f, separators=(',', ':'))
print(f"Updated src/app/realBorders.json with {len(border_json_segments)} segments.")

# ---------------------------------------------------------
# 4. ELEVATION GRID & SMOOTHED VECTOR CONTOURS (NASA SRTM DEM)
# ---------------------------------------------------------
print("Stitching and smoothing elevation raster...")

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

# Subsample by 4x
DS = 4
grid_sub = dem_grid[::DS, ::DS]

# Smooth elevation grid with 2D separable Gaussian-style kernel
# to ensure smooth, natural, organic elevation curves (NO jagged triangle artifacts!)
k = np.array([1, 4, 6, 4, 1], dtype=np.float32)
k /= k.sum()
grid_smoothed = np.apply_along_axis(lambda m: np.convolve(m, k, mode='same'), axis=1, arr=grid_sub)
grid_smoothed = np.apply_along_axis(lambda m: np.convolve(m, k, mode='same'), axis=0, arr=grid_smoothed)

sub_ny, sub_nx = grid_smoothed.shape
px_idx = np.arange(0, full_nx, DS)[:sub_nx]
py_idx = np.arange(0, full_ny, DS)[:sub_ny]
PX, PY = np.meshgrid(px_idx, py_idx)
X_tile = X_MIN_T + PX / 256.0
Y_tile = Y_MIN_T + PY / 256.0

n_pow = 1 << Z
GRID_LONS = X_tile / n_pow * 360.0 - 180.0
GRID_LATS = np.degrees(np.arctan(np.sinh(np.pi * (1.0 - 2.0 * Y_tile / n_pow))))
X_SVG_GRID, Y_SVG_GRID = project_to_svg(GRID_LONS, GRID_LATS)

# Curated harmonious color palette - warm tan/gold tones, completely eliminating dark/jagged blocks
TERRAIN_LEVELS = [0, 200, 500, 1000, 1600, 2600, 9000]

TERRAIN_CONFIGS = [
    {"name": "coastal-plain", "fill": "#82a166", "desc": "0–200m Coastal Plain"},
    {"name": "plains",        "fill": "#99b275", "desc": "200–500m Mid Plains"},
    {"name": "hills",         "fill": "#c4b580", "desc": "500–1000m Low Hills (Sand/Tan)"},
    {"name": "highlands",     "fill": "#b89f70", "desc": "1000–1600m Highlands (Warm Tan)"},
    {"name": "mountains",     "fill": "#a78c5d", "desc": "1600–2600m Mountains (Tan Gold)"},
    {"name": "major-mount",   "fill": "#967b4e", "desc": "2600m+ High Mountains (Rich Tan)"},
]

cs = plt.contourf(X_SVG_GRID, Y_SVG_GRID, grid_smoothed, levels=TERRAIN_LEVELS)
contour_paths = cs.get_paths()

terrain_svg_layers = []
for i, (path, cfg) in enumerate(zip(contour_paths, TERRAIN_CONFIGS)):
    polys = path.to_polygons()
    path_strs = []
    for poly in polys:
        if len(poly) < 4:
            continue
        step = 2 if len(poly) > 36 else 1
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
    print(f"  Contour {cfg['desc']}: {len(path_strs)} smoothed vector polygons")

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
                g_svg = g_svg.simplify(1.0, preserve_topology=True)
                lines = [g_svg] if g_svg.geom_type == 'LineString' else (g_svg.geoms if g_svg.geom_type == 'MultiLineString' else [])
                for ln in lines:
                    coords = ln.coords
                    if len(coords) >= 2:
                        p_str = f"M {coords[0][0]:.1f} {coords[0][1]:.1f} " + " ".join([f"L {x:.1f} {y:.1f}" for x, y in coords[1:]])
                        major_river_paths_svg[matched_key].append(p_str)
        except Exception:
            pass

# ---------------------------------------------------------
# 6. LABELS (Typography Data)
# ---------------------------------------------------------
SEA_LABELS = [
    {"name": "MEDITERRANEAN SEA", "lon": 18.0, "lat": 35.5, "angle": 0, "size": 22},
    {"name": "OCEANUS ATLANTICUS", "lon": -10.0, "lat": 44.0, "angle": -50, "size": 24},
    {"name": "PONTUS EUXINUS (BLACK SEA)", "lon": 34.5, "lat": 43.5, "angle": 4, "size": 18},
    {"name": "MARE CASPIUM", "lon": 50.8, "lat": 42.0, "angle": 80, "size": 18},
    {"name": "NORTH SEA", "lon": 3.0, "lat": 56.5, "angle": 12, "size": 18},
    {"name": "MARE BALTICUM", "lon": 19.5, "lat": 57.5, "angle": 30, "size": 18},
    {"name": "SINUS PERSICUS", "lon": 52.0, "lat": 27.5, "angle": -38, "size": 18},
    {"name": "SINUS ARABICUS (RED SEA)", "lon": 37.0, "lat": 23.5, "angle": -55, "size": 20},
    {"name": "ARABIAN SEA", "lon": 58.0, "lat": 18.0, "angle": 20, "size": 20}
]

MOUNTAIN_RANGES = [
    {"name": "ATLAS MOUNTAINS", "center_lon": -4.0, "center_lat": 32.5, "angle": 18},
    {"name": "PYRENEES", "center_lon": 0.5, "center_lat": 42.7, "angle": -4},
    {"name": "ALPS", "center_lon": 10.0, "center_lat": 46.5, "angle": 12},
    {"name": "APENNINES", "center_lon": 13.0, "center_lat": 42.8, "angle": -52},
    {"name": "CARPATHIANS", "center_lon": 23.5, "center_lat": 47.5, "angle": -25},
    {"name": "DINARIC ALPS", "center_lon": 17.5, "center_lat": 43.5, "angle": -40},
    {"name": "BALKAN MOUNTAINS", "center_lon": 25.2, "center_lat": 42.8, "angle": -2},
    {"name": "SCANDINAVIAN MOUNTAINS", "center_lon": 12.0, "center_lat": 64.0, "angle": 55},
    {"name": "SCOTTISH HIGHLANDS", "center_lon": -4.5, "center_lat": 57.2, "angle": 38},
    {"name": "CAUCASUS", "center_lon": 44.5, "center_lat": 42.6, "angle": -22},
    {"name": "PONTIC MOUNTAINS", "center_lon": 36.8, "center_lat": 40.9, "angle": 2},
    {"name": "TAURUS MOUNTAINS", "center_lon": 34.0, "center_lat": 37.4, "angle": 14},
    {"name": "ZAGROS MOUNTAINS", "center_lon": 50.0, "center_lat": 32.0, "angle": -48},
    {"name": "ELBURZ MOUNTAINS", "center_lon": 52.5, "center_lat": 36.3, "angle": 5},
    {"name": "LEBANON MOUNTAINS", "center_lon": 36.0, "center_lat": 34.2, "angle": 65},
    {"name": "JUDEAN HIGHLANDS", "center_lon": 35.15, "center_lat": 31.7, "angle": 85},
    {"name": "SARAWAT MOUNTAINS", "center_lon": 41.5, "center_lat": 20.0, "angle": -60}
]

RIVER_LABEL_COORDS = [
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
    {"name": "Jordan", "lon": 35.5, "lat": 32.2, "angle": -85}
]

# ---------------------------------------------------------
# 7. ASSEMBLE CLEAN, EDITABLE SVG DOCUMENT
# ---------------------------------------------------------
print("Assembling complete, re-editable SVG document...")

svg_out = []
svg_out.append(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SVG_W} {SVG_H}" width="100%" height="100%"
     shape-rendering="geometricPrecision" text-rendering="geometricPrecision">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&amp;display=swap');

      /* Editable SVG Typography */
      .mountain-label {{
        font-family: 'Cinzel', serif, Georgia;
        font-weight: 800;
        font-size: 13.5px;
        letter-spacing: 3.5px;
        fill: #342416;
        stroke: #ece4d8;
        stroke-width: 3.2px;
        paint-order: stroke fill;
        text-anchor: middle;
      }}

      .sea-label {{
        font-family: 'Cinzel', serif, Georgia;
        font-style: italic;
        font-weight: 700;
        fill: #50789d;
        letter-spacing: 6.0px;
        text-anchor: middle;
        opacity: 0.90;
      }}

      .river-label {{
        font-family: 'Cinzel', serif, Georgia;
        font-style: italic;
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 1.5px;
        fill: #143d5f;
        stroke: #ffffff;
        stroke-width: 2.8px;
        paint-order: stroke fill;
        text-anchor: middle;
      }}

      /* Editable Border Lines & Rivers */
      .border-shadow {{
        stroke: #09121a;
        stroke-width: 5.2px;
        stroke-opacity: 0.35;
        stroke-linejoin: round;
        stroke-linecap: round;
      }}

      .border-line {{
        stroke: #121f2d;
        stroke-width: 3.4px;
        stroke-linejoin: round;
        stroke-linecap: round;
      }}

      .river-glow {{
        stroke: #3b6890;
        stroke-opacity: 0.35;
        stroke-linecap: round;
        stroke-linejoin: round;
      }}

      .river-main {{
        stroke: #164065;
        stroke-linecap: round;
        stroke-linejoin: round;
      }}
    </style>

    <!-- Land Clipping Path (Land minus Lakes) -->
    <clipPath id="land-clip">
      <path d="{geom_to_svg_path(pure_land_svg, min_area=30, tolerance=1.2)}" />
    </clipPath>

    <!-- Deep Water Gradient -->
    <linearGradient id="seaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#182c3f" />
      <stop offset="50%" stop-color="#213a52" />
      <stop offset="100%" stop-color="#162738" />
    </linearGradient>
  </defs>

  <!-- ======================================================= -->
  <!-- 1. SEA LAYER (<g id="sea">)                             -->
  <!-- ======================================================= -->
  <g id="sea">
    <!-- Deep Water Base -->
    <rect width="{SVG_W}" height="{SVG_H}" fill="url(#seaGradient)" />

    <!-- Coastal Shallows / Bathymetric Glow -->
    <path d="{geom_to_svg_path(land_svg_simp, min_area=40, tolerance=1.4)}" fill="none" stroke="#25425c" stroke-width="16" stroke-opacity="0.38" stroke-linejoin="round" />
    <path d="{geom_to_svg_path(land_svg_simp, min_area=40, tolerance=1.4)}" fill="none" stroke="#315679" stroke-width="7" stroke-opacity="0.45" stroke-linejoin="round" />

    <!-- Major Inland Lakes (Caspian, Aral, Van, Dead Sea) -->
    {f'<path id="lakes" d="{geom_to_svg_path(lakes_svg_simp, min_area=20, tolerance=1.0)}" fill="#1a3146" stroke="#264868" stroke-width="1.6" />' if lakes_svg_simp else ''}

    <!-- Subtle Historical Nautical Rhumb Lines -->
    <g id="rhumb-lines" opacity="0.16" stroke="#4a6d8c" stroke-width="0.8" stroke-dasharray="8,6">
      <line x1="200" y1="400" x2="1800" y2="1600" />
      <line x1="400" y1="1800" x2="1600" y2="400" />
      <line x1="800" y1="1200" x2="2200" y2="1400" />
      <line x1="600" y1="1400" x2="2400" y2="1100" />
    </g>

    <!-- Compass Rose in Atlantic Ocean -->
    <g id="compass-rose" transform="translate(340, 1600) scale(0.85)" opacity="0.55">
      <circle cx="0" cy="0" r="65" fill="none" stroke="#5d82a6" stroke-width="1.5" />
      <circle cx="0" cy="0" r="50" fill="none" stroke="#5d82a6" stroke-width="0.8" stroke-dasharray="4,3" />
      <path d="M 0 -65 L 11 -16 L 0 0 L -11 -16 Z" fill="#bfa370" />
      <path d="M 0 -65 L 0 0 L -11 -16 Z" fill="#8f764a" />
      <path d="M 65 0 L 16 11 L 0 0 L 16 -11 Z" fill="#bfa370" />
      <path d="M 65 0 L 0 0 L 16 -11 Z" fill="#8f764a" />
      <path d="M 0 65 L -11 16 L 0 0 L 11 16 Z" fill="#bfa370" />
      <path d="M 0 65 L 0 0 L 11 16 Z" fill="#8f764a" />
      <path d="M -65 0 L -16 -11 L 0 0 L -16 11 Z" fill="#bfa370" />
      <path d="M -65 0 L 0 0 L -16 11 Z" fill="#8f764a" />
      <circle cx="0" cy="0" r="5" fill="#2d2218" stroke="#d5b882" stroke-width="1.5" />
      <text x="0" y="-70" font-family="'Cinzel', serif" font-weight="800" font-size="13" fill="#d5b882" text-anchor="middle">N</text>
    </g>
  </g>

  <!-- ======================================================= -->
  <!-- 2. TERRAIN ELEVATION (<g id="terrain">)                 -->
  <!-- NASA SRTM DEM Contours (Smooth Tan/Gold Elevation Fills)-->
  <!-- ZERO TRIANGULAR PEAK GLYPHS                             -->
  <!-- ======================================================= -->
  <g id="terrain" clip-path="url(#land-clip)">
    <!-- Base Farmland / Lowland Green -->
    <rect width="{SVG_W}" height="{SVG_H}" fill="#82a166" />

    <!-- Arid Steppe & Desert (Sahara, Sinai, Arabia) -->
    <path id="terrain-desert" d="M 0 1200 L 2600 1200 L 2600 2200 L 0 2200 Z" fill="#ded09f" opacity="0.88" />
''')

for lyr in terrain_svg_layers:
    svg_out.append(f'''    <!-- {lyr["desc"]} -->
    <path id="{lyr["id"]}" d="{lyr["d"]}" fill="{lyr["fill"]}" />''')

svg_out.append('''  </g>

  <!-- ======================================================= -->
  <!-- 3. THICK BORDERS & COASTLINES (<g id="borders">)        -->
  <!-- Prominent, thick, crisp vector strokes                  -->
  <!-- ======================================================= -->
  <g id="borders">
    <!-- Shadow depth stroke -->
    <path class="border-shadow" d="''' + ' '.join(coast_paths_svg) + '''" fill="none" />
    <!-- Crisp main coastline border -->
    <path class="border-line" d="''' + ' '.join(coast_paths_svg) + '''" fill="none" />
  </g>

  <!-- ======================================================= -->
  <!-- 4. RIVERS (<g id="rivers">)                             -->
  <!-- 16 Major Rivers extracted from Natural Earth 10m        -->
  <!-- ======================================================= -->
  <g id="rivers" clip-path="url(#land-clip)">
''')

for rk, paths in major_river_paths_svg.items():
    if paths:
        is_major = rk in ['Nile', 'Danube', 'Rhine', 'Volga', 'Euphrates']
        w = 3.2 if is_major else 2.4
        glow_w = w + 2.2
        svg_out.append(f'''    <!-- River {rk} -->
    <g id="river-{rk.lower()}">
      <path class="river-glow" d="{' '.join(paths)}" fill="none" stroke-width="{glow_w}" />
      <path class="river-main" d="{' '.join(paths)}" fill="none" stroke-width="{w}" />
    </g>''')

svg_out.append('''  </g>

  <!-- ======================================================= -->
  <!-- 5. LABELS (<g id="labels">)                             -->
  <!-- Re-editable text elements with Cinzel typography        -->
  <!-- ======================================================= -->
  <g id="labels">
    <!-- Seas & Oceans -->
    <g id="labels-seas">
''')

for sea in SEA_LABELS:
    sx, sy = project_to_svg(sea["lon"], sea["lat"])
    rot_str = f' transform="rotate({sea["angle"]}, {sx:.1f}, {sy:.1f})"' if sea["angle"] != 0 else ""
    svg_out.append(f'''      <text class="sea-label" x="{sx:.1f}" y="{sy:.1f}" font-size="{sea["size"]}"{rot_str}>{sea["name"]}</text>''')

svg_out.append('''    </g>

    <!-- Mountain Ranges (16 Historical Ranges + Sarawat) -->
    <g id="labels-mountains">
''')

for mr in MOUNTAIN_RANGES:
    sx, sy = project_to_svg(mr["center_lon"], mr["center_lat"])
    rot_str = f' transform="rotate({mr["angle"]}, {sx:.1f}, {sy:.1f})"' if mr["angle"] != 0 else ""
    svg_out.append(f'''      <text class="mountain-label" x="{sx:.1f}" y="{sy:.1f}"{rot_str}>{mr["name"]}</text>''')

svg_out.append('''    </g>

    <!-- Major Rivers -->
    <g id="labels-rivers">
''')

for rlbl in RIVER_LABEL_COORDS:
    sx, sy = project_to_svg(rlbl["lon"], rlbl["lat"])
    rot_str = f' transform="rotate({rlbl["angle"]}, {sx:.1f}, {sy:.1f})"' if rlbl["angle"] != 0 else ""
    svg_out.append(f'''      <text class="river-label" x="{sx:.1f}" y="{sy:.1f}"{rot_str}>{rlbl["name"]}</text>''')

svg_out.append(f'''    </g>
  </g>

  <!-- ======================================================= -->
  <!-- 6. MAP FRAME & BORDERS (<g id="map-frame">)             -->
  <!-- Thick, stately border frame — NO CLOUDS / NO CIRCLES!   -->
  <!-- ======================================================= -->
  <g id="map-frame" pointer-events="none">
    <!-- Outer Decorative Border Lines -->
    <rect x="14" y="14" width="{SVG_W - 28}" height="{SVG_H - 28}" fill="none" stroke="#221811" stroke-width="10" rx="3" />
    <rect x="22" y="22" width="{SVG_W - 44}" height="{SVG_H - 44}" fill="none" stroke="#b08a46" stroke-width="3.5" />
    <rect x="28" y="28" width="{SVG_W - 56}" height="{SVG_H - 56}" fill="none" stroke="#443224" stroke-width="1.8" stroke-dasharray="8,6" />

    <!-- Corner Accents -->
    <g fill="#b08a46">
      <rect x="12" y="12" width="28" height="28" />
      <rect x="{SVG_W - 40}" y="12" width="28" height="28" />
      <rect x="12" y="{SVG_H - 40}" width="28" height="28" />
      <rect x="{SVG_W - 40}" y="{SVG_H - 40}" width="28" height="28" />
      <circle cx="26" cy="26" r="4.5" fill="#221811" />
      <circle cx="{SVG_W - 26}" cy="26" r="4.5" fill="#221811" />
      <circle cx="26" cy="{SVG_H - 26}" r="4.5" fill="#221811" />
      <circle cx="{SVG_W - 26}" cy="{SVG_H - 26}" r="4.5" fill="#221811" />
    </g>

    <!-- Top Classical Banner -->
    <g transform="translate({SVG_W // 2}, 64)">
      <rect x="-310" y="-32" width="620" height="52" rx="6" fill="#18130e" stroke="#b08a46" stroke-width="2.5" opacity="0.95" />
      <rect x="-304" y="-26" width="608" height="40" fill="none" stroke="#8a6932" stroke-width="1" stroke-dasharray="5,3" />
      <text font-family="'Cinzel', serif" font-weight="900" x="0" y="-7" font-size="17" fill="#e8c988" text-anchor="middle" letter-spacing="4px">THEATRVM BELLI ORBIS ANTIQVI</text>
      <text font-family="'Cinzel', serif" font-weight="700" x="0" y="9" font-size="10.5" fill="#bfa576" text-anchor="middle" letter-spacing="2.5px">EUROPA • ASIA OCCIDENTALIS • ARABIA • AFRICA</text>
    </g>

    <!-- Terrain Legend in Bottom Left -->
    <g transform="translate(60, {SVG_H - 225})">
      <rect x="0" y="0" width="240" height="165" rx="6" fill="#14100c" stroke="#967438" stroke-width="2.2" opacity="0.94" />
      <text font-family="'Cinzel', serif" font-weight="900" x="120" y="22" font-size="12" fill="#e8c988" text-anchor="middle" letter-spacing="2px">TERRAIN ELEVATION</text>
      <line x1="20" y1="28" x2="220" y2="28" stroke="#82622d" stroke-width="1" />

      <rect x="22" y="38" width="18" height="11" fill="#82a166" stroke="#2b2016" />
      <text font-family="'Cinzel', serif" font-size="10" fill="#dedede" x="50" y="47">0–200m Coastal Plain</text>

      <rect x="22" y="55" width="18" height="11" fill="#99b275" stroke="#2b2016" />
      <text font-family="'Cinzel', serif" font-size="10" fill="#dedede" x="50" y="64">200–500m Plains</text>

      <rect x="22" y="72" width="18" height="11" fill="#c4b580" stroke="#2b2016" />
      <text font-family="'Cinzel', serif" font-size="10" fill="#dedede" x="50" y="81">500–1000m Low Hills (Tan)</text>

      <rect x="22" y="89" width="18" height="11" fill="#b89f70" stroke="#2b2016" />
      <text font-family="'Cinzel', serif" font-size="10" fill="#dedede" x="50" y="98">1000–1600m Highlands (Warm)</text>

      <rect x="22" y="106" width="18" height="11" fill="#a78c5d" stroke="#2b2016" />
      <text font-family="'Cinzel', serif" font-size="10" fill="#dedede" x="50" y="115">1600–2600m Mountains (Gold)</text>

      <rect x="22" y="123" width="18" height="11" fill="#967b4e" stroke="#2b2016" />
      <text font-family="'Cinzel', serif" font-size="10" fill="#dedede" x="50" y="132">2600m+ High Mountains</text>

      <rect x="22" y="140" width="18" height="11" fill="#ded09f" stroke="#2b2016" />
      <text font-family="'Cinzel', serif" font-size="10" fill="#dedede" x="50" y="149">Desert / Arid Steppe</text>
    </g>
  </g>
</svg>
''')

final_svg = "\n".join(svg_out)
print(f"Generated complete vector SVG: {len(final_svg):,} characters.")

for dest in ["public/campaign_map.svg", "campaign_map.svg"]:
    with open(dest, "w", encoding="utf-8") as f:
        f.write(final_svg)
    print(f"Saved: {dest} ({os.path.getsize(dest)/1024/1024:.2f} MB)")

print(f"--- Completed in {time.time() - t0:.1f}s ---")
