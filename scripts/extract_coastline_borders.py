#!/usr/bin/env python3
"""
Extract Natural Earth 1:10m coastline data as screen-space border segments
for zoom-invariant rendering in the React canvas layer.
Replaces country borders (ne_10m_admin_0_boundary_lines_land.geojson)
with sea/coastline borders (ne_10m_coastline.geojson).
"""

import json
import math
import numpy as np
from shapely.geometry import shape, Polygon, MultiPolygon, LineString, MultiLineString
from shapely.ops import transform

print("--- Extracting Coastline Sea Borders ---")

# --------------------------------------------------------
# Projection (must match build_clean_vector_map.py)
# --------------------------------------------------------
LON0 = 24.0
LAT0 = 38.0
LON0_RAD = math.radians(LON0)
LAT0_RAD = math.radians(LAT0)

def project_lonlat(lon, lat):
    lons_rad = math.radians(lon) if not hasattr(lon, '__len__') else np.radians(lon)
    lats_rad = math.radians(lat) if not hasattr(lat, '__len__') else np.radians(lat)
    dlon = lons_rad - LON0_RAD
    cos_c = math.sin(LAT0_RAD)*math.sin(lats_rad) + math.cos(LAT0_RAD)*math.cos(lats_rad)*math.cos(dlon) if not hasattr(lon, '__len__') else \
            np.sin(LAT0_RAD)*np.sin(lats_rad) + np.cos(LAT0_RAD)*np.cos(lats_rad)*np.cos(dlon)
    if hasattr(cos_c, 'clip'):
        cos_c = np.clip(cos_c, -1.0, 1.0)
    else:
        cos_c = max(-1.0, min(1.0, cos_c))
    k = np.sqrt(2.0 / (1.0 + cos_c)) if hasattr(cos_c, '__len__') else math.sqrt(2.0 / (1.0 + cos_c))
    x = k * (np.cos(lats_rad) if hasattr(lats_rad, '__len__') else math.cos(lats_rad)) * (np.sin(dlon) if hasattr(dlon, '__len__') else math.sin(dlon))
    y = k * ((np.cos(LAT0_RAD)*np.sin(lats_rad) - np.sin(LAT0_RAD)*np.cos(lats_rad)*np.cos(dlon)) if hasattr(lats_rad, '__len__') else
             (math.cos(LAT0_RAD)*math.sin(lats_rad) - math.sin(LAT0_RAD)*math.cos(lats_rad)*math.cos(dlon)))
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

def project_to_svg_scalar(lon, lat):
    px, py = project_lonlat(lon, lat)
    sx = OFFSET_X + (px - XMIN_P) * SCALE_P
    sy = SVG_H - (OFFSET_Y + (py - YMIN_P) * SCALE_P)
    return sx, sy

def shapely_transform_to_svg(x, y):
    lons = np.asarray(x)
    lats = np.asarray(y)
    dlon = np.radians(lons) - LON0_RAD
    lats_rad = np.radians(lats)
    cos_c = np.sin(LAT0_RAD)*np.sin(lats_rad) + np.cos(LAT0_RAD)*np.cos(lats_rad)*np.cos(dlon)
    cos_c = np.clip(cos_c, -1.0, 1.0)
    k = np.sqrt(2.0 / (1.0 + cos_c))
    px = k * np.cos(lats_rad) * np.sin(dlon)
    py = k * (np.cos(LAT0_RAD)*np.sin(lats_rad) - np.sin(LAT0_RAD)*np.cos(lats_rad)*np.cos(dlon))
    sx = OFFSET_X + (px - XMIN_P) * SCALE_P
    sy = SVG_H - (OFFSET_Y + (py - YMIN_P) * SCALE_P)
    return sx, sy

# --------------------------------------------------------
# Map boundary (same as build script)
# --------------------------------------------------------
MAP_BOUNDARY_COORDS = [
    (-13.0, 71.0), (61.5, 71.0), (61.5, 36.0), (61.5, 25.0),
    (59.8, 22.5), (55.0, 17.0), (48.5, 13.8), (43.2, 12.4),
    (38.0, 14.5), (34.0, 19.5), (24.0, 20.0), (10.0, 20.5),
    (-2.0, 21.0), (-13.0, 25.0), (-13.0, 71.0)
]
boundary_poly_geo = Polygon(MAP_BOUNDARY_COORDS)

# --------------------------------------------------------
# Load and project coastlines
# --------------------------------------------------------
print("Loading ne_10m_coastline.geojson...")
with open('data/ne_10m_coastline.geojson') as f:
    coast_geojson = json.load(f)

all_border_segments = []
total_features = len(coast_geojson['features'])
print(f"  Total coastline features: {total_features}")

for i, feat in enumerate(coast_geojson['features']):
    geom = shape(feat['geometry'])
    if not geom.intersects(boundary_poly_geo):
        continue
    try:
        clipped = geom.intersection(boundary_poly_geo)
        if clipped.is_empty:
            continue
        # Simplify for performance — 0.04 deg tolerance is fine for screen rendering
        clipped = clipped.simplify(0.03, preserve_topology=True)
        if clipped.is_empty:
            continue

        lines = []
        if clipped.geom_type == 'LineString':
            lines = [clipped]
        elif clipped.geom_type == 'MultiLineString':
            lines = list(clipped.geoms)
        elif clipped.geom_type == 'GeometryCollection':
            for g in clipped.geoms:
                if g.geom_type in ('LineString', 'MultiLineString'):
                    if g.geom_type == 'LineString':
                        lines.append(g)
                    else:
                        lines.extend(g.geoms)

        for ln in lines:
            coords = list(ln.coords)
            if len(coords) < 2:
                continue
            # Project to SVG space
            svg_pts = []
            for (lon, lat) in coords:
                sx, sy = project_to_svg_scalar(lon, lat)
                svg_pts.append([round(sx, 1), round(sy, 1)])
            all_border_segments.append(svg_pts)

    except Exception as e:
        pass

print(f"  Extracted {len(all_border_segments)} coastline segments")

# Write out as JSON array of polylines (same format as realBorders.json)
out_path = 'src/app/realBorders.json'
with open(out_path, 'w') as f:
    json.dump(all_border_segments, f, separators=(',', ':'))

file_size = sum(len(str(s)) for s in all_border_segments)
print(f"Written to {out_path} ({len(all_border_segments)} segments)")
print("--- Done ---")
