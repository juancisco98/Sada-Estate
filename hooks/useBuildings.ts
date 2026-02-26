import { useDataContext } from '../context/DataContext';
import { supabase } from '../services/supabaseClient';
import { Building } from '../types';
import { buildingToDb } from '../utils/mappers';
import { supabaseUpsert, supabaseDelete } from '../utils/supabaseHelpers';
import { logger } from '../utils/logger';

export const useBuildings = (currentUserId?: string) => {
    const { buildings, setBuildings, setProperties } = useDataContext();

    const saveBuilding = async (building: Building) => {
        const buildingWithUser = { ...building, userId: currentUserId };
        setBuildings(prev => {
            const exists = prev.find(b => b.id === building.id);
            if (exists) return prev.map(b => b.id === building.id ? buildingWithUser : b);
            return [...prev, buildingWithUser];
        });

        await supabaseUpsert('buildings', buildingToDb(buildingWithUser), `building ${building.address}`);
    };

    const deleteBuilding = async (buildingId: string) => {
        setBuildings(prev => prev.filter(b => b.id !== buildingId));
        setProperties(prev => prev.map(p =>
            p.buildingId === buildingId ? { ...p, buildingId: undefined, unitLabel: undefined } : p
        ));

        try {
            await supabase.from('properties').update({ building_id: null, unit_label: '' }).eq('building_id', buildingId);
        } catch (err) {
            logger.error('[Supabase] Exception unlinking properties from building:', err);
        }
        await supabaseDelete('buildings', buildingId, 'building');
    };

    return {
        buildings,
        saveBuilding,
        deleteBuilding
    };
};
