import { AppShell } from "@/components/layout/AppShell";
import { AdminRouteGate } from "@/components/auth/AdminRouteGate";
import AdminDashboardSwitcher from "@/components/feature/admin/AdminDashboardSwitcher";

export default function AdminPage() {
    return (
        <AdminRouteGate>
            <AppShell title="Admin Dashboard">
                <AdminDashboardSwitcher />
            </AppShell>
        </AdminRouteGate>
    );
}
