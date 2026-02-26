import { useState } from 'react';
import { Property } from '../types';
import { geocodeAddress } from '../utils/geocoding';
import { handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { ViewState } from '../components/Sidebar';

export const useSearch = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
    const [searchResult, setSearchResult] = useState<{ lat: number, lng: number, address: string } | null>(null);

    const performSearch = async (query: string, setCurrentView: (view: ViewState) => void, setSelectedProperty: (prop: Property | null) => void) => {
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
                logger.log("No se encontró la dirección.");
                handleError(new Error('Address not found'), 'No se encontró la dirección.');
            }
        } catch (error) {
            logger.error("Search error:", error);
            handleError(error, 'Hubo un error al buscar la dirección.');
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
