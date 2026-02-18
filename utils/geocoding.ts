
export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number; formattedAddress: string } | null> => {
    if (!address) return null;

    try {
        // 1. Try Google Maps if API key is present
        const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (googleKey) {
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleKey}`);
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                const result = data.results[0];
                return {
                    lat: result.geometry.location.lat,
                    lng: result.geometry.location.lng,
                    formattedAddress: result.formatted_address
                };
            }
        }

        // 2. Fallback to OpenStreetMap (Nominatim)
        // Add a delay to respect Nominatim's usage policy if possible, or just call it.
        // In a real app we might want to debounce or limit these calls.
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
        const data = await response.json();

        if (data && data.length > 0) {
            const result = data[0];
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                formattedAddress: result.display_name
            };
        }
    } catch (error) {
        console.error("Geocoding error:", error);
    }

    return null;
};
