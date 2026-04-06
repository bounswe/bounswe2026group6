import { Suspense } from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AuthRouteGate } from "@/components/auth/AuthRouteGate";
import { LoginForm } from "@/components/feature/auth/LoginForm";

export default function LoginPage() {
    return (
        <Suspense>
            <AuthRouteGate mode="guest-only">
                <AuthLayout
                    title="Log In"
                    subtitle="Access your NEPH account to manage your emergency information."
                >
                    <LoginForm />
                </AuthLayout>
            </AuthRouteGate>
        </Suspense>
    );
}
