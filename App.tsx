import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Toaster, toast } from 'sonner';
import { handleError } from './utils/errorHandler';
// Force Vercel Rebuild - Timestamp: 2026-02-19-1520
// Debugging Vercel Environment
console.log('[App] Starting up...');
console.log('[App] VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? 'Defined' : 'Missing');
console.log('[App] VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Defined' : 'Missing');

import MapBoard from './components/MapBoard';
import PropertyCard from './components/PropertyCard';
import VoiceAssistant from './components/VoiceAssistant';
import Sidebar, { ViewState } from './components/Sidebar';
import AuthScreen from './components/AuthScreen';
import Header from './components/Header';
import { ExpenseConfirmationModal, UpdateConfirmationModal } from './components/VoiceConfirmationModals';
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
import { useVoiceNavigation } from './hooks/useVoiceNavigation';
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
  } = useProperties(currentUser?.email || currentUser?.name);

  const {
    professionals,
    saveProfessional: saveProfessionalData,
    deleteProfessional: handleDeleteProfessional
  } = useProfessionals();

  const {
    maintenanceTasks,
    assignProfessional: assignProfessionalData,
    finishMaintenance: finishMaintenanceData,
    addPartialExpense
  } = useMaintenance(currentUser?.email || currentUser?.name);

  const {
    buildings,
    saveBuilding: handleSaveBuilding,
    deleteBuilding: handleDeleteBuilding // Note: App.tsx doesn't seem to use this widely but usePropertyData exported it
  } = useBuildings();

  // Tenant Data
  const {
    tenants,
    payments,
    handleSaveTenant,
    handleDeleteTenant,
    handleRegisterPayment,
    handleUpdatePayment,
    getTenantMetrics,
  } = useTenantData();

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
  const [finishingProperty, setFinishingProperty] = useState<Property | null>(null);
  const [showAddProModal, setShowAddProModal] = useState(false);
  const [professionalToEdit, setProfessionalToEdit] = useState<Professional | null>(null);

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

  const {
    pendingExpense,
    setPendingExpense,
    pendingUpdate,
    setPendingUpdate,
    assigningProfessional,
    setAssigningProfessional,
    handleVoiceIntent,
    confirmExpense,
    confirmUpdate
  } = useVoiceNavigation({
    properties,
    professionals,
    currentView,
    setCurrentView,
    setSelectedProperty,
    selectedProperty,
    handleOpenAddModal: () => {
      setPropertyToEdit(null);
      setShowPropertyModal(true);
    },
    setShowAddProModal,
    handleOpenFinishMaintenance: (prop) => setFinishingProperty(prop),
    updatePropertyFields,
    updateNoteData,
    performSearch: handleSearch
  });

  // --- Auth Effects ---
  useEffect(() => {
    // Listen for auth changes directly from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user && session.user.email) {
        const userEmail = session.user.email.toLowerCase();

        // Allowlist Check
        if (ALLOWED_EMAILS.includes(userEmail)) {
          setCurrentUser({
            id: session.user.id,
            name: session.user.user_metadata?.full_name || userEmail.split('@')[0],
            email: userEmail,
            photoURL: session.user.user_metadata?.avatar_url,
            color: '#3b82f6' // Default color
          });
          setIsAuthenticated(true);
        } else {
          // Deny access
          await signOut();
          handleError(new Error(`Unauthorized access attempt by ${userEmail}`), `Acceso denegado: ${userEmail} no está autorizado.`);
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
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
    setShowPropertyModal(true);
  };

  const handleOpenEditModal = (prop: Property) => {
    setPropertyToEdit(prop);
    setShowPropertyModal(true);
  };

  const handleSaveProperty = (savedPropOrProps: Property | Property[]) => {
    if (Array.isArray(savedPropOrProps)) {
      // Bulk save (Building)
      // We need to access useProperties' saveProperties which we exposed earlier
      // But destructured as undefined in the component currently. 
      // Wait, I strictly need to update the destructuring in App.tsx first or now?
      // I can assume propertyToEdit is null for bulk adds usually.
      // Let's use saveProperties directly if available, or map saveProperty.
      // Actually I exposed saveProperties in step 74.
      // I need to update the destructuring in App.tsx line 47.

      // Since I can't effectively update the destructuring AND this function in one go easily without context of line numbers changing...
      // I will assume `savePropertiesData` is available (I will add it in next tool call or this one if I can match lines).
      // Let's do a trick: I will just use savePropertyData in a loop if saveProperties isn't there, 
      // BUT I know I added saveProperties to the hook.
      // I will update the destructuring in a separate tool call to be safe.
      // For now, let's implement the logic assuming savePropertiesData exists.

      // Actually, to avoid breaking build, I will do the destructuring update in the NEXT step, 
      // and here I will just implement the logic using `savePropertiesData` which I'll alias in the destructuring next.
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
                onClose={() => setSelectedProperty(null)}
                onViewDetails={handleViewMetrics}
                onEdit={handleOpenEditModal}
                onUpdateNote={handleUpdateNote}
                onFinishMaintenance={(prop) => setFinishingProperty(prop)}
                onDelete={handleDeleteProperty}
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

      <VoiceAssistant
        properties={properties}
        professionals={professionals}
        currentView={currentView}
        selectedItem={selectedProperty || assigningProfessional}
        onIntent={handleVoiceIntent}
      />

      {showPropertyModal && (
        <AddPropertyModal
          address={searchResult?.address}
          coordinates={searchResult ? [searchResult.lat, searchResult.lng] : undefined}
          existingProperty={propertyToEdit}
          detectedCountry={searchResult?.address ? detectCountryFromAddress(searchResult.address) : undefined}
          onClose={() => {
            setShowPropertyModal(false);
            setPropertyToEdit(null);
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
          onConfirm={handleAssignProfessionalToProperty}
        />
      )}

      <ExpenseConfirmationModal
        pendingExpense={pendingExpense}
        onClose={() => setPendingExpense(null)}
        onConfirm={confirmExpense}
      />

      <UpdateConfirmationModal
        pendingUpdate={pendingUpdate}
        onClose={() => setPendingUpdate(null)}
        onConfirm={confirmUpdate}
      />
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