// Tax configuration per country
// Defines which tax fields to show, their labels, and currency rules

export interface TaxField {
    key: string;
    label: string;
    currency: string;
}

export interface CountryTaxConfig {
    fields: TaxField[];
    taxCurrency: string; // Currency for taxes
    allowedRentCurrencies: string[];
    defaultRentCurrency: string;
    flag: string; // Emoji flag
}

export const TAX_CONFIG: Record<string, CountryTaxConfig> = {
    Argentina: {
        fields: [
            { key: 'abl', label: 'ABL', currency: 'ARS' },
            { key: 'rentas', label: 'Rentas', currency: 'ARS' },
            { key: 'water', label: 'AySA', currency: 'ARS' },
        ],
        taxCurrency: 'ARS',
        allowedRentCurrencies: ['ARS', 'USD'],
        defaultRentCurrency: 'ARS',
        flag: '🇦🇷',
    },
    USA: {
        fields: [
            { key: 'propertyTax', label: 'Property Tax', currency: 'USD' },
            { key: 'hoa', label: 'HOA', currency: 'USD' },
            { key: 'insurance', label: 'Insurance', currency: 'USD' },
        ],
        taxCurrency: 'USD',
        allowedRentCurrencies: ['USD'],
        defaultRentCurrency: 'USD',
        flag: '🇺🇸',
    },
    Uruguay: {
        fields: [
            { key: 'contribucion', label: 'Contribución Inmob.', currency: 'UYU' },
            { key: 'ose', label: 'OSE (Agua)', currency: 'UYU' },
            { key: 'primaria', label: 'Primaria', currency: 'UYU' },
        ],
        taxCurrency: 'UYU',
        allowedRentCurrencies: ['USD', 'UYU'],
        defaultRentCurrency: 'USD',
        flag: '🇺🇾',
    },
};

// Get config for a country, fallback to Argentina
export const getTaxConfig = (country: string): CountryTaxConfig => {
    return TAX_CONFIG[country] || TAX_CONFIG['Argentina'];
};

// Detect country from a geocoded address string
export const detectCountryFromAddress = (formattedAddress: string): string => {
    if (!formattedAddress) return 'Argentina';

    const parts = formattedAddress.split(',').map(p => p.trim().toLowerCase());
    const lastPart = parts[parts.length - 1];

    // Check last part first (standard for geocoded addresses)
    if (lastPart === 'usa' || lastPart === 'united states' || lastPart === 'ee. uu.' || lastPart === 'eeuu') return 'USA';
    if (lastPart === 'uruguay') return 'Uruguay';
    if (lastPart === 'argentina') return 'Argentina';

    // Search in parts
    if (parts.some(p => p === 'usa' || p === 'united states')) return 'USA';
    if (parts.some(p => p === 'uruguay')) return 'Uruguay';
    if (parts.some(p => p === 'argentina')) return 'Argentina';

    // Fallback to keyword search in whole string
    const addr = formattedAddress.toLowerCase();

    if (addr.includes('florida') || addr.includes('miami') || addr.includes('texas')) return 'USA';
    if (addr.includes('montevideo') || addr.includes('punta del este')) return 'Uruguay';
    if (addr.includes('buenos aires') || addr.includes('caba') || addr.includes('c.a.b.a.') || addr.includes('córdoba')) return 'Argentina';

    // Default
    return 'Argentina';
};
