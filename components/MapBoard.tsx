import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Property, PropertyStatus } from '../types';
import { MAP_CENTER } from '../constants';

// Fix Leaflet Default Icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '',
  iconUrl: '',
  shadowUrl: '',
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

const MapController = ({ center }: { center?: [number, number] }) => {
  const map = useMap();

  // Fix: Force map resize calculation when component mounts (fixes gray bug)
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [map]);

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


const ReturnToStartButton = () => {
  const map = useMap();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    map.flyTo(MAP_CENTER, 13, { duration: 1.5 });
  };

  // Position it below the standard zoom control (which is usually top-right)
  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'none', top: '80px' }}>
      <div className="leaflet-control leaflet-bar pointer-events-auto">
        <button
          onClick={handleClick}
          className="bg-white text-black hover:bg-gray-100 flex items-center justify-center w-[30px] h-[30px] shadow-sm bg-clip-padding border border-[#ccc]"
          title="Volver a mi ubicación (Buenos Aires)"
          style={{ borderRadius: '2px' }} // Match leaflet style
        >
          <span className="text-lg">🏠</span>
        </button>
      </div>
    </div>
  );
};

const MapBoard: React.FC<MapBoardProps> = ({
  properties,
  onPropertySelect,
  center,
  searchResult,
  onAddProperty
}) => {
  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <MapContainer
        center={MAP_CENTER}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <MapController center={center} />
        <ReturnToStartButton />
        {/* Using CartoDB Positron for the "Google Maps Light" neutral aesthetic */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Existing Properties */}
        {properties.map(prop => (
          <Marker
            key={prop.id}
            position={prop.coordinates}
            icon={createCustomIcon(prop)}
            eventHandlers={{
              click: () => onPropertySelect(prop),
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
    </div>
  );
};

export default MapBoard;