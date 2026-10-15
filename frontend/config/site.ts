export const CATEGORIES = [
  "MUSIC",
  "COMEDY",
  "THEATRE",
  "WORKSHOP",
  "SPORTS",
  "FOOD",
  "TECH",
  "ART",
] as const;

export type CategoryFilter = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  MUSIC: "Music",
  COMEDY: "Comedy",
  THEATRE: "Theatre",
  WORKSHOP: "Workshops",
  SPORTS: "Sports",
  FOOD: "Food",
  TECH: "Tech",
  ART: "Art",
};

export const CITIES = [
  "Mumbai",
  "Pune",
  "Delhi",
  "Bengaluru",
  "Hyderabad",
  "Chennai",
] as const;

export const DATE_PRESETS = ["today", "tomorrow", "weekend", "week"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "This weekend",
  week: "This week",
};

export const SITE = {
  name: "TideEvent",
  tagline: "Discover events around you. Book in seconds.",
  demoNote: "Demo project — no payments involved.",
} as const;
