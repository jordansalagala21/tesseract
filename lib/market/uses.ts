/**
 * Candidate business uses and what each needs from a space (AI-05). OWNER: Developer 1.
 *
 * These are PLANNING HEURISTICS for a prototype: rough size ranges and preferences used to rank
 * ideas. They are not building codes, zoning rules, operator requirements or market data, and
 * every rationale that uses them says "heuristic". Tune freely; tests pin behaviour, not values.
 */

export type UseCategory =
  | "restaurant_bar"
  | "cafe"
  | "fitness_studio"
  | "medical_office"
  | "specialty_retail"
  | "coworking";

/** Observable build-out features (from Matterport/vision as ai_observation, or CoStar text). */
export type BuildOutTag =
  | "commercial_kitchen"
  | "bar_counter"
  | "open_floor"
  | "private_offices"
  | "exam_rooms"
  | "restrooms"
  | "storefront_glazing"
  | "high_open_ceiling";

export type Importance = "required" | "important" | "helpful" | "irrelevant";

export interface UseRequirements {
  id: UseCategory;
  label: string;
  /** Square feet: below `min` or above `max` is a poor fit; `ideal` is the sweet spot. */
  sf: { min: number; idealMin: number; idealMax: number; max: number };
  /** Ceiling height in feet: below `hard` is a blocker; `preferred` and above is ideal. */
  ceilingFt: { hard: number; preferred: number } | null;
  groundFloor: Importance;
  frontage: Importance;
  parking: Importance;
  /** Existing build-out that lowers conversion cost for this use. */
  benefitsFrom: BuildOutTag[];
  /** Same-category businesses (for saturation) and complementary neighbours, by industry keyword. */
  competitorKeywords: string[];
  complementKeywords: string[];
  /** Things that must be confirmed before this use is viable; always listed as unknowns. */
  keyChecks: string[];
}

export const USES: Record<UseCategory, UseRequirements> = {
  restaurant_bar: {
    id: "restaurant_bar",
    label: "Restaurant / bar",
    sf: { min: 1500, idealMin: 2500, idealMax: 6000, max: 12000 },
    ceilingFt: { hard: 9, preferred: 12 },
    groundFloor: "required",
    frontage: "important",
    parking: "helpful",
    benefitsFrom: ["commercial_kitchen", "bar_counter", "restrooms", "storefront_glazing"],
    competitorKeywords: ["restaurant", "bar", "food", "eating"],
    complementKeywords: ["office", "entertainment", "hotel", "apartment"],
    keyChecks: ["Kitchen exhaust hood and grease interceptor condition or feasibility", "Gas and electrical capacity for a commercial kitchen", "Liquor licensing and hours rules for this location"],
  },
  cafe: {
    id: "cafe",
    label: "Café / coffee shop",
    sf: { min: 600, idealMin: 1000, idealMax: 2500, max: 4500 },
    ceilingFt: { hard: 9, preferred: 11 },
    groundFloor: "required",
    frontage: "important",
    parking: "helpful",
    benefitsFrom: ["bar_counter", "restrooms", "storefront_glazing"],
    competitorKeywords: ["coffee", "cafe", "bakery"],
    complementKeywords: ["office", "medical", "university", "apartment"],
    keyChecks: ["Plumbing for an espresso bar and hand sinks", "Health-department requirements for food prep", "Seating and signage rules for the storefront"],
  },
  fitness_studio: {
    id: "fitness_studio",
    label: "Fitness studio / gym",
    sf: { min: 1800, idealMin: 3000, idealMax: 10000, max: 25000 },
    ceilingFt: { hard: 10, preferred: 14 },
    groundFloor: "helpful",
    frontage: "helpful",
    parking: "important",
    benefitsFrom: ["open_floor", "high_open_ceiling", "restrooms"],
    competitorKeywords: ["fitness", "gym", "training", "yoga", "pilates"],
    complementKeywords: ["apartment", "office", "health"],
    keyChecks: ["Floor loading and sound or vibration limits for equipment", "Showers and changing-room plumbing", "Parking available to members at peak hours"],
  },
  medical_office: {
    id: "medical_office",
    label: "Medical / clinic",
    sf: { min: 1200, idealMin: 2000, idealMax: 6000, max: 15000 },
    ceilingFt: { hard: 8, preferred: 9 },
    groundFloor: "helpful",
    frontage: "helpful",
    parking: "important",
    benefitsFrom: ["exam_rooms", "private_offices", "restrooms"],
    competitorKeywords: ["medical", "clinic", "dental", "physician", "health"],
    complementKeywords: ["pharmacy", "apartment", "office"],
    keyChecks: ["Plumbing for exam-room sinks", "Accessibility of the entrance and restrooms", "Patient parking and drop-off"],
  },
  specialty_retail: {
    id: "specialty_retail",
    label: "Specialty retail / showroom",
    sf: { min: 800, idealMin: 1500, idealMax: 5000, max: 12000 },
    ceilingFt: { hard: 9, preferred: 12 },
    groundFloor: "required",
    frontage: "important",
    parking: "helpful",
    benefitsFrom: ["storefront_glazing", "open_floor", "high_open_ceiling"],
    competitorKeywords: ["retail", "apparel", "boutique", "store"],
    complementKeywords: ["retail", "restaurant", "apartment"],
    keyChecks: ["Signage and storefront visibility rules", "Loading access for deliveries", "Co-tenancy or use restrictions in the lease"],
  },
  coworking: {
    id: "coworking",
    label: "Coworking / flexible office",
    sf: { min: 3000, idealMin: 6000, idealMax: 20000, max: 40000 },
    ceilingFt: { hard: 8, preferred: 10 },
    groundFloor: "irrelevant",
    frontage: "irrelevant",
    parking: "helpful",
    benefitsFrom: ["private_offices", "open_floor", "restrooms"],
    competitorKeywords: ["coworking", "shared office", "executive suites"],
    complementKeywords: ["cafe", "restaurant", "apartment"],
    keyChecks: ["Restroom count for the expected occupancy", "Internet service options in the building", "After-hours access and HVAC"],
  },
};

export const USE_CATEGORIES = Object.keys(USES) as UseCategory[];
