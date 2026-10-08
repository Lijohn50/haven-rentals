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
  Snowflake,
  Sofa,
  Sparkles,
  Thermometer,
  Trees,
  Tv,
  Umbrella,
  Waves,
  WashingMachine,
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
  wifi: Wind,
  'wifi-free': Wind,
  kitchen: ChefHat,
  kitchenette: ChefHat,
  coffee: ChefHat,
  snowflake: Snowflake,
  'air-conditioning': Snowflake,
  'air-conditioning-central': Snowflake,
  heating: Thermometer,
  'heating-central': Thermometer,
  'washing-machine': WashingMachine,
  washer: WashingMachine,
  laundry: WashingMachine,
  dryer: Wind,
  tv: Tv,
  desk: Laptop,
  workspace: Laptop,
  parking: CircleParking,
  'free-parking': CircleParking,
  'paid-parking': Car,
  pool: Waves,
  'pool-shared': Waves,
  'hot-tub': Bath,
  bbq: Flame,
  barbecue: Flame,
  fireplace: Flame,
  balcony: Umbrella,
  beach: Footprints,
  'beach-access': Footprints,
  'smoke-alarm': Shield,
  'co-alarm': Shield,
  'first-aid': Shield,
  'fire-extinguisher': Wrench,
  paw: PawPrint,
  crib: Baby,
  'high-chair': Baby,
  dumbbell: Dumbbell,
  elevator: Sofa,
  'hair-dryer': Wind,
  iron: Sofa,
  key: Key,
  garden: Trees,
  view: Sparkles,
  bike: Bike,
  bed: Bed,
  check: Check,
};

export function amenityIcon(key: string | null | undefined): LucideIcon {
  if (!key) return Check;
  return ICONS[key.trim().toLowerCase()] ?? Check;
}

export function hasAmenityIcon(key: string | null | undefined): boolean {
  if (!key) return false;
  return key.trim().toLowerCase() in ICONS;
}