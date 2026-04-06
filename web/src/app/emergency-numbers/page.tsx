"use client";

import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { defaultEmergencyContacts } from "@/lib/emergencyNumbers";

export default function EmergencyNumbersPage() {
    return (
        <AppShell title="Emergency Numbers">
            <div className="emergency-page-grid">
                <SectionCard>
                    <SectionHeader
                        title="Emergency Contact List"
                        subtitle="Quick-access emergency numbers for critical situations."
                    />

                    <div className="emergency-contact-list">
                        {defaultEmergencyContacts.map((item) => (
                            <div key={item.id} className="emergency-contact-item">
                                <div className="emergency-contact-meta">
                                    <p className="emergency-contact-label">{item.label}</p>
                                    <p className="emergency-contact-subtitle">Emergency Contact</p>
                                </div>

                                <div className="emergency-contact-actions-row">
                                    <p className="emergency-contact-phone">{item.phone}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                </SectionCard>
            </div>
        </AppShell>
    );
}
