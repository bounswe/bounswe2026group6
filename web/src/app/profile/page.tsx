import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AuthRouteGate } from "@/components/auth/AuthRouteGate";
import ProfileView from "@/components/feature/profile/ProfileView";

export default function ProfilePage() {
    return (
        <Suspense>
            <AuthRouteGate mode="protected">
                <AppShell title="Profile">
                    <ProfileView />
                </AppShell>
            </AuthRouteGate>
        </Suspense>
    );
}
