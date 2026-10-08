/**
 * The API has no "popular destinations" endpoint, so the landing page keeps a curated
 * list and checks each entry with `GET /search?city=…&size=1`. Entries with no homes are
 * dropped, which is why the section can be hidden entirely (architecture 9.2.5).
 */
export interface CuratedDestination {
  city: string;
  country: string;
}

export const CURATED_DESTINATIONS: CuratedDestination[] = [
  { city: 'New York', country: 'US' },
  { city: 'Miami', country: 'US' },
  { city: 'San Francisco', country: 'US' },
  { city: 'Austin', country: 'US' },
  { city: 'San Diego', country: 'US' },
  { city: 'Denver', country: 'US' },
  { city: 'Portland', country: 'US' },
  { city: 'Nashville', country: 'US' },
];

/** Below three surviving entries the section is hidden rather than shown nearly empty. */
export const MIN_DESTINATIONS_SHOWN = 3;