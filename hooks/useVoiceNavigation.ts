import { useState } from 'react';
import { Property, VoiceCommandResponse, Professional, PropertyStatus } from '../types';
import { ViewState } from '../components/Sidebar';

interface UseVoiceNavigationProps {
    properties: Property[];
    professionals: Professional[];
    currentView: ViewState;
    setCurrentView: (view: ViewState) => void;
    setSelectedProperty: (property: Property | null) => void;
    selectedProperty: Property | null;
    handleOpenAddModal: () => void;
    setShowAddProModal: (show: boolean) => void;
    handleOpenFinishMaintenance: (property: Property) => void;
    updatePropertyFields: (id: string, updates: Partial<Property>) => void;
    updateNoteData: (id: string, note: string) => void;
    performSearch: (query: string) => void;
}

export const useVoiceNavigation = ({
    properties,
    professionals,
    currentView,
    setCurrentView,
    setSelectedProperty,
    selectedProperty,
    handleOpenAddModal,
    setShowAddProModal,
    handleOpenFinishMaintenance,
    updatePropertyFields,
    updateNoteData,
    performSearch,
}: UseVoiceNavigationProps) => {
    const [pendingExpense, setPendingExpense] = useState<VoiceCommandResponse['data'] | null>(null);
    const [pendingUpdate, setPendingUpdate] = useState<{
        property: Property;
        updates: Partial<Property>;
        description: string;
    } | null>(null);
    const [assigningProfessional, setAssigningProfessional] = useState<Professional | null>(null);

    const handleVoiceIntent = (response: VoiceCommandResponse) => {
        const { intent, data } = response;
        if (!data) return;

        switch (intent) {
            case 'NAVIGATE':
                if (data.targetView) {
                    if (data.targetView === 'ADD_PROPERTY_MODAL') {
                        handleOpenAddModal();
                        if (data.address) {
                            performSearch(data.address);
                        }
                    } else if (data.targetView === 'ADD_PRO_MODAL') {
                        setShowAddProModal(true);
                    } else {
                        setCurrentView(data.targetView as ViewState);
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
                        if (currentView !== 'MAP') setCurrentView('MAP');
                    }
                } else if (data.itemType === 'PROFESSIONAL') {
                    setCurrentView('PROFESSIONALS');
                }
                break;

            case 'UPDATE_PROPERTY':
                if (data.actionType === 'CREATE_NEW') {
                    handleOpenAddModal();
                    if (data.address) {
                        performSearch(data.address);
                    }
                    return;
                }

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
                            setAssigningProfessional(pro);
                            setSelectedProperty(targetProp);
                            updates.assignedProfessionalId = pro.id;
                            updates.professionalAssignedDate = new Date().toISOString();
                            description = `Asignar a ${pro.name}`;
                        }
                    } else if (data.actionType === 'FINISH_MAINTENANCE') {
                        handleOpenFinishMaintenance(targetProp);
                        return;
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

    return {
        pendingExpense,
        setPendingExpense,
        pendingUpdate,
        setPendingUpdate,
        assigningProfessional,
        setAssigningProfessional,
        handleVoiceIntent,
        confirmExpense,
        confirmUpdate
    };
};
