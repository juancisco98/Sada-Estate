import { useDataContext } from '../context/DataContext';
import { supabase } from '../services/supabaseClient';
import { Professional, MaintenanceTask, TaskStatus } from '../types';
import { taskToDb, professionalToDb } from '../utils/mappers';

export const useMaintenance = (currentUserId?: string) => {
    const {
        setProperties,
        setMaintenanceTasks,
        setProfessionals,
        maintenanceTasks
    } = useDataContext();

    const assignProfessional = async (propertyId: string, professional: Professional, taskDescription: string) => {
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
            estimatedCost: 0,
            userId: currentUserId
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

    const addPartialExpense = async (taskId: string, expense: { description: string, amount: number, date: string, by: string }) => {
        const newExpense = { ...expense, id: `pe-${Date.now()}` };

        // 1. Update maintenance task locally
        setMaintenanceTasks(prev => prev.map(task => {
            if (task.id === taskId) {
                return {
                    ...task,
                    partialExpenses: [...(task.partialExpenses || []), newExpense]
                };
            }
            return task;
        }));

        // 2. Persist to Supabase
        try {
            // Find the active task
            const { data: activeTasks } = await supabase
                .from('maintenance_tasks')
                .select('id, partial_expenses')
                .eq('id', taskId)
                .limit(1);

            if (activeTasks && activeTasks.length > 0) {
                const currentExpenses = activeTasks[0].partial_expenses || [];
                await supabase
                    .from('maintenance_tasks')
                    .update({
                        partial_expenses: [...currentExpenses, newExpense]
                    })
                    .eq('id', activeTasks[0].id);

                console.log(`[Supabase] ✅ Partial expense added`);
            }
        } catch (err) {
            console.error('[Supabase] ❌ Exception adding partial expense:', err);
        }
    };

    const finishMaintenance = async (propertyId: string, rating?: number, speedRating?: number, comment?: string, finalCost?: number) => {
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

    return {
        maintenanceTasks,
        assignProfessional,
        addPartialExpense,
        finishMaintenance
    };
};
