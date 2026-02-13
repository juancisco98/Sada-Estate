import { useState, useEffect } from 'react';
import { Property, Professional, PropertyStatus, MaintenanceTask, TaskStatus } from '../types';
import { MOCK_PROPERTIES, MOCK_PROFESSIONALS, MOCK_MAINTENANCE_TASKS } from '../constants';
import { supabase } from '../services/supabaseClient';

// ========== MAPPERS: DB (snake_case) <-> App (camelCase) ==========

const dbToProperty = (row: any): Property => ({
    id: row.id,
    address: row.address,
    tenantName: row.tenant_name,
    tenantPhone: row.tenant_phone,
    imageUrl: row.image_url,
    status: row.status as PropertyStatus,
    monthlyRent: Number(row.monthly_rent),
    coordinates: row.coordinates as [number, number],
    contractEnd: row.contract_end,
    lastPaymentDate: row.last_payment_date,
    assignedProfessionalId: row.assigned_professional_id,
    professionalAssignedDate: row.professional_assigned_date,
    maintenanceTaskDescription: row.maintenance_task_description,
    notes: row.notes,
    valuation: row.valuation ? Number(row.valuation) : undefined,
    taxInfo: row.tax_info,
    suggestedRent: row.suggested_rent ? Number(row.suggested_rent) : undefined,
    lastModifiedBy: row.last_modified_by,
    rooms: row.rooms,
    squareMeters: row.square_meters ? Number(row.square_meters) : undefined,
    country: row.country,
    currency: row.currency,
    exchangeRate: row.exchange_rate ? Number(row.exchange_rate) : undefined,
});

const propertyToDb = (p: Property): Record<string, any> => ({
    id: p.id,
    address: p.address,
    tenant_name: p.tenantName,
    tenant_phone: p.tenantPhone,
    image_url: p.imageUrl,
    status: p.status,
    monthly_rent: p.monthlyRent,
    coordinates: p.coordinates,
    contract_end: p.contractEnd,
    last_payment_date: p.lastPaymentDate,
    assigned_professional_id: p.assignedProfessionalId || null,
    professional_assigned_date: p.professionalAssignedDate || null,
    maintenance_task_description: p.maintenanceTaskDescription || null,
    notes: p.notes || null,
    valuation: p.valuation || 0,
    tax_info: p.taxInfo || {},
    suggested_rent: p.suggestedRent || null,
    last_modified_by: p.lastModifiedBy || null,
    rooms: p.rooms || null,
    square_meters: p.squareMeters || null,
    country: p.country,
    currency: p.currency,
    exchange_rate: p.exchangeRate || null,
});

const dbToProfessional = (row: any): Professional => ({
    id: row.id,
    name: row.name,
    profession: row.profession,
    rating: Number(row.rating),
    speedRating: Number(row.speed_rating),
    zone: row.zone,
    phone: row.phone,
    reviews: row.reviews || [],
});

const professionalToDb = (p: Professional): Record<string, any> => ({
    id: p.id,
    name: p.name,
    profession: p.profession,
    rating: p.rating,
    speed_rating: p.speedRating,
    zone: p.zone,
    phone: p.phone,
    reviews: p.reviews || [],
});

const dbToTask = (row: any): MaintenanceTask => ({
    id: row.id,
    propertyId: row.property_id,
    professionalId: row.professional_id,
    description: row.description,
    status: row.status as TaskStatus,
    startDate: row.start_date,
    estimatedCost: Number(row.estimated_cost),
    cost: row.cost ? Number(row.cost) : undefined,
    endDate: row.end_date || undefined,
});

const taskToDb = (t: MaintenanceTask): Record<string, any> => ({
    id: t.id,
    property_id: t.propertyId,
    professional_id: t.professionalId,
    description: t.description,
    status: t.status,
    start_date: t.startDate,
    estimated_cost: t.estimatedCost,
    cost: t.cost || null,
    end_date: t.endDate || null,
});

// ========== HOOK ==========

export const usePropertyData = (currentUserId?: string) => {
    const [properties, setProperties] = useState<Property[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load all data from Supabase on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Load professionals first (properties may reference them)
                const { data: prosData, error: prosError } = await supabase
                    .from('professionals')
                    .select('*')
                    .order('created_at', { ascending: true });

                if (prosError) throw prosError;

                let loadedPros: Professional[];
                if (prosData && prosData.length > 0) {
                    loadedPros = prosData.map(dbToProfessional);
                    console.log(`[Supabase] ✅ Loaded ${loadedPros.length} professionals`);
                } else {
                    // Seed from mock data
                    console.log('[Supabase] 📦 No professionals found, seeding from mock data...');
                    const seedPros = MOCK_PROFESSIONALS.map(p => professionalToDb(p));
                    const { error: seedError } = await supabase.from('professionals').insert(seedPros);
                    if (seedError) console.error('[Supabase] Seed pros error:', seedError);
                    loadedPros = MOCK_PROFESSIONALS;
                }
                setProfessionals(loadedPros);

                // Load properties
                const { data: propsData, error: propsError } = await supabase
                    .from('properties')
                    .select('*')
                    .order('created_at', { ascending: true });

                if (propsError) throw propsError;

                let loadedProps: Property[];
                if (propsData && propsData.length > 0) {
                    loadedProps = propsData.map(dbToProperty);
                    console.log(`[Supabase] ✅ Loaded ${loadedProps.length} properties`);
                } else {
                    // Seed from mock data
                    console.log('[Supabase] 📦 No properties found, seeding from mock data...');
                    const seedProps = MOCK_PROPERTIES.map(p => {
                        const dbRow = propertyToDb(p);
                        // Remove FK references that won't exist yet in UUID format
                        dbRow.assigned_professional_id = null;
                        dbRow.last_modified_by = null;
                        return dbRow;
                    });
                    const { error: seedError } = await supabase.from('properties').insert(seedProps);
                    if (seedError) console.error('[Supabase] Seed props error:', seedError);
                    loadedProps = MOCK_PROPERTIES;
                }
                setProperties(loadedProps);

                // Load maintenance tasks
                const { data: tasksData, error: tasksError } = await supabase
                    .from('maintenance_tasks')
                    .select('*')
                    .order('created_at', { ascending: true });

                if (tasksError) throw tasksError;

                if (tasksData && tasksData.length > 0) {
                    setMaintenanceTasks(tasksData.map(dbToTask));
                    console.log(`[Supabase] ✅ Loaded ${tasksData.length} tasks`);
                } else {
                    console.log('[Supabase] 📦 No tasks found (starting fresh)');
                    setMaintenanceTasks([]);
                }

            } catch (error) {
                console.error('[Supabase] ❌ Load error, falling back to mock data:', error);
                setProperties(MOCK_PROPERTIES);
                setProfessionals(MOCK_PROFESSIONALS);
                setMaintenanceTasks(MOCK_MAINTENANCE_TASKS);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    // ========== PROPERTY CRUD ==========

    const handleSaveProperty = async (savedProp: Property) => {
        const propWithUser = { ...savedProp, lastModifiedBy: currentUserId };

        // Update local state immediately (optimistic)
        setProperties(prev => {
            const exists = prev.find(p => p.id === propWithUser.id);
            if (exists) {
                return prev.map(p => p.id === propWithUser.id ? propWithUser : p);
            } else {
                return [...prev, propWithUser];
            }
        });

        // Persist to Supabase
        try {
            const dbRow = propertyToDb(propWithUser);
            const { error } = await supabase
                .from('properties')
                .upsert(dbRow, { onConflict: 'id' });

            if (error) {
                console.error('[Supabase] ❌ Error saving property:', error);
            } else {
                console.log(`[Supabase] ✅ Property saved: ${propWithUser.address}`);
            }
        } catch (err) {
            console.error('[Supabase] ❌ Exception saving property:', err);
        }
    };

    const handleUpdateNote = async (propertyId: string, newNote: string) => {
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

    const handleDeleteProperty = async (propertyId: string) => {
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

    // ========== PROFESSIONAL CRUD ==========

    const handleSaveProfessional = async (newPro: Professional) => {
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

    const handleDeleteProfessional = async (proId: string) => {
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

    // ========== ASSIGNMENT & MAINTENANCE ==========

    const handleAssignProfessional = async (propertyId: string, professional: Professional, taskDescription: string) => {
        // 1. Update Property locally
        setProperties(prev => prev.map(p => {
            if (p.id === propertyId) {
                return {
                    ...p,
                    assignedProfessionalId: professional.id,
                    professionalAssignedDate: new Date().toISOString(),
                    maintenanceTaskDescription: taskDescription,
                    lastModifiedBy: currentUserId
                };
            }
            return p;
        }));

        // 2. Create Maintenance Task locally
        const newTask: MaintenanceTask = {
            id: `t-${Date.now()}`,
            propertyId,
            professionalId: professional.id,
            description: taskDescription,
            status: TaskStatus.IN_PROGRESS,
            startDate: new Date().toISOString(),
            estimatedCost: 0
        };
        setMaintenanceTasks(prev => [...prev, newTask]);

        // 3. Persist to Supabase
        try {
            await supabase
                .from('properties')
                .update({
                    assigned_professional_id: professional.id,
                    professional_assigned_date: new Date().toISOString(),
                    maintenance_task_description: taskDescription,
                    last_modified_by: currentUserId || null
                })
                .eq('id', propertyId);

            await supabase
                .from('maintenance_tasks')
                .insert(taskToDb(newTask));

            console.log(`[Supabase] ✅ Professional assigned & task created`);
        } catch (err) {
            console.error('[Supabase] ❌ Exception assigning professional:', err);
        }
    };

    const handleFinishMaintenance = async (propertyId: string, rating?: number, speedRating?: number, comment?: string, finalCost?: number) => {
        // 1. Update property locally
        setProperties(prev => {
            const property = prev.find(p => p.id === propertyId);
            const proId = property?.assignedProfessionalId;

            if (proId && rating) {
                setTimeout(() => {
                    setProfessionals(pros => pros.map(pro => {
                        if (pro.id === proId) {
                            const currentReviews = pro.reviews || [];
                            const count = currentReviews.length + 5;
                            const newRating = ((pro.rating * count) + rating) / (count + 1);
                            const newSpeed = ((pro.speedRating * count) + (speedRating || rating)) / (count + 1);

                            const updatedPro = {
                                ...pro,
                                rating: parseFloat(newRating.toFixed(1)),
                                speedRating: parseFloat(newSpeed.toFixed(1)),
                                reviews: [...currentReviews, { rating, comment: comment || '', date: new Date().toISOString() }]
                            };

                            // Persist professional update
                            supabase
                                .from('professionals')
                                .update(professionalToDb(updatedPro))
                                .eq('id', proId)
                                .then(({ error }) => {
                                    if (error) console.error('[Supabase] ❌ Error updating pro rating:', error);
                                });

                            return updatedPro;
                        }
                        return pro;
                    }));
                }, 0);
            }

            return prev.map(p => {
                if (p.id === propertyId) {
                    return {
                        ...p,
                        assignedProfessionalId: undefined,
                        professionalAssignedDate: undefined,
                        maintenanceTaskDescription: undefined,
                    };
                }
                return p;
            });
        });

        // 2. Update maintenance task locally
        setMaintenanceTasks(prev => prev.map(task => {
            if (task.propertyId === propertyId && task.status !== TaskStatus.COMPLETED) {
                return {
                    ...task,
                    status: TaskStatus.COMPLETED,
                    cost: finalCost || 0,
                    endDate: new Date().toISOString()
                };
            }
            return task;
        }));

        // 3. Persist to Supabase
        try {
            await supabase
                .from('properties')
                .update({
                    assigned_professional_id: null,
                    professional_assigned_date: null,
                    maintenance_task_description: null,
                })
                .eq('id', propertyId);

            // Find the active task for this property
            const { data: activeTasks } = await supabase
                .from('maintenance_tasks')
                .select('id')
                .eq('property_id', propertyId)
                .neq('status', 'COMPLETED')
                .limit(1);

            if (activeTasks && activeTasks.length > 0) {
                await supabase
                    .from('maintenance_tasks')
                    .update({
                        status: 'COMPLETED',
                        cost: finalCost || 0,
                        end_date: new Date().toISOString()
                    })
                    .eq('id', activeTasks[0].id);
            }

            console.log(`[Supabase] ✅ Maintenance finished for property ${propertyId}`);
        } catch (err) {
            console.error('[Supabase] ❌ Exception finishing maintenance:', err);
        }
    };

    // Generic updater
    const updatePropertyFields = async (propertyId: string, updates: Partial<Property>) => {
        const propWithUser = { ...updates, lastModifiedBy: currentUserId };
        setProperties(prev => prev.map(p =>
            p.id === propertyId ? { ...p, ...propWithUser } : p
        ));

        try {
            // Convert camelCase updates to snake_case for DB
            const dbUpdates: Record<string, any> = {};
            if (updates.monthlyRent !== undefined) dbUpdates.monthly_rent = updates.monthlyRent;
            if (updates.tenantName !== undefined) dbUpdates.tenant_name = updates.tenantName;
            if (updates.tenantPhone !== undefined) dbUpdates.tenant_phone = updates.tenantPhone;
            if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
            if (updates.status !== undefined) dbUpdates.status = updates.status;
            if (updates.suggestedRent !== undefined) dbUpdates.suggested_rent = updates.suggestedRent;
            if (updates.taxInfo !== undefined) dbUpdates.tax_info = updates.taxInfo;
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
        professionals,
        maintenanceTasks,
        isLoading,
        handleSaveProperty,
        handleUpdateNote,
        handleSaveProfessional,
        handleAssignProfessional,
        handleFinishMaintenance,
        updatePropertyFields,
        handleDeleteProfessional,
        handleDeleteProperty
    };
};
