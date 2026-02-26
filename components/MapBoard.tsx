import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Property, PropertyStatus } from '../types';
import { MAP_CENTER, MAP_RESIZE_DELAY_MS } from '../constants';
import { formatCurrency } from '../utils/currency';

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

// Status dot helper for building popup
const getStatusDot = (status: PropertyStatus, hasProf: boolean) => {
  if (hasProf) return 'bg-orange-500';
  switch (status) {
    case PropertyStatus.CURRENT: return 'bg-green-500';
    case PropertyStatus.LATE: return 'bg-red-500';
    case PropertyStatus.WARNING: return 'bg-yellow-400';
    default: return 'bg-gray-400';
  }
};

const MapBoard: React.FC<MapBoardProps> = ({
  properties,
  onPropertySelect,
  center,
  searchResult,
  onAddProperty
}) => {
  // Separate properties into standalone vs building-grouped
  const { standalone, buildingGroups } = useMemo(() => {
    const standalone: Property[] = [];
    const groupMap = new Map<string, Property[]>();

    properties.forEach(prop => {
      if (prop.buildingId) {
        const group = groupMap.get(prop.buildingId) || [];
        group.push(prop);
        groupMap.set(prop.buildingId, group);
      } else {
        standalone.push(prop);
      }
    });

    return {
      standalone,
      buildingGroups: Array.from(groupMap.entries()).map(([buildingId, units]) => ({
        buildingId,
        units,
        // Use the first unit's coordinates as the building pin location
        coordinates: units[0].coordinates as [number, number],
        address: units[0].address.split(',')[0], // Short address
      })),
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
            position={prop.coordinates}
            icon={createCustomIcon(prop)}
            eventHandlers={{
              click: () => onPropertySelect(prop),
            }}
          />
        ))}

        {/* Building Groups — single pin per building with popup listing units */}
        {buildingGroups.map(group => (
          <Marker
            key={`building-${group.buildingId}`}
            position={group.coordinates}
            icon={createBuildingIcon(group.units.length)}
          >
            <Popup offset={[0, -20]} closeButton={true} className="custom-popup" maxWidth={280}>
              <div className="p-1">
                <p className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-1">
                  🏢 {group.address}
                </p>
                <p className="text-[10px] text-gray-500 mb-2 uppercase font-semibold tracking-wider">
                  {group.units.length} {group.units.length === 1 ? 'unidad' : 'unidades'}
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {group.units.map(unit => (
                    <button
                      key={unit.id}
                      onClick={() => onPropertySelect(unit)}
                      className="w-full text-left flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusDot(unit.status, !!unit.assignedProfessionalId)}`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {unit.unitLabel || unit.id.slice(0, 6)}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {unit.tenantName} · {formatCurrency(unit.monthlyRent, unit.currency || 'ARS')}
                        </p>
                      </div>
                      <span className="text-gray-400 group-hover:text-gray-600 text-xs">→</span>
                    </button>
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
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