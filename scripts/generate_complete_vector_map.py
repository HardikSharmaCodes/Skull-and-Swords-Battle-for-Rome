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

def unproject_lonlat(x, y):
    rho = np.hypot(x, y)
    rho_safe = np.where(rho == 0, 1e-12, rho)
    c = 2.0 * np.arcsin(np.clip(rho / 2.0, -1.0, 1.0))
    sin_c = np.sin(c)
    cos_c = np.cos(c)
    sin_lat = cos_c * np.sin(LAT0_RAD) + (y * sin_c * np.cos(LAT0_RAD)) / rho_safe
    sin_lat = np.clip(sin_lat, -1.0, 1.0)
    lat = np.arcsin(sin_lat)
    denom = rho_safe * np.cos(LAT0_RAD) * cos_c - y * np.sin(LAT0_RAD) * sin_c
    dlon = np.arctan2(x * sin_c, denom)
    lon = LON0_RAD + dlon
    lat = np.where(rho == 0, LAT0_RAD, lat)
    lon = np.where(rho == 0, LON0_RAD, lon)
    return np.degrees(lon), np.degrees(lat)

# Terrain thresholds — exact classes as specified:
# Sea: < 0m  (handled by sea background rect)
# Coastal Plain: 0–200m
# Plains: 200–500m
# Hills: 500–1000m
# Highlands: 1000–1500m
# Mountains: 1500–2500m
# Major Mountains: 2500m+
TERRAIN_LEVELS = [0, 200, 500, 1000, 1500, 2500, 9000]

# Vivid physical-relief colour palette — each band is immediately distinguishable
TERRAIN_CONFIGS = [
    {"name": "coastal-plain", "fill": "#7eb866", "desc": "0–200m Coastal Plain"},
    {"name": "plains",        "fill": "#b8ce58", "desc": "200–500m Plains"},
    {"name": "hills",         "fill": "#e5be52", "desc": "500–1000m Hills"},
    {"name": "highlands",     "fill": "#cb8442", "desc": "1000–1500m Highlands"},
    {"name": "mountains",     "fill": "#9c4e24", "desc": "1500–2500m Mountains"},
    {"name": "major-mount",   "fill": "#ded8d0", "desc": "2500m+ Major Mountains"},
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
# 4b. EXPORT TERRAIN ELEVATION COORDINATES (x, y, elevation)
# ---------------------------------------------------------
print("Exporting terrain elevation points (x, y, elevation)...")
grid_step = 10
grid_xs = np.arange(0, SVG_W + 1, grid_step)
grid_ys = np.arange(0, SVG_H + 1, grid_step)
mesh_x, mesh_y = np.meshgrid(grid_xs, grid_ys)

proj_x = (mesh_x - OFFSET_X) / SCALE_P + XMIN_P
proj_y = (SVG_H - mesh_y - OFFSET_Y) / SCALE_P + YMIN_P
pts_lons, pts_lats = unproject_lonlat(proj_x, proj_y)

X_tile_pts = (pts_lons + 180.0) / 360.0 * n_pow
lats_rad_pts = np.radians(np.clip(pts_lats, -85.05, 85.05))
Y_tile_pts = (1.0 - np.log(np.tan(lats_rad_pts) + 1.0 / np.cos(lats_rad_pts)) / np.pi) / 2.0 * n_pow
dpx_pts = np.clip(np.round((X_tile_pts - X_MIN_T) * 256.0).astype(int), 0, full_nx - 1)
dpy_pts = np.clip(np.round((Y_tile_pts - Y_MIN_T) * 256.0).astype(int), 0, full_ny - 1)

grid_elevations = dem_grid[dpy_pts, dpx_pts]

elevation_points = [
    [int(x), int(y), int(round(float(elev)))]
    for x, y, elev in zip(mesh_x.flatten(), mesh_y.flatten(), grid_elevations.flatten())
]

for dest_json in ['src/app/elevationData.json', 'public/elevationData.json']:
    with open(dest_json, 'w') as f:
        json.dump(elevation_points, f, separators=(',', ':'))
print(f"Saved {len(elevation_points)} (x,y,elevation) points to src/app/elevationData.json ({os.path.getsize('src/app/elevationData.json')/1024:.1f} KB)")

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
# Also collect raw coordinate arrays per river for the JSON export
major_river_coords = {k: [] for k in MAJOR_RIVERS_KEYS}

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
                        # Store coordinate pairs for JSON: [[x, y], ...]
                        major_river_coords[matched_key].append(
                            [[round(x, 1), round(y, 1)] for x, y in coords]
                        )
        except Exception:
            pass

# ---------------------------------------------------------
# 5b. EXPORT RIVER COORDINATES (riversData.json)
# ---------------------------------------------------------
print("Exporting river coordinate data...")
rivers_export = {}
for rk, segments in major_river_coords.items():
    if not segments:
        continue
    all_pts = [pt for seg in segments for pt in seg]
    xs = [pt[0] for pt in all_pts]
    ys = [pt[1] for pt in all_pts]
    cx = round(sum(xs) / len(xs), 1)
    cy = round(sum(ys) / len(ys), 1)
    rivers_export[rk] = {
        "name": rk,
        "svgId": f"river-{rk.lower()}",
        "segments": segments,
        "bbox": {
            "xMin": round(min(xs), 1),
            "xMax": round(max(xs), 1),
            "yMin": round(min(ys), 1),
            "yMax": round(max(ys), 1),
        },
        "centroid": [cx, cy],
    }
    print(f"  {rk}: {len(segments)} segment(s), centroid=({cx:.0f}, {cy:.0f})")

for dest_rivers in ['src/app/riversData.json', 'public/riversData.json']:
    with open(dest_rivers, 'w') as f:
        json.dump(rivers_export, f, separators=(',', ':'))
print(f"Saved riversData.json ({os.path.getsize('src/app/riversData.json')/1024:.1f} KB)")

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
    <style><![CDATA[
      /* Border Lines & Rivers */
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
    ]]></style>

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

    <!-- Vintage Nautical Sea Gradient -->
    <linearGradient id="vintageSeaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#223342" />
      <stop offset="50%" stop-color="#2b3e4f" />
      <stop offset="100%" stop-color="#1d2b38" />
    </linearGradient>
  </defs>

  <!-- ======================================================= -->
  <!-- 1. SEA LAYER (<g id="sea">)                             -->
  <!-- ======================================================= -->
  <g id="sea">
    <!-- Deep Water Base for Terrain Mode -->
    <rect id="sea-terrain-bg" width="{SVG_W}" height="{SVG_H}" fill="url(#seaGradient)" />
    <!-- Antique Water Base for Vintage Paper Mode -->
    <rect id="sea-vintage-bg" width="{SVG_W}" height="{SVG_H}" fill="url(#vintageSeaGradient)" style="display: none;" />

    <!-- Coastal Shallows / Bathymetric Glow -->
    <path d="{geom_to_svg_path(land_svg_simp, min_area=40, tolerance=1.4)}" fill="none" stroke="#25425c" stroke-width="16" stroke-opacity="0.38" stroke-linejoin="round" />
    <path d="{geom_to_svg_path(land_svg_simp, min_area=40, tolerance=1.4)}" fill="none" stroke="#315679" stroke-width="7" stroke-opacity="0.45" stroke-linejoin="round" />

    <!-- Major Inland Lakes (Caspian, Aral, Van, Dead Sea) -->
    {f'<path id="lakes" d="{geom_to_svg_path(lakes_svg_simp, min_area=20, tolerance=1.0)}" fill="#1a3146" stroke="#264868" stroke-width="1.6" />' if lakes_svg_simp else ''}
  </g>

  <!-- ======================================================= -->
  <!-- 2a. TERRAIN ELEVATION (<g id="terrain">)                 -->
  <!-- NASA SRTM DEM Contours (Smooth Tan/Gold Elevation Fills)-->
  <!-- ======================================================= -->
  <g id="terrain" clip-path="url(#land-clip)">
    <!-- Base Farmland / Lowland Green matching 0–200m Coastal Plain -->
    <rect width="{SVG_W}" height="{SVG_H}" fill="#7eb866" />
''')

for lyr in terrain_svg_layers:
    svg_out.append(f'''    <!-- {lyr["desc"]} -->
    <path id="{lyr["id"]}" d="{lyr["d"]}" fill="{lyr["fill"]}" />''')

svg_out.append(f'''  </g>

  <!-- ======================================================= -->
  <!-- 2b. VINTAGE PAPER MAP TEXTURE (<g id="vintage-paper">)  -->
  <!-- Land map covered in authentic vintage parchment texture -->
  <!-- ======================================================= -->
  <g id="vintage-paper" clip-path="url(#land-clip)" style="display: none;">
    <!-- Base warm parchment undercoat -->
    <rect width="{SVG_W}" height="{SVG_H}" fill="#ebdcb9" />
    <!-- High-resolution aged parchment map texture -->
    <image href="/vintage_paper.jpg" width="{SVG_W}" height="{SVG_H}" preserveAspectRatio="none" />
  </g>
''')

# Load pre-computed watershed border lines
watershed_borders_file = 'data/watershed_border_lines.json'
if os.path.exists(watershed_borders_file):
    with open(watershed_borders_file) as f:
        wb_data = json.load(f)
    w_border_d = wb_data.get('border_d', '')
    
    svg_out.append(f'''  <!-- ======================================================= -->
  <!-- 2c. PRE-COMPUTED WATERSHED VECTOR BORDERS (<g id="watershed-borders">) -->
  <!-- Pure Cost-Weighted Distance with terrain, rivers & water calculated     -->
  <!-- Vector white lines with non-scaling-stroke (fixed screen thickness)      -->
  <!-- ======================================================= -->
  <g id="watershed-borders" clip-path="url(#land-clip)">
    <!-- Shadow stroke for high contrast against any terrain -->
    <path class="watershed-border-shadow" d="{w_border_d}" fill="none"
          stroke="rgba(0, 0, 0, 0.70)" stroke-width="2.8"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round" stroke-linecap="round" />
    <!-- Crisp pure white vector line that does not change thickness on zoom -->
    <path class="watershed-border-white" d="{w_border_d}" fill="none"
          stroke="#ffffff" stroke-width="1.6"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round" stroke-linecap="round" />
  </g>
''')

svg_out.append(f'''  <!-- ======================================================= -->
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
</svg>
''')

final_svg = "\n".join(svg_out)
print(f"Generated complete vector SVG: {len(final_svg):,} characters.")

for dest in ["public/campaign_map.svg", "campaign_map.svg"]:
    with open(dest, "w", encoding="utf-8") as f:
        f.write(final_svg)
    print(f"Saved: {dest} ({os.path.getsize(dest)/1024/1024:.2f} MB)")

print(f"--- Completed in {time.time() - t0:.1f}s ---")
