import { AppShell } from "@/components/layout/AppShell";
import { AdminRouteGate } from "@/components/auth/AdminRouteGate";
import AdminEmergencyOverviewView from "@/components/feature/admin/AdminEmergencyOverviewView";

export default function AdminPage() {
    return (
        <AdminRouteGate>
            <AppShell title="Admin Dashboard">
                <AdminEmergencyOverviewView />
            </AppShell>
        </AdminRouteGate>
    );
}
