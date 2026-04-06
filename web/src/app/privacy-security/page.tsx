import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AuthRouteGate } from "@/components/auth/AuthRouteGate";
import PrivacySecurityView from "@/components/feature/settings/PrivacySecurityView";

export default function PrivacySecurityPage() {
    return (
        <Suspense>
            <AuthRouteGate mode="protected">
                <AppShell title="Privacy & Security">
                    <PrivacySecurityView />
                </AppShell>
            </AuthRouteGate>
        </Suspense>
    );
}
