import {
  Baby,
  Bath,
  Bed,
  Bike,
  Car,
  Check,
  ChefHat,
  CircleParking,
  Dumbbell,
  Flame,
  Footprints,
  Key,
  Laptop,
  PawPrint,
  Shield,
  Shirt,
  Snowflake,
  Sofa,
  Sparkles,
  Thermometer,
  Trees,
  Tv,
  Umbrella,
  Waves,
  WashingMachine,
  Wifi,
  Wind,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * The backend stores a free-text `icon` key per amenity. This map is data, not logic, and
 * always has a fallback so an amenity added by an admin never breaks a listing page
 * (architecture 6.7).
 */
const ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  'wifi-free': Wifi,
  kitchen: ChefHat,
  kitchenette: ChefHat,
  coffee: ChefHat,
  ac: Snowflake,
  snowflake: Snowflake,
  'air-conditioning': Snowflake,
  'air-conditioning-central': Snowflake,
  heating: Thermometer,
  'heating-central': Thermometer,
  'washing-machine': WashingMachine,
  washer: WashingMachine,
  laundry: WashingMachine,
  dryer: Shirt,
  tv: Tv,
  desk: Laptop,
  workspace: Laptop,
  parking: CircleParking,
  'free-parking': CircleParking,
  'paid-parking': Car,
  pool: Waves,
  'pool-shared': Waves,
  'hot-tub': Bath,
  hot_tub: Bath,
  bbq: Flame,
  barbecue: Flame,
  fireplace: Flame,
  balcony: Umbrella,
  beach: Footprints,
  'beach-access': Footprints,
  alarm: Shield,
  'smoke-alarm': Shield,
  sensor: Shield,
  'co-alarm': Shield,
  first_aid: Shield,
  'first-aid': Shield,
  extinguisher: Wrench,
  'fire-extinguisher': Wrench,
  pets: PawPrint,
  paw: PawPrint,
  crib: Baby,
  'high-chair': Baby,
  gym: Dumbbell,
  dumbbell: Dumbbell,
  elevator: Sofa,
  'hair-dryer': Wind,
  iron: Sofa,
  keypad: Key,
  key: Key,
  garden: Trees,
  view: Sparkles,
  bike: Bike,
  bed: Bed,
  check: Check,
};

export function amenityIcon(key: string | null | undefined): LucideIcon {
  if (!key) return Check;
  const raw = key.trim().toLowerCase();
  const normalized = raw.replace(/_/g, '-');
  return ICONS[raw] ?? ICONS[normalized] ?? Check;
}

export function hasAmenityIcon(key: string | null | undefined): boolean {
  if (!key) return false;
  const raw = key.trim().toLowerCase();
  const normalized = raw.replace(/_/g, '-');
  return raw in ICONS || normalized in ICONS;
}