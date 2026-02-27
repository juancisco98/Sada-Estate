import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Property, PropertyStatus } from '../types';
import { MAP_CENTER, MAP_RESIZE_DELAY_MS } from '../constants';


// Fix Leaflet Default Icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapBoardProps {
  properties: Property[];
  onPropertySelect: (property: Property) => void;
  onBuildingSelect?: (buildingId: string) => void;
  center?: [number, number];
  searchResult?: { lat: number; lng: number; address: string } | null;
  onAddProperty?: () => void;
}

const createCustomIcon = (property: Property) => {
  let colorClass = '';

  // Logic: If under maintenance (professional assigned), it MUST be Orange, overriding other statuses visually on map
  if (property.assignedProfessionalId) {
    colorClass = 'bg-orange-500 border-orange-200';
  } else {
    // Normal Status Logic
    switch (property.status) {
      case PropertyStatus.CURRENT: colorClass = 'bg-green-500 border-green-200'; break;
      case PropertyStatus.LATE: colorClass = 'bg-red-500 border-red-200'; break;
      case PropertyStatus.WARNING: colorClass = 'bg-yellow-400 border-yellow-200'; break;
      default: colorClass = 'bg-gray-400 border-gray-200';
    }
  }

  const html = `
    <div class="relative w-8 h-8 rounded-full shadow-lg border-4 ${colorClass} flex items-center justify-center transform hover:scale-110 transition-transform duration-200">
      ${property.assignedProfessionalId ? '<div class="text-white text-[10px] font-bold">🛠️</div>' : '<div class="w-2 h-2 bg-white rounded-full"></div>'}
    </div>
  `;

  return L.divIcon({
    html: html,
    className: 'custom-marker-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
};

// Building group icon — larger, distinct violet icon with unit count badge
const createBuildingIcon = (unitCount: number) => {
  const html = `
    <div class="relative w-10 h-10 rounded-xl shadow-lg border-[3px] border-violet-200 bg-violet-600 flex items-center justify-center transform hover:scale-110 transition-transform duration-200">
      <div class="text-white text-sm font-bold">🏢</div>
      <div class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border-2 border-violet-600 flex items-center justify-center">
        <span class="text-[10px] font-black text-violet-700">${unitCount}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html: html,
    className: 'custom-building-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
};

// House icon — rounded square with house emoji, status-colored
const createHouseIcon = (property: Property) => {
  let borderColor = 'border-teal-200';
  let bgColor = 'bg-teal-600';

  if (property.assignedProfessionalId) {
    borderColor = 'border-orange-200';
    bgColor = 'bg-orange-500';
  } else {
    switch (property.status) {
      case PropertyStatus.CURRENT: borderColor = 'border-green-200'; bgColor = 'bg-green-600'; break;
      case PropertyStatus.LATE: borderColor = 'border-red-200'; bgColor = 'bg-red-600'; break;
      case PropertyStatus.WARNING: borderColor = 'border-yellow-200'; bgColor = 'bg-yellow-500'; break;
    }
  }

  const html = `
    <div class="relative w-9 h-9 rounded-xl shadow-lg border-[3px] ${borderColor} ${bgColor} flex items-center justify-center transform hover:scale-110 transition-transform duration-200">
      <div class="text-white text-sm">🏠</div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-house-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
};

// Local/shop icon — rounded square with shop emoji, status-colored
const createLocalIcon = (property: Property) => {
  let borderColor = 'border-amber-200';
  let bgColor = 'bg-amber-600';

  if (property.assignedProfessionalId) {
    borderColor = 'border-orange-200';
    bgColor = 'bg-orange-500';
  } else {
    switch (property.status) {
      case PropertyStatus.CURRENT: borderColor = 'border-green-200'; bgColor = 'bg-green-600'; break;
      case PropertyStatus.LATE: borderColor = 'border-red-200'; bgColor = 'bg-red-600'; break;
      case PropertyStatus.WARNING: borderColor = 'border-yellow-200'; bgColor = 'bg-yellow-500'; break;
    }
  }

  const html = `
    <div class="relative w-9 h-9 rounded-xl shadow-lg border-[3px] ${borderColor} ${bgColor} flex items-center justify-center transform hover:scale-110 transition-transform duration-200">
      <div class="text-white text-sm">🏪</div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-local-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
};

// Select the appropriate icon for a standalone property based on its type
const getStandaloneIcon = (property: Property) => {
  const type = property.propertyType || (property.buildingId ? 'edificio' : 'casa');
  switch (type) {
    case 'casa': return createHouseIcon(property);
    case 'local': return createLocalIcon(property);
    default: return createCustomIcon(property);
  }
};

const createSearchIcon = () => {
  const html = `
    <div class="relative w-10 h-10 flex items-center justify-center">
       <span class="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping"></span>
       <div class="relative w-8 h-8 rounded-full shadow-xl border-4 border-white bg-blue-600 flex items-center justify-center transform transition-transform duration-200">
         <div class="w-2 h-2 bg-white rounded-full"></div>
       </div>
    </div>
  `;

  return L.divIcon({
    html: html,
    className: 'custom-search-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

const MapController = ({ center, properties }: { center?: [number, number]; properties: Property[] }) => {
  const map = useMap();

  // Fix: Force map resize calculation when component mounts (fixes gray bug)
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, MAP_RESIZE_DELAY_MS);
  }, [map]);

  // On mount, fit to property bounds
  useEffect(() => {
    if (!center && properties.length > 0) {
      const bounds = L.latLngBounds(properties.map(p => p.coordinates));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }
  }, [map, properties.length]); // only on mount / property count change

  useEffect(() => {
    if (center) {
      map.flyTo(center, 16, {
        duration: 1.5
      });
    }
  }, [center, map]);

  useEffect(() => {
    map.zoomControl.setPosition('topright');
  }, [map]);

  return null;
}


const ReturnToStartButton = ({ properties }: { properties: Property[] }) => {
  const map = useMap();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (properties.length > 0) {
      const bounds = L.latLngBounds(properties.map(p => p.coordinates));
      map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 15, duration: 1.5 });
    } else {
      map.flyTo(MAP_CENTER, 13, { duration: 1.5 });
    }
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'none', top: '100px' }}>
      <div className="leaflet-control pointer-events-auto">
        <button
          onClick={handleClick}
          className="bg-white text-black hover:bg-gray-100 flex items-center justify-center w-[40px] h-[40px] shadow-lg rounded-xl"
          title="Ver todas las propiedades"
        >
          <span className="text-xl">🏠</span>
        </button>
      </div>
    </div>
  );
};


const MapBoard: React.FC<MapBoardProps> = ({
  properties,
  onPropertySelect,
  onBuildingSelect,
  center,
  searchResult,
  onAddProperty
}) => {
  // Separate properties into standalone vs building-grouped
  // Groups by buildingId first, then by shared address for properties without buildingId
  const { standalone, buildingGroups } = useMemo(() => {
    const standaloneTemp: Property[] = [];
    const buildingIdMap = new Map<string, Property[]>();
    const noBuildingId: Property[] = [];

    properties.forEach(prop => {
      if (prop.buildingId) {
        const group = buildingIdMap.get(prop.buildingId) || [];
        group.push(prop);
        buildingIdMap.set(prop.buildingId, group);
      } else {
        noBuildingId.push(prop);
      }
    });

    // Group properties without buildingId by normalized address (first part before first comma)
    const addressMap = new Map<string, Property[]>();
    noBuildingId.forEach(prop => {
      const baseAddress = prop.address.split(',')[0].trim().toLowerCase();
      const group = addressMap.get(baseAddress) || [];
      group.push(prop);
      addressMap.set(baseAddress, group);
    });

    // Address groups with 2+ properties become building groups; singles stay standalone
    const addressGroups: { buildingId: string; units: Property[]; coordinates: [number, number]; address: string }[] = [];
    addressMap.forEach((units, baseAddress) => {
      if (units.length >= 2) {
        addressGroups.push({
          buildingId: `addr:${baseAddress}`,
          units,
          coordinates: units[0].coordinates as [number, number],
          address: units[0].address.split(',')[0],
        });
      } else {
        standaloneTemp.push(units[0]);
      }
    });

    const buildingIdGroups = Array.from(buildingIdMap.entries()).map(([buildingId, units]) => ({
      buildingId,
      units,
      coordinates: units[0].coordinates as [number, number],
      address: units[0].address.split(',')[0],
    }));

    // Nudge standalone markers that overlap so both are visible
    const PROXIMITY_THRESHOLD = 0.00015; // ~15 meters
    const NUDGE = 0.00008; // ~8 meters — just enough to not overlap
    const offsetStandalone = standaloneTemp.map((prop) => {
      const cluster = standaloneTemp.filter(other =>
        Math.abs(other.coordinates[0] - prop.coordinates[0]) < PROXIMITY_THRESHOLD &&
        Math.abs(other.coordinates[1] - prop.coordinates[1]) < PROXIMITY_THRESHOLD
      );
      if (cluster.length <= 1) return { ...prop, displayCoordinates: prop.coordinates };
      const idx = cluster.findIndex(p => p.id === prop.id);
      // Spread horizontally (longitude) so they sit side by side on the street
      const offsetLng = (idx - (cluster.length - 1) / 2) * NUDGE;
      return { ...prop, displayCoordinates: [prop.coordinates[0], prop.coordinates[1] + offsetLng] as [number, number] };
    });

    return {
      standalone: offsetStandalone,
      buildingGroups: [...buildingIdGroups, ...addressGroups],
    };
  }, [properties]);

  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <MapContainer
        center={MAP_CENTER}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <MapController center={center} properties={properties} />
        <ReturnToStartButton properties={properties} />
        {/* Using CartoDB Positron for the "Google Maps Light" neutral aesthetic */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Standalone Properties (no building) */}
        {standalone.map(prop => (
          <Marker
            key={prop.id}
            position={prop.displayCoordinates}
            icon={getStandaloneIcon(prop)}
            eventHandlers={{
              click: () => onPropertySelect(prop),
            }}
          />
        ))}

        {/* Building Groups — single pin per building, opens BuildingCard on click */}
        {buildingGroups.map(group => (
          <Marker
            key={`building-${group.buildingId}`}
            position={group.coordinates}
            icon={createBuildingIcon(group.units.length)}
            eventHandlers={{
              click: () => onBuildingSelect ? onBuildingSelect(group.buildingId) : onPropertySelect(group.units[0]),
            }}
          />
        ))}

        {/* Search Result Marker */}
        {searchResult && (
          <Marker
            position={[searchResult.lat, searchResult.lng]}
            icon={createSearchIcon()}
            eventHandlers={{
              click: () => { }, // Handled by popup button usually, but here we can open modal directly or show popup
            }}
          >
            <Popup offset={[0, -10]} closeButton={false} className="custom-popup">
              <div className="p-1 text-center">
                <p className="font-semibold text-gray-800 text-sm mb-2">{searchResult.address.split(',')[0]}</p>
                <button
                  onClick={onAddProperty}
                  className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors w-full"
                >
                  + Agregar Propiedad
                </button>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Floating Action Button (FAB) for adding property without search */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddProperty && onAddProperty();
        }}
        className="fixed bottom-24 right-6 z-[1000] w-14 h-14 bg-gray-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-gray-800 hover:scale-110 active:scale-95 transition-all md:bottom-8"
        title="Crear Nueva Propiedad"
        aria-label="Crear nueva propiedad"
      >
        <span className="text-3xl font-bold">+</span>
      </button>
    </div>
  );
};

export default MapBoard;