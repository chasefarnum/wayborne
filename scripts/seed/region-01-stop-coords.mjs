// Region 01 stop coordinates. Source: Overture Maps places, release 2026-06-17.0
// (CDLA-P 2.0, store-friendly). Matched by name+town similarity against the
// region bbox, human-adjudicated 2026-07-17. Google coordinates are never
// persisted; unmatched stops stay ungeocoded until ridden or traced.

export const stopCoords = {
  "s-001": { lon: -74.00697, lat: 41.31148, matched: "Perkins Memorial Tower" }, // summit scene pinned at the tower record
  "s-002": { lon: -74.19313, lat: 41.15374, matched: "Rhodes North Tavern" },
  "s-003": { lon: -73.78937, lat: 42.25149, matched: "Moto Coffee Machine" },
  "s-004": { lon: -74.73358, lat: 41.42672, matched: "Hawks Nest" },
  "s-005": { lon: -74.2921, lat: 41.21781, matched: "Emerald Point Restaurant and Marina" },
  "s-006": { lon: -74.3186, lat: 41.18365, matched: "Cove Castle Restaurant" },
  "s-007": { lon: -74.29193, lat: 42.19151, matched: "West Kill Brewing" },
  "s-008": { lon: -74.30764, lat: 42.07104, matched: "Phoenicia Diner" },
  "s-009": { lon: -74.31372, lat: 42.08322, matched: "Brio's Pizzeria & Restaurant" },
  "s-010": { lon: -73.71738, lat: 42.11953, matched: "West Taghkanic Diner" }, // matched under the pre-2025 name; reopened as Doves Diner
  "s-011": { lon: -73.8743, lat: 41.99674, matched: "Historic Village Diner" },
  "s-012": { lon: -74.90922, lat: 41.93075, matched: "Roscoe Diner" },
  "s-013": { lon: -74.82499, lat: 41.90407, matched: "Robin Hood Diner" },
  "s-014": { lon: -73.93044, lat: 41.7767, matched: "Eveready Diner" },
  "s-015": { lon: -73.8947, lat: 42.25364, matched: "Gracie's Luncheonette" },
  "s-016": { lon: -74.02095, lat: 41.93517, matched: "Dallas Hot Weiners" },
  "s-017": { lon: -74.0794, lat: 41.97249, matched: "Hickory BBQ & Smokehouse" },
  "s-018": { lon: -74.31889, lat: 41.77139, matched: "Outpost BBQ" },
  "s-019": { lon: -74.00536, lat: 41.50225, matched: "Billy Joe's Ribworks" },
  "s-020": { lon: -74.91097, lat: 41.47735, matched: "The Carriage House" },
  "s-021": { lon: -74.78393, lat: 42.18969, matched: "The Andes Hotel" },
  "s-022": { lon: -74.04935, lat: 42.35919, matched: "Freehold Country Pub" },
  "s-023": { lon: -74.1923, lat: 41.72806, matched: "Mountain Brauhaus" },
  "s-024": { lon: -74.27763, lat: 41.97358, matched: "Snyder's Tavern" },
  "s-025": { lon: -74.25566, lat: 41.89156, matched: "The Country Inn" },
  "s-026": { lon: -74.13333, lat: 42.19559, matched: "Last Chance Antiques & Cheese Cafe" },
  "s-027": { lon: -74.28918, lat: 41.24469, matched: "Bellvale Farms Creamery" },
  "s-028": { lon: -74.13618, lat: 42.19564, matched: "Mama's Boy Burgers" },
  "s-029": { lon: -73.88186, lat: 41.98203, matched: "Holy Cow" },
  "s-030": { lon: -73.57724, lat: 41.42495, matched: "Red Rooster Drive-In" },
  "s-031": { lon: -74.41644, lat: 41.3274, matched: "Quaker Creek Store" },
  "s-032": { lon: -74.23943, lat: 41.79293, matched: "Saunderskill Farm Market" },
  "s-033": { lon: -74.13811, lat: 41.66724, matched: "Wright's Farm" },
  "s-034": { lon: -73.90874, lat: 42.00112, matched: "Montgomery Place Orchards Farmstand" },
  "s-035": { lon: -74.02186, lat: 42.17513, matched: "Circle W Market" },
  "s-036": { lon: -74.05515, lat: 42.20221, matched: "North-South Lake Campground" }, // campground-category record, no locality metadata
  "s-037": { lon: -74.19243, lat: 42.19198, matched: "Devil's Tombstone Campground" }, // verify campground position on NY-214 (record confidence high, position unridden)
  "s-038": { lon: -74.36199, lat: 42.03575, matched: "Woodland Valley Campground" },
  "s-039": { lon: -74.21376, lat: 42.0272, matched: "Kenneth L Wilson Campground" },
  "s-040": { lon: -74.69132, lat: 41.95774, matched: "Mongaup Pond Campground" },
  "s-041": { lon: -74.74358, lat: 42.03748, matched: "Little Pond Campground" },
  "s-042": { lon: -74.83717, lat: 41.97991, matched: "Beaverkill Campground" },
  "s-043": { lon: -75.06961, lat: 42.11976, matched: "Bear Spring Mountain Campground" },
  "s-044": { lon: -74.07343, lat: 42.35122, matched: "Blackthorne Resort" },
  "s-045": { lon: -74.01851, lat: 42.09249, matched: "Rip Van Winkle Campgrounds" },
  "s-046a": { lon: -74.86244, lat: 41.44665, matched: "The Outpost" },
  "s-046b": { lon: -74.95175, lat: 41.48137, matched: "Kittatinny Campgrounds" },
  "s-047": { lon: -74.03475, lat: 42.19488, matched: "Catskill Mountain House Site" },
  // s-048: no trustworthy Overture record for the falls platform; candidates mislocated. Pin after a ride or the Laurel House Rd lot gets traced.
  "s-049": { lon: -74.12673, lat: 42.33651, matched: "Five State Lookout" },
  "s-050": { lon: -74.73358, lat: 41.42672, matched: "Hawks Nest (park)" }, // same Overture record as s-004; pull-offs are the same bend
  "s-051": { lon: -74.27509, lat: 41.74316, matched: "Minnewaska State Park" },
  "s-052": { lon: -74.36165, lat: 41.66996, matched: "Sam's Point Trailhead" },
  "s-053": { lon: -73.82935, lat: 42.21714, matched: "Olana State Historic Site" },
  "s-054": { lon: -74.00123, lat: 41.42309, matched: "Storm King Trail" },
  "s-055": { lon: -74.60236, lat: 42.40598, matched: "Mt Utsayantha Stamford Ny" },
  "s-056": { lon: -74.00697, lat: 41.31148, matched: "Perkins Memorial Tower" },
  "s-057": { lon: -74.18163, lat: 41.94788, matched: "Ashokan Reservoir" }, // verify this is the promenade lot, not the reservoir centroid
  "s-058": { lon: -74.03266, lat: 41.49396, matched: "Motorcyclepedia Museum" },
  "s-059": { lon: -74.08643, lat: 41.98375, matched: "Woodstock Harley-Davidson" },
  "s-060": { lon: -74.07789, lat: 41.48866, matched: "Moroney's Motorsports" },
  "s-061": { lon: -74.47586, lat: 41.5719, matched: "O'Toole's Harley-Davidson" },
  "s-062a": { lon: -73.85983, lat: 42.74025, matched: "Spitzie's Harley Davidson of Albany" },
  "s-062b": { lon: -73.60265, lat: 42.75861, matched: "Brunswick Harley-Davidson" },
  "s-063": { lon: -73.86521, lat: 41.17095, matched: "Hudson Valley Motorcycles" },
  "s-064": { lon: -73.98658, lat: 42.07581, matched: "Cycle Center" },
};
