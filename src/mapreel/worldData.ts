import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
// 50m detail: nicer coastlines than 110m when the globe is zoomed in, still
// small enough to bundle. Imported once and converted to GeoJSON at load.
import countries50m from "world-atlas/countries-50m.json";

const topo = countries50m as unknown as Topology;

export const COUNTRIES: FeatureCollection<Geometry, { name: string }> = feature(
  topo,
  topo.objects.countries
) as unknown as FeatureCollection<Geometry, { name: string }>;

export const LAND: Feature<Geometry> = feature(
  topo,
  topo.objects.land
) as unknown as Feature<Geometry>;
