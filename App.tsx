import React, { useState, useEffect, Suspense, lazy } from 'react';
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
import { Property, Professional } from './types';
import { DataProvider, useDataContext } from './context/DataContext';
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
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [currentView, setCurrentView] = useState<ViewState>('MAP');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Data Hooks
  const { isLoading } = useDataContext();
  const {
    properties,
    saveProperty: savePropertyData,
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
    finishMaintenance: finishMaintenanceData
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
    const storedSession = localStorage.getItem('sada_session');
    if (storedSession) {
      setCurrentUser(JSON.parse(storedSession));
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (user: any) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('sada_session', JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('sada_session');
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

  const handleSaveProperty = (savedProp: Property) => {
    savePropertyData(savedProp);
    setShowPropertyModal(false);
    setPropertyToEdit(null);
    setSearchResult(null);
    setSearchQuery('');

    if (!propertyToEdit) {
      setSelectedProperty(savedProp);
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
    alert("Obra finalizada y calificación guardada con éxito.");
  };

  const handleSaveProfessional = (newPro: Professional) => {
    saveProfessionalData(newPro);
    setShowAddProModal(false);
  };

  const handleAssignProfessionalToProperty = (propertyId: string, taskDescription: string) => {
    if (!assigningProfessional) return;
    assignProfessionalData(propertyId, assigningProfessional, taskDescription);
    setAssigningProfessional(null);
    alert(`Asignado ${assigningProfessional.name} correctamente.`);
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
                  onAddProfessional={() => setShowAddProModal(true)}
                  onAssignProfessional={(pro) => setAssigningProfessional(pro)}
                  onDeleteProfessional={handleDeleteProfessional}
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
    return <AuthScreen onLogin={handleLogin} />;
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
          onClose={() => setFinishingProperty(null)}
          onConfirm={confirmFinishMaintenance}
        />
      )}

      {showAddProModal && (
        <AddProfessionalModal
          onClose={() => setShowAddProModal(false)}
          onSave={handleSaveProfessional}
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