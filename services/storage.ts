import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

const BUCKET_NAME = 'payment-proofs';

/**
 * Uploads a file to Supabase Storage and returns the public URL.
 * @param file The file to upload.
 * @param folder Optional folder path within the bucket (e.g., 'tenants/123').
 * @returns Promise resolving to the public URL of the uploaded file.
 */
export const uploadPaymentProof = async (file: File, folder: string = 'general'): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            logger.error('Error uploading file:', error.message);
            throw error;
        }

        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

        return publicUrlData.publicUrl;
    } catch (error) {
        logger.error('Upload failed:', error);
        return null;
    }
};
