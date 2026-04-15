
/**
 * Utility to identify if a string is a placeholder unit ID (like u1, dpto 4)
 * versus a real person's name.
 */
export const isPlaceholderName = (name: string): boolean => {
    if (!name || name === 'VACANTE' || name === '-') return true;
    const n = name.trim().toLowerCase();

    // Matches: u1, u4, d1, d15, dpto 3, dpto 4, unidad 2, vacante, -
    if (/^(dpto|u|d|unidad|piso|vacante|-)\s*\d*[a-z]*$/i.test(n)) return true;

    // Very short names are likely placeholders/units like "1A", "2B"
    if (n.length < 3) return true;

    return false;
};

/**
 * Interface for the minimal property data needed for display
 */
export interface DisplayProperty {
    id: string;
    tenantName: string;
    unitLabel?: string;
    address?: string;
    type?: string;
    buildingId?: string | null;
}

/**
 * Smartly determines what to show as Title and Subtitle for a property.
 * Houses/Locals: Prioritize Address + Tenant Name.
 * Building Units: Prioritize Tenant Name + Unit/Floor.
 */
export const getPropertyDisplayInfo = (p: DisplayProperty) => {
    const name = (p.tenantName || 'VACANTE').trim();
    const label = (p.unitLabel || '').trim();
    const address = (p.address || '').trim();
    const isStandalone = p.type === 'casa' || p.type === 'local' || !p.buildingId;
    const shortAddress = address.split(',')[0].toUpperCase();
    const idSuffix = p.id.split('-').pop() || '—';

    // --- CASE A: STANDALONE (Casa / Local) ---
    if (isStandalone) {
        return {
            title: shortAddress || (name.toUpperCase() !== 'VACANTE' ? name.toUpperCase() : 'CASA'),
            subtitle: name.toUpperCase() === 'VACANTE' ? 'VACANTE' : name.toUpperCase()
        };
    }

    // --- CASE B: BUILDING UNIT (Edificio) ---

    // 1. If name is a placeholder, prioritize the label
    if (isPlaceholderName(name) && label) {
        return {
            title: label.replace(/Dpto\. Dpto\./gi, 'Dpto.').toUpperCase(),
            subtitle: name.toUpperCase()
        };
    }

    // 2. Try to extract unit from name (e.g. "EUGENIA 2B" -> "EUGENIA", Unit "2B")
    const floorRegex = /\b((?:PB|[1-9][0-9]?|[A-Z])\s*[A-Z1-9]|(?:[1-9][0-9]?)-(?:[1-9][0-9]?))\b$/i;
    const match = name.match(floorRegex);

    if (match) {
        const floorInfo = match[1].trim();
        const cleanName = name.replace(floorRegex, '').trim();

        if (cleanName && cleanName.length > 1) {
            const combinedSubtitle = label && !label.toUpperCase().includes(floorInfo.toUpperCase())
                ? `${floorInfo.toUpperCase()} (${label.toUpperCase()})`
                : floorInfo.toUpperCase();

            return {
                title: cleanName.toUpperCase(),
                subtitle: combinedSubtitle
            };
        }
    }

    // 3. Fallback for Building Units
    return {
        title: name.toUpperCase(),
        subtitle: label.replace(/Dpto\. Dpto\./gi, 'Dpto.').toUpperCase() || `UNIDAD ${idSuffix.toUpperCase()}`
    };
};
