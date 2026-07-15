"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import { CHARACTER_TAGS, stopGroupOf } from "@/lib/explore";
import type { SegmentRow, StopRow } from "@/lib/explore";

// Catskills / Hudson Valley at a regional zoom; the camera stays put until
// traced geometry gives fitBounds something real to frame.
const INITIAL_CENTER: [number, number] = [-74.35, 41.95];
const INITIAL_ZOOM = 8;
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
const FALLBACK_COLOR = "#57534e";

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

export default function ExploreMap({
  segments,
  stops,
  selectedId,
  onSelectAction,
}: {
  segments: SegmentRow[];
  stops: StopRow[];
  selectedId: string | null;
  onSelectAction: (sweepId: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

  const onSelectRef = useRef(onSelectAction);
  onSelectRef.current = onSelectAction;

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
      map.addLayer({
        id: "segments-line",
        type: "line",
        source: "segments",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 3.5, "line-opacity": 0.85 },
      });
      map.addLayer({
        id: "stops-circle",
        type: "circle",
        source: "stops",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 6,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });
      for (const layer of ["segments-line", "stops-circle"]) {
        map.on("click", layer, (e) => {
          const sweepId = e.features?.[0]?.properties?.sweepId;
          if (typeof sweepId === "string") onSelectRef.current(sweepId);
        });
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }
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
    </div>
  );
}
