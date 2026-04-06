export type EmergencyContact = {
    id: string;
    label: string;
    phone: string;
};

export const defaultEmergencyContacts: EmergencyContact[] = [
    { id: "e-001", label: "General Emergency", phone: "112" },
    { id: "e-002", label: "AFAD Disaster and Emergency", phone: "122" },
    { id: "e-003", label: "Fire Department", phone: "110" },
    { id: "e-004", label: "Coast Guard", phone: "158" },
    { id: "e-005", label: "Forest Fire Hotline", phone: "177" },
    { id: "e-006", label: "Poison Information Center", phone: "114" },
];
