import { useDataContext } from '../context/DataContext';
import { supabase } from '../services/supabaseClient';
import { Property } from '../types';
import { propertyToDb } from '../utils/mappers';

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

        // Optimistic update
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

        try {
            const dbRows = propsWithUser.map(propertyToDb);
            const { error } = await supabase
                .from('properties')
                .upsert(dbRows, { onConflict: 'id' });

            if (error) {
                console.error('[Supabase] ❌ Error saving properties:', error);
            } else {
                console.log(`[Supabase] ✅ Saved ${propsWithUser.length} properties.`);
            }
        } catch (err) {
            console.error('[Supabase] ❌ Exception saving properties:', err);
        }
    };

    const updateNote = async (propertyId: string, newNote: string) => {
        setProperties(prev => prev.map(p =>
            p.id === propertyId ? { ...p, notes: newNote, lastModifiedBy: currentUserId } : p
        ));

        try {
            const { error } = await supabase
                .from('properties')
                .update({ notes: newNote, last_modified_by: currentUserId || null })
                .eq('id', propertyId);

            if (error) console.error('[Supabase] ❌ Error updating note:', error);
        } catch (err) {
            console.error('[Supabase] ❌ Exception updating note:', err);
        }
    };

    const deleteProperty = async (propertyId: string) => {
        setProperties(prev => prev.filter(p => p.id !== propertyId));

        try {
            // Also delete associated maintenance tasks
            await supabase
                .from('maintenance_tasks')
                .delete()
                .eq('property_id', propertyId);

            const { error } = await supabase
                .from('properties')
                .delete()
                .eq('id', propertyId);

            if (error) console.error('[Supabase] ❌ Error deleting property:', error);
            else console.log(`[Supabase] ✅ Property deleted: ${propertyId}`);
        } catch (err) {
            console.error('[Supabase] ❌ Exception deleting property:', err);
        }
    };

    const updatePropertyFields = async (propertyId: string, updates: Partial<Property>) => {
        const propWithUser = { ...updates, lastModifiedBy: currentUserId };
        setProperties(prev => prev.map(p =>
            p.id === propertyId ? { ...p, ...propWithUser } : p
        ));

        try {
            const dbUpdates: Record<string, any> = {};
            if (updates.monthlyRent !== undefined) dbUpdates.monthly_rent = updates.monthlyRent;
            if (updates.tenantName !== undefined) dbUpdates.tenant_name = updates.tenantName;
            if (updates.tenantPhone !== undefined) dbUpdates.tenant_phone = updates.tenantPhone;
            if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
            if (updates.status !== undefined) dbUpdates.status = updates.status;
            if (updates.buildingId !== undefined) dbUpdates.building_id = updates.buildingId;
            if (updates.unitLabel !== undefined) dbUpdates.unit_label = updates.unitLabel;
            dbUpdates.last_modified_by = currentUserId || null;

            const { error } = await supabase
                .from('properties')
                .update(dbUpdates)
                .eq('id', propertyId);

            if (error) console.error('[Supabase] ❌ Error updating property fields:', error);
        } catch (err) {
            console.error('[Supabase] ❌ Exception updating property fields:', err);
        }
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
