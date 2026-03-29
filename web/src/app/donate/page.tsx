import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";

export default function DonatePage() {
    return (
        <AppShell title="Donate">
            <SectionCard>
                <SectionHeader
                    title="Support Preparedness Efforts"
                    subtitle="Donation integrations will be connected in a later release."
                />

                <p className="project-paragraph">
                    In upcoming versions, this page will allow secure donations to
                    support emergency education, volunteer readiness, and community
                    support activities.
                </p>

                <div className="donate-action-wrap">
                    <PrimaryButton disabled>Donation Coming Soon</PrimaryButton>
                </div>
            </SectionCard>
        </AppShell>
    );
}
