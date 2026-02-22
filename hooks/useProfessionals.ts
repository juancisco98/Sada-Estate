import { useDataContext } from '../context/DataContext';
import { supabase } from '../services/supabaseClient';
import { Professional } from '../types';
import { professionalToDb } from '../utils/mappers';

export const useProfessionals = (currentUserId?: string) => {
    const { professionals, setProfessionals } = useDataContext();

    const saveProfessional = async (newPro: Professional) => {
        const proWithUser = { ...newPro, userId: currentUserId };
        setProfessionals(prev => {
            const exists = prev.find(p => p.id === newPro.id);
            if (exists) return prev.map(p => p.id === newPro.id ? proWithUser : p);
            return [...prev, proWithUser];
        });

        try {
            const { error } = await supabase
                .from('professionals')
                .upsert(professionalToDb(proWithUser), { onConflict: 'id' });

            if (error) console.error('[Supabase] ❌ Error saving professional:', error);
            else console.log(`[Supabase] ✅ Professional saved: ${newPro.name}`);
        } catch (err) {
            console.error('[Supabase] ❌ Exception saving professional:', err);
        }
    };

    const deleteProfessional = async (proId: string) => {
        setProfessionals(prev => prev.filter(p => p.id !== proId));

        try {
            const { error } = await supabase
                .from('professionals')
                .delete()
                .eq('id', proId);

            if (error) console.error('[Supabase] ❌ Error deleting professional:', error);
            else console.log(`[Supabase] ✅ Professional deleted: ${proId}`);
        } catch (err) {
            console.error('[Supabase] ❌ Exception deleting professional:', err);
        }
    };

    return {
        professionals,
        saveProfessional,
        deleteProfessional
    };
};
