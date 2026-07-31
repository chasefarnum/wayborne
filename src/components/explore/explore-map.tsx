"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import { CHARACTER_TAGS, stopGroupOf } from "@/lib/explore";
import type { SegmentRow, StopRow } from "@/lib/explore";
import { simplifyLine } from "@/lib/route";
import type { LonLat } from "@/lib/route";

// Catskills / Hudson Valley at a regional zoom; the camera stays put until
// traced geometry or a rider's line gives fitBounds something real to frame.
const INITIAL_CENTER: [number, number] = [-74.35, 41.95];
const INITIAL_ZOOM = 8;
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
const FALLBACK_COLOR = "#57534e";

// The corridor band is geographically honest: 5 mi each side of the line
// (matching the RPC's ST_DWithin radius), drawn as a wide line whose pixel
// width tracks zoom exactly. Meters-per-pixel halves per zoom level, so an
// exponential base-2 interpolation between zoom 0 and 24 renders a constant
// ground width. Base width: corridor meters / meters-per-pixel at zoom 0 and
// the region's latitude (~42 N).
const CORRIDOR_WIDTH_M = 2 * 8046.72;
const CORRIDOR_BASE_PX =
  CORRIDOR_WIDTH_M / ((156543.03392 * Math.cos((42 * Math.PI) / 180)) / 1);
const CORRIDOR_WIDTH: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["exponential", 2],
  ["zoom"],
  0,
  CORRIDOR_BASE_PX,
  24,
  CORRIDOR_BASE_PX * 2 ** 24,
];
// Tuned against alidade_smooth_dark: a warm lift of the dark land color, so
// the band still reads as a highlighted swath of the map itself.
const CORRIDOR_COLOR = "#2c2a27";
const DIM_OPACITY = 0.25;
const LINE_DRAW_MS = 400;

// PostgREST serializes traced geography columns as GeoJSON; untraced rows are
// null and stay off the map (spec: omitted from the map, still listable).
function geometryOf(geom: unknown): Geometry | null {
  if (geom && typeof geom === "object" && "type" in geom && "coordinates" in geom) {
    return geom as Geometry;
  }
  return null;
}

function toFeature(sweepId: string | null, geom: unknown, color: string): Feature | null {
  const geometry = geometryOf(geom);
  if (!geometry || !sweepId) return null;
  return { type: "Feature", geometry, properties: { sweepId, color } };
}

function endpointFeatures(points: { at: LonLat; label: string }[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map(({ at, label }) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: at },
      properties: { label },
    })),
  };
}

function lineBounds(coords: LonLat[]): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds(coords[0], coords[0]);
  for (const c of coords) bounds.extend(c);
  return bounds;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ExploreMap({
  segments,
  stops,
  selectedId,
  onSelectAction,
  entryTaps = null,
  onMapTapAction,
  routeLine = null,
  dimOutsideIds = null,
}: {
  segments: SegmentRow[];
  stops: StopRow[];
  selectedId: string | null;
  onSelectAction: (sweepId: string | null) => void;
  // Non-null puts the map in route entry: clicks place taps instead of
  // selecting content, and placed taps render as A/B markers.
  entryTaps?: { start: LonLat | null; end: LonLat | null } | null;
  onMapTapAction?: (at: LonLat) => void;
  // The rider's active line: drawn in over ~400ms, corridor band after.
  routeLine?: GeoJSON.LineString | null;
  // Route mode dimming: sweep ids allowed at full strength; everything else
  // whispers. Null restores the catalog presentation exactly.
  dimOutsideIds?: Set<string> | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Latest-callback refs, written in an effect (react-hooks/refs bans render
  // writes); map click handlers read them at event time, after effects run.
  const onSelectRef = useRef(onSelectAction);
  const onMapTapRef = useRef(onMapTapAction);
  const entryActiveRef = useRef(entryTaps !== null);
  useEffect(() => {
    onSelectRef.current = onSelectAction;
    onMapTapRef.current = onMapTapAction;
    entryActiveRef.current = entryTaps !== null;
  }, [onSelectAction, onMapTapAction, entryTaps]);

  const segmentData = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: segments
        .map((s) =>
          toFeature(
            s.sweep_id,
            s.geom,
            CHARACTER_TAGS.find((t) => t.value === s.character[0])?.color ?? FALLBACK_COLOR
          )
        )
        .filter((f): f is Feature => f !== null),
    }),
    [segments]
  );

  const stopData = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: stops
        .map((s) => toFeature(s.sweep_id, s.geom, stopGroupOf(s.category)?.color ?? FALLBACK_COLOR))
        .filter((f): f is Feature => f !== null),
    }),
    [stops]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL!,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("segments", { type: "geojson", data: EMPTY });
      map.addSource("stops", { type: "geojson", data: EMPTY });
      map.addSource("route", { type: "geojson", data: EMPTY });
      // The corridor gets its own, aggressively simplified copy of the line:
      // routed lines carry thousands of vertices, and sub-pixel vertex
      // spacing under a very wide stroke makes the round joins overdraw into
      // fan artifacts. Simplification error is meters; the band is 5 miles.
      map.addSource("corridor", { type: "geojson", data: EMPTY });
      map.addSource("route-points", { type: "geojson", data: EMPTY });

      // The corridor band slots into the basemap stack below water, roads,
      // and labels (an opaque tint of the land color), so it reads as a
      // highlighted swath of the map itself. Opaque matters: MapLibre draws
      // translucent lines without depth culling, and a translucent band this
      // wide fans into overlap artifacts at every bend.
      map.addLayer(
        {
          id: "route-corridor",
          type: "line",
          source: "corridor",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": CORRIDOR_COLOR,
            "line-width": CORRIDOR_WIDTH,
            "line-opacity": 0,
          },
        },
        map.getLayer("water") ? "water" : undefined
      );
      // Curated road lines insert below the basemap's first symbol layer:
      // street names and shields must stay readable over our overlays, or the
      // rider can't tell which road the line is on.
      const firstSymbolId = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
      map.addLayer(
        {
          id: "segments-line",
          type: "line",
          source: "segments",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ["get", "color"], "line-width": 3.5, "line-opacity": 0.85 },
        },
        firstSymbolId
      );
      map.addLayer({
        id: "stops-circle",
        type: "circle",
        source: "stops",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 6,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ede0c8", // bone, never pure white
        },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#fafaf9", "line-width": 3, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "route-points-circle",
        type: "circle",
        source: "route-points",
        paint: {
          "circle-color": "#c9611e", // paint orange (round 4): waypoints wear the accent
          "circle-radius": 10,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0a0a0b",
        },
      });
      map.addLayer({
        id: "route-points-label",
        type: "symbol",
        source: "route-points",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-font": ["Stadia Semibold"],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#0a0a0b" },
      });

      for (const layer of ["segments-line", "stops-circle"]) {
        map.on("click", layer, (e) => {
          if (entryActiveRef.current) return; // entry taps win over selection
          const sweepId = e.features?.[0]?.properties?.sweepId;
          if (typeof sweepId === "string") onSelectRef.current(sweepId);
        });
        map.on("mouseenter", layer, () => {
          if (!entryActiveRef.current) map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          if (!entryActiveRef.current) map.getCanvas().style.cursor = "";
        });
      }
      map.on("click", (e) => {
        if (!entryActiveRef.current) return;
        onMapTapRef.current?.([e.lngLat.lng, e.lngLat.lat]);
      });
      setLoaded(true);
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    (map.getSource("segments") as maplibregl.GeoJSONSource).setData(segmentData);
    (map.getSource("stops") as maplibregl.GeoJSONSource).setData(stopData);
  }, [loaded, segmentData, stopData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const isSelected = ["==", ["get", "sweepId"], selectedId ?? ""];
    map.setPaintProperty("segments-line", "line-width", ["case", isSelected, 6, 3.5]);
    map.setPaintProperty("stops-circle", "circle-radius", ["case", isSelected, 9, 6]);
  }, [loaded, selectedId]);

  // Entry mode: crosshair cursor and A/B markers for placed taps.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    map.getCanvas().style.cursor = entryTaps ? "crosshair" : "";
    if (routeLine) return; // active route owns the points source below
    const points: { at: LonLat; label: string }[] = [];
    if (entryTaps?.start) points.push({ at: entryTaps.start, label: "A" });
    if (entryTaps?.end) points.push({ at: entryTaps.end, label: "B" });
    (map.getSource("route-points") as maplibregl.GeoJSONSource).setData(
      endpointFeatures(points)
    );
  }, [loaded, entryTaps, routeLine]);

  // The rider's line: draws A-to-B over ~400ms so the rider sees it is their
  // route, then the corridor fades up ("your line, then what's near it").
  // Reduced motion: both land instantly. Clearing the route empties the
  // sources and restores the catalog presentation exactly.
  const drawFrameRef = useRef(0);
  const corridorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const routeSource = map.getSource("route") as maplibregl.GeoJSONSource;
    const corridorSource = map.getSource("corridor") as maplibregl.GeoJSONSource;
    const pointsSource = map.getSource("route-points") as maplibregl.GeoJSONSource;

    cancelAnimationFrame(drawFrameRef.current);
    if (corridorTimerRef.current) clearTimeout(corridorTimerRef.current);

    if (!routeLine) {
      routeSource.setData(EMPTY);
      corridorSource.setData(EMPTY);
      map.setPaintProperty("route-corridor", "line-opacity", 0);
      return;
    }

    const coords = routeLine.coordinates as LonLat[];
    const asLine = (c: LonLat[]): Feature => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: c },
      properties: {},
    });
    pointsSource.setData(
      endpointFeatures([
        { at: coords[0], label: "A" },
        { at: coords[coords.length - 1], label: "B" },
      ])
    );
    corridorSource.setData({
      type: "FeatureCollection",
      features: [asLine(simplifyLine(routeLine, 200).coordinates as LonLat[])],
    });
    map.fitBounds(lineBounds(coords), {
      padding: 64,
      duration: prefersReducedMotion() ? 0 : 600,
    });

    const showCorridor = () => {
      map.setPaintProperty("route-corridor", "line-opacity-transition", {
        duration: prefersReducedMotion() ? 0 : 250,
      });
      map.setPaintProperty("route-corridor", "line-opacity", 1);
    };

    if (prefersReducedMotion()) {
      routeSource.setData({ type: "FeatureCollection", features: [asLine(coords)] });
      showCorridor();
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / LINE_DRAW_MS);
      const count = Math.max(2, Math.ceil(coords.length * t));
      routeSource.setData({
        type: "FeatureCollection",
        features: [asLine(coords.slice(0, count))],
      });
      if (t < 1) {
        drawFrameRef.current = requestAnimationFrame(step);
      } else {
        corridorTimerRef.current = setTimeout(showCorridor, 50);
      }
    };
    drawFrameRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(drawFrameRef.current);
      if (corridorTimerRef.current) clearTimeout(corridorTimerRef.current);
    };
  }, [loaded, routeLine]);

  // Route-mode dimming: in-corridor content full strength, the rest at a
  // whisper. Filter changes swap pins in the same render pass as the list
  // (one beat); null restores catalog opacities exactly.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    if (!dimOutsideIds) {
      map.setPaintProperty("segments-line", "line-opacity", 0.85);
      map.setPaintProperty("stops-circle", "circle-opacity", 1);
      map.setPaintProperty("stops-circle", "circle-stroke-opacity", 1);
      return;
    }
    const inCorridor: maplibregl.ExpressionSpecification = [
      "in",
      ["get", "sweepId"],
      ["literal", [...dimOutsideIds]],
    ];
    map.setPaintProperty("segments-line", "line-opacity", [
      "case",
      inCorridor,
      0.85,
      DIM_OPACITY,
    ]);
    map.setPaintProperty("stops-circle", "circle-opacity", ["case", inCorridor, 1, DIM_OPACITY]);
    map.setPaintProperty("stops-circle", "circle-stroke-opacity", [
      "case",
      inCorridor,
      1,
      DIM_OPACITY,
    ]);
  }, [loaded, dimOutsideIds]);

  const tracedCount = segmentData.features.length + stopData.features.length;
  const listedCount = segments.length + stops.length;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {loaded && tracedCount === 0 && listedCount > 0 && (
        <p className="absolute bottom-4 left-4 max-w-xs rounded-md bg-background/90 px-3 py-1.5 text-sm text-muted-foreground">
          {`Geometry tracing is next: ${segments.length} roads and ${stops.length} stops are listed on the left and land here as they're traced.`}
        </p>
      )}
      {entryTaps && (
        <p
          role="status"
          className="absolute bottom-4 left-4 rounded-md bg-background/90 px-3 py-1.5 text-sm"
        >
          {entryTaps.start ? "Start set. Tap your end." : "Tap your start, tap your end. We draw the line."}
        </p>
      )}
    </div>
  );
}
