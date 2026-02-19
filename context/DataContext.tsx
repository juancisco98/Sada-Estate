import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Property, Professional, MaintenanceTask, Building } from '../types';
import { supabase } from '../services/supabaseClient';
import {
    dbToBuilding, dbToProperty,
    dbToProfessional,
    dbToTask
} from '../utils/mappers';
import { handleError } from '../utils/errorHandler';

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

            if (prosData) {
                const loadedPros = prosData.map(dbToProfessional);
                setProfessionals(loadedPros);
                console.log(`[Supabase] ✅ Loaded ${loadedPros.length} professionals`);
            }

            // Load properties
            const { data: propsData, error: propsError } = await supabase
                .from('properties')
                .select('*')
                .order('created_at', { ascending: true });

            if (propsError) throw propsError;

            if (propsData) {
                const loadedProps = propsData.map(dbToProperty);
                setProperties(loadedProps);
                console.log(`[Supabase] ✅ Loaded ${loadedProps.length} properties`);
            }

            // Load maintenance tasks
            const { data: tasksData, error: tasksError } = await supabase
                .from('maintenance_tasks')
                .select('*')
                .order('created_at', { ascending: true });

            if (tasksError) throw tasksError;

            if (tasksData) {
                setMaintenanceTasks(tasksData.map(dbToTask));
                console.log(`[Supabase] ✅ Loaded ${tasksData.length} tasks`);
            }

            // Load buildings
            const { data: buildingsData } = await supabase
                .from('buildings')
                .select('*')
                .order('created_at', { ascending: true });

            if (buildingsData) {
                setBuildings(buildingsData.map(dbToBuilding));
                console.log(`[Supabase] ✅ Loaded ${buildingsData.length} buildings`);
            }

        } catch (error) {
            handleError(error, 'Error al cargar los datos. Por favor recargue la página.');
            // No fallback to mock data
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
