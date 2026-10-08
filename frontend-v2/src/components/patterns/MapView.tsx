// react-leaflet does not ship Leaflet's stylesheet for you. Without it `.leaflet-container`
// loses its positioning/overflow rules and the panes render unstyled.
import 'leaflet/dist/leaflet.css';
import React, { Suspense, lazy } from 'react';
import { MapContainer, CircleMarker, TileLayer, Tooltip } from 'react-leaflet';
import { ENV } from '@/config/env';
import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';

interface MapViewProps {
  latitude: number;
  longitude: number;
  /** the exact street address is never shown publicly (document C5) */
  label: string;
  className?: string;
}

function LeafletMap({ latitude, longitude, label, className }: MapViewProps) {
  // A wide circle, not a pin: the public page never reveals the exact address.
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={12}
      scrollWheelZoom={false}
      className={className}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer url={ENV.MAP_TILE_URL} attribution={ENV.MAP_ATTRIBUTION} />
      <CircleMarker
        center={[latitude, longitude]}
        radius={900}
        pathOptions={{ color: '#0F766E', fillColor: '#CCFBF1', fillOpacity: 0.6, weight: 2 }}
      >
        <Tooltip direction="top" offset={[0, -10]}>
          {label}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}

/** Lazily loaded so Leaflet never lands in the first bundle (architecture 15.2). */
const LeafletMapLazy = lazy(() => Promise.resolve({ default: LeafletMap }));

export const MapView: React.FC<MapViewProps> = (props) => (
  <Suspense fallback={<Skeleton className={cn('w-full', props.className ?? 'h-64')} />}>
    <LeafletMapLazy {...props} />
  </Suspense>
);