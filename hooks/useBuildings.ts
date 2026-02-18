import { useDataContext } from '../context/DataContext';
import { supabase } from '../services/supabaseClient';
import { Building } from '../types';
import { buildingToDb } from '../utils/mappers';

export const useBuildings = () => {
    const { buildings, setBuildings, setProperties } = useDataContext();

    const saveBuilding = async (building: Building) => {
        setBuildings(prev => {
            const exists = prev.find(b => b.id === building.id);
            if (exists) return prev.map(b => b.id === building.id ? building : b);
            return [...prev, building];
        });

        try {
            const { error } = await supabase
                .from('buildings')
                .upsert(buildingToDb(building), { onConflict: 'id' });
            if (error) console.error('[Supabase] ❌ Error saving building:', error);
            else console.log(`[Supabase] ✅ Building saved: ${building.address}`);
        } catch (err) {
            console.error('[Supabase] ❌ Exception saving building:', err);
        }
    };

    const deleteBuilding = async (buildingId: string) => {
        setBuildings(prev => prev.filter(b => b.id !== buildingId));
        // Unlink properties
        setProperties(prev => prev.map(p =>
            p.buildingId === buildingId ? { ...p, buildingId: undefined, unitLabel: undefined } : p
        ));

        try {
            await supabase.from('properties').update({ building_id: null, unit_label: '' }).eq('building_id', buildingId);
            const { error } = await supabase.from('buildings').delete().eq('id', buildingId);
            if (error) console.error('[Supabase] ❌ Error deleting building:', error);
        } catch (err) {
            console.error('[Supabase] ❌ Exception deleting building:', err);
        }
    };

    return {
        buildings,
        saveBuilding,
        deleteBuilding
    };
};
