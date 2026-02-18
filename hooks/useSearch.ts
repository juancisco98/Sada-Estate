import { useState } from 'react';
import { Property } from '../types';
import { geocodeAddress } from '../utils/geocoding';

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
            const result = await geocodeAddress(query);

            if (result) {
                setMapCenter([result.lat, result.lng]);
                setSearchResult({
                    lat: result.lat,
                    lng: result.lng,
                    address: result.formattedAddress
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
