import { useDataContext } from '../context/DataContext';
import { Professional } from '../types';
import { professionalToDb } from '../utils/mappers';
import { supabaseUpsert, supabaseDelete } from '../utils/supabaseHelpers';

export const useProfessionals = (currentUserId?: string) => {
    const { professionals, setProfessionals } = useDataContext();

    const saveProfessional = async (newPro: Professional) => {
        const proWithUser = { ...newPro, userId: currentUserId };
        setProfessionals(prev => {
            const exists = prev.find(p => p.id === newPro.id);
            if (exists) return prev.map(p => p.id === newPro.id ? proWithUser : p);
            return [...prev, proWithUser];
        });

        await supabaseUpsert('professionals', professionalToDb(proWithUser), `professional ${newPro.name}`);
    };

    const deleteProfessional = async (proId: string) => {
        setProfessionals(prev => prev.filter(p => p.id !== proId));
        await supabaseDelete('professionals', proId, 'professional');
    };

    return {
        professionals,
        saveProfessional,
        deleteProfessional
    };
};
