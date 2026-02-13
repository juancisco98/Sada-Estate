import { useState } from 'react';
import { Property } from '../types';

export const useSearch = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
    const [searchResult, setSearchResult] = useState<{ lat: number, lng: number, address: string } | null>(null);

    const performSearch = async (query: string, setCurrentView: (view: any) => void, setSelectedProperty: (prop: Property | null) => void) => {
        if (!query) return;

        setSearchQuery(query);
        setIsSearching(true);
        setSearchResult(null);
        setSelectedProperty(null);
        setCurrentView('MAP');

        try {
            const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

            let lat: number | undefined;
            let lng: number | undefined;
            let address: string | undefined;

            if (googleKey) {
                const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleKey}`);
                const data = await response.json();

                if (data.status === 'OK' && data.results.length > 0) {
                    const result = data.results[0];
                    lat = result.geometry.location.lat;
                    lng = result.geometry.location.lng;
                    address = result.formatted_address;
                } else {
                    console.log("Google Maps Geocoding failed or returned no results:", data.status);
                }
            }

            if (!lat || !lng) {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
                const data = await response.json();

                if (data && data.length > 0) {
                    const result = data[0];
                    lat = parseFloat(result.lat);
                    lng = parseFloat(result.lon);
                    address = result.display_name;
                }
            }

            if (lat && lng && address) {
                setMapCenter([lat, lng]);
                setSearchResult({
                    lat,
                    lng,
                    address
                });
            } else {
                console.log("No se encontró la dirección.");
                alert("No se encontró la dirección.");
            }
        } catch (error) {
            console.error("Search error:", error);
            alert("Hubo un error al buscar la dirección.");
        } finally {
            setIsSearching(false);
        }
    };

    return {
        searchQuery,
        setSearchQuery,
        isSearching,
        mapCenter,
        setMapCenter,
        searchResult,
        setSearchResult,
        performSearch
    };
};
