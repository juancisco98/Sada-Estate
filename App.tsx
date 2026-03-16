import React, { useState, useEffect, useCallback, Suspense, lazy, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { handleError } from './utils/errorHandler';
import { logger } from './utils/logger';

import { LayoutDashboard, FileSpreadsheet } from 'lucide-react';
import MapBoard from './components/MapBoard';
import PropertyCard from './components/PropertyCard';
import Sidebar, { ViewState } from './components/Sidebar';
import AuthScreen from './components/AuthScreen';
import Header from './components/Header';
import AddPropertyModal from './components/AddPropertyModal';
import FinishMaintenanceModal from './components/FinishMaintenanceModal';
import AddProfessionalModal from './components/AddProfessionalModal';
import AssignProfessionalModal from './components/AssignProfessionalModal';
import BuildingCard from './components/BuildingCard';
import { Property, Professional, User, Building } from './types';
import { DataProvider, useDataContext } from './context/DataContext';
import { supabase, signOut } from './services/supabaseClient';
import { ALLOWED_EMAILS } from './constants';
import { useProperties } from './hooks/useProperties';
import { useProfessionals } from './hooks/useProfessionals';
import { useMaintenance } from './hooks/useMaintenance';
import { useBuildings } from './hooks/useBuildings';
import { useTenantData } from './hooks/useTenantData';
import { useReminders } from './hooks/useReminders';
import { useAutomation } from './hooks/useAutomation';
import { detectCountryFromAddress } from './utils/taxConfig';
import { useSearch } from './hooks/useSearch';
import type { Session } from '@supabase/supabase-js';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Lazy load dashboard views
const OverviewView = lazy(() => import('./components/DashboardViews').then(module => ({ default: module.OverviewView })));
const FinanceView = lazy(() => import('./components/DashboardViews').then(module => ({ default: module.FinanceView })));
const ProfessionalsView = lazy(() => import('./components/DashboardViews').then(module => ({ default: module.ProfessionalsView })));
const TenantsView = lazy(() => import('./components/TenantsView'));
const RemindersView = lazy(() => import('./components/RemindersView'));
const AutomationView = lazy(() => import('./components/AutomationView'));
const TenantPortal = lazy(() => import('./components/TenantPortal'));
const ExpensesAdminPortal = lazy(() => import('./components/ExpensesAdminPortal'));


const Dashboard: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [currentView, setCurrentView] = useState<ViewState>('MAP');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminMode, setAdminMode] = useState<'choosing' | 'admin' | 'expenses'>('choosing');

  // Data Hooks
  const { isLoading, refreshData } = useDataContext();
  const {
    properties,
    saveProperty: savePropertyData,
    saveProperties: savePropertiesData,
    updateNote: updateNoteData,
    deleteProperty: handleDeleteProperty,
    updatePropertyFields
  } = useProperties(currentUser?.id);

  const {
    professionals,
    saveProfessional: saveProfessionalData,
    deleteProfessional: handleDeleteProfessional
  } = useProfessionals(currentUser?.id);

  const {
    maintenanceTasks,
    assignProfessional: assignProfessionalData,
    finishMaintenance: finishMaintenanceData,
    addPartialExpense
  } = useMaintenance(currentUser?.id);

  const {
    buildings,
    saveBuilding: handleSaveBuilding,
    deleteBuilding: handleDeleteBuilding // Note: App.tsx doesn't seem to use this widely but usePropertyData exported it
  } = useBuildings(currentUser?.id);

  // Tenant Data
  const {
    tenants,
    payments,
    handleSaveTenant,
    handleDeleteTenant,
    handleRegisterPayment,
    handleUpdatePayment,
    getTenantMetrics,
  } = useTenantData(currentUser?.id);

  // Reminders
  const {
    allReminders,
    activeCount: reminderActiveCount,
    createReminder,
    toggleComplete: toggleReminderComplete,
    deleteReminder,
    analyzeWithAI,
    isAnalyzing,
    lastAnalysis,
  } = useReminders();

  // Automation
  const {
    pendingProposals,
    automationRules,
    automationHistory,
    stats: automationStats,
    isAnalyzing: isAutomationAnalyzing,
    toggleRule,
    toggleApprovalRequired,
    updateConfidenceThreshold,
    approveProposal,
    rejectProposal,
    undoExecution,
    triggerAnalysis,
    loadActionLogCount,
  } = useAutomation();

  // Selection State
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [previousBuilding, setPreviousBuilding] = useState<Building | null>(null);

  // Sync selectedProperty with latest data
  useEffect(() => {
    if (selectedProperty) {
      const updated = properties.find(p => p.id === selectedProperty.id);
      if (updated && updated !== selectedProperty) {
        setSelectedProperty(updated);
      }
    }
  }, [properties, selectedProperty]);

  // State to handle navigation from Map Card "Ver Métricas" to Finance View Modal
  const [financialPropertyToOpen, setFinancialPropertyToOpen] = useState<Property | null>(null);

  // Modal States
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [propertyToEdit, setPropertyToEdit] = useState<Property | null>(null);
  const [isRestrictedEdit, setIsRestrictedEdit] = useState(false);
  const [targetBuilding, setTargetBuilding] = useState<Building | null>(null);
  const [finishingProperty, setFinishingProperty] = useState<Property | null>(null);
  const [showAddProModal, setShowAddProModal] = useState(false);
  const [professionalToEdit, setProfessionalToEdit] = useState<Professional | null>(null);
  const [assigningProfessional, setAssigningProfessional] = useState<Professional | null>(null);

  // --- URL State Management ---
  const isHydrated = useRef(false);

  // Hydrate state from URL on load
  useEffect(() => {
    if (!isLoading && properties.length > 0 && !isHydrated.current) {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') as ViewState;
      const propertyIdParam = params.get('property');

      if (viewParam && ['MAP', 'OVERVIEW', 'FINANCE', 'PROFESSIONALS', 'TENANTS', 'REMINDERS'].includes(viewParam)) {
        setCurrentView(viewParam);
      }

      if (propertyIdParam) {
        const prop = properties.find(p => p.id === propertyIdParam);
        if (prop) {
          setSelectedProperty(prop);
          if (viewParam === 'FINANCE') {
            setFinancialPropertyToOpen(prop);
          }
        }
      }
      isHydrated.current = true;
    }
  }, [isLoading, properties]);

  // Update URL on state change
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (currentView) {
      params.set('view', currentView);
    }

    // Sync property ID from either selectedProperty or financialPropertyToOpen
    const propToSync = financialPropertyToOpen || selectedProperty;
    if (propToSync) {
      params.set('property', propToSync.id);
    } else {
      params.delete('property');
    }

    // Use replaceState to update URL without adding to history stack, 
    // ensuring back button works naturally for navigation history, 
    // but refreshes keep state.
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [currentView, selectedProperty, financialPropertyToOpen]);

  // --- Hooks Integration ---
  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    mapCenter,
    setMapCenter,
    searchResult,
    setSearchResult,
    performSearch: rawPerformSearch
  } = useSearch();

  const handleSearch = (query: string) => {
    rawPerformSearch(query, setCurrentView, setSelectedProperty);
  };

  // --- Auth Effects ---
  useEffect(() => {
    const handleAuthChange = async (event: string, session: Session | null) => {
      logger.log(`[Auth] Event: ${event}`);

      if (session?.user?.email) {
        const userEmail = session.user.email.toLowerCase();
        const isAllowed = ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(userEmail);

        if (isAllowed) {
          setCurrentUser({
            id: session.user.id,
            name: session.user.user_metadata?.full_name || userEmail.split('@')[0],
            email: userEmail,
            photoURL: session.user.user_metadata?.avatar_url,
            color: '#3b82f6',
            role: 'ADMIN'
          });
          setIsAuthenticated(true);
          logger.log('[Auth] User authenticated as ADMIN (hardcoded).');
        } else {
          // Check if email exists in allowed_emails table (Dynamic Admins)
          const { data: adminData } = await supabase
            .from('allowed_emails')
            .select('email')
            .eq('email', userEmail)
            .maybeSingle();

          if (adminData) {
            setCurrentUser({
              id: session.user.id,
              name: session.user.user_metadata?.full_name || userEmail.split('@')[0],
              email: userEmail,
              photoURL: session.user.user_metadata?.avatar_url,
              color: '#3b82f6',
              role: 'ADMIN'
            });
            setIsAuthenticated(true);
            logger.log('[Auth] User authenticated as ADMIN (database).');
          } else {
            // Check if email exists in expenses_admins table
            const { data: expensesAdminData } = await supabase
              .from('expenses_admins')
              .select('email')
              .eq('email', userEmail)
              .maybeSingle();

            if (expensesAdminData) {
              setCurrentUser({
                id: session.user.id,
                name: session.user.user_metadata?.full_name || userEmail.split('@')[0],
                email: userEmail,
                photoURL: session.user.user_metadata?.avatar_url,
                color: '#8b5cf6',
                role: 'EXPENSES_ADMIN'
              });
              setIsAuthenticated(true);
              logger.log('[Auth] User authenticated as EXPENSES_ADMIN.');
            } else {
            // Check if email exists in tenants table
            const { data: tenantData, error } = await supabase
              .from('tenants')
              .select('*')
              .eq('email', userEmail)
              .maybeSingle();

            if (tenantData && !error) {
              // Link Auth UID to tenant record if missing or different
              if (!tenantData.user_id || tenantData.user_id !== session.user.id) {
                await supabase
                  .from('tenants')
                  .update({ user_id: session.user.id })
                  .eq('id', tenantData.id);
                logger.log('[Auth] Linked tenant Auth UID to record.');
                refreshData();
              }

              setCurrentUser({
                id: session.user.id,
                name: session.user.user_metadata?.full_name || tenantData.name,
                email: userEmail,
                photoURL: session.user.user_metadata?.avatar_url,
                color: '#10b981',
                role: 'TENANT'
              });
              setIsAuthenticated(true);
              logger.log('[Auth] User authenticated as TENANT.');
            } else {
              logger.warn('[Auth] Unauthorized access attempt for ' + userEmail);
              await signOut();
              handleError(new Error('Unauthorized'), `Acceso denegado: El correo ${userEmail} no está registrado como administrador ni inquilino.`);
              setIsAuthenticated(false);
              setCurrentUser(null);
            }
            } // closes expenses_admins else block
          }
        }
      } else {
        if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && session === null)) {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthChange(event, session);
    });

    const handleAppUrlOpen = (data: any) => {
      logger.log('[Auth] App opened with URL:', data.url);
      if (data.url.includes('com.svpropiedades.app://login-callback')) {
        // The URL could be parsed like a normal URL
        // However, iOS/Android URLs might need manual extracting if it contains hash or search
        const urlStr = data.url.replace('#', '?'); // Convert hash to search if needed for easy parsing of PKCE
        try {
          const url = new URL(urlStr);
          const code = url.searchParams.get('code');
          if (code) {
            logger.log('[Auth] Exchanging code from native deep link');
            supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
              if (error) {
                logger.error('[Auth] PKCE code exchange failed on native:', error);
              }
            });
          } else {
            // In case it comes as a hash fragment like access_token=xxx
            const access_token = url.searchParams.get('access_token');
            const refresh_token = url.searchParams.get('refresh_token');
            if (access_token && refresh_token) {
              supabase.auth.setSession({ access_token, refresh_token });
            }
          }
        } catch (e) {
          logger.error('Error parsing deep link url', e);
        }
      }
    };

    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appUrlOpen', handleAppUrlOpen);
    }

    // detectSessionInUrl: true (in supabaseClient) handles the PKCE code exchange automatically.
    // Manually calling exchangeCodeForSession would fail because the code is already consumed.
    // Just restore any existing session on load.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        logger.error('[Auth] Error getting session:', error);
        return;
      }
      if (session) {
        handleAuthChange('INITIAL_SESSION', session);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.removeAllListeners();
      }
    };
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setAdminMode('choosing');
  }, []);

  // --- Handlers ---

  const handlePropertySelect = useCallback((property: Property) => {
    setSelectedBuilding(null);
    setSelectedProperty(property);
    setSearchResult(null);
  }, [setSearchResult]);

  const handleBuildingSelect = useCallback((buildingId: string) => {
    // Handle address-based groups (prefixed with "addr:")
    if (buildingId.startsWith('addr:')) {
      const baseAddress = buildingId.slice(5); // remove "addr:" prefix
      const groupUnits = properties.filter(
        p => !p.buildingId && p.address.split(',')[0].trim().toLowerCase() === baseAddress
      );
      if (groupUnits.length > 0) {
        const virtualBuilding: Building = {
          id: buildingId,
          address: groupUnits[0].address,
          coordinates: groupUnits[0].coordinates,
          country: groupUnits[0].country,
          currency: groupUnits[0].currency,
          imageUrl: groupUnits[0].imageUrl,
        };
        setSelectedProperty(null);
        setSelectedBuilding(virtualBuilding);
        setSearchResult(null);
      }
    } else {
      let building = buildings.find(b => b.id === buildingId);
      // Fallback: building record may not exist yet (pre-Lesson 7 buildings)
      if (!building) {
        const buildingUnits = properties.filter(p => p.buildingId === buildingId);
        if (buildingUnits.length > 0) {
          building = {
            id: buildingId,
            address: buildingUnits[0].address,
            coordinates: buildingUnits[0].coordinates,
            country: buildingUnits[0].country,
            currency: buildingUnits[0].currency,
            imageUrl: buildingUnits[0].imageUrl,
          };
        }
      }
      if (building) {
        setSelectedProperty(null);
        setSelectedBuilding(building);
        setSearchResult(null);
      }
    }
  }, [buildings, properties, setSearchResult]);

  const handleViewMetrics = useCallback(() => {
    if (selectedProperty) {
      setFinancialPropertyToOpen(selectedProperty);
      setCurrentView('FINANCE');
      setSelectedProperty(null);
    }
  }, [selectedProperty]);

  const handleOpenAddModal = useCallback(() => {
    setPropertyToEdit(null);
    setIsRestrictedEdit(false);
    setTargetBuilding(null);
    setShowPropertyModal(true);
  }, []);

  const handleOpenEditModal = useCallback((prop: Property, isRestricted: boolean = false) => {
    setPropertyToEdit(prop);
    setIsRestrictedEdit(isRestricted);
    setShowPropertyModal(true);
  }, []);

  const handleAddUnitToBuilding = useCallback((building: Building) => {
    setTargetBuilding(building);
    setPropertyToEdit(null);
    setIsRestrictedEdit(false);
    setShowPropertyModal(true);
  }, []);

  const handleSaveProperty = useCallback((savedPropOrProps: Property | Property[]) => {
    if (Array.isArray(savedPropOrProps)) {
      // Building mode: save all units + create building record
      savePropertiesData(savedPropOrProps);
      if (savedPropOrProps.length > 0 && savedPropOrProps[0].buildingId) {
        const first = savedPropOrProps[0];
        handleSaveBuilding({
          id: first.buildingId!,
          address: first.address,
          coordinates: first.coordinates,
          country: first.country,
          currency: first.currency,
          imageUrl: first.imageUrl,
        });
      }
      setShowPropertyModal(false);
      setPropertyToEdit(null);
      setTargetBuilding(null);
      setSearchResult(null);
      setSearchQuery('');
    } else {
      savePropertyData(savedPropOrProps);
      setShowPropertyModal(false);
      setPropertyToEdit(null);
      setTargetBuilding(null);
      setSearchResult(null);
      setSearchQuery('');

      if (!propertyToEdit) {
        setSelectedProperty(savedPropOrProps);
      }
    }
  }, [savePropertiesData, savePropertyData, propertyToEdit, setSearchResult, setSearchQuery, handleSaveBuilding]);

  const handleUpdateNote = useCallback((propertyId: string, newNote: string) => {
    updateNoteData(propertyId, newNote);
  }, [updateNoteData]);

  const confirmFinishMaintenance = useCallback((rating: number, speedRating: number, comment: string, cost: number) => {
    if (!finishingProperty) return;
    finishMaintenanceData(finishingProperty.id, rating, speedRating, comment, cost);
    setFinishingProperty(null);
    toast.success("Obra finalizada y calificación guardada con éxito.");
    if (selectedProperty?.id === finishingProperty.id) {
      const updated = properties.find(p => p.id === finishingProperty.id);
      if (updated) setSelectedProperty(updated);
    }
  }, [finishingProperty, finishMaintenanceData, selectedProperty, properties]);

  const handleSaveProfessional = useCallback((newPro: Professional) => {
    saveProfessionalData(newPro);
    setShowAddProModal(false);
    setProfessionalToEdit(null);
  }, [saveProfessionalData]);

  const handleEditProfessional = useCallback((pro: Professional) => {
    setProfessionalToEdit(pro);
    setShowAddProModal(true);
  }, []);

  const handleAssignProfessionalToProperty = useCallback((propertyId: string, taskDescription: string) => {
    if (!assigningProfessional) return;
    assignProfessionalData(propertyId, assigningProfessional, taskDescription);
    setAssigningProfessional(null);
    toast.success(`Asignado ${assigningProfessional.name} correctamente.`);
  }, [assigningProfessional, assignProfessionalData]);

  const handleSearchClick = useCallback(() => {
    handleSearch(searchQuery);
  }, [handleSearch, searchQuery]);

  const handleNavigateToEntity = useCallback((entityType: string, entityId: string) => {
    if (entityType === 'property') {
      const prop = properties.find(p => p.id === entityId);
      if (prop) {
        setCurrentView('MAP');
        setSelectedProperty(prop);
        // Auto-abrir edición para que pueda modificar renta/importe
        setPropertyToEdit(prop);
        setIsRestrictedEdit(false);
        setTargetBuilding(null);
        setShowPropertyModal(true);
      }
    } else if (entityType === 'tenant') {
      // Find the property linked to this tenant
      const tenant = tenants.find(t => t.id === entityId);
      if (tenant?.propertyId) {
        const prop = properties.find(p => p.id === tenant.propertyId);
        if (prop) {
          setCurrentView('MAP');
          setSelectedProperty(prop);
          setPropertyToEdit(prop);
          setIsRestrictedEdit(false);
          setTargetBuilding(null);
          setShowPropertyModal(true);
          return;
        }
      }
      setCurrentView('TENANTS');
    } else if (entityType === 'professional') {
      setCurrentView('PROFESSIONALS');
    } else if (entityType === 'maintenance_task') {
      setCurrentView('PROFESSIONALS');
    }
  }, [properties, tenants]);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'OVERVIEW':
        return (
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50 dark:bg-slate-900 transition-colors duration-500">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<div className="p-10 text-center dark:text-white">Cargando vista...</div>}>
                <OverviewView
                  onEditProperty={handleOpenEditModal}
                  properties={properties}
                  professionals={professionals}
                  maintenanceTasks={maintenanceTasks} // Pass tasks
                  onAddProperty={handleOpenAddModal}
                  onDeleteProperty={handleDeleteProperty}
                  onAddExpense={addPartialExpense}
                  onFinishMaintenance={(prop) => setFinishingProperty(prop)}
                />
              </Suspense>
            </div>
          </div>
        );
      case 'FINANCE':
        return (
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50 dark:bg-slate-900 transition-colors duration-500">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<div className="p-10 text-center dark:text-white">Cargando finanzas...</div>}>
                <FinanceView
                  properties={properties}
                  professionals={professionals}
                  maintenanceTasks={maintenanceTasks}
                  preSelectedProperty={financialPropertyToOpen}
                  onClearPreSelection={() => setFinancialPropertyToOpen(null)}
                />
              </Suspense>
            </div>
          </div>
        );
      case 'PROFESSIONALS':
        return (
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50 dark:bg-slate-900 transition-colors duration-500">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<div className="p-10 text-center dark:text-white">Cargando profesionales...</div>}>
                <ProfessionalsView
                  properties={properties}
                  professionals={professionals}
                  onAddProfessional={() => {
                    setProfessionalToEdit(null);
                    setShowAddProModal(true);
                  }}
                  onAssignProfessional={(pro) => setAssigningProfessional(pro)}
                  onDeleteProfessional={handleDeleteProfessional}
                  onEditProfessional={handleEditProfessional}
                  onFinishMaintenance={(prop) => setFinishingProperty(prop)}
                />
              </Suspense>
            </div>
          </div>
        );
      case 'TENANTS':
        return (
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50 dark:bg-slate-900 transition-colors duration-500">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<div className="p-10 text-center dark:text-white">Cargando inquilinos...</div>}>
                <TenantsView
                  tenants={tenants}
                  payments={payments}
                  properties={properties}
                  onSaveTenant={handleSaveTenant}
                  onDeleteTenant={handleDeleteTenant}
                  onRegisterPayment={handleRegisterPayment}
                  onUpdatePayment={handleUpdatePayment}
                  getTenantMetrics={getTenantMetrics}
                  maintenanceTasks={maintenanceTasks}
                  refreshData={refreshData}
                />
              </Suspense>
            </div>
          </div>
        );
      case 'REMINDERS':
        return (
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50 dark:bg-slate-900 transition-colors duration-500">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<div className="p-10 text-center dark:text-white">Cargando recordatorios...</div>}>
                <RemindersView
                  smartReminders={allReminders}
                  onAnalyzeAI={analyzeWithAI}
                  isAnalyzing={isAnalyzing}
                  lastAnalysis={lastAnalysis}
                  properties={properties}
                  tenants={tenants}
                  professionals={professionals}
                  maintenanceTasks={maintenanceTasks}
                  onNavigateToEntity={handleNavigateToEntity}
                />
              </Suspense>
            </div>
          </div>
        );
      case 'AUTOMATION':
        return (
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50 dark:bg-slate-900 transition-colors duration-500">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<div className="p-10 text-center dark:text-white">Cargando automatizaciones...</div>}>
                <AutomationView
                  rules={automationRules}
                  history={automationHistory}
                  pendingProposals={pendingProposals}
                  stats={automationStats}
                  isAnalyzing={isAutomationAnalyzing}
                  onToggleRule={toggleRule}
                  onToggleApprovalRequired={toggleApprovalRequired}
                  onUpdateConfidenceThreshold={updateConfidenceThreshold}
                  onApproveProposal={approveProposal}
                  onRejectProposal={rejectProposal}
                  onUndoExecution={undoExecution}
                  onTriggerAnalysis={() => triggerAnalysis(
                    allReminders.filter(r => !r.completed).map(r => ({
                      title: r.title, type: r.type, dueDate: r.dueDate,
                      entityType: r.entityType, entityId: r.entityId, urgency: r.urgency,
                    }))
                  )}
                  onLoadActionLogCount={loadActionLogCount}
                  properties={properties}
                  tenants={tenants}
                />
              </Suspense>
            </div>
          </div>
        );
      case 'MAP':
      default:
        return (
          <>
            <MapBoard
              properties={properties}
              onPropertySelect={handlePropertySelect}
              onBuildingSelect={handleBuildingSelect}
              center={mapCenter}
              searchResult={searchResult}
              onAddProperty={handleOpenAddModal}
            />
            {selectedBuilding && (
              <BuildingCard
                building={selectedBuilding}
                units={
                  selectedBuilding.id.startsWith('addr:')
                    ? properties.filter(p => !p.buildingId && p.address.split(',')[0].trim().toLowerCase() === selectedBuilding.id.slice(5))
                    : properties.filter(p => p.buildingId === selectedBuilding.id)
                }
                onClose={() => setSelectedBuilding(null)}
                onSelectUnit={(unit) => {
                  setPreviousBuilding(selectedBuilding);
                  setSelectedBuilding(null);
                  setSelectedProperty(unit);
                }}
                onAddUnit={handleAddUnitToBuilding}
              />
            )}
            {selectedProperty && (
              <PropertyCard
                property={selectedProperty}
                allProperties={properties}
                onClose={() => {
                  setSelectedProperty(null);
                  setPreviousBuilding(null);
                }}
                onViewDetails={handleViewMetrics}
                onEdit={handleOpenEditModal}
                onUpdateNote={handleUpdateNote}
                onFinishMaintenance={(prop) => setFinishingProperty(prop)}
                onDelete={handleDeleteProperty}
                onBack={previousBuilding ? () => {
                  setSelectedProperty(null);
                  setSelectedBuilding(previousBuilding);
                  setPreviousBuilding(null);
                } : undefined}
                professionals={professionals}
                payments={payments}
              />
            )}
          </>
        );
    }
  };

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (isLoading) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 transition-colors duration-500">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400 text-lg">Cargando datos...</p>
      </div>
    );
  }

  if (currentUser?.role === 'ADMIN' && adminMode === 'choosing') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">SV</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              Bienvenido, {currentUser.name.split(' ')[0]}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">¿Qué panel querés usar hoy?</p>
          </div>
          <button
            onClick={() => setAdminMode('admin')}
            className="w-full p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-600 transition-colors">
                <LayoutDashboard className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-white">Panel de Administración</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Propiedades, inquilinos, finanzas y mapa</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setAdminMode('expenses')}
            className="w-full p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md hover:border-violet-300 dark:hover:border-violet-500/50 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-violet-100 dark:bg-violet-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-violet-600 transition-colors">
                <FileSpreadsheet className="w-6 h-6 text-violet-600 group-hover:text-white transition-colors" />
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-white">Panel de Expensas</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Subir liquidaciones y gestionar expensas</p>
              </div>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="w-full text-center text-sm text-slate-400 hover:text-red-500 py-2 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (currentUser?.role === 'ADMIN' && adminMode === 'expenses') {
    return (
      <Suspense fallback={
        <div className="w-full h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-violet-500 border-t-transparent"></div>
        </div>
      }>
        <ExpensesAdminPortal currentUser={currentUser} onLogout={handleLogout} onSwitchMode={() => setAdminMode('choosing')} />
      </Suspense>
    );
  }

  if (currentUser?.role === 'TENANT') {
    return (
      <Suspense fallback={
        <div className="w-full h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
        </div>
      }>
        <TenantPortal currentUser={currentUser} onLogout={handleLogout} />
      </Suspense>
    );
  }

  if (currentUser?.role === 'EXPENSES_ADMIN') {
    return (
      <Suspense fallback={
        <div className="w-full h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-violet-500 border-t-transparent"></div>
        </div>
      }>
        <ExpensesAdminPortal currentUser={currentUser} onLogout={handleLogout} />
      </Suspense>
    );
  }

  return (
    <div className="relative w-full h-screen bg-gray-100 dark:bg-slate-900 overflow-hidden flex flex-col transition-colors duration-500">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentView={currentView}
        onNavigate={setCurrentView}
        onLogout={handleLogout}
        onSwitchMode={() => setAdminMode('choosing')}
        reminderCount={reminderActiveCount}
        automationCount={pendingProposals.length}
      />

      <Header
        onMenuClick={() => setIsSidebarOpen(true)}
        currentUser={currentUser}
        currentView={currentView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchClick}
        isSearching={isSearching}
        onNavigateToMap={() => {
          setCurrentView('MAP');
          setMapCenter(undefined);
          setSearchResult(null);
        }}
        reminderCount={reminderActiveCount}
        onNavigateToReminders={() => setCurrentView('REMINDERS')}
      />

      <div className="w-full h-full relative">
        {renderCurrentView()}
      </div>

      {showPropertyModal && (
        <AddPropertyModal
          address={targetBuilding ? targetBuilding.address : searchResult?.address}
          coordinates={targetBuilding ? targetBuilding.coordinates : searchResult ? [searchResult.lat, searchResult.lng] : undefined}
          existingProperty={propertyToEdit}
          isRestrictedMode={isRestrictedEdit}
          detectedCountry={targetBuilding ? targetBuilding.country : searchResult?.address ? detectCountryFromAddress(searchResult.address) : undefined}
          targetBuilding={targetBuilding || undefined}
          onClose={() => {
            setShowPropertyModal(false);
            setPropertyToEdit(null);
            setIsRestrictedEdit(false);
            setTargetBuilding(null);
          }}
          onSave={handleSaveProperty}
          onDelete={handleDeleteProperty}
          professionals={professionals}
        />
      )}

      {finishingProperty && (
        <FinishMaintenanceModal
          property={finishingProperty}
          professionalName={professionals.find(p => p.id === finishingProperty.assignedProfessionalId)?.name || 'Profesional'}
          task={maintenanceTasks.find(t => t.propertyId === finishingProperty.id && t.status !== 'COMPLETED')}
          onClose={() => setFinishingProperty(null)}
          onConfirm={confirmFinishMaintenance}
        />
      )}

      {showAddProModal && (
        <AddProfessionalModal
          onClose={() => {
            setShowAddProModal(false);
            setProfessionalToEdit(null);
          }}
          onSave={handleSaveProfessional}
          existingProfessional={professionalToEdit}
        />
      )}

      {assigningProfessional && (
        <AssignProfessionalModal
          professional={assigningProfessional}
          properties={properties}
          onClose={() => setAssigningProfessional(null)}
          onConfirm={(propertyId, taskDescription) => handleAssignProfessionalToProperty(propertyId, taskDescription)}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <DataProvider>
      <Toaster position="top-right" richColors closeButton />
      <Dashboard />
    </DataProvider>
  );
}