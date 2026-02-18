import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Property, Professional, MaintenanceTask, Building } from '../types';
import { supabase } from '../services/supabaseClient';
import { MOCK_PROPERTIES, MOCK_PROFESSIONALS, MOCK_MAINTENANCE_TASKS } from '../constants';
import {
    dbToBuilding, dbToProperty, propertyToDb,
    dbToProfessional, professionalToDb,
    dbToTask
} from '../utils/mappers';

interface DataContextType {
    properties: Property[];
    setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
    professionals: Professional[];
    setProfessionals: React.Dispatch<React.SetStateAction<Professional[]>>;
    maintenanceTasks: MaintenanceTask[];
    setMaintenanceTasks: React.Dispatch<React.SetStateAction<MaintenanceTask[]>>;
    buildings: Building[];
    setBuildings: React.Dispatch<React.SetStateAction<Building[]>>;
    isLoading: boolean;
    refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [properties, setProperties] = useState<Property[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load professionals first
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
                console.log('[Supabase] 📦 No properties found, seeding from mock data...');
                const seedProps = MOCK_PROPERTIES.map(p => {
                    const dbRow = propertyToDb(p);
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
                setMaintenanceTasks([]);
            }

            // Load buildings
            const { data: buildingsData } = await supabase
                .from('buildings')
                .select('*')
                .order('created_at', { ascending: true });

            if (buildingsData && buildingsData.length > 0) {
                setBuildings(buildingsData.map(dbToBuilding));
                console.log(`[Supabase] ✅ Loaded ${buildingsData.length} buildings`);
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

    useEffect(() => {
        loadData();
    }, []);

    return (
        <DataContext.Provider value={{
            properties, setProperties,
            professionals, setProfessionals,
            maintenanceTasks, setMaintenanceTasks,
            buildings, setBuildings,
            isLoading,
            refreshData: loadData
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useDataContext = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useDataContext must be used within a DataProvider');
    }
    return context;
};
