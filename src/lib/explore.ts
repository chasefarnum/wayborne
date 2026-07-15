import type { Enums, Tables } from "@/lib/database.types";

export type SegmentRow = Pick<
  Tables<"road_segments">,
  | "id"
  | "sweep_id"
  | "name"
  | "route_desc"
  | "length_mi"
  | "sub_area"
  | "character"
  | "blurb"
  | "warnings"
  | "seasonal_notes"
  | "provenance"
  | "source_urls"
  | "geom"
>;

export type StopRow = Pick<
  Tables<"stops">,
  | "id"
  | "sweep_id"
  | "name"
  | "category"
  | "town"
  | "blurb"
  | "rider_signal"
  | "practicals"
  | "seasonal_notes"
  | "provenance"
  | "source_urls"
  | "geom"
>;

// Placeholder palette (ember / bone / gravel / pine energy) — stands in
// until branding opens, per wireframe v2.
export const CHARACTER_TAGS: {
  value: Enums<"road_character">;
  label: string;
  color: string;
}[] = [
  { value: "technical", label: "technical", color: "#b45309" },
  { value: "sweepers", label: "sweepers", color: "#a16207" },
  { value: "scenic", label: "scenic", color: "#4d7c0f" },
  { value: "river_road", label: "river-road", color: "#0e7490" },
  { value: "ridge_run", label: "ridge-run", color: "#7c2d12" },
  { value: "low_traffic", label: "low-traffic", color: "#57534e" },
  { value: "forest", label: "forest", color: "#166534" },
];

export const STOP_GROUPS: {
  value: string;
  label: string;
  categories: Enums<"stop_category">[];
  color: string;
}[] = [
  {
    value: "food",
    label: "Food",
    categories: ["diner", "bbq", "roadhouse", "ice_cream", "farm_stand", "general_store"],
    color: "#b45309",
  },
  { value: "hangouts", label: "Hangouts", categories: ["hangout", "dive_bar"], color: "#7c2d12" },
  {
    value: "camping",
    label: "Camping",
    categories: ["dec_campground", "private_campground"],
    color: "#166534",
  },
  { value: "overlooks", label: "Overlooks & POIs", categories: ["overlook", "poi"], color: "#0e7490" },
  { value: "dealers", label: "Dealers & service", categories: ["hd_dealer", "indie_shop"], color: "#57534e" },
];

export const CATEGORY_LABELS: Record<Enums<"stop_category">, string> = {
  hangout: "Hangout",
  diner: "Diner",
  roadhouse: "Roadhouse",
  bbq: "BBQ",
  dive_bar: "Dive bar",
  ice_cream: "Ice cream",
  farm_stand: "Farm stand",
  general_store: "General store",
  dec_campground: "DEC campground",
  private_campground: "Private campground",
  overlook: "Overlook",
  poi: "Point of interest",
  hd_dealer: "H-D dealer",
  indie_shop: "Indie shop",
};

export function characterLabel(value: Enums<"road_character">): string {
  return CHARACTER_TAGS.find((t) => t.value === value)?.label ?? value;
}

export function stopGroupOf(category: Enums<"stop_category">) {
  return STOP_GROUPS.find((g) => g.categories.includes(category));
}
