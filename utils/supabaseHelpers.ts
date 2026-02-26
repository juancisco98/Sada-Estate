import { supabase } from '../services/supabaseClient';
import { logger } from './logger';
import { handleError } from './errorHandler';

/**
 * Generic wrapper for Supabase upsert operations with optimistic updates.
 */
export async function supabaseUpsert<T>(
    table: string,
    dbRow: Record<string, unknown> | Record<string, unknown>[],
    label: string
): Promise<void> {
    try {
        const rows = Array.isArray(dbRow) ? dbRow : [dbRow];
        const { error } = await supabase
            .from(table)
            .upsert(rows, { onConflict: 'id' });

        if (error) {
            logger.error(`[Supabase] Error saving ${label}:`, error);
        } else {
            logger.log(`[Supabase] ${label} saved successfully.`);
        }
    } catch (err) {
        logger.error(`[Supabase] Exception saving ${label}:`, err);
    }
}

/**
 * Generic wrapper for Supabase delete operations.
 */
export async function supabaseDelete(
    table: string,
    id: string,
    label: string
): Promise<void> {
    try {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);

        if (error) {
            logger.error(`[Supabase] Error deleting ${label}:`, error);
        } else {
            logger.log(`[Supabase] ${label} deleted: ${id}`);
        }
    } catch (err) {
        logger.error(`[Supabase] Exception deleting ${label}:`, err);
    }
}

/**
 * Generic wrapper for Supabase update operations.
 */
export async function supabaseUpdate(
    table: string,
    id: string,
    updates: Record<string, unknown>,
    label: string
): Promise<void> {
    try {
        const { error } = await supabase
            .from(table)
            .update(updates)
            .eq('id', id);

        if (error) {
            logger.error(`[Supabase] Error updating ${label}:`, error);
        } else {
            logger.log(`[Supabase] ${label} updated: ${id}`);
        }
    } catch (err) {
        logger.error(`[Supabase] Exception updating ${label}:`, err);
    }
}

/**
 * Generic wrapper for Supabase insert operations.
 */
export async function supabaseInsert(
    table: string,
    row: Record<string, unknown>,
    label: string
): Promise<void> {
    try {
        const { error } = await supabase
            .from(table)
            .insert(row);

        if (error) {
            logger.error(`[Supabase] Error inserting ${label}:`, error);
        } else {
            logger.log(`[Supabase] ${label} inserted.`);
        }
    } catch (err) {
        logger.error(`[Supabase] Exception inserting ${label}:`, err);
    }
}
