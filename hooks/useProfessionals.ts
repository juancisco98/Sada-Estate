import { useDataContext } from '../context/DataContext';
import { supabase } from '../services/supabaseClient';
import { Professional } from '../types';
import { professionalToDb } from '../utils/mappers';

export const useProfessionals = () => {
    const { professionals, setProfessionals } = useDataContext();

    const saveProfessional = async (newPro: Professional) => {
        setProfessionals(prev => [...prev, newPro]);

        try {
            const { error } = await supabase
                .from('professionals')
                .insert(professionalToDb(newPro));

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
