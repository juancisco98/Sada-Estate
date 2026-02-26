import { useDataContext } from '../context/DataContext';
import { supabase } from '../services/supabaseClient';
import { Professional, MaintenanceTask, TaskStatus } from '../types';
import { taskToDb, professionalToDb } from '../utils/mappers';
import { supabaseUpdate, supabaseInsert } from '../utils/supabaseHelpers';
import { logger } from '../utils/logger';

export const useMaintenance = (currentUserId?: string) => {
    const {
        setProperties,
        setMaintenanceTasks,
        setProfessionals,
        maintenanceTasks
    } = useDataContext();

    const assignProfessional = async (propertyId: string, professional: Professional, taskDescription: string) => {
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

        await supabaseUpdate('properties', propertyId, {
            assigned_professional_id: professional.id,
            professional_assigned_date: new Date().toISOString(),
            maintenance_task_description: taskDescription,
            last_modified_by: currentUserId || null
        }, 'property assignment');

        await supabaseInsert('maintenance_tasks', taskToDb(newTask), 'maintenance task');
    };

    const addPartialExpense = async (taskId: string, expense: { description: string, amount: number, date: string, by: string }) => {
        const newExpense = { ...expense, id: `pe-${Date.now()}` };

        setMaintenanceTasks(prev => prev.map(task => {
            if (task.id === taskId) {
                return {
                    ...task,
                    partialExpenses: [...(task.partialExpenses || []), newExpense]
                };
            }
            return task;
        }));

        try {
            const { data: activeTasks } = await supabase
                .from('maintenance_tasks')
                .select('id, partial_expenses')
                .eq('id', taskId)
                .limit(1);

            if (activeTasks && activeTasks.length > 0) {
                const currentExpenses = activeTasks[0].partial_expenses || [];
                await supabaseUpdate('maintenance_tasks', activeTasks[0].id, {
                    partial_expenses: [...currentExpenses, newExpense]
                }, 'partial expense');
            }
        } catch (err) {
            logger.error('[Supabase] Exception adding partial expense:', err);
        }
    };

    const finishMaintenance = async (propertyId: string, rating?: number, speedRating?: number, comment?: string, finalCost?: number) => {
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

                            supabaseUpdate('professionals', proId, professionalToDb(updatedPro), 'professional rating');
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

        await supabaseUpdate('properties', propertyId, {
            assigned_professional_id: null,
            professional_assigned_date: null,
            maintenance_task_description: null,
        }, 'property maintenance clear');

        try {
            const { data: activeTasks } = await supabase
                .from('maintenance_tasks')
                .select('id')
                .eq('property_id', propertyId)
                .neq('status', 'COMPLETED')
                .limit(1);

            if (activeTasks && activeTasks.length > 0) {
                await supabaseUpdate('maintenance_tasks', activeTasks[0].id, {
                    status: 'COMPLETED',
                    cost: finalCost || 0,
                    end_date: new Date().toISOString()
                }, 'maintenance completion');
            }
        } catch (err) {
            logger.error('[Supabase] Exception finishing maintenance:', err);
        }
    };

    return {
        maintenanceTasks,
        assignProfessional,
        addPartialExpense,
        finishMaintenance
    };
};
