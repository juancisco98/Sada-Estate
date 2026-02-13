import React, { useState, useEffect } from 'react';
import MapBoard from './components/MapBoard';
import PropertyCard from './components/PropertyCard';
import VoiceAssistant from './components/VoiceAssistant';
import Sidebar, { ViewState } from './components/Sidebar';
import AuthScreen from './components/AuthScreen'; // Import Authentication
import Header from './components/Header';
import { ExpenseConfirmationModal, UpdateConfirmationModal } from './components/VoiceConfirmationModals';
import { OverviewView, FinanceView, ProfessionalsView } from './components/DashboardViews';
import AddPropertyModal from './components/AddPropertyModal';
import FinishMaintenanceModal from './components/FinishMaintenanceModal';
import AddProfessionalModal from './components/AddProfessionalModal';
import AssignProfessionalModal from './components/AssignProfessionalModal';
// Mock data now auto-seeded by usePropertyData hook via Supabase
import { Property, VoiceCommandResponse, Professional, PropertyStatus } from './types';
import { usePropertyData } from './hooks/usePropertyData';
import { detectCountryFromAddress } from './utils/taxConfig';

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null); // Allow flexible user object for now including mocks

  const [currentView, setCurrentView] = useState<ViewState>('MAP');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Data State

  // Data State - MOVED TO HOOK
  const {
    properties,
    professionals,
    handleSaveProperty: savePropertyData,
    handleUpdateNote: updateNoteData,
    handleSaveProfessional: saveProfessionalData,
    handleAssignProfessional: assignProfessionalData,
    handleFinishMaintenance: finishMaintenanceData,
    updatePropertyFields,
    handleDeleteProfessional,
    handleDeleteProperty,
    maintenanceTasks,
    isLoading
  } = usePropertyData(currentUser?.email || currentUser?.name);
  // Ideally currentUser should match User interface. Let's cast or fix state type.



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

  // Voice Command State
  const [pendingExpense, setPendingExpense] = useState<VoiceCommandResponse['data'] | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{
    property: Property;
    updates: Partial<Property>;
    description: string;
  } | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
  const [searchResult, setSearchResult] = useState<{ lat: number, lng: number, address: string } | null>(null);

  // Modal States
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [propertyToEdit, setPropertyToEdit] = useState<Property | null>(null);
  const [finishingProperty, setFinishingProperty] = useState<Property | null>(null);

  // New Modal States
  const [showAddProModal, setShowAddProModal] = useState(false);
  const [assigningProfessional, setAssigningProfessional] = useState<Professional | null>(null);

  // --- Auth Effects ---
  useEffect(() => {
    // Check for existing session
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
    setSearchResult(null); // Clear search result when selecting existing property
  };

  // Logic to navigate from Map Card to Finance Detail
  const handleViewMetrics = () => {
    if (selectedProperty) {
      setFinancialPropertyToOpen(selectedProperty);
      setCurrentView('FINANCE');
      setSelectedProperty(null); // Close the map card
    }
  };

  const handleVoiceIntent = (response: VoiceCommandResponse) => {
    const { intent, data } = response;
    if (!data) return;

    switch (intent) {
      case 'NAVIGATE':
        if (data.targetView) {
          if (data.targetView === 'ADD_PROPERTY_MODAL') {
            handleOpenAddModal();
            // Pre-fill address if provided
            if (data.address) {
              setSearchResult({ lat: 0, lng: 0, address: data.address }); // Mock coords if not searched
            }
          } else if (data.targetView === 'ADD_PRO_MODAL') {
            setShowAddProModal(true);
          } else {
            setCurrentView(data.targetView as ViewState);
            // Clear selection if moving to high-level views
            if (['OVERVIEW', 'MAP'].includes(data.targetView)) {
              setSelectedProperty(null);
            }
          }
        }
        break;

      case 'SEARCH_MAP':
        if (data.searchQuery) {
          performSearch(data.searchQuery);
        }
        break;

      case 'SELECT_ITEM':
        if (data.itemType === 'PROPERTY') {
          const prop = properties.find(p => p.id === data.propertyId);
          if (prop) {
            setSelectedProperty(prop);
            // If we are in Map, it centers automatically via PropertyCard? 
            // We might need to ensure view is MAP or we just select it.
            if (currentView !== 'MAP') setCurrentView('MAP'); // Auto-switch to map to show selection
          }
        } else if (data.itemType === 'PROFESSIONAL') {
          // If we had a detailed pro view, we would select it here.
          // For now, switch to Professionals view
          setCurrentView('PROFESSIONALS');
        }
        break;

      case 'UPDATE_PROPERTY':
        // Handle Creation
        if (data.actionType === 'CREATE_NEW') {
          handleOpenAddModal();
          if (data.address) {
            // We try to "search" it to get coords, or just prefill
            performSearch(data.address);
          }
          return;
        }

        // Handle Edits
        let targetProp = properties.find(p => p.id === data.propertyId);
        if (!targetProp && selectedProperty) targetProp = selectedProperty;

        if (targetProp) {
          const updates: Partial<Property> = {};
          let description = "";

          if (data.actionType === 'CHANGE_RENT' && data.newRent) {
            updates.monthlyRent = data.newRent;
            description = `Cambiar alquiler a $${data.newRent}`;
          } else if (data.actionType === 'CHANGE_TENANT' && data.newTenant) {
            updates.tenantName = data.newTenant;
            updates.status = PropertyStatus.CURRENT;
            description = `Nuevo Inquilino: ${data.newTenant}`;
          } else if (data.actionType === 'ASSIGN_PROFESSIONAL' && data.professionalName) {
            const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const pro = professionals.find(p => normalize(p.name).includes(normalize(data.professionalName!)));
            if (pro) {
              // Direct Assignment (or open modal with pre-selection)
              // Simple approach: Set state for modal
              setAssigningProfessional(pro);
              setSelectedProperty(targetProp); // Ensure property is context
              // We will need a way to trigger the assignment logic directly or via modal
              // Ideally, just set the update directly:
              updates.assignedProfessionalId = pro.id;
              updates.professionalAssignedDate = new Date().toISOString();
              description = `Asignar a ${pro.name}`;
            }
          } else if (data.actionType === 'FINISH_MAINTENANCE') {
            // Finish maintenance
            handleOpenFinishMaintenance(targetProp);
            return; // Steps handled by modal opener
          } else if (data.actionType === 'CREATE_NOTE' && data.noteContent) {
            const oldNotes = targetProp.notes || "";
            updates.notes = oldNotes ? `${oldNotes}\n- ${data.noteContent}` : `- ${data.noteContent}`;
            description = `Agregar nota: "${data.noteContent}"`;
          }

          if (Object.keys(updates).length > 0) {
            setPendingUpdate({
              property: targetProp,
              updates,
              description
            });
          }
        }
        break;

      case 'REGISTER_EXPENSE':
        if (data.amount && data.description) {
          setPendingExpense(data);
        }
        break;

      case 'CALL_CONTACT':
        if (data.phoneNumber) {
          const confirmed = window.confirm(`Llamar a ${data.contactName}?`);
          if (confirmed) window.open(`tel:${data.phoneNumber}`, '_self');
        }
        break;
    }
  };

  // Legacy handlers replaced by handleVoiceIntent, keeping logic for modals
  const confirmExpense = () => {
    alert("Gasto registrado exitosamente en la bitácora.");
    setPendingExpense(null);
  };

  const confirmUpdate = () => {
    if (pendingUpdate) {
      updatePropertyFields(pendingUpdate.property.id, pendingUpdate.updates);
      setPendingUpdate(null);
    }
  };

  // Quick Note Update Handler
  const handleUpdateNote = (propertyId: string, newNote: string) => {
    updateNoteData(propertyId, newNote);
  };

  // Finish Maintenance Handling
  const handleOpenFinishMaintenance = (property: Property) => {
    setFinishingProperty(property);
  };

  const confirmFinishMaintenance = (rating: number, speedRating: number, comment: string, cost: number) => {
    if (!finishingProperty) return;

    // Pass ratings to hook
    finishMaintenanceData(finishingProperty.id, rating, speedRating, comment, cost);

    setFinishingProperty(null);
    alert("Obra finalizada y calificación guardada con éxito.");
  };

  // Add Professional Handler
  const handleSaveProfessional = (newPro: Professional) => {
    saveProfessionalData(newPro);
    setShowAddProModal(false);
  };

  // Assign Professional Logic (from Professionals View)
  const handleAssignProfessionalToProperty = (propertyId: string, taskDescription: string) => {
    if (!assigningProfessional) return;

    assignProfessionalData(propertyId, assigningProfessional, taskDescription);

    setAssigningProfessional(null);
    alert(`Asignado ${assigningProfessional.name} correctamente.`);
  };

  // Centralized Search Logic
  const performSearch = async (query: string) => {
    if (!query) return;

    setSearchQuery(query);
    setIsSearching(true);
    setSearchResult(null);
    setSelectedProperty(null);
    setCurrentView('MAP'); // Ensure we are on Map View

    try {
      const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      let lat: number | undefined;
      let lng: number | undefined;
      let address: string | undefined;

      if (googleKey) {
        // Use Google Maps Geocoding API
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleKey}`);
        const data = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
          const result = data.results[0];
          lat = result.geometry.location.lat;
          lng = result.geometry.location.lng;
          address = result.formatted_address;
        } else {
          console.log("Google Maps Geocoding failed or returned no results:", data.status);
        }
      }

      // Fallback to Nominatim if Google fails or key is missing (and result wasn't found yet)
      if (!lat || !lng) {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await response.json();

        if (data && data.length > 0) {
          const result = data[0];
          lat = parseFloat(result.lat);
          lng = parseFloat(result.lon);
          address = result.display_name;
        }
      }

      if (lat && lng && address) {
        setMapCenter([lat, lng]);
        setSearchResult({
          lat,
          lng,
          address
        });
      } else {
        // Optional: Could add a small toast here if not found via voice
        console.log("No se encontró la dirección.");
        alert("No se encontró la dirección.");
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("Hubo un error al buscar la dirección.");
    } finally {
      setIsSearching(false);
    }
  };

  // Click Handler wrapper
  const handleSearchClick = () => {
    performSearch(searchQuery);
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
      // If new property, select it (we might need to find it by ID if we aren't careful, 
      // but here ID is generated in modal or passed. 
      // For simplicity we set it, and useEffect will sync it)
      setSelectedProperty(savedProp);
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'OVERVIEW':
        return (
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50">
            <div className="max-w-7xl mx-auto">
              <OverviewView
                onEditProperty={handleOpenEditModal}
                properties={properties}
                professionals={professionals}
                maintenanceTasks={maintenanceTasks} // Pass tasks
                onAddProperty={handleOpenAddModal}
                onDeleteProperty={handleDeleteProperty}
              />
            </div>
          </div>
        );
      case 'FINANCE':
        return (
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50">
            <div className="max-w-7xl mx-auto">
              <FinanceView
                properties={properties}
                maintenanceTasks={maintenanceTasks} // Pass tasks
                preSelectedProperty={financialPropertyToOpen}
                onClearPreSelection={() => setFinancialPropertyToOpen(null)}
              />
            </div>
          </div>
        );
      case 'PROFESSIONALS':
        return (
          <div className="h-full overflow-y-auto pt-28 px-6 bg-gray-50">
            <div className="max-w-7xl mx-auto">
              <ProfessionalsView
                properties={properties}
                professionals={professionals}
                onAddProfessional={() => setShowAddProModal(true)}
                onAssignProfessional={(pro) => setAssigningProfessional(pro)}
                onDeleteProfessional={handleDeleteProfessional}
              />
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
                onViewDetails={handleViewMetrics} // Updated Handler
                onEdit={handleOpenEditModal}
                onUpdateNote={handleUpdateNote}
                onFinishMaintenance={handleOpenFinishMaintenance}
                onDelete={handleDeleteProperty}
              />
            )}

          </>
        );
    }
  };

  // Conditional Rendering for Auth
  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  // Loading state while Supabase data loads
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
        onLogout={handleLogout} // Pass Logout Handler
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

      {/* Voice Assistant - Now Global with Search */}
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

      {/* Finish Maintenance Modal */}
      {finishingProperty && (
        <FinishMaintenanceModal
          property={finishingProperty}
          professionalName={professionals.find(p => p.id === finishingProperty.assignedProfessionalId)?.name || 'Profesional'}
          onClose={() => setFinishingProperty(null)}
          onConfirm={confirmFinishMaintenance}
        />
      )}

      {/* Add Professional Modal */}
      {showAddProModal && (
        <AddProfessionalModal
          onClose={() => setShowAddProModal(false)}
          onSave={handleSaveProfessional}
        />
      )}

      {/* Assign Professional Modal */}
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

export default App;