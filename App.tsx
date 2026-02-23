import React, { useState, useEffect, Suspense, lazy, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { handleError } from './utils/errorHandler';
console.log('[App] Starting up...');

import MapBoard from './components/MapBoard';
import PropertyCard from './components/PropertyCard';
import Sidebar, { ViewState } from './components/Sidebar';
import AuthScreen from './components/AuthScreen';
import Header from './components/Header';
import AddPropertyModal from './components/AddPropertyModal';
import FinishMaintenanceModal from './components/FinishMaintenanceModal';
import AddProfessionalModal from './components/AddProfessionalModal';
import AssignProfessionalModal from './components/AssignProfessionalModal';
import { Property, Professional, User } from './types';
import { DataProvider, useDataContext } from './context/DataContext';
import { supabase, signOut } from './services/supabaseClient';
import { ALLOWED_EMAILS } from './constants';
import { useProperties } from './hooks/useProperties';
import { useProfessionals } from './hooks/useProfessionals';
import { useMaintenance } from './hooks/useMaintenance';
import { useBuildings } from './hooks/useBuildings';
import { useTenantData } from './hooks/useTenantData';
import { detectCountryFromAddress } from './utils/taxConfig';
import { useSearch } from './hooks/useSearch';

// Lazy load dashboard views
const OverviewView = lazy(() => import('./components/DashboardViews').then(module => ({ default: module.OverviewView })));
const FinanceView = lazy(() => import('./components/DashboardViews').then(module => ({ default: module.FinanceView })));
const ProfessionalsView = lazy(() => import('./components/DashboardViews').then(module => ({ default: module.ProfessionalsView })));
const TenantsView = lazy(() => import('./components/TenantsView'));

const Dashboard: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [currentView, setCurrentView] = useState<ViewState>('MAP');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Data Hooks
  const { isLoading } = useDataContext();
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

  // Selection State
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

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

      if (viewParam && ['MAP', 'OVERVIEW', 'FINANCE', 'PROFESSIONALS', 'TENANTS'].includes(viewParam)) {
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
    // Shared handler for auth changes
    const handleAuthChange = async (event: string, session: any) => {
      console.log(`[Auth] Event: ${event}`);

      if (session?.user?.email) {
        const userEmail = session.user.email.toLowerCase();
        console.log(`[Auth] User detected: ${userEmail}`);

        // Allowlist Check
        const isAllowed = ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(userEmail);
        console.log(`[Auth] Is Allowed: ${isAllowed}`);

        if (isAllowed) {
          setCurrentUser({
            id: session.user.id,
            name: session.user.user_metadata?.full_name || userEmail.split('@')[0],
            email: userEmail,
            photoURL: session.user.user_metadata?.avatar_url,
            color: '#3b82f6'
          });
          setIsAuthenticated(true);
          console.log('[Auth] ✅ User authenticated successfully');
        } else {
          console.warn(`[Auth] ❌ Unauthorized access attempt: ${userEmail}`);
          await signOut();
          handleError(new Error('Unauthorized'), `Acceso denegado: El correo ${userEmail} no está en la lista permitida.`);
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else {
        if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && session === null)) {
          console.log('[Auth] No active session / signed out');
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      }
    };

    // Listen for all auth changes FIRST (this is the single source of truth)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[Auth] onAuthStateChange fired: ${event}`);
      handleAuthChange(event, session);
    });

    // Check if we're returning from a PKCE OAuth redirect (?code= in URL)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      console.log('[Auth] Detected PKCE code in URL, exchanging for session...');
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          console.error('[Auth] PKCE code exchange failed:', error);
          handleError(error, 'Error al intercambiar código de autenticación.');
        } else {
          console.log('[Auth] ✅ PKCE code exchange successful');
          // Clean up the URL (remove ?code=... from address bar)
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState(null, '', cleanUrl);
        }
      });
    } else {
      // Check for hash-based redirect (implicit flow fallback)
      const hashParams = window.location.hash;
      const isHashRedirect = hashParams && (hashParams.includes('access_token') || hashParams.includes('error'));

      if (isHashRedirect) {
        console.log('[Auth] Detected hash-based OAuth redirect, onAuthStateChange will handle it...');
      } else {
        // Normal page load - check for existing session
        console.log('[Auth] Normal page load, checking for existing session...');
        supabase.auth.getSession().then(({ data: { session }, error }) => {
          if (error) {
            console.error('[Auth] Error getting session:', error);
            return;
          }
          if (session) {
            console.log('[Auth] Existing session found:', session.user.email);
            handleAuthChange('INITIAL_SESSION', session);
          } else {
            console.log('[Auth] No existing session.');
          }
        });
      }
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // --- Handlers ---

  const handlePropertySelect = (property: Property) => {
    setSelectedProperty(property);
    setSearchResult(null);
  };

  const handleViewMetrics = () => {
    if (selectedProperty) {
      setFinancialPropertyToOpen(selectedProperty);
      setCurrentView('FINANCE');
      setSelectedProperty(null);
    }
  };

  const handleOpenAddModal = () => {
    setPropertyToEdit(null);
    setIsRestrictedEdit(false);
    setShowPropertyModal(true);
  };

  const handleOpenEditModal = (prop: Property, isRestricted: boolean = false) => {
    setPropertyToEdit(prop);
    setIsRestrictedEdit(isRestricted);
    setShowPropertyModal(true);
  };

  const handleSaveProperty = (savedPropOrProps: Property | Property[]) => {
    if (Array.isArray(savedPropOrProps)) {
      savePropertiesData(savedPropOrProps);
      setShowPropertyModal(false);
      setPropertyToEdit(null);
      setSearchResult(null);
      setSearchQuery('');
    } else {
      // Single save
      savePropertyData(savedPropOrProps);
      setShowPropertyModal(false);
      setPropertyToEdit(null);
      setSearchResult(null);
      setSearchQuery('');

      if (!propertyToEdit) {
        setSelectedProperty(savedPropOrProps);
      }
    }
  };

  // Quick Note Update Handler
  const handleUpdateNote = (propertyId: string, newNote: string) => {
    updateNoteData(propertyId, newNote);
  };

  const confirmFinishMaintenance = (rating: number, speedRating: number, comment: string, cost: number) => {
    if (!finishingProperty) return;
    finishMaintenanceData(finishingProperty.id, rating, speedRating, comment, cost);
    setFinishingProperty(null);
    toast.success("Obra finalizada y calificación guardada con éxito.");
    // Force refresh the property in selection if it was selected
    if (selectedProperty?.id === finishingProperty.id) {
      const updated = properties.find(p => p.id === finishingProperty.id);
      if (updated) setSelectedProperty(updated);
    }
  };

  const handleSaveProfessional = (newPro: Professional) => {
    saveProfessionalData(newPro);
    setShowAddProModal(false);
    setProfessionalToEdit(null);
  };

  const handleEditProfessional = (pro: Professional) => {
    setProfessionalToEdit(pro);
    setShowAddProModal(true);
  };

  const handleAssignProfessionalToProperty = (propertyId: string, taskDescription: string) => {
    if (!assigningProfessional) return;
    assignProfessionalData(propertyId, assigningProfessional, taskDescription);
    setAssigningProfessional(null);
    toast.success(`Asignado ${assigningProfessional.name} correctamente.`);
  };

  const handleSearchClick = () => {
    handleSearch(searchQuery);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'OVERVIEW':
        return (
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<div className="p-10 text-center">Cargando vista...</div>}>
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
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<div className="p-10 text-center">Cargando finanzas...</div>}>
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
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<div className="p-10 text-center">Cargando profesionales...</div>}>
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
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<div className="p-10 text-center">Cargando inquilinos...</div>}>
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
              center={mapCenter}
              searchResult={searchResult}
              onAddProperty={handleOpenAddModal}
            />
            {selectedProperty && (
              <PropertyCard
                property={selectedProperty}
                allProperties={properties}
                onClose={() => setSelectedProperty(null)}
                onViewDetails={handleViewMetrics}
                onEdit={handleOpenEditModal}
                onUpdateNote={handleUpdateNote}
                onFinishMaintenance={(prop) => setFinishingProperty(prop)}
                onDelete={handleDeleteProperty}
                professionals={professionals}
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
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mb-4"></div>
        <p className="text-gray-600 text-lg">Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-gray-100 overflow-hidden flex flex-col">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentView={currentView}
        onNavigate={setCurrentView}
        onLogout={handleLogout}
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
      />

      <div className="w-full h-full relative z-0">
        {renderCurrentView()}
      </div>

      {showPropertyModal && (
        <AddPropertyModal
          address={searchResult?.address}
          coordinates={searchResult ? [searchResult.lat, searchResult.lng] : undefined}
          existingProperty={propertyToEdit}
          isRestrictedMode={isRestrictedEdit}
          detectedCountry={searchResult?.address ? detectCountryFromAddress(searchResult.address) : undefined}
          onClose={() => {
            setShowPropertyModal(false);
            setPropertyToEdit(null);
            setIsRestrictedEdit(false);
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
      <Dashboard />
    </DataProvider>
  );
}