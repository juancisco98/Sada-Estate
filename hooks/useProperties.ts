import { useDataContext } from '../context/DataContext';
import { supabase } from '../services/supabaseClient';
import { Property } from '../types';
import { propertyToDb } from '../utils/mappers';
import { supabaseUpsert, supabaseDelete, supabaseUpdate } from '../utils/supabaseHelpers';
import { logger } from '../utils/logger';

export const useProperties = (currentUserId?: string) => {
    const { properties, setProperties } = useDataContext();

    const saveProperty = async (savedProp: Property) => {
        await saveProperties([savedProp]);
    };

    const saveProperties = async (savedProps: Property[]) => {
        const propsWithUser = savedProps.map(p => ({
            ...p,
            lastModifiedBy: currentUserId,
            userId: currentUserId
        }));

        setProperties(prev => {
            const newProps = [...prev];
            propsWithUser.forEach(p => {
                const index = newProps.findIndex(existing => existing.id === p.id);
                if (index !== -1) {
                    newProps[index] = p;
                } else {
                    newProps.push(p);
                }
            });
            return newProps;
        });

        const dbRows = propsWithUser.map(propertyToDb);
        await supabaseUpsert('properties', dbRows, `${propsWithUser.length} properties`);
    };

    const updateNote = async (propertyId: string, newNote: string) => {
        setProperties(prev => prev.map(p =>
            p.id === propertyId ? { ...p, notes: newNote, lastModifiedBy: currentUserId } : p
        ));

        await supabaseUpdate('properties', propertyId, { notes: newNote, last_modified_by: currentUserId || null }, 'property note');
    };

    const deleteProperty = async (propertyId: string) => {
        setProperties(prev => prev.filter(p => p.id !== propertyId));

        try {
            await supabase.from('maintenance_tasks').delete().eq('property_id', propertyId);
        } catch (err) {
            logger.error('[Supabase] Exception deleting related tasks:', err);
        }
        await supabaseDelete('properties', propertyId, 'property');
    };

    const updatePropertyFields = async (propertyId: string, updates: Partial<Property>) => {
        const propWithUser = { ...updates, lastModifiedBy: currentUserId };
        setProperties(prev => prev.map(p =>
            p.id === propertyId ? { ...p, ...propWithUser } : p
        ));

        const dbUpdates: Record<string, unknown> = {};
        if (updates.monthlyRent !== undefined) dbUpdates.monthly_rent = updates.monthlyRent;
        if (updates.tenantName !== undefined) dbUpdates.tenant_name = updates.tenantName;
        if (updates.tenantPhone !== undefined) dbUpdates.tenant_phone = updates.tenantPhone;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.buildingId !== undefined) dbUpdates.building_id = updates.buildingId;
        if (updates.unitLabel !== undefined) dbUpdates.unit_label = updates.unitLabel;
        dbUpdates.last_modified_by = currentUserId || null;

        await supabaseUpdate('properties', propertyId, dbUpdates, 'property fields');
    };

    return {
        properties,
        saveProperty,
        updateNote,
        deleteProperty,
        updatePropertyFields,
        saveProperties
    };
};
